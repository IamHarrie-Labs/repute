/**
 * Repute Buyer Agents — the core hackathon demo.
 *
 * NaiveAgent  — picks merchants at random, pays regardless of reputation.
 *               Gets rugged by ShadowAPI and Flaky Node constantly.
 *
 * ReputeAgent — queries Repute's /leaderboard before every call.
 *               Only pays merchants with trust_score > 75 and no fraud flag.
 *               Dramatically better success rate and lower wasted spend.
 *
 * Both agents:
 *  • In DEMO_MODE: generate a simulated tx hash, call merchant with it
 *  • In LIVE_MODE: actually send USDC on Arc testnet, use real tx hash
 *  • Print running P&L table every 20 calls
 *
 * Run: node --env-file=../../.env --experimental-strip-types src/buyers.ts
 */

import "dotenv/config";
import { privateKeyToAccount } from "viem/accounts";
import { MERCHANT_PROFILES, API_BASE, DEMO_MODE } from "./config.ts";
import { sendUsdc, circleTransferUsdc, waitForCircleTx } from "./arc.ts";
import { Repute, type LeaderboardEntry } from "@repute/sdk";

// Repute SDK client — used by ReputeAgent to query trust scores
const reputeClient = new Repute({ baseUrl: API_BASE });

// ── Merchant address → port mapping (built from env + config) ─────────────
function buildPortMap(): Map<string, { port: number; name: string; priceUsdc: number }> {
  const map = new Map<string, { port: number; name: string; priceUsdc: number }>();
  for (const m of MERCHANT_PROFILES) {
    const addr = process.env[`MERCHANT_${m.id}_ADDRESS`];
    if (addr) {
      map.set(addr.toLowerCase(), { port: m.port, name: m.name, priceUsdc: m.priceUsdc });
    }
    // Also map by port directly for demo mode
    map.set(`port:${m.port}`, { port: m.port, name: m.name, priceUsdc: m.priceUsdc });
  }
  return map;
}

/** ReputeAgent uses the @repute/sdk to fetch the agent leaderboard for trust routing. */
async function getAgentLeaderboard(): Promise<LeaderboardEntry[]> {
  try {
    // SDK wraps the /leaderboard endpoint — returns all merchants with scores
    const data = await reputeClient.leaderboard();
    return data.merchants as LeaderboardEntry[];
  } catch {
    return [];
  }
}

// NaiveAgent's "leaderboard" is just the full list — it ignores scores anyway
async function getAllMerchants(): Promise<LeaderboardEntry[]> {
  return getAgentLeaderboard(); // both use agent set for this demo
}

/** Call a merchant's /v1/data endpoint with payment proof. */
async function callMerchant(
  port: number,
  buyerAddress: string,
  txHash: string
): Promise<{ ok: boolean; latency: number; status: number }> {
  const start = Date.now();
  try {
    const res = await fetch(`http://localhost:${port}/v1/data`, {
      headers: {
        "X-Payment-Proof":  txHash,
        "X-Buyer-Address":  buyerAddress,
      },
      signal: AbortSignal.timeout(5000),
    });
    return { ok: res.ok, latency: Date.now() - start, status: res.status };
  } catch {
    return { ok: false, latency: Date.now() - start, status: 0 };
  }
}

/** Generate a simulated tx hash for demo mode. */
function demoTxHash(buyer: string, ts: number): string {
  return `demo-${buyer.slice(2, 10)}-${ts}`;
}

function sleep(ms: number) { return new Promise<void>((r) => setTimeout(r, ms)); }

// ── Shared stats logger ────────────────────────────────────────────────────

function printBanner(
  naiveStats: { calls: number; successes: number; spent: number; wasted: number },
  reputeStats: { calls: number; successes: number; spent: number; wasted: number }
) {
  const nRate = naiveStats.calls > 0  ? ((naiveStats.successes  / naiveStats.calls)  * 100).toFixed(1) : "0.0";
  const rRate = reputeStats.calls > 0 ? ((reputeStats.successes / reputeStats.calls) * 100).toFixed(1) : "0.0";

  console.log(`
┌────────────────────────────────────────────────────────────────┐
│                    AGENT BATTLE SCORECARD                      │
├─────────────────────────────┬──────────────────────────────────┤
│  NaiveAgent (random)        │  ReputeAgent (trust-routed)      │
├─────────────────────────────┼──────────────────────────────────┤
│  Calls:     ${String(naiveStats.calls).padEnd(16)}  │  Calls:     ${String(reputeStats.calls).padEnd(19)}  │
│  Success:   ${(nRate + "%").padEnd(16)}  │  Success:   ${(rRate + "%").padEnd(19)}  │
│  Spent:     $${naiveStats.spent.toFixed(4).padEnd(15)}  │  Spent:     $${reputeStats.spent.toFixed(4).padEnd(18)}  │
│  Wasted:    $${naiveStats.wasted.toFixed(4).padEnd(15)}  │  Wasted:    $${reputeStats.wasted.toFixed(4).padEnd(18)}  │
└─────────────────────────────┴──────────────────────────────────┘`);
}

// ── NaiveAgent ─────────────────────────────────────────────────────────────

async function naiveAgent() {
  const addrKey = process.env.BUYER_NAIVE_ADDRESS;
  const pkKey   = process.env.BUYER_NAIVE_PK as `0x${string}` | undefined;
  const myAddress = addrKey ?? (pkKey ? privateKeyToAccount(pkKey).address : "0xNaive000000000000000000000000000000000000");

  let calls = 0, successes = 0, spent = 0, wasted = 0;

  console.log(`[NaiveAgent]  starting — address: ${myAddress.slice(0,10)}… — picking merchants at RANDOM`);
  console.log(`[NaiveAgent]  mode: ${DEMO_MODE ? "DEMO" : "LIVE Arc USDC"}`);

  // Get all available merchants with ports
  const allPorts = MERCHANT_PROFILES.map(m => ({
    port: m.port,
    name: m.name,
    priceUsdc: m.priceUsdc,
    address: process.env[`MERCHANT_${m.id}_ADDRESS`] ?? `0x${m.id.toString().padStart(40,"0")}`,
  }));

  while (true) {
    // Random merchant selection — no intelligence
    const pick = allPorts[Math.floor(Math.random() * allPorts.length)];
    const ts   = Date.now();

    let txHash: string;
    if (!DEMO_MODE) {
      // Real on-chain USDC transfer — prefer Circle wallet, fall back to local PK
      const circleWalletId = process.env.CIRCLE_BUYER_NAIVE_WALLET_ID;
      try {
        if (circleWalletId) {
          const txId = await circleTransferUsdc(circleWalletId, pick.address, pick.priceUsdc);
          if (!txId) throw new Error("Circle transfer returned null");
          const state = await waitForCircleTx(txId, 20_000);
          if (state === "FAILED") throw new Error("Circle tx FAILED");
          txHash = txId;
          console.log(`[NaiveAgent]  → Circle sent $${pick.priceUsdc} USDC to ${pick.name} — txId: ${txHash.slice(0, 14)}…`);
        } else if (pkKey) {
          txHash = await sendUsdc(pkKey, pick.address as `0x${string}`, pick.priceUsdc);
          console.log(`[NaiveAgent]  → sent $${pick.priceUsdc} USDC to ${pick.name} — tx: ${txHash.slice(0, 14)}…`);
        } else {
          throw new Error("No Circle wallet ID or private key for NaiveAgent");
        }
      } catch (e: any) {
        console.warn(`[NaiveAgent]  tx failed: ${e.message}`);
        await sleep(3000);
        continue;
      }
    } else {
      txHash = demoTxHash(myAddress, ts);
    }

    const result = await callMerchant(pick.port, myAddress, txHash);
    calls++;
    spent += pick.priceUsdc;

    if (result.ok) {
      successes++;
      console.log(`[NaiveAgent]  ✓ ${pick.name.padEnd(16)}  latency=${result.latency}ms  success=${((successes/calls)*100).toFixed(1)}%  spent=$${spent.toFixed(4)}`);
    } else {
      wasted += pick.priceUsdc;
      console.log(`[NaiveAgent]  ✗ ${pick.name.padEnd(16)}  status=${result.status}  success=${((successes/calls)*100).toFixed(1)}%  wasted=$${wasted.toFixed(4)}`);
    }

    // Report every 20 calls
    if (calls % 20 === 0) {
      (global as any).__naiveStats = { calls, successes, spent, wasted };
      const rs = (global as any).__reputeStats ?? { calls: 0, successes: 0, spent: 0, wasted: 0 };
      printBanner({ calls, successes, spent, wasted }, rs);
    }

    await sleep(2500 + Math.random() * 1000);
  }
}

// ── ReputeAgent ────────────────────────────────────────────────────────────

async function reputeAgent() {
  const addrKey = process.env.BUYER_REPUTE_ADDRESS;
  const pkKey   = process.env.BUYER_REPUTE_PK as `0x${string}` | undefined;
  const myAddress = addrKey ?? (pkKey ? privateKeyToAccount(pkKey).address : "0xRepute00000000000000000000000000000000000");

  let calls = 0, successes = 0, spent = 0, wasted = 0;
  let leaderboard: LeaderboardEntry[] = [];
  let lastRefresh = 0;

  // Port map for resolving merchant address → port
  const portMap = buildPortMap();

  console.log(`[ReputeAgent] starting — address: ${myAddress.slice(0,10)}… — routing by TRUST SCORE`);
  console.log(`[ReputeAgent] mode: ${DEMO_MODE ? "DEMO" : "LIVE Arc USDC"}`);

  // Wait for merchants to be scored (scoring runs every 30s with 5s initial delay)
  console.log("[ReputeAgent] waiting 10s for initial scores to populate…");
  await sleep(10_000);

  while (true) {
    // Refresh leaderboard every 30s
    if (Date.now() - lastRefresh > 30_000) {
      leaderboard = await getAgentLeaderboard();
      lastRefresh = Date.now();

      if (leaderboard.length > 0) {
        const best = leaderboard.filter(m => m.trust_score > 75 && !m.fraud_flag);
        console.log(`[ReputeAgent] leaderboard refreshed — ${leaderboard.length} agents, ${best.length} trusted`);
      }
    }

    // ── TRUST ROUTING ALGORITHM ──
    // Filter: only merchants with score > 75 and no fraud flag
    const trusted = leaderboard
      .filter(m => m.trust_score > 75 && !m.fraud_flag)
      .sort((a, b) => {
        // Weighted score: trust (60%) + latency efficiency (40%)
        const scoreA = a.trust_score * 0.6 + Math.max(0, 100 - (a.avg_latency_ms ?? 500) / 20) * 0.4;
        const scoreB = b.trust_score * 0.6 + Math.max(0, 100 - (b.avg_latency_ms ?? 500) / 20) * 0.4;
        return scoreB - scoreA;
      });

    if (trusted.length === 0) {
      // No trusted merchants yet — fall back to first in config (PriceFeed Pro, most reliable)
      const fallback = MERCHANT_PROFILES[0];
      const fallbackAddr = process.env[`MERCHANT_${fallback.id}_ADDRESS`];
      if (!fallbackAddr) { await sleep(3000); continue; }
      trusted.push({
        merchant: fallbackAddr,
        name: fallback.name,
        trust_score: 50,
        fraud_flag: null,
        reliability_pct: 99,
        avg_latency_ms: 100,
        price_per_call: fallback.priceUsdc,
      });
    }

    // Pick the best trusted merchant that has a local port
    let portEntry: { port: number; name: string; priceUsdc: number } | undefined;
    let pick: LeaderboardEntry | undefined;
    for (const candidate of trusted) {
      const found = portMap.get(candidate.merchant.toLowerCase())
        ?? portMap.get(`port:${MERCHANT_PROFILES.find(m => m.name === candidate.name)?.port}`);
      if (found) { portEntry = found; pick = candidate; break; }
    }

    if (!portEntry || !pick) {
      // No known local merchants available — wait for scoring cycle
      await sleep(5000);
      continue;
    }

    const ts  = Date.now();
    let txHash: string;

    if (!DEMO_MODE) {
      const circleWalletId = process.env.CIRCLE_BUYER_REPUTE_WALLET_ID;
      try {
        if (circleWalletId) {
          const txId = await circleTransferUsdc(circleWalletId, pick.merchant, portEntry.priceUsdc);
          if (!txId) throw new Error("Circle transfer returned null");
          const state = await waitForCircleTx(txId, 20_000);
          if (state === "FAILED") throw new Error("Circle tx FAILED");
          txHash = txId;
          console.log(`[ReputeAgent] → Circle sent $${portEntry.priceUsdc} USDC to ${pick.name} — txId: ${txHash.slice(0, 14)}…`);
        } else if (pkKey) {
          txHash = await sendUsdc(pkKey, pick.merchant as `0x${string}`, portEntry.priceUsdc);
          console.log(`[ReputeAgent] → sent $${portEntry.priceUsdc} USDC to ${pick.name} — tx: ${txHash.slice(0, 14)}…`);
        } else {
          throw new Error("No Circle wallet ID or private key for ReputeAgent");
        }
      } catch (e: any) {
        console.warn(`[ReputeAgent] tx failed: ${e.message}`);
        await sleep(3000);
        continue;
      }
    } else {
      txHash = demoTxHash(myAddress, ts);
    }

    const result = await callMerchant(portEntry.port, myAddress, txHash);
    calls++;
    spent += portEntry.priceUsdc;

    if (result.ok) {
      successes++;
      console.log(
        `[ReputeAgent] ✓ ${pick.name.padEnd(16)}  score=${pick.trust_score.toFixed(1).padStart(5)}  latency=${result.latency}ms  success=${((successes/calls)*100).toFixed(1)}%  spent=$${spent.toFixed(4)}`
      );
    } else {
      wasted += portEntry.priceUsdc;
      console.log(
        `[ReputeAgent] ✗ ${pick.name.padEnd(16)}  score=${pick.trust_score.toFixed(1).padStart(5)}  status=${result.status}  success=${((successes/calls)*100).toFixed(1)}%  wasted=$${wasted.toFixed(4)}`
      );

      // Score dropped below threshold mid-call? Refresh immediately
      if (result.status === 503 || result.status === 408) {
        lastRefresh = 0;
      }
    }

    if (calls % 20 === 0) {
      (global as any).__reputeStats = { calls, successes, spent, wasted };
      const ns = (global as any).__naiveStats ?? { calls: 0, successes: 0, spent: 0, wasted: 0 };
      printBanner(ns, { calls, successes, spent, wasted });
    }

    await sleep(2000 + Math.random() * 800);
  }
}

// ── Run both concurrently ──────────────────────────────────────────────────

console.log("╔══════════════════════════════════════════════╗");
console.log("║         Repute — Agent Battle Starting       ║");
console.log("║   NaiveAgent  vs  ReputeAgent on Arc         ║");
console.log("╚══════════════════════════════════════════════╝\n");

Promise.all([naiveAgent(), reputeAgent()]).catch(console.error);
