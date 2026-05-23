/**
 * One-time setup: generate and register an Entity Secret with Circle.
 *
 * Run: node --env-file=../../.env --experimental-strip-types src/setup-entity-secret.ts
 */

import crypto from "crypto";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { registerEntitySecretCiphertext } from "@circle-fin/developer-controlled-wallets";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ENV_PATH  = path.resolve(__dirname, "../../../.env");
const API_KEY   = process.env.CIRCLE_API_KEY ?? "";

if (!API_KEY || !API_KEY.includes(":")) {
  console.error("❌  CIRCLE_API_KEY not set or malformed in .env");
  process.exit(1);
}

const existing = process.env.CIRCLE_ENTITY_SECRET;
if (existing && existing.length === 64) {
  console.log("✓  CIRCLE_ENTITY_SECRET already set — nothing to do. Run: pnpm provision");
  process.exit(0);
}

async function setup() {
  console.log("╔══════════════════════════════════════════╗");
  console.log("║   Circle Entity Secret Setup             ║");
  console.log("╚══════════════════════════════════════════╝\n");

  // Generate a fresh cryptographically random 32-byte entity secret
  const entitySecret = crypto.randomBytes(32).toString("hex");
  console.log(`✓  Generated entity secret: ${entitySecret.slice(0, 8)}…${entitySecret.slice(-8)}`);
  console.log(`   Full secret (save this!): ${entitySecret}\n`);

  // Register with Circle — the SDK handles encryption internally
  console.log("   Registering with Circle API...");
  const result = await registerEntitySecretCiphertext({
    apiKey: API_KEY,
    entitySecret,
  });

  const recoveryFile = result?.data?.recoveryFile;
  if (recoveryFile) {
    const recoveryPath = path.resolve(__dirname, "../../../circle-recovery.dat");
    fs.writeFileSync(recoveryPath, recoveryFile);
    console.log(`✓  Recovery file saved → circle-recovery.dat (keep this safe!)`);
  }

  console.log("✓  Registered with Circle successfully\n");

  // Save entity secret to .env
  const envText = fs.readFileSync(ENV_PATH, "utf8");
  const updated = envText.replace(
    /^CIRCLE_ENTITY_SECRET=.*$/m,
    `CIRCLE_ENTITY_SECRET=${entitySecret}`
  );
  fs.writeFileSync(ENV_PATH, updated);
  console.log("✓  Saved CIRCLE_ENTITY_SECRET to .env\n");

  console.log("╔══════════════════════════════════════════╗");
  console.log("║              ALL DONE ✓                  ║");
  console.log("╠══════════════════════════════════════════╣");
  console.log("║  Next: provision Circle wallets          ║");
  console.log("║    pnpm provision                        ║");
  console.log("╚══════════════════════════════════════════╝");
}

setup().catch((e: any) => {
  console.error("\n❌  Setup failed:", e?.message ?? e);
  process.exit(1);
});
