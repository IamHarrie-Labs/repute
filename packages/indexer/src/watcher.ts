import { createPublicClient, http, parseAbiItem, formatUnits } from "viem";
import type { Db } from "./db.ts";
import { randomBytes } from "crypto";

const arcTestnet = {
  id: 5042002,
  name: "Arc Testnet",
  nativeCurrency: { name: "USD Coin", symbol: "USDC", decimals: 6 },
  rpcUrls: { default: { http: [process.env.ARC_RPC_URL ?? "https://rpc.testnet.arc.network"] } },
} as const;

const USDC_ADDRESS = (process.env.ARC_USDC_ADDRESS ?? "0x0000000000000000000000000000000000000000") as `0x${string}`;

const transferAbi = parseAbiItem(
  "event Transfer(address indexed from, address indexed to, uint256 value)"
);

export function startArcWatcher(db: Db) {
  const client = createPublicClient({
    chain: arcTestnet,
    transport: http(),
  });

  const insertPayment = db.prepare(`
    INSERT OR IGNORE INTO payments
      (tx_hash, block_number, timestamp, merchant, buyer, amount_usdc,
       endpoint, latency_ms, delivered, response_valid, chain_id)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const upsertMerchant = db.prepare(`
    INSERT INTO merchants (address, name, category, first_seen_at, last_active_at)
    VALUES (?, NULL, 'unknown', ?, ?)
    ON CONFLICT(address) DO UPDATE SET last_active_at = excluded.last_active_at
  `);

  console.log("[watcher] watching Arc testnet for USDC transfers...");

  client.watchEvent({
    address: USDC_ADDRESS,
    event: transferAbi,
    onLogs: (logs) => {
      for (const log of logs) {
        const { from, to, value } = log.args as { from: string; to: string; value: bigint };
        const amount = parseFloat(formatUnits(value, 6));
        const now = Date.now();

        upsertMerchant.run(to, now, now);
        insertPayment.run(
          log.transactionHash,
          Number(log.blockNumber),
          now, to, from, amount,
          null, null, 1, 1, arcTestnet.id
        );

        console.log(`[watcher] ${from.slice(0, 8)} → ${to.slice(0, 8)} $${amount.toFixed(4)}`);
      }
    },
  });
}
