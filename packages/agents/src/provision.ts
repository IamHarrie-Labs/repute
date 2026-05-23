/**
 * Wallet provisioning script — run once before starting agents.
 * Generates private keys for all merchant + buyer wallets and saves them to .env.
 *
 * Usage: node --env-file=../../.env --experimental-strip-types src/provision.ts
 */

import "dotenv/config";
import { generatePrivateKey, privateKeyToAccount } from "viem/accounts";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { MERCHANT_PROFILES } from "./config.ts";
import { getUsdcBalance, createCircleWallet } from "./arc.ts";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ENV_PATH = path.resolve(__dirname, "../../../.env");

function readEnv(): Record<string, string> {
  const text = fs.readFileSync(ENV_PATH, "utf8");
  const map: Record<string, string> = {};
  for (const line of text.split("\n")) {
    const [k, ...rest] = line.split("=");
    if (k && !k.startsWith("#")) map[k.trim()] = rest.join("=").trim();
  }
  return map;
}

function writeEnv(map: Record<string, string>) {
  const lines = Object.entries(map).map(([k, v]) => `${k}=${v}`).join("\n");
  fs.writeFileSync(ENV_PATH, lines + "\n");
}

async function provision() {
  console.log("╔══════════════════════════════════════════╗");
  console.log("║     Repute Agent Wallet Provisioning     ║");
  console.log("╚══════════════════════════════════════════╝\n");

  const env = readEnv();
  const useCircle = !!env.CIRCLE_API_KEY;
  console.log(`Wallet mode: ${useCircle ? "Circle Developer-Controlled Wallets ✓" : "Local (viem private keys)"}`);
  if (!useCircle) {
    console.log("  → Set CIRCLE_API_KEY in .env to switch to Circle wallets\n");
  }

  const wallets: { role: string; envKey: string; address: string; privateKey?: string }[] = [];

  // ── Merchant wallets ──
  for (const m of MERCHANT_PROFILES) {
    const pkKey = `MERCHANT_${m.id}_PK`;
    const addrKey = `MERCHANT_${m.id}_ADDRESS`;

    if (useCircle) {
      const addrKeyVal = env[addrKey];
      if (addrKeyVal) {
        wallets.push({ role: `Merchant: ${m.name}`, envKey: addrKey, address: addrKeyVal });
        continue;
      }
      const w = await createCircleWallet(`Repute Merchant ${m.id}: ${m.name}`);
      if (w) {
        env[addrKey] = w.address;
        env[`CIRCLE_MERCHANT_${m.id}_WALLET_ID`] = w.id;
        wallets.push({ role: `Merchant: ${m.name}`, envKey: addrKey, address: w.address });
      }
    } else {
      let pk = env[pkKey] as `0x${string}` | undefined;
      if (!pk || !pk.startsWith("0x")) {
        pk = generatePrivateKey();
        env[pkKey] = pk;
      }
      const account = privateKeyToAccount(pk);
      env[addrKey] = account.address;
      wallets.push({ role: `Merchant: ${m.name}`, envKey: addrKey, address: account.address, privateKey: pk });
    }
  }

  // ── Buyer wallets ──
  const buyers = [
    { id: "NAIVE", label: "NaiveAgent (buyer)" },
    { id: "REPUTE", label: "ReputeAgent (buyer)" },
  ];

  for (const b of buyers) {
    const pkKey = `BUYER_${b.id}_PK`;
    const addrKey = `BUYER_${b.id}_ADDRESS`;

    if (useCircle) {
      const addrKeyVal = env[addrKey];
      if (addrKeyVal) {
        wallets.push({ role: b.label, envKey: addrKey, address: addrKeyVal });
        continue;
      }
      const w = await createCircleWallet(`Repute ${b.label}`);
      if (w) {
        env[addrKey] = w.address;
        env[`CIRCLE_BUYER_${b.id}_WALLET_ID`] = w.id;
        wallets.push({ role: b.label, envKey: addrKey, address: w.address });
      }
    } else {
      let pk = env[pkKey] as `0x${string}` | undefined;
      if (!pk || !pk.startsWith("0x")) {
        pk = generatePrivateKey();
        env[pkKey] = pk;
      }
      const account = privateKeyToAccount(pk);
      env[addrKey] = account.address;
      wallets.push({ role: b.label, envKey: addrKey, address: account.address, privateKey: pk });
    }
  }

  writeEnv(env);
  console.log("✓ Saved wallet addresses to .env\n");

  // ── Print summary ──
  console.log("┌──────────────────────────────────────────────────────────────┐");
  console.log("│                      WALLET ADDRESSES                        │");
  console.log("├──────────────────────────────────────────────────────────────┤");
  for (const w of wallets) {
    console.log(`│  ${w.role.padEnd(26)} ${w.address}  │`);
  }
  console.log("└──────────────────────────────────────────────────────────────┘\n");

  // ── Check balances ──
  console.log("Checking USDC balances on Arc testnet...");
  const buyerWallets = wallets.filter(w => w.role.includes("buyer"));
  for (const w of buyerWallets) {
    const bal = await getUsdcBalance(w.address as `0x${string}`);
    const status = bal >= 1 ? "✓ FUNDED" : "⚠ NEEDS FUNDING";
    console.log(`  ${w.role}: ${bal.toFixed(4)} USDC  [${status}]`);
  }

  console.log(`
╔══════════════════════════════════════════════════════════════════╗
║                    NEXT STEPS                                    ║
╠══════════════════════════════════════════════════════════════════╣
║  1. Fund buyer wallets with testnet USDC (5–10 USDC each):       ║
║     • Run: arc-canteen faucet <address>                           ║
║     • Or transfer from your wallet via Arc testnet explorer       ║
║                                                                  ║
║  2. Start agents:                                                 ║
║     pnpm --filter agents merchants   ← start merchant servers     ║
║     pnpm --filter agents buyers      ← start buyer agents         ║
║                                                                  ║
║  3. DEMO_MODE controls payment simulation:                        ║
║     DEMO_MODE=true  → fast simulation (no real USDC needed)       ║
║     DEMO_MODE=false → real on-chain USDC transfers on Arc         ║
╚══════════════════════════════════════════════════════════════════╝
`);
}

provision().catch(console.error);
