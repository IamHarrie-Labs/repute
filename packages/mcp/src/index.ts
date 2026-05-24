#!/usr/bin/env node
/**
 * @repute/mcp — Repute MCP Server
 *
 * Exposes Repute trust-score tools to Claude Code and any MCP-compatible
 * agent framework. Run it and add it to your claude_desktop_config.json
 * or .claude/settings.json once — then Claude can call repute_score,
 * repute_batch, repute_leaderboard, repute_stats, and repute_feed natively.
 *
 * Usage (Claude Code):
 *   Add to .claude/settings.json:
 *   {
 *     "mcpServers": {
 *       "repute": {
 *         "command": "node",
 *         "args": ["--experimental-strip-types", "/path/to/packages/mcp/src/index.ts"],
 *         "env": { "REPUTE_API_URL": "http://localhost:3001" }
 *       }
 *     }
 *   }
 *
 * Usage (standalone):
 *   REPUTE_API_URL=http://localhost:3001 node --experimental-strip-types src/index.ts
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { Repute } from "@repute/sdk";

const API_URL = process.env.REPUTE_API_URL ?? "http://localhost:3001";

const repute = new Repute({ baseUrl: API_URL });

const server = new McpServer({
  name: "repute",
  version: "0.4.1",
});

// ── Tool: repute_score ────────────────────────────────────────────────────────

server.tool(
  "repute_score",
  "Query a merchant's trust score and payment verdict before spending USDC on Arc. " +
  "Returns trust_score (0–100), verdict (SAFE_TO_PAY | CAUTION | DO_NOT_PAY), " +
  "fraud_flag, reliability_pct, avg_latency_ms, and price_per_call.",
  {
    address: z.string().describe(
      "The merchant's Arc/EVM wallet address (0x...)"
    ),
  },
  async ({ address }) => {
    try {
      const score = await repute.score(address);
      const lines = [
        `Merchant: ${score.name} (${score.address})`,
        `Verdict:  ${score.verdict}`,
        `Trust score: ${score.trust_score}/100`,
        `Reliability: ${score.reliability_pct.toFixed(1)}%`,
        `Avg latency: ${score.avg_latency_ms}ms`,
        `Price/call:  $${score.price_per_call} USDC`,
        `Total calls: ${score.total_calls}`,
        `Total volume: $${score.total_volume.toFixed(4)} USDC`,
        `Fraud flag:  ${score.fraud_flag ?? "none"}`,
        `Updated:     ${score.updated_at ? new Date(score.updated_at).toISOString() : "never"}`,
      ];

      return {
        content: [
          {
            type: "text",
            text: lines.join("\n"),
          },
          {
            type: "text",
            text: JSON.stringify(score, null, 2),
          },
        ],
      };
    } catch (err: any) {
      return {
        content: [{ type: "text", text: `Error: ${err.message}` }],
        isError: true,
      };
    }
  }
);

// ── Tool: repute_batch ────────────────────────────────────────────────────────

server.tool(
  "repute_batch",
  "Score up to 20 merchant addresses in one call. " +
  "Useful when choosing between multiple merchants — returns verdicts for all at once.",
  {
    addresses: z
      .array(z.string())
      .min(1)
      .max(20)
      .describe("Array of merchant Arc/EVM addresses (up to 20)"),
  },
  async ({ addresses }) => {
    try {
      const { scores } = await repute.batchScore(addresses);

      const rows = scores.map(s =>
        `${s.verdict.padEnd(14)} score=${String(s.trust_score).padStart(3)}  ` +
        `rel=${s.reliability_pct.toFixed(1)}%  lat=${s.avg_latency_ms}ms  ` +
        `flag=${s.fraud_flag ?? "none"}  ${s.name} (${s.address.slice(0, 10)}…)`
      );

      return {
        content: [
          {
            type: "text",
            text: `Batch scored ${scores.length} merchants:\n\n` + rows.join("\n"),
          },
          {
            type: "text",
            text: JSON.stringify(scores, null, 2),
          },
        ],
      };
    } catch (err: any) {
      return {
        content: [{ type: "text", text: `Error: ${err.message}` }],
        isError: true,
      };
    }
  }
);

// ── Tool: repute_leaderboard ──────────────────────────────────────────────────

server.tool(
  "repute_leaderboard",
  "Get all merchants sorted by trust score. " +
  "Optionally filter to only SAFE merchants (score > 75, no fraud flag). " +
  "Use this to pick the best merchant before routing a payment.",
  {
    safe_only: z
      .boolean()
      .optional()
      .describe("If true, return only merchants with score > 75 and no fraud flag"),
    limit: z
      .number()
      .int()
      .min(1)
      .max(50)
      .optional()
      .describe("Max results to return (default 10)"),
  },
  async ({ safe_only = false, limit = 10 }) => {
    try {
      const { merchants } = await repute.leaderboard();

      const filtered = safe_only
        ? merchants.filter(m => m.trust_score > 75 && !m.fraud_flag)
        : merchants;

      const top = filtered.slice(0, limit);

      const rows = top.map((m, i) =>
        `${String(i + 1).padStart(2)}. [${m.trust_score.toFixed(1).padStart(5)}] ` +
        `${m.fraud_flag ? "⚠ " : "✓ "}` +
        `${m.name.padEnd(20)}  rel=${m.reliability_pct.toFixed(1)}%  ` +
        `lat=${m.avg_latency_ms}ms  $${m.price_per_call}/call  ` +
        `${m.merchant.slice(0, 10)}…`
      );

      const header = safe_only
        ? `Top ${top.length} SAFE merchants (score > 75, no fraud):`
        : `Top ${top.length} merchants by trust score:`;

      return {
        content: [
          {
            type: "text",
            text: header + "\n\n" + rows.join("\n"),
          },
          {
            type: "text",
            text: JSON.stringify(top, null, 2),
          },
        ],
      };
    } catch (err: any) {
      return {
        content: [{ type: "text", text: `Error: ${err.message}` }],
        isError: true,
      };
    }
  }
);

// ── Tool: repute_stats ────────────────────────────────────────────────────────

server.tool(
  "repute_stats",
  "Get network-wide Repute statistics: total payments indexed, merchant count, " +
  "active fraud alerts, throughput per minute, and 24h USDC volume.",
  {},
  async () => {
    try {
      const s = await repute.stats();
      const lines = [
        `Payments indexed: ${s.total_indexed.toLocaleString()}`,
        `Merchants tracked: ${s.merchant_count}`,
        `Active fraud alerts: ${s.active_alerts}`,
        `Throughput: ${s.per_minute.toFixed(1)} payments/min`,
        `24h USDC volume: $${s.vol_24h.toFixed(4)}`,
      ];
      return {
        content: [
          { type: "text", text: lines.join("\n") },
          { type: "text", text: JSON.stringify(s, null, 2) },
        ],
      };
    } catch (err: any) {
      return {
        content: [{ type: "text", text: `Error: ${err.message}` }],
        isError: true,
      };
    }
  }
);

// ── Tool: repute_feed ─────────────────────────────────────────────────────────

server.tool(
  "repute_feed",
  "Get recent x402 payments from the Repute live feed. " +
  "Shows merchant, buyer, amount, endpoint, delivery status and trust score at time of payment.",
  {
    limit: z
      .number()
      .int()
      .min(1)
      .max(50)
      .optional()
      .describe("Number of recent payments to return (default 10)"),
  },
  async ({ limit = 10 }) => {
    try {
      const { payments } = await repute.feed(limit);
      const rows = payments.map(p => {
        const ts = new Date(p.timestamp).toISOString();
        const status = p.delivered ? "✓ delivered" : "✗ failed";
        return (
          `${ts}  ${status}  $${p.amount_usdc}  ` +
          `${p.merchant_name} (score ${p.trust_score ?? "??"})  ${p.endpoint}`
        );
      });
      return {
        content: [
          {
            type: "text",
            text: `Last ${payments.length} payments:\n\n` + rows.join("\n"),
          },
          {
            type: "text",
            text: JSON.stringify(payments, null, 2),
          },
        ],
      };
    } catch (err: any) {
      return {
        content: [{ type: "text", text: `Error: ${err.message}` }],
        isError: true,
      };
    }
  }
);

// ── Tool: repute_subscribe ────────────────────────────────────────────────────

server.tool(
  "repute_subscribe",
  "Register a webhook URL to receive fraud flag alerts from Repute. " +
  "Your URL will receive a POST request whenever a merchant is newly flagged.",
  {
    url: z.string().url().describe("The webhook endpoint to notify (must be publicly reachable)"),
    events: z
      .array(z.enum(["fraud_flag", "incident"]))
      .optional()
      .describe("Event types to subscribe to (default: both)"),
    label: z.string().optional().describe("Human-readable label for this webhook"),
  },
  async ({ url, events, label }) => {
    try {
      const reg = await repute.subscribe(url, events, label);
      return {
        content: [
          {
            type: "text",
            text: [
              `Webhook registered successfully.`,
              `ID:     ${reg.webhook_id}`,
              `URL:    ${reg.url}`,
              `Events: ${reg.events.join(", ")}`,
              ``,
              reg.message,
            ].join("\n"),
          },
        ],
      };
    } catch (err: any) {
      return {
        content: [{ type: "text", text: `Error: ${err.message}` }],
        isError: true,
      };
    }
  }
);

// ── Start ─────────────────────────────────────────────────────────────────────

const transport = new StdioServerTransport();
await server.connect(transport);
