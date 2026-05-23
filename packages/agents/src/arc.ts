/**
 * Arc testnet wallet utilities.
 *
 * Two modes:
 *  LOCAL  — viem private keys (works immediately, no API key needed)
 *  CIRCLE — Circle Developer-Controlled Wallets (set CIRCLE_API_KEY + CIRCLE_ENTITY_SECRET)
 *
 * The mode is selected automatically based on whether CIRCLE_API_KEY is set.
 */

import {
  createWalletClient,
  createPublicClient,
  http,
  erc20Abi,
  parseUnits,
  formatUnits,
} from "viem";
import { privateKeyToAccount, generatePrivateKey } from "viem/accounts";
import { ARC_RPC_URL, USDC_ADDRESS } from "./config.ts";

// ── Arc chain definition ───────────────────────────────────────────────────
export const arcTestnet = {
  id: 5042002,
  name: "Arc Testnet",
  nativeCurrency: { name: "USD Coin", symbol: "USDC", decimals: 6 },
  rpcUrls: { default: { http: [ARC_RPC_URL] } },
} as const;

export const publicClient = createPublicClient({
  chain: arcTestnet,
  transport: http(ARC_RPC_URL),
});

// ── Local wallet helpers (viem) ────────────────────────────────────────────

export function getOrCreateAccount(privateKeyEnvVar: string) {
  const pk = process.env[privateKeyEnvVar] as `0x${string}` | undefined;
  if (pk && pk.startsWith("0x") && pk.length === 66) {
    return privateKeyToAccount(pk);
  }
  const newPk = generatePrivateKey();
  process.env[privateKeyEnvVar] = newPk;
  return privateKeyToAccount(newPk);
}

export function makeWalletClient(privateKey: `0x${string}`) {
  const account = privateKeyToAccount(privateKey);
  return createWalletClient({ account, chain: arcTestnet, transport: http(ARC_RPC_URL) });
}

/** Get USDC balance of an address on Arc testnet. */
export async function getUsdcBalance(address: `0x${string}`): Promise<number> {
  try {
    const raw = await publicClient.readContract({
      address: USDC_ADDRESS,
      abi: erc20Abi,
      functionName: "balanceOf",
      args: [address],
    });
    return parseFloat(formatUnits(raw as bigint, 6));
  } catch {
    return 0;
  }
}

/** Send USDC via local private key (viem). Returns tx hash. */
export async function sendUsdc(
  fromPrivateKey: `0x${string}`,
  toAddress: `0x${string}`,
  amountUsdc: number
): Promise<`0x${string}`> {
  const client = makeWalletClient(fromPrivateKey);
  return client.writeContract({
    address: USDC_ADDRESS,
    abi: erc20Abi,
    functionName: "transfer",
    args: [toAddress, parseUnits(amountUsdc.toFixed(6), 6)],
  });
}

// ── Circle Developer-Controlled Wallets ────────────────────────────────────
// Activated when CIRCLE_API_KEY + CIRCLE_ENTITY_SECRET are set in .env

export interface CircleWallet {
  id: string;
  address: string;
  blockchain: string;
}

/** Lazily import Circle SDK (only when CIRCLE_API_KEY is present). */
async function getCircleClient() {
  const apiKey    = process.env.CIRCLE_API_KEY;
  const entitySecret = process.env.CIRCLE_ENTITY_SECRET;
  if (!apiKey || !entitySecret) return null;

  try {
    const { initiateDeveloperControlledWalletsClient } = await import(
      "@circle-fin/developer-controlled-wallets"
    );
    return initiateDeveloperControlledWalletsClient({ apiKey, entitySecret });
  } catch (e: any) {
    console.warn("[circle] SDK not available:", e.message);
    return null;
  }
}

/** Create or retrieve the shared Repute wallet set. */
async function getOrCreateWalletSet(client: any): Promise<string | null> {
  let walletSetId = process.env.CIRCLE_WALLET_SET_ID;
  if (walletSetId) return walletSetId;

  try {
    const res = await client.createWalletSet({ name: "Repute Agent Wallets" });
    walletSetId = res.data?.walletSet?.id;
    if (walletSetId) {
      process.env.CIRCLE_WALLET_SET_ID = walletSetId;
      console.log(`[circle] Created wallet set: ${walletSetId}`);
    }
    return walletSetId ?? null;
  } catch (e: any) {
    console.warn("[circle] createWalletSet failed:", e.message);
    return null;
  }
}

/**
 * Create a Circle Developer-Controlled Wallet on Arc Testnet.
 * Falls back to null if Circle SDK is unavailable.
 */
export async function createCircleWallet(name: string): Promise<CircleWallet | null> {
  const client = await getCircleClient();
  if (!client) return null;

  const walletSetId = await getOrCreateWalletSet(client);
  if (!walletSetId) return null;

  try {
    const res = await client.createWallets({
      walletSetId,
      blockchains: ["ARC-TESTNET"],  // Arc Testnet — confirmed supported via Circle MCP
      count: 1,
      accountType: "EOA",  // No per-transaction fees, highest throughput on Arc
    });

    const wallet = res.data?.wallets?.[0];
    if (!wallet) {
      console.warn(`[circle] No wallet returned for "${name}"`);
      return null;
    }

    console.log(`[circle] Wallet "${name}": ${wallet.address}`);
    return { id: wallet.id, address: wallet.address, blockchain: wallet.blockchain };
  } catch (e: any) {
    console.warn(`[circle] createWallets failed for "${name}":`, e.message);
    return null;
  }
}

/** Get USDC balance of a Circle wallet (by wallet ID). */
export async function getCircleWalletBalance(walletId: string): Promise<number> {
  const client = await getCircleClient();
  if (!client) return 0;

  try {
    const res = await client.getWalletTokenBalance({
      walletId,
      tokenAddress: USDC_ADDRESS,
    });
    const balance = res.data?.tokenBalance?.amount;
    return parseFloat(balance ?? "0");
  } catch {
    return 0;
  }
}

/**
 * Send USDC via Circle Developer-Controlled Wallets.
 * Uses Circle's custodial signing — no private key needed on-device.
 * Falls back to viem if Circle is not configured.
 */
export async function circleTransferUsdc(
  fromWalletId: string,
  toAddress: string,
  amountUsdc: number
): Promise<string | null> {
  const client = await getCircleClient();
  if (!client) return null;

  try {
    const res = await client.createTransaction({
      walletId: fromWalletId,
      destinationAddress: toAddress,
      // Circle uses amount as a string in human-readable units
      amounts: [amountUsdc.toFixed(6)],
      fee: {
        type: "level",
        config: { feeLevel: "MEDIUM" },
      },
      idempotencyKey: `repute-${fromWalletId}-${toAddress}-${Date.now()}`,
    });

    const txId = res.data?.transaction?.id;
    console.log(`[circle] Transfer ${amountUsdc} USDC → ${toAddress.slice(0, 10)}… txId: ${txId}`);
    return txId ?? null;
  } catch (e: any) {
    console.warn("[circle] Transfer failed:", e.message);
    return null;
  }
}

/** Wait for a Circle transaction to confirm. Returns final state. */
export async function waitForCircleTx(
  transactionId: string,
  timeoutMs = 30_000
): Promise<string> {
  const client = await getCircleClient();
  if (!client) return "UNKNOWN";

  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      const res = await client.getTransaction({ transactionId });
      const state = res.data?.transaction?.state;
      if (state === "CONFIRMED" || state === "COMPLETE" || state === "FAILED") {
        return state;
      }
    } catch { /* retry */ }
    await new Promise(r => setTimeout(r, 1500));
  }
  return "TIMEOUT";
}
