import type { Db } from "./db.ts";
import { randomBytes } from "crypto";

const MERCHANTS = [
  { address: "0xM1a2b3c4d5e6f7a8b9c0d1e2f3a4b5c6d7e8f9a0", name: "PriceFeed Pro",    category: "Data",    reliability: 0.99, avgLatency: 85,  pricePerCall: 0.0003, fraud: null },
  { address: "0xM2b3c4d5e6f7a8b9c0d1e2f3a4b5c6d7e8f9a0b1", name: "NeuralOracle",    category: "AI",      reliability: 0.97, avgLatency: 210, pricePerCall: 0.0008, fraud: null },
  { address: "0xM3c4d5e6f7a8b9c0d1e2f3a4b5c6d7e8f9a0b1c2", name: "ChainVault Store", category: "Storage", reliability: 0.94, avgLatency: 140, pricePerCall: 0.0002, fraud: null },
  { address: "0xM4d5e6f7a8b9c0d1e2f3a4b5c6d7e8f9a0b1c2d3", name: "ComputeGrid",      category: "Compute", reliability: 0.91, avgLatency: 320, pricePerCall: 0.0012, fraud: null },
  { address: "0xM5e6f7a8b9c0d1e2f3a4b5c6d7e8f9a0b1c2d3e4", name: "ArcSentiment",     category: "Data",    reliability: 0.88, avgLatency: 180, pricePerCall: 0.0005, fraud: null },
  { address: "0xM6f7a8b9c0d1e2f3a4b5c6d7e8f9a0b1c2d3e4f5", name: "Flaky Node",       category: "Oracle",  reliability: 0.54, avgLatency: 890, pricePerCall: 0.0004, fraud: "flaky" },
  { address: "0xM7a8b9c0d1e2f3a4b5c6d7e8f9a0b1c2d3e4f5a6", name: "ShadowAPI",        category: "Data",    reliability: 0.12, avgLatency: 50,  pricePerCall: 0.0001, fraud: "ghost" },
  { address: "0xM8b9c0d1e2f3a4b5c6d7e8f9a0b1c2d3e4f5a6b7", name: "RapidCompute",     category: "Compute", reliability: 0.96, avgLatency: 95,  pricePerCall: 0.0010, fraud: null },
];

const BUYERS = Array.from({ length: 12 }, (_, i) =>
  `0xB${i.toString(16).padStart(39, "0")}`
);

const ENDPOINTS = [
  "/v1/price-feed", "/v1/sentiment", "/v1/summary", "/v1/compute",
  "/v1/oracle/eth", "/v1/store", "/v1/retrieve", "/v1/classify",
];

function randInt(min: number, max: number) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function randFrom<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function fakeTxHash(): string {
  return "0x" + randomBytes(32).toString("hex");
}

export function startSimulator(db: Db) {
  const insertPayment = db.prepare(`
    INSERT OR IGNORE INTO payments
      (tx_hash, block_number, timestamp, merchant, buyer, amount_usdc,
       endpoint, latency_ms, delivered, response_valid, chain_id)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const upsertMerchant = db.prepare(`
    INSERT INTO merchants (address, name, category, first_seen_at, last_active_at)
    VALUES (?, ?, ?, ?, ?)
    ON CONFLICT(address) DO UPDATE SET last_active_at = excluded.last_active_at
  `);

  const insertIncident = db.prepare(`
    INSERT OR IGNORE INTO incidents
      (merchant, type, severity, description, evidence_tx, usdc_lost, detected_at)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `);

  const alreadySeeded = (db.prepare(`SELECT COUNT(*) AS n FROM payments`).get() as any).n > 0;

  if (alreadySeeded) {
    console.log("[simulator] DB already seeded, skipping backfill");
  } else {
    const now = Date.now();

    for (const m of MERCHANTS) {
      upsertMerchant.run(
        m.address, m.name, m.category,
        now - randInt(0, 7 * 86400000),
        now - randInt(0, 3600000)
      );

      if (m.fraud === "ghost") {
        insertIncident.run(
          m.address, "ghost", "critical",
          "Merchant accepted payment but never returned data on 87% of calls. Suspected rug.",
          fakeTxHash(),
          parseFloat((0.0001 * randInt(200, 800)).toFixed(4)),
          now - randInt(0, 2 * 86400000)
        );
      }
      if (m.fraud === "flaky") {
        insertIncident.run(
          m.address, "flaky", "medium",
          "Merchant fails to deliver on >45% of calls during high-traffic windows.",
          fakeTxHash(),
          parseFloat((0.0001 * randInt(50, 200)).toFixed(4)),
          now - randInt(0, 4 * 86400000)
        );
      }
    }

    console.log("[simulator] seeding 8,400 historical payments...");
    db.exec("BEGIN");
    for (let i = 0; i < 8400; i++) {
      const m = randFrom(MERCHANTS);
      const buyer = randFrom(BUYERS);
      const ts = now - randInt(0, 7 * 24 * 3600 * 1000);
      const delivered = Math.random() < m.reliability ? 1 : 0;
      const latency = delivered
        ? randInt(Math.floor(m.avgLatency * 0.5), Math.floor(m.avgLatency * 1.8))
        : randInt(m.avgLatency * 2, m.avgLatency * 5);

      insertPayment.run(
        fakeTxHash(), randInt(1000000, 2000000), ts,
        m.address, buyer, m.pricePerCall,
        randFrom(ENDPOINTS), latency, delivered, delivered, 1227853952
      );
    }
    db.exec("COMMIT");
    console.log("[simulator] seeded 8,400 payments across 8 merchants");
  }

  // Live trickle
  function emitLive() {
    const m = randFrom(MERCHANTS);
    const buyer = randFrom(BUYERS);
    const delivered = Math.random() < m.reliability ? 1 : 0;
    const latency = delivered
      ? randInt(Math.floor(m.avgLatency * 0.5), Math.floor(m.avgLatency * 1.8))
      : randInt(m.avgLatency * 2, m.avgLatency * 5);
    const ts = Date.now();

    insertPayment.run(
      fakeTxHash(), randInt(2000001, 9999999), ts,
      m.address, buyer, m.pricePerCall,
      randFrom(ENDPOINTS), latency, delivered, delivered, 1227853952
    );

    upsertMerchant.run(m.address, m.name, m.category, ts, ts);

    console.log(`[sim] ${delivered ? "✓" : "✗"} ${m.name.padEnd(18)} $${m.pricePerCall} USDC  ${latency}ms`);
    setTimeout(emitLive, randInt(2000, 4000));
  }

  emitLive();
}
