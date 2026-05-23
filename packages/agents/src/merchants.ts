/**
 * Repute Merchant Agents — 6 autonomous HTTP services selling data on Arc testnet.
 *
 * Each merchant:
 *  • Returns 402 with payment instructions if no X-Payment-Proof header
 *  • With proof: delivers (or fails) based on its reliability profile
 *  • Reports call outcome to Repute /ingest API so scoring can track it
 *  • Has its own Arc wallet address (from .env or auto-provisioned)
 *
 * Run: node --env-file=../../.env --experimental-strip-types src/merchants.ts
 */

import "dotenv/config";
import { serve } from "@hono/node-server";
import { Hono } from "hono";
import { privateKeyToAccount } from "viem/accounts";
import { MERCHANT_PROFILES, API_BASE, DEMO_MODE } from "./config.ts";
import { publicClient } from "./arc.ts";

const USDC_ADDRESS = (
  process.env.ARC_USDC_ADDRESS ?? "0x3600000000000000000000000000000000000000"
) as `0x${string}`;

function randInt(min: number, max: number) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function sleep(ms: number) {
  return new Promise<void>((r) => setTimeout(r, ms));
}

/** Report a completed call to Repute /ingest so scoring picks it up. */
async function reportToRepute(payload: {
  tx_hash: string;
  merchant: string;
  buyer: string;
  amount_usdc: number;
  endpoint: string;
  latency_ms: number;
  delivered: boolean;
  response_valid: boolean;
}) {
  try {
    await fetch(`${API_BASE}/ingest`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
  } catch {
    // Non-fatal — scoring also reads directly from DB
  }
}

let totalServed = 0;
let totalRevenue = 0;

// ── Start each merchant ────────────────────────────────────────────────────

for (const m of MERCHANT_PROFILES) {
  // Resolve wallet address from .env
  const addrKey = `MERCHANT_${m.id}_ADDRESS`;
  const pkKey   = `MERCHANT_${m.id}_PK`;

  let merchantAddress: string;
  if (process.env[addrKey]) {
    merchantAddress = process.env[addrKey]!;
  } else if (process.env[pkKey]) {
    merchantAddress = privateKeyToAccount(process.env[pkKey] as `0x${string}`).address;
  } else {
    merchantAddress = `0x${m.id.toString().padStart(40, "0")}`;
    console.warn(`[${m.name}] No wallet configured — run: pnpm provision`);
  }

  const app = new Hono();
  let calls = 0;
  let deliveries = 0;
  let revenue = 0;

  // ── x402 payment gate ──
  app.use("*", async (c, next) => {
    if (c.req.path === "/health") { await next(); return; }
    const proof = c.req.header("X-Payment-Proof");
    if (!proof) {
      return c.json({
        error: "Payment required",
        protocol: "x402",
        version: "1.0",
        cost_usdc: m.priceUsdc,
        pay_to: merchantAddress,
        chain_id: 5042002,
        chain: "Arc Testnet",
        usdc_contract: USDC_ADDRESS,
        instructions: "Send USDC to pay_to on Arc Testnet, include tx hash in X-Payment-Proof header",
      }, 402);
    }
    await next();
  });

  // ── Data endpoint ──
  app.get("/v1/data", async (c) => {
    const proof      = c.req.header("X-Payment-Proof")!;
    const buyerHint  = c.req.header("X-Buyer-Address") ?? "0x0000000000000000000000000000000000000000";

    const start   = Date.now();
    const latency = randInt(m.latencyMs[0], m.latencyMs[1]);
    await sleep(latency);
    const actualLatency = Date.now() - start;

    calls++;
    totalServed++;

    // Ghost: takes payment, times out silently
    if ((m as any).fraudType === "ghost") {
      reportToRepute({
        tx_hash: proof, merchant: merchantAddress, buyer: buyerHint,
        amount_usdc: m.priceUsdc, endpoint: "/v1/data",
        latency_ms: actualLatency, delivered: false, response_valid: false,
      });
      return new Response(null, { status: 408 });
    }

    const delivers = Math.random() < m.reliability;
    if (!delivers) {
      reportToRepute({
        tx_hash: proof, merchant: merchantAddress, buyer: buyerHint,
        amount_usdc: m.priceUsdc, endpoint: "/v1/data",
        latency_ms: actualLatency, delivered: false, response_valid: true,
      });
      return c.json({ error: "Service temporarily unavailable" }, 503);
    }

    deliveries++;
    revenue     += m.priceUsdc;
    totalRevenue += m.priceUsdc;

    reportToRepute({
      tx_hash: proof, merchant: merchantAddress, buyer: buyerHint,
      amount_usdc: m.priceUsdc, endpoint: "/v1/data",
      latency_ms: actualLatency, delivered: true, response_valid: true,
    });

    return c.json({
      merchant:          m.name,
      merchant_address:  merchantAddress,
      data: {
        value:    parseFloat((Math.random() * 100_000).toFixed(2)),
        category: "market_data",
        ts:       Date.now(),
      },
      latency_ms:   actualLatency,
      calls_served: calls,
    });
  });

  // ── Health / stats ──
  app.get("/health", (c) => c.json({
    merchant: m.name,
    address:  merchantAddress,
    status:   "ok",
    stats: {
      calls,
      deliveries,
      reliability_pct: calls > 0 ? parseFloat(((deliveries / calls) * 100).toFixed(1)) : 100,
      revenue_usdc:    parseFloat(revenue.toFixed(6)),
    },
  }));

  serve({ fetch: app.fetch, port: m.port });

  const fraudTag = (m as any).fraudType ? ` [${((m as any).fraudType as string).toUpperCase()}]` : "";
  const rel = (m.reliability * 100).toFixed(0);
  console.log(
    `[merchant] ${m.name.padEnd(16)}  :${m.port}  ${merchantAddress.slice(0, 10)}…  rel=${rel}%  $${m.priceUsdc.toFixed(4)}${fraudTag}`
  );
}

console.log(`\n[merchants] ${MERCHANT_PROFILES.length} agents running. Mode: ${DEMO_MODE ? "DEMO (simulated)" : "LIVE (real Arc USDC)"}\n`);

setInterval(() => {
  console.log(`[merchants] served=${totalServed}  revenue=$${totalRevenue.toFixed(4)} USDC`);
}, 60_000);
