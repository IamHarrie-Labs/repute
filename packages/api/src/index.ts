import "dotenv/config";
import { serve } from "@hono/node-server";
import { Hono } from "hono";
import { cors } from "hono/cors";
import { logger } from "hono/logger";
import { DatabaseSync } from "node:sqlite";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DB_PATH = path.resolve(__dirname, "../../../data/receipt-layer.db");

const db = new DatabaseSync(DB_PATH);
db.exec("PRAGMA journal_mode = WAL");
db.exec("PRAGMA foreign_keys = ON");
db.exec("PRAGMA busy_timeout = 10000");
db.exec("PRAGMA cache_size = -8000");   // 8MB page cache
db.exec("PRAGMA synchronous = NORMAL"); // faster writes, safe with WAL

// Ensure tables exist (in case API starts before indexer)
db.exec(`
  CREATE TABLE IF NOT EXISTS merchants (
    address        TEXT PRIMARY KEY,
    name           TEXT,
    category       TEXT NOT NULL DEFAULT 'unknown',
    first_seen_at  INTEGER NOT NULL,
    last_active_at INTEGER NOT NULL
  );
  CREATE TABLE IF NOT EXISTS payments (
    id             INTEGER PRIMARY KEY AUTOINCREMENT,
    tx_hash        TEXT UNIQUE,
    block_number   INTEGER,
    timestamp      INTEGER NOT NULL,
    merchant       TEXT NOT NULL,
    buyer          TEXT NOT NULL,
    amount_usdc    REAL NOT NULL,
    endpoint       TEXT,
    latency_ms     INTEGER,
    delivered      INTEGER NOT NULL DEFAULT 1,
    response_valid INTEGER NOT NULL DEFAULT 1,
    chain_id       INTEGER NOT NULL DEFAULT 1,
    raw_meta       TEXT
  );
  CREATE TABLE IF NOT EXISTS scores (
    merchant        TEXT PRIMARY KEY,
    trust_score     REAL NOT NULL DEFAULT 50,
    reliability_pct REAL NOT NULL DEFAULT 100,
    avg_latency_ms  REAL NOT NULL DEFAULT 0,
    price_per_call  REAL NOT NULL DEFAULT 0,
    price_vs_median REAL NOT NULL DEFAULT 0,
    total_calls     INTEGER NOT NULL DEFAULT 0,
    total_volume    REAL NOT NULL DEFAULT 0,
    fraud_flag      TEXT,
    updated_at      INTEGER NOT NULL
  );
  CREATE TABLE IF NOT EXISTS incidents (
    id           INTEGER PRIMARY KEY AUTOINCREMENT,
    merchant     TEXT NOT NULL,
    type         TEXT NOT NULL,
    severity     TEXT NOT NULL DEFAULT 'medium',
    description  TEXT,
    evidence_tx  TEXT,
    usdc_lost    REAL NOT NULL DEFAULT 0,
    detected_at  INTEGER NOT NULL,
    resolved_at  INTEGER
  );
  CREATE INDEX IF NOT EXISTS idx_payments_merchant  ON payments(merchant);
  CREATE INDEX IF NOT EXISTS idx_payments_timestamp ON payments(timestamp);
  CREATE INDEX IF NOT EXISTS idx_incidents_merchant ON incidents(merchant);

  CREATE TABLE IF NOT EXISTS webhooks (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    url        TEXT NOT NULL,
    events     TEXT NOT NULL DEFAULT '["fraud_flag","incident"]',
    label      TEXT,
    created_at INTEGER NOT NULL,
    last_fired INTEGER,
    fail_count INTEGER NOT NULL DEFAULT 0,
    active     INTEGER NOT NULL DEFAULT 1
  );
`);

// Fix chain ID reference in x402 response
const app = new Hono();
app.use("*", logger());
app.use("*", cors());

const DEMO_MODE = process.env.DEMO_MODE === "true";
const REPUTE_WALLET = process.env.RECEIPT_LAYER_WALLET ?? "0xRepute";

// x402 payment gate — enforces cost or returns 402 with payment instructions.
// Auto-bypasses in DEMO_MODE so the dashboard and SDK work without real txs.
// When a real X-Payment-Proof is provided, logs the score query as a payment
// receipt so it appears in the live feed (the product eats its own cooking).
function x402Gate(costUsdc: number) {
  return async (c: any, next: any) => {
    const proof  = c.req.header("X-Payment-Proof");
    const bypass = c.req.header("X-Demo-Bypass");

    // Auto-bypass in demo mode
    if (DEMO_MODE || bypass) {
      await next();
      return;
    }

    if (!proof) {
      return c.json({
        error: "Payment required",
        protocol: "x402",
        cost_usdc: costUsdc,
        pay_to: REPUTE_WALLET,
        chain: "Arc Testnet · chain id 5042002",
        token: "USDC · 0x3600000000000000000000000000000000000000",
        instructions: "Transfer USDC on Arc to pay_to, then retry with X-Payment-Proof: <txHash>",
      }, 402);
    }

    // Log the paid query as a payment receipt (shows in live feed)
    const caller = c.req.header("X-Caller-Address") ?? "0xunknown";
    const now    = Date.now();
    try {
      db.prepare(`
        INSERT OR IGNORE INTO payments
          (tx_hash, block_number, timestamp, merchant, buyer, amount_usdc,
           endpoint, latency_ms, delivered, response_valid, chain_id)
        VALUES (?, NULL, ?, ?, ?, ?, ?, NULL, 1, 1, 5042002)
      `).run(proof, now, REPUTE_WALLET, caller, costUsdc, c.req.path);
    } catch { /* duplicate proof — ignore */ }

    await next();
  };
}

// ── Public routes ──────────────────────────────────────────────────────────

app.get("/health", (c) => c.json({ status: "ok", ts: Date.now() }));

app.get("/stats", (c) => {
  const total     = (db.prepare(`SELECT COUNT(*) AS n FROM payments`).get() as any).n;
  const merchants = (db.prepare(`SELECT COUNT(*) AS n FROM merchants`).get() as any).n;
  const alerts    = (db.prepare(`SELECT COUNT(*) AS n FROM incidents WHERE resolved_at IS NULL`).get() as any).n;
  const perMin    = (db.prepare(`SELECT COUNT(*) AS n FROM payments WHERE timestamp > ?`).get(Date.now() - 60000) as any).n;
  const vol24Row  = (db.prepare(`SELECT COALESCE(SUM(amount_usdc),0) AS v FROM payments WHERE timestamp > ?`).get(Date.now() - 86400000) as any);
  const vol24     = parseFloat((vol24Row?.v || 0).toFixed(4));
  return c.json({ total_indexed: total, merchant_count: merchants, active_alerts: alerts, per_minute: perMin, vol_24h: vol24 });
});

app.get("/feed", (c) => {
  const limit = Math.min(Number(c.req.query("limit") ?? 50), 200);
  const rows = db.prepare(`
    SELECT p.*, m.name AS merchant_name, m.category, s.trust_score
    FROM payments p
    LEFT JOIN merchants m ON p.merchant = m.address
    LEFT JOIN scores    s ON p.merchant = s.merchant
    ORDER BY p.timestamp DESC
    LIMIT ?
  `).all(limit);
  return c.json({ payments: rows });
});

app.get("/leaderboard", (c) => {
  const rows = db.prepare(`
    SELECT s.*, m.name, m.category, m.first_seen_at, m.last_active_at
    FROM scores s
    JOIN merchants m ON s.merchant = m.address
    ORDER BY s.trust_score DESC
  `).all();
  return c.json({ merchants: rows });
});

app.get("/incidents", (c) => {
  const rows = db.prepare(`
    SELECT i.*, m.name AS merchant_name, m.category
    FROM incidents i
    LEFT JOIN merchants m ON i.merchant = m.address
    ORDER BY i.detected_at DESC
  `).all();
  return c.json({ incidents: rows });
});

// SSE live feed — real-time stream for the dashboard
app.get("/feed/stream", (c) => {
  let lastId = (db.prepare(`SELECT MAX(id) AS id FROM payments`).get() as any)?.id ?? 0;

  const stream = new ReadableStream({
    start(controller) {
      const enc = new TextEncoder();
      const send = (data: unknown) =>
        controller.enqueue(enc.encode(`data: ${JSON.stringify(data)}\n\n`));

      const initial = db.prepare(`
        SELECT p.*, m.name AS merchant_name, m.category, s.trust_score
        FROM payments p
        LEFT JOIN merchants m ON p.merchant = m.address
        LEFT JOIN scores    s ON p.merchant = s.merchant
        WHERE p.id <= ?
        ORDER BY p.timestamp DESC LIMIT 20
      `).all(lastId);
      send({ type: "snapshot", payments: (initial as any[]).reverse() });

      const interval = setInterval(() => {
        const rows = db.prepare(`
          SELECT p.*, m.name AS merchant_name, m.category, s.trust_score
          FROM payments p
          LEFT JOIN merchants m ON p.merchant = m.address
          LEFT JOIN scores    s ON p.merchant = s.merchant
          WHERE p.id > ?
          ORDER BY p.id ASC
        `).all(lastId) as any[];

        if (rows.length > 0) {
          lastId = rows[rows.length - 1].id;
          send({ type: "payments", payments: rows });
        }
      }, 1000);

      c.req.raw.signal.addEventListener("abort", () => {
        clearInterval(interval);
        try { controller.close(); } catch {}
      });
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      "Connection": "keep-alive",
      "Access-Control-Allow-Origin": "*",
    },
  });
});

// ── Agent ingest — merchants POST call outcomes here ──────────────────────
// This complements the on-chain indexer: captures x402 metadata (endpoint,
// latency, delivery status) that can't be inferred from a USDC Transfer event.

app.post("/ingest", async (c) => {
  let body: any;
  try { body = await c.req.json(); } catch { return c.json({ error: "Invalid JSON" }, 400); }

  const { tx_hash, merchant, buyer, amount_usdc, endpoint, latency_ms, delivered, response_valid } = body;
  if (!merchant || !buyer || amount_usdc == null) {
    return c.json({ error: "merchant, buyer, amount_usdc required" }, 400);
  }

  const now = Date.now();

  // Upsert merchant record (agent merchants register themselves on first call)
  db.prepare(`
    INSERT INTO merchants (address, name, category, first_seen_at, last_active_at)
    VALUES (?, ?, 'agent', ?, ?)
    ON CONFLICT(address) DO UPDATE SET last_active_at = excluded.last_active_at
  `).run(merchant, body.merchant_name ?? merchant.slice(0, 10), now, now);

  // Insert or update payment record
  // If the indexer already captured this tx_hash, we enrich it with metadata.
  // If not yet captured (demo mode), we insert it directly.
  const existing = tx_hash
    ? db.prepare(`SELECT id FROM payments WHERE tx_hash = ?`).get(tx_hash)
    : null;

  if (existing) {
    db.prepare(`
      UPDATE payments SET
        endpoint       = COALESCE(endpoint, ?),
        latency_ms     = COALESCE(latency_ms, ?),
        delivered      = ?,
        response_valid = ?
      WHERE tx_hash = ?
    `).run(endpoint ?? null, latency_ms ?? null, delivered ? 1 : 0, response_valid ? 1 : 0, tx_hash);
  } else {
    // Demo mode or indexer hasn't caught up yet — insert full record
    const fakeTxHash = tx_hash ?? `agent-${merchant.slice(2, 8)}-${now}`;
    try {
      db.prepare(`
        INSERT INTO payments
          (tx_hash, block_number, timestamp, merchant, buyer, amount_usdc,
           endpoint, latency_ms, delivered, response_valid, chain_id)
        VALUES (?, NULL, ?, ?, ?, ?, ?, ?, ?, ?, 5042002)
      `).run(
        fakeTxHash, now, merchant, buyer,
        Number(amount_usdc),
        endpoint ?? "/v1/data",
        latency_ms ?? null,
        delivered ? 1 : 0,
        response_valid ? 1 : 0
      );
    } catch {
      // tx_hash conflict — already inserted, ignore
    }
  }

  return c.json({ ok: true });
});

// ── Agent Battle dashboard — live NaiveAgent vs ReputeAgent comparison ────
app.get("/battle", (c) => {
  const naiveAddr  = process.env.BUYER_NAIVE_ADDRESS  ?? "";
  const reputeAddr = process.env.BUYER_REPUTE_ADDRESS ?? "";

  function getBuyerStats(buyerAddr: string) {
    if (!buyerAddr) return null;
    const row = db.prepare(`
      SELECT
        COUNT(*)                                AS total_calls,
        SUM(delivered)                          AS successes,
        SUM(CASE WHEN delivered = 0 THEN 1 ELSE 0 END) AS failures,
        SUM(amount_usdc)                        AS total_spent,
        SUM(CASE WHEN delivered = 0 THEN amount_usdc ELSE 0 END) AS wasted,
        AVG(CASE WHEN delivered = 1 THEN latency_ms END) AS avg_latency
      FROM payments
      WHERE buyer = ?
    `).get(buyerAddr) as any;

    const calls    = row?.total_calls ?? 0;
    const wins     = row?.successes   ?? 0;
    const success_rate = calls > 0 ? parseFloat(((wins / calls) * 100).toFixed(1)) : 0;

    // Top 3 merchants this buyer called
    const topMerchants = db.prepare(`
      SELECT p.merchant, m.name, COUNT(*) AS calls,
             SUM(p.delivered) AS delivered,
             AVG(p.amount_usdc) AS avg_price
      FROM payments p
      LEFT JOIN merchants m ON p.merchant = m.address
      WHERE p.buyer = ?
      GROUP BY p.merchant ORDER BY calls DESC LIMIT 3
    `).all(buyerAddr) as any[];

    return {
      address:      buyerAddr,
      total_calls:  calls,
      successes:    wins,
      failures:     row?.failures    ?? 0,
      success_rate,
      total_spent:  parseFloat((row?.total_spent ?? 0).toFixed(6)),
      wasted_usdc:  parseFloat((row?.wasted      ?? 0).toFixed(6)),
      avg_latency:  row?.avg_latency ? parseFloat(row.avg_latency.toFixed(0)) : null,
      top_merchants: topMerchants,
    };
  }

  // Recent battle activity (last 50 calls from either buyer)
  const recentCalls = db.prepare(`
    SELECT p.*, m.name AS merchant_name, m.category
    FROM payments p
    LEFT JOIN merchants m ON p.merchant = m.address
    WHERE p.buyer IN (?, ?)
    ORDER BY p.timestamp DESC LIMIT 50
  `).all(naiveAddr, reputeAddr) as any[];

  return c.json({
    naive:       getBuyerStats(naiveAddr),
    repute:      getBuyerStats(reputeAddr),
    recent_calls: recentCalls,
    updated_at:  Date.now(),
  });
});

// ── Agent registry — list known agent merchants ────────────────────────────
app.get("/agents", (c) => {
  const rows = db.prepare(`
    SELECT
      m.address        AS merchant,
      m.address,
      m.name,
      m.category,
      m.first_seen_at,
      m.last_active_at,
      COALESCE(s.trust_score,     50)  AS trust_score,
      COALESCE(s.reliability_pct, 100) AS reliability_pct,
      COALESCE(s.avg_latency_ms,  0)   AS avg_latency_ms,
      COALESCE(s.price_per_call,  0)   AS price_per_call,
      COALESCE(s.total_calls,     0)   AS total_calls,
      s.fraud_flag
    FROM merchants m
    LEFT JOIN scores s ON m.address = s.merchant
    WHERE m.category = 'agent'
    ORDER BY trust_score DESC
  `).all();
  return c.json({ agents: rows });
});

// ── Paid routes (x402) ──────────────────────────────────────────────────────

app.get("/merchant/:address", x402Gate(0.0001), (c) => {
  const { address } = c.req.param();
  const merchant = db.prepare(`SELECT * FROM merchants WHERE address = ?`).get(address);
  if (!merchant) return c.json({ error: "Merchant not found" }, 404);

  const score   = db.prepare(`SELECT * FROM scores WHERE merchant = ?`).get(address);
  const recent  = db.prepare(`SELECT * FROM payments WHERE merchant = ? ORDER BY timestamp DESC LIMIT 20`).all(address);
  const incidents = db.prepare(`SELECT * FROM incidents WHERE merchant = ? ORDER BY detected_at DESC`).all(address);
  const daily   = db.prepare(`
    SELECT
      DATE(timestamp / 1000, 'unixepoch') AS day,
      COUNT(*) AS calls,
      SUM(delivered) AS delivered,
      AVG(latency_ms) AS avg_latency,
      SUM(amount_usdc) AS volume
    FROM payments
    WHERE merchant = ? AND timestamp > ?
    GROUP BY day ORDER BY day
  `).all(address, Date.now() - 30 * 86400000);

  return c.json({ merchant, score, recent_payments: recent, incidents, daily });
});

app.post("/batch-scores", x402Gate(0.0005), async (c) => {
  const { addresses } = await c.req.json<{ addresses: string[] }>();
  if (!Array.isArray(addresses) || addresses.length > 20)
    return c.json({ error: "Provide up to 20 addresses" }, 400);

  const placeholders = addresses.map(() => "?").join(",");
  const scores = db.prepare(`
    SELECT s.*, m.name, m.category
    FROM scores s JOIN merchants m ON s.merchant = m.address
    WHERE s.merchant IN (${placeholders})
  `).all(...addresses);

  return c.json({ scores });
});

// ── /score alias — cleaner URL for SDK and agents ─────────────────────────
// Identical to /merchant/:address but semantically clear that you're buying
// a score query. This is the endpoint the @repute/sdk wraps.
app.get("/score/:address", x402Gate(0.0001), (c) => {
  const { address } = c.req.param();
  const merchant  = db.prepare(`SELECT * FROM merchants WHERE address = ?`).get(address);
  if (!merchant) return c.json({ error: "Merchant not found" }, 404);
  const score     = db.prepare(`SELECT * FROM scores WHERE merchant = ?`).get(address) as any;
  return c.json({
    address,
    name:             (merchant as any).name,
    category:         (merchant as any).category,
    trust_score:      score?.trust_score     ?? 50,
    reliability_pct:  score?.reliability_pct ?? 100,
    avg_latency_ms:   score?.avg_latency_ms  ?? 0,
    price_per_call:   score?.price_per_call  ?? 0,
    total_calls:      score?.total_calls     ?? 0,
    total_volume:     score?.total_volume    ?? 0,
    fraud_flag:       score?.fraud_flag      ?? null,
    updated_at:       score?.updated_at      ?? null,
    verdict: !score?.fraud_flag && (score?.trust_score ?? 50) >= 75
      ? "SAFE_TO_PAY"
      : score?.fraud_flag
        ? "DO_NOT_PAY"
        : "CAUTION",
  });
});

// ── Webhooks ───────────────────────────────────────────────────────────────

// POST /subscribe — register a webhook URL for fraud/incident events
app.post("/subscribe", async (c) => {
  let body: any;
  try { body = await c.req.json(); } catch { return c.json({ error: "Invalid JSON" }, 400); }

  const { url, events = ["fraud_flag", "incident"], label } = body;
  if (!url || typeof url !== "string" || !url.startsWith("http")) {
    return c.json({ error: "url is required and must start with http" }, 400);
  }

  const id = (db.prepare(`
    INSERT INTO webhooks (url, events, label, created_at)
    VALUES (?, ?, ?, ?)
  `).run(url, JSON.stringify(events), label ?? null, Date.now()) as any).lastInsertRowid;

  return c.json({
    ok: true,
    webhook_id: id,
    url,
    events,
    message: "Webhook registered. You will receive POST requests when fraud is flagged.",
  });
});

// GET /subscriptions — list active webhooks
app.get("/subscriptions", (c) => {
  const rows = db.prepare(`
    SELECT id, url, events, label, created_at, last_fired, fail_count, active
    FROM webhooks WHERE active = 1 ORDER BY created_at DESC
  `).all();
  return c.json({ webhooks: rows.map((r: any) => ({ ...r, events: JSON.parse(r.events) })) });
});

// DELETE /subscribe/:id — deactivate a webhook
app.delete("/subscribe/:id", (c) => {
  const { id } = c.req.param();
  db.prepare(`UPDATE webhooks SET active = 0 WHERE id = ?`).run(id);
  return c.json({ ok: true });
});

// ── Internal: fire webhooks (called by scoring service via POST /webhooks/fire)
app.post("/webhooks/fire", async (c) => {
  let body: any;
  try { body = await c.req.json(); } catch { return c.json({ error: "bad json" }, 400); }

  const { event, payload } = body;
  if (!event || !payload) return c.json({ error: "event and payload required" }, 400);

  const hooks = db.prepare(`
    SELECT * FROM webhooks WHERE active = 1
  `).all() as any[];

  const targets = hooks.filter(h => {
    try { return JSON.parse(h.events).includes(event); } catch { return false; }
  });

  // Fire all matching webhooks (non-blocking, retry 3x)
  const now = Date.now();
  for (const hook of targets) {
    fireWebhook(hook, event, payload, now);
  }

  return c.json({ ok: true, fired: targets.length });
});

async function fireWebhook(hook: any, event: string, payload: any, now: number, attempt = 1): Promise<void> {
  try {
    const res = await fetch(hook.url, {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Repute-Event": event },
      body: JSON.stringify({ event, payload, timestamp: now, repute_version: "0.4.1" }),
      signal: AbortSignal.timeout(5000),
    });
    db.prepare(`UPDATE webhooks SET last_fired = ?, fail_count = 0 WHERE id = ?`)
      .run(now, hook.id);
    console.log(`[webhooks] fired ${event} → ${hook.url} (${res.status})`);
  } catch (e: any) {
    console.warn(`[webhooks] attempt ${attempt}/3 failed → ${hook.url}: ${e.message}`);
    db.prepare(`UPDATE webhooks SET fail_count = fail_count + 1 WHERE id = ?`).run(hook.id);
    if (attempt < 3) {
      await new Promise(r => setTimeout(r, attempt * 1000));
      await fireWebhook(hook, event, payload, now, attempt + 1);
    } else {
      // Deactivate after 3 consecutive failures accumulated over time
      const row = db.prepare(`SELECT fail_count FROM webhooks WHERE id = ?`).get(hook.id) as any;
      if (row?.fail_count >= 10) {
        db.prepare(`UPDATE webhooks SET active = 0 WHERE id = ?`).run(hook.id);
        console.warn(`[webhooks] deactivated ${hook.url} after 10 failures`);
      }
    }
  }
}

const PORT = Number(process.env.API_PORT ?? 3001);
serve({ fetch: app.fetch, port: PORT });
console.log(`[api] Receipt Layer running on http://localhost:${PORT}`);
