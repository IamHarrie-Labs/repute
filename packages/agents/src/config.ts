/**
 * Shared config for all Repute agents.
 * Merchant profiles define behavior — the same archetypes exist in real agent economies.
 */

export const MERCHANT_PROFILES = [
  {
    id: 1,
    name: "PriceFeed Pro",
    priceUsdc: 0.0003,
    reliability: 0.99,  // 99% delivery rate
    latencyMs: [60, 130] as [number, number],
    port: 4001,
    description: "Reliable mid-tier price oracle",
  },
  {
    id: 2,
    name: "NeuralOracle",
    priceUsdc: 0.0008,
    reliability: 0.97,
    latencyMs: [140, 280] as [number, number],
    port: 4002,
    description: "Premium AI inference, slightly pricey but solid",
  },
  {
    id: 3,
    name: "ChainVault",
    priceUsdc: 0.0002,
    reliability: 0.93,
    latencyMs: [90, 180] as [number, number],
    port: 4003,
    description: "Budget-friendly on-chain data store",
  },
  {
    id: 4,
    name: "Flaky Node",
    priceUsdc: 0.0004,
    reliability: 0.48,  // fails half the time
    latencyMs: [300, 1800] as [number, number],
    port: 4004,
    fraudType: "flaky" as const,
    description: "Unreliable — high latency, frequent 503s",
  },
  {
    id: 5,
    name: "ShadowAPI",
    priceUsdc: 0.0001,  // suspiciously cheap
    reliability: 0.08,  // ghost — almost never delivers
    latencyMs: [10, 40] as [number, number],
    port: 4005,
    fraudType: "ghost" as const,
    description: "Takes payment, delivers nothing",
  },
  {
    id: 6,
    name: "Premium Plus",
    priceUsdc: 0.0012,
    reliability: 0.998,
    latencyMs: [35, 75] as [number, number],
    port: 4006,
    description: "Most reliable, premium pricing — worth it",
  },
] as const;

export type MerchantProfile = typeof MERCHANT_PROFILES[number];

// API_BASE resolution: explicit API_URL > derive from PORT/API_PORT (handles Railway
// injecting $PORT) > localhost:3001 default for local dev.
const _internalPort = process.env.API_URL
  ? null
  : (process.env.PORT ?? process.env.API_PORT ?? "3001");
export const API_BASE = process.env.API_URL ?? `http://localhost:${_internalPort}`;

export const ARC_RPC_URL = process.env.ARC_RPC_URL ?? "https://rpc.testnet.arc.network";

export const USDC_ADDRESS = (
  process.env.ARC_USDC_ADDRESS ?? "0x3600000000000000000000000000000000000000"
) as `0x${string}`;

/** If true — agents simulate USDC payments (no real tx, posts directly to /ingest).
 *  If false — agents send real on-chain USDC transfers on Arc testnet. */
export const DEMO_MODE = process.env.DEMO_MODE !== "false";
