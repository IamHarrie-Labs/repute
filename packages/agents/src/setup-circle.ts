/**
 * Circle Developer-Controlled Wallets — one-time setup script.
 *
 * Run this ONCE after you have your Circle API key.
 * It will:
 *   1. Generate a secure entity secret
 *   2. Register it with Circle (saves recovery file locally)
 *   3. Create a wallet set + 8 wallets (6 merchants + 2 buyers) on ARC-TESTNET
 *   4. Fund buyer wallets via Circle testnet faucet
 *   5. Update .env with all wallet IDs and addresses
 *
 * Usage:
 *   node --env-file=../../.env --experimental-strip-types src/setup-circle.ts
 *
 * Prerequisites:
 *   CIRCLE_API_KEY=<your key from https://developers.circle.com>
 *   (CIRCLE_ENTITY_SECRET will be generated and saved automatically)
 */

import "dotenv/config";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import {
  generateEntitySecret,
  registerEntitySecretCiphertext,
  initiateDeveloperControlledWalletsClient,
} from "@circle-fin/developer-controlled-wallets";
import { MERCHANT_PROFILES } from "./config.ts";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ENV_PATH      = path.resolve(__dirname, "../../../.env");
const RECOVERY_PATH = path.resolve(__dirname, "../../../circle-recovery.dat");

// ── Env helpers ───────────────────────────────────────────────────────────

function readEnv(): Record<string, string> {
  if (!fs.existsSync(ENV_PATH)) return {};
  const map: Record<string, string> = {};
  for (const line of fs.readFileSync(ENV_PATH, "utf8").split("\n")) {
    if (!line.trim() || line.trim().startsWith("#")) continue;
    const eqIdx = line.indexOf("=");
    if (eqIdx < 0) continue;
    map[line.slice(0, eqIdx).trim()] = line.slice(eqIdx + 1).trim();
  }
  return map;
}

function writeEnv(map: Record<string, string>) {
  // Preserve comment lines from original .env
  const existing = fs.existsSync(ENV_PATH) ? fs.readFileSync(ENV_PATH, "utf8") : "";
  const commentLines = existing.split("\n").filter(l => l.trim().startsWith("#") || !l.trim());
  const keyLines = Object.entries(map).map(([k, v]) => `${k}=${v}`);
  fs.writeFileSync(ENV_PATH, [...keyLines, "", ...commentLines].join("\n") + "\n");
}

// ── Main setup ────────────────────────────────────────────────────────────

async function setup() {
  console.log("╔══════════════════════════════════════════════════════════╗");
  console.log("║   Circle Developer-Controlled Wallets — Repute Setup     ║");
  console.log("╚══════════════════════════════════════════════════════════╝\n");

  const env = readEnv();

  // ── Step 1: API key check ──────────────────────────────────────────────
  if (!env.CIRCLE_API_KEY) {
    console.error("❌  CIRCLE_API_KEY is not set in .env");
    console.error("    Get yours at: https://developers.circle.com → API Keys");
    process.exit(1);
  }
  console.log("✓ API key found\n");

  // ── Step 2: Entity secret ──────────────────────────────────────────────
  let entitySecret = env.CIRCLE_ENTITY_SECRET;

  if (!entitySecret || entitySecret.length !== 64) {
    console.log("[1/4] Generating entity secret...");

    // generateEntitySecret() just prints to console — capture it
    // We generate our own 32-byte random hex directly
    const bytes = new Uint8Array(32);
    crypto.getRandomValues(bytes);
    entitySecret = Array.from(bytes).map(b => b.toString(16).padStart(2, "0")).join("");

    console.log("\n⚠️  Entity secret generated. Registering with Circle...");

    try {
      // recoveryFileDownloadPath must be a relative path — omit it and save manually
      const regResult = await registerEntitySecretCiphertext({
        apiKey: env.CIRCLE_API_KEY,
        entitySecret,
      });

      const recoveryData = regResult.data?.recoveryFile ?? "";
      if (recoveryData) fs.writeFileSync(RECOVERY_PATH, recoveryData);
      console.log(`✓ Registered! Recovery file saved: ${RECOVERY_PATH}`);
      console.log("  ⚠️  BACK UP THIS RECOVERY FILE — it's your only account recovery option.\n");
    } catch (e: any) {
      const msg = e.message ?? String(e);
      if (msg.includes("already") || msg.includes("registered") || e.response?.status === 409) {
        console.log("  (Entity secret already registered — continuing)\n");
      } else {
        console.error("❌  Registration failed:", msg);
        if (e.response?.data) console.error("    API error:", JSON.stringify(e.response.data));
        process.exit(1);
      }
    }

    env.CIRCLE_ENTITY_SECRET = entitySecret;
    writeEnv(env);
    console.log("✓ CIRCLE_ENTITY_SECRET saved to .env\n");
  } else {
    console.log("✓ Entity secret already configured\n");
  }

  // ── Step 3: Initialize client ──────────────────────────────────────────
  const client = initiateDeveloperControlledWalletsClient({
    apiKey:       env.CIRCLE_API_KEY,
    entitySecret: entitySecret,
  });

  // ── Step 4: Wallet set ─────────────────────────────────────────────────
  console.log("[2/4] Setting up wallet set...");
  let walletSetId = env.CIRCLE_WALLET_SET_ID;

  if (!walletSetId) {
    const wsRes = await client.createWalletSet({ name: "Repute Agent Wallets" });
    walletSetId = wsRes.data?.walletSet?.id;
    if (!walletSetId) {
      console.error("❌  Failed to create wallet set:", JSON.stringify(wsRes));
      process.exit(1);
    }
    env.CIRCLE_WALLET_SET_ID = walletSetId;
    writeEnv(env);
    console.log(`✓ Wallet set created: ${walletSetId}\n`);
  } else {
    console.log(`✓ Using existing wallet set: ${walletSetId}\n`);
  }

  // ── Step 5: Create wallets ─────────────────────────────────────────────
  console.log("[3/4] Creating wallets on ARC-TESTNET...");

  const agentDefs = [
    ...MERCHANT_PROFILES.map(m => ({
      key:  `MERCHANT_${m.id}`,
      name: `Repute Merchant ${m.id}: ${m.name}`,
      isBuyer: false,
    })),
    { key: "BUYER_NAIVE",  name: "Repute NaiveAgent",  isBuyer: true },
    { key: "BUYER_REPUTE", name: "Repute ReputeAgent", isBuyer: true },
  ];

  const needsWallet = agentDefs.filter(a => !env[`CIRCLE_${a.key}_WALLET_ID`]);

  if (needsWallet.length > 0) {
    const metadata = needsWallet.map(a => ({ name: a.name, refId: a.key.toLowerCase() }));
    const createRes = await client.createWallets({
      walletSetId,
      blockchains: ["ARC-TESTNET"],
      count: needsWallet.length,
      accountType: "EOA",
      metadata,
    });

    const wallets = createRes.data?.wallets ?? [];
    if (wallets.length !== needsWallet.length) {
      console.error(`❌  Expected ${needsWallet.length} wallets, got ${wallets.length}`);
      process.exit(1);
    }

    for (let i = 0; i < needsWallet.length; i++) {
      const def    = needsWallet[i];
      const wallet = wallets[i];
      env[`CIRCLE_${def.key}_WALLET_ID`]  = wallet.id;
      env[`${def.key}_ADDRESS`]            = wallet.address;
      env[`${def.key}_CIRCLE_ADDRESS`]     = wallet.address;
      console.log(`  ✓ ${def.name.padEnd(32)} ${wallet.address}`);
    }

    writeEnv(env);
    console.log();
  } else {
    console.log("  ✓ All wallets already created\n");
  }

  // ── Step 6: Fund buyer wallets via faucet ─────────────────────────────
  console.log("[4/4] Funding buyer wallets from Circle testnet faucet...");

  for (const buyer of ["BUYER_NAIVE", "BUYER_REPUTE"]) {
    const address = env[`${buyer}_ADDRESS`];
    if (!address) { console.warn(`  ⚠ No address for ${buyer} — skipping`); continue; }

    try {
      await client.requestTestnetTokens({
        address,
        blockchain: "ARC-TESTNET",
        usdc: true,
      });
      console.log(`  ✓ Funded ${buyer}: ${address.slice(0, 10)}…`);
    } catch (e: any) {
      const msg = e.response?.data?.message ?? e.message;
      console.warn(`  ⚠ Faucet for ${buyer} failed: ${msg}`);
      console.warn(`    Fund manually: send testnet USDC to ${address}`);
    }
  }

  // ── Done ──────────────────────────────────────────────────────────────
  console.log(`
╔══════════════════════════════════════════════════════════════╗
║                   Circle Setup Complete!                     ║
╠══════════════════════════════════════════════════════════════╣
║  Wallet set: ${walletSetId?.slice(0,36).padEnd(36)}  ║
╠══════════════════════════════════════════════════════════════╣
║  Merchants:                                                  ║`);

  for (const m of MERCHANT_PROFILES) {
    const addr = env[`MERCHANT_${m.id}_ADDRESS`] ?? "not set";
    console.log(`║  ${("M" + m.id + " " + m.name).padEnd(20)} ${addr.slice(0, 34).padEnd(34)}  ║`);
  }

  console.log(`║                                                              ║
║  Buyers:                                                     ║
║  NaiveAgent  ${(env.BUYER_NAIVE_ADDRESS ?? "not set").slice(0, 42).padEnd(42)}  ║
║  ReputeAgent ${(env.BUYER_REPUTE_ADDRESS ?? "not set").slice(0, 42).padEnd(42)}  ║
╠══════════════════════════════════════════════════════════════╣
║  Next steps:                                                 ║
║  1. Check buyer USDC balances (should be > 0 from faucet)   ║
║  2. Set DEMO_MODE=false in .env to enable real USDC txs      ║
║  3. Run: pnpm merchants && pnpm buyers                        ║
╚══════════════════════════════════════════════════════════════╝`);
}

setup().catch(e => {
  console.error("Setup failed:", e.message ?? e);
  process.exit(1);
});
