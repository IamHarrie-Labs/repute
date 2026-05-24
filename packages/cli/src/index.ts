#!/usr/bin/env node
/**
 * @repute/cli — Query Repute trust scores from the terminal.
 *
 * Usage:
 *   npx @repute/cli score   <address>
 *   npx @repute/cli batch   <addr1> <addr2> ...
 *   npx @repute/cli board   [--safe] [--limit N]
 *   npx @repute/cli stats
 *   npx @repute/cli feed    [--limit N]
 *
 * Options:
 *   --api   Base URL of the Repute API (default: http://localhost:3001)
 *   --json  Output raw JSON instead of formatted text
 */

import { Repute } from "@repute/sdk";

// ── ANSI colours (no deps) ─────────────────────────────────────────────────

const c = {
  reset:  "\x1b[0m",
  bold:   "\x1b[1m",
  dim:    "\x1b[2m",
  green:  "\x1b[32m",
  yellow: "\x1b[33m",
  red:    "\x1b[31m",
  cyan:   "\x1b[36m",
  white:  "\x1b[97m",
  gray:   "\x1b[90m",
};

function paint(col: string, text: string) { return col + text + c.reset; }
function bold(t: string)  { return paint(c.bold, t); }
function dim(t: string)   { return paint(c.dim + c.gray, t); }
function green(t: string) { return paint(c.green, t); }
function yellow(t: string){ return paint(c.yellow, t); }
function red(t: string)   { return paint(c.red, t); }
function cyan(t: string)  { return paint(c.cyan, t); }

function verdictColor(v: string) {
  if (v === "SAFE_TO_PAY") return green(v);
  if (v === "DO_NOT_PAY")  return red(v);
  return yellow(v);
}

function bar(pct: number, width = 20): string {
  const filled = Math.round((pct / 100) * width);
  const col = pct >= 75 ? c.green : pct >= 50 ? c.yellow : c.red;
  return col + "█".repeat(filled) + c.reset + c.dim + "░".repeat(width - filled) + c.reset;
}

// ── Arg parsing ────────────────────────────────────────────────────────────

const args = process.argv.slice(2);
const cmd  = args[0];

function flag(name: string): string | undefined {
  const i = args.indexOf(`--${name}`);
  return i !== -1 ? args[i + 1] : undefined;
}

function hasFlag(name: string): boolean {
  return args.includes(`--${name}`);
}

const API_URL   = flag("api")   ?? process.env.REPUTE_API_URL ?? "http://localhost:3001";
const JSON_MODE = hasFlag("json");
const repute    = new Repute({ baseUrl: API_URL });

// ── Commands ───────────────────────────────────────────────────────────────

async function cmdScore() {
  const address = args[1];
  if (!address) {
    console.error(red("Error: ") + "address required\n  " + dim("repute score <0x...>"));
    process.exit(1);
  }

  process.stdout.write(dim(`Querying ${API_URL}/score/${address}…\n`));
  const s = await repute.score(address);

  if (JSON_MODE) { console.log(JSON.stringify(s, null, 2)); return; }

  console.log();
  console.log(bold("  " + s.name) + "  " + dim(s.address));
  console.log();
  console.log("  Verdict     " + verdictColor(s.verdict));
  console.log(`  Trust       ${bar(s.trust_score)}  ${bold(String(s.trust_score))}/100`);
  console.log(`  Reliability ${bar(s.reliability_pct)}  ${s.reliability_pct.toFixed(1)}%`);
  console.log(`  Latency     ${s.avg_latency_ms}ms`);
  console.log(`  Price       $${s.price_per_call} USDC / call`);
  console.log(`  Volume      $${s.total_volume.toFixed(4)} USDC (${s.total_calls} calls)`);
  console.log(`  Fraud flag  ${s.fraud_flag ? red(s.fraud_flag) : green("none")}`);
  console.log(`  Category    ${s.category}`);
  console.log();
}

async function cmdBatch() {
  const addrs = args.slice(1).filter(a => !a.startsWith("--"));
  if (!addrs.length) {
    console.error(red("Error: ") + "at least one address required");
    process.exit(1);
  }

  process.stdout.write(dim(`Batch scoring ${addrs.length} address${addrs.length > 1 ? "es" : ""}…\n`));
  const { scores } = await repute.batchScore(addrs);

  if (JSON_MODE) { console.log(JSON.stringify(scores, null, 2)); return; }

  console.log();
  for (const s of scores) {
    const flag = s.fraud_flag ? red(` ⚠ ${s.fraud_flag}`) : "";
    console.log(
      `  ${verdictColor(s.verdict).padEnd(22)}  ` +
      `${bar(s.trust_score, 12)} ${bold(String(s.trust_score).padStart(3))}  ` +
      `${s.name.padEnd(20)}${flag}  ` +
      dim(s.address.slice(0, 14) + "…")
    );
  }
  console.log();
}

async function cmdBoard() {
  const safe  = hasFlag("safe");
  const limit = parseInt(flag("limit") ?? "10", 10);

  process.stdout.write(dim(`Fetching leaderboard${safe ? " (safe only)" : ""}…\n`));
  const { merchants } = await repute.leaderboard();

  const list = safe
    ? merchants.filter(m => m.trust_score > 75 && !m.fraud_flag)
    : merchants;

  const top = list.slice(0, limit);

  if (JSON_MODE) { console.log(JSON.stringify(top, null, 2)); return; }

  console.log();
  console.log(
    dim("  #   Score              Merchant             Rel      Lat    Price/call  Address")
  );
  console.log(dim("  " + "─".repeat(92)));

  top.forEach((m, i) => {
    const flag = m.fraud_flag ? red(" ⚠") : green(" ✓");
    console.log(
      `  ${String(i + 1).padStart(2)}.${flag}  ` +
      `${bar(m.trust_score, 12)} ${bold(m.trust_score.toFixed(1).padStart(5))}  ` +
      `${m.name.padEnd(20)}  ` +
      `${m.reliability_pct.toFixed(1).padStart(5)}%  ` +
      `${String(m.avg_latency_ms).padStart(5)}ms  ` +
      `$${m.price_per_call}/call  ` +
      dim(m.merchant.slice(0, 10) + "…")
    );
  });
  console.log();
  if (safe) console.log(dim(`  ${top.length} trusted merchants (score > 75, no fraud flag)\n`));
}

async function cmdStats() {
  process.stdout.write(dim("Fetching network stats…\n"));
  const s = await repute.stats();

  if (JSON_MODE) { console.log(JSON.stringify(s, null, 2)); return; }

  console.log();
  console.log(`  ${bold("Payments indexed")}   ${cyan(s.total_indexed.toLocaleString())}`);
  console.log(`  ${bold("Merchants tracked")}  ${cyan(String(s.merchant_count))}`);
  console.log(`  ${bold("Active alerts")}      ${s.active_alerts > 0 ? red(String(s.active_alerts)) : green("0")}`);
  console.log(`  ${bold("Throughput")}         ${s.per_minute.toFixed(1)} payments/min`);
  console.log(`  ${bold("24h volume")}         $${s.vol_24h.toFixed(4)} USDC`);
  console.log();
}

async function cmdFeed() {
  const limit = parseInt(flag("limit") ?? "10", 10);

  process.stdout.write(dim(`Fetching last ${limit} payments…\n`));
  const { payments } = await repute.feed(limit);

  if (JSON_MODE) { console.log(JSON.stringify(payments, null, 2)); return; }

  console.log();
  console.log(dim("  Time                  Status       Amount    Merchant              Score  Endpoint"));
  console.log(dim("  " + "─".repeat(92)));

  for (const p of payments) {
    const ts = new Date(p.timestamp).toISOString().replace("T", " ").slice(0, 19);
    const ok = p.delivered ? green("✓ delivered") : red("✗ failed   ");
    const score = p.trust_score != null ? String(Math.round(p.trust_score)).padStart(3) : " ??";
    console.log(
      `  ${dim(ts)}  ${ok}  $${String(p.amount_usdc).padEnd(8)}  ` +
      `${p.merchant_name.padEnd(20)}  ${score}  ${dim(p.endpoint)}`
    );
  }
  console.log();
}

function printHelp() {
  console.log(`
${bold("repute")} — Trust scores for autonomous agent commerce on Arc

${bold("Usage:")}
  repute score  ${cyan("<address>")}                   Full trust profile
  repute batch  ${cyan("<addr1> <addr2> ...")}         Score up to 20 addresses
  repute board  ${cyan("[--safe] [--limit N]")}        Merchant leaderboard
  repute stats                               Network totals
  repute feed   ${cyan("[--limit N]")}                 Recent indexed payments

${bold("Options:")}
  --api   <url>   Repute API base URL  ${dim("(default: http://localhost:3001)")}
  --json          Output raw JSON
  --safe          board: filter to score > 75, no fraud flag only
  --limit <n>     board / feed: max results to return

${bold("Examples:")}
  repute score 0x15481D7B...
  repute board --safe --limit 5
  repute feed --limit 20 --json
  repute batch 0xABC... 0xDEF... 0x123...
  repute stats --api https://repute.xyz
`);
}

// ── Dispatch ───────────────────────────────────────────────────────────────

async function main() {
  try {
    switch (cmd) {
      case "score":  await cmdScore(); break;
      case "batch":  await cmdBatch(); break;
      case "board":
      case "leaderboard": await cmdBoard(); break;
      case "stats":  await cmdStats(); break;
      case "feed":   await cmdFeed();  break;
      default:       printHelp();
    }
  } catch (err: any) {
    const msg = err?.body?.error ?? err?.message ?? "Unknown error";
    console.error(red("Error: ") + msg);
    if (err?.status === 402) {
      console.error(dim("  This endpoint requires a payment proof (x402)."));
      console.error(dim("  Set DEMO_MODE=true on the API for local testing."));
    }
    process.exit(1);
  }
}

main();
