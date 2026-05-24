import "dotenv/config";
import { DatabaseSync } from "node:sqlite";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DB_PATH = process.env.DATA_DIR
  ? path.join(process.env.DATA_DIR, "receipt-layer.db")
  : path.resolve(__dirname, "../../../data/receipt-layer.db");

const db = new DatabaseSync(DB_PATH);
// WAL is already set by the indexer and persists; just set timeout
db.exec("PRAGMA busy_timeout = 5000");

// Ensure tables exist before querying (scoring may start before indexer)
db.exec(`
  CREATE TABLE IF NOT EXISTS merchants (
    address TEXT PRIMARY KEY, name TEXT,
    category TEXT NOT NULL DEFAULT 'unknown',
    first_seen_at INTEGER NOT NULL DEFAULT 0,
    last_active_at INTEGER NOT NULL DEFAULT 0
  );
  CREATE TABLE IF NOT EXISTS payments (
    id INTEGER PRIMARY KEY AUTOINCREMENT, tx_hash TEXT UNIQUE,
    block_number INTEGER, timestamp INTEGER NOT NULL,
    merchant TEXT NOT NULL, buyer TEXT NOT NULL,
    amount_usdc REAL NOT NULL, endpoint TEXT,
    latency_ms INTEGER, delivered INTEGER NOT NULL DEFAULT 1,
    response_valid INTEGER NOT NULL DEFAULT 1,
    chain_id INTEGER NOT NULL DEFAULT 1, raw_meta TEXT
  );
  CREATE TABLE IF NOT EXISTS scores (
    merchant TEXT PRIMARY KEY,
    trust_score REAL NOT NULL DEFAULT 50,
    reliability_pct REAL NOT NULL DEFAULT 100,
    avg_latency_ms REAL NOT NULL DEFAULT 0,
    price_per_call REAL NOT NULL DEFAULT 0,
    price_vs_median REAL NOT NULL DEFAULT 0,
    total_calls INTEGER NOT NULL DEFAULT 0,
    total_volume REAL NOT NULL DEFAULT 0,
    fraud_flag TEXT, updated_at INTEGER NOT NULL DEFAULT 0
  );
  CREATE TABLE IF NOT EXISTS incidents (
    id INTEGER PRIMARY KEY AUTOINCREMENT, merchant TEXT NOT NULL,
    type TEXT NOT NULL, severity TEXT NOT NULL DEFAULT 'medium',
    description TEXT, evidence_tx TEXT,
    usdc_lost REAL NOT NULL DEFAULT 0,
    detected_at INTEGER NOT NULL, resolved_at INTEGER
  );
`);

function computeScores() {
  const stats = db.prepare(`
    SELECT
      merchant,
      COUNT(*)                                           AS total_calls,
      SUM(delivered)                                     AS delivered,
      AVG(CASE WHEN delivered = 1 THEN latency_ms END)   AS avg_latency,
      AVG(amount_usdc)                                   AS avg_price,
      SUM(amount_usdc)                                   AS total_volume
    FROM payments
    GROUP BY merchant
  `).all() as any[];

  if (stats.length === 0) return;

  const categoryMedians = db.prepare(`
    SELECT m.category, AVG(p.amount_usdc) AS median_price
    FROM payments p
    JOIN merchants m ON p.merchant = m.address
    GROUP BY m.category
  `).all() as { category: string; median_price: number }[];

  const medianMap = new Map(categoryMedians.map(r => [r.category, r.median_price]));

  const merchantCategories = db.prepare(`SELECT address, category FROM merchants`).all() as
    { address: string; category: string }[];
  const catMap = new Map(merchantCategories.map(r => [r.address, r.category]));

  const fraudFlags = db.prepare(`
    SELECT merchant, type FROM incidents WHERE resolved_at IS NULL
  `).all() as { merchant: string; type: string }[];
  const fraudMap = new Map(fraudFlags.map(r => [r.merchant, r.type]));

  const upsertScore = db.prepare(`
    INSERT INTO scores
      (merchant, trust_score, reliability_pct, avg_latency_ms, price_per_call,
       price_vs_median, total_calls, total_volume, fraud_flag, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(merchant) DO UPDATE SET
      trust_score     = excluded.trust_score,
      reliability_pct = excluded.reliability_pct,
      avg_latency_ms  = excluded.avg_latency_ms,
      price_per_call  = excluded.price_per_call,
      price_vs_median = excluded.price_vs_median,
      total_calls     = excluded.total_calls,
      total_volume    = excluded.total_volume,
      fraud_flag      = excluded.fraud_flag,
      updated_at      = excluded.updated_at
  `);

  const rows_to_write: any[] = [];
  for (const row of stats) {
    const reliability = row.total_calls > 0 ? (row.delivered / row.total_calls) * 100 : 100;
    const latency = row.avg_latency ?? 9999;
    const cat = catMap.get(row.merchant) ?? "unknown";
    const catMedian = medianMap.get(cat) ?? row.avg_price;
    const priceRatio = catMedian > 0 ? row.avg_price / catMedian : 1;
    const fraud = fraudMap.get(row.merchant) ?? null;

    const reliabilityScore = reliability;
    const latencyScore = Math.max(0, 100 - latency / 20);
    const priceScore = Math.max(0, 100 - (priceRatio - 1) * 100);
    const fraudPenalty = fraud === "ghost" ? 80 : fraud === "flaky" ? 40 : 0;
    const raw = reliabilityScore * 0.40 + latencyScore * 0.30 + priceScore * 0.30;
    const trust_score = parseFloat(Math.max(0, Math.min(100, raw - fraudPenalty)).toFixed(1));

    rows_to_write.push([
      row.merchant, trust_score,
      parseFloat(reliability.toFixed(2)), parseFloat(latency.toFixed(0)),
      row.avg_price, parseFloat(priceRatio.toFixed(3)),
      row.total_calls, parseFloat(row.total_volume.toFixed(6)),
      fraud, Date.now()
    ]);
  }

  // Snapshot previous fraud flags before writing, to detect new ones
  const prevFlags = new Map<string, string | null>(
    (db.prepare(`SELECT merchant, fraud_flag FROM scores`).all() as any[])
      .map(r => [r.merchant, r.fraud_flag])
  );

  // Batch write in a single transaction to minimize lock time
  try {
    db.exec("BEGIN IMMEDIATE");
    for (const args of rows_to_write) upsertScore.run(...args);
    db.exec("COMMIT");
    console.log(`[scoring] updated ${stats.length} merchant scores`);
  } catch (e: any) {
    try { db.exec("ROLLBACK"); } catch {}
    console.warn(`[scoring] write skipped (${e.errstr ?? e.message}) — will retry in 30s`);
    return;
  }

  // Fire webhooks for any merchant newly flagged this cycle
  for (const [merchant, trust_score, reliability_pct, , , , , , fraud_flag] of rows_to_write) {
    const prev = prevFlags.get(merchant);
    if (fraud_flag && fraud_flag !== prev) {
      const name = (db.prepare(`SELECT name FROM merchants WHERE address = ?`).get(merchant) as any)?.name ?? merchant;
      const incident = db.prepare(`
        SELECT * FROM incidents WHERE merchant = ? AND resolved_at IS NULL
        ORDER BY detected_at DESC LIMIT 1
      `).get(merchant) as any;

      const payload = {
        merchant,
        name,
        fraud_flag,
        trust_score,
        reliability_pct,
        incident_id:   incident?.id ?? null,
        description:   incident?.description ?? `${name} flagged as ${fraud_flag}`,
        detected_at:   Date.now(),
      };

      // Notify API's webhook fire endpoint (non-blocking)
      const apiPort = process.env.API_PORT ?? 3001;
      fetch(`http://localhost:${apiPort}/webhooks/fire`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ event: "fraud_flag", payload }),
      }).catch(e => console.warn(`[scoring] webhook fire failed: ${e.message}`));

      console.log(`[scoring] 🚨 fraud_flag webhook fired for ${name} (${fraud_flag})`);
    }
  }
}

// Delay first run by 5s to let indexer finish its initial writes
setTimeout(() => {
  computeScores();
  setInterval(computeScores, 30_000);
}, 5000);
