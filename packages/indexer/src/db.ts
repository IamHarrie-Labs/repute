import { DatabaseSync } from "node:sqlite";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
export const DB_PATH = path.resolve(__dirname, "../../../data/receipt-layer.db");

export function openDb() {
  const db = new DatabaseSync(DB_PATH);
  db.exec("PRAGMA journal_mode = WAL");
  db.exec("PRAGMA foreign_keys = ON");
  return db;
}

export type Db = ReturnType<typeof openDb>;

export function initDb(db: Db) {
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
      raw_meta       TEXT,
      FOREIGN KEY (merchant) REFERENCES merchants(address)
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
      updated_at      INTEGER NOT NULL,
      FOREIGN KEY (merchant) REFERENCES merchants(address)
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
      resolved_at  INTEGER,
      FOREIGN KEY (merchant) REFERENCES merchants(address)
    );

    CREATE INDEX IF NOT EXISTS idx_payments_merchant  ON payments(merchant);
    CREATE INDEX IF NOT EXISTS idx_payments_timestamp ON payments(timestamp);
    CREATE INDEX IF NOT EXISTS idx_incidents_merchant ON incidents(merchant);
  `);
}
