/**
 * @repute/sdk — Trust scores for autonomous agent commerce on Arc
 *
 * Usage:
 *   import { Repute } from '@repute/sdk';
 *
 *   const client = new Repute({ baseUrl: 'http://localhost:3001' });
 *   const score  = await client.score('0x15481D7B...');
 *
 *   if (score.verdict === 'SAFE_TO_PAY') {
 *     await circleTransferUsdc(walletId, score.address, score.price_per_call);
 *   }
 */

// ── Types ──────────────────────────────────────────────────────────────────

export interface ReputeConfig {
  /** Repute API base URL. Default: http://localhost:3001 */
  baseUrl?: string;
  /**
   * x402 payment proof header for live mode.
   * In DEMO_MODE the API bypasses this automatically.
   */
  paymentProof?: string;
  /** Your agent's address — logged against paid score queries. */
  callerAddress?: string;
}

export type Verdict = "SAFE_TO_PAY" | "CAUTION" | "DO_NOT_PAY";

export interface ScoreResult {
  address:        string;
  name:           string;
  category:       string;
  trust_score:    number;       // 0–100 composite
  reliability_pct:number;       // % calls delivered
  avg_latency_ms: number;
  price_per_call: number;       // USDC
  total_calls:    number;
  total_volume:   number;       // USDC earned lifetime
  fraud_flag:     string | null; // "ghost" | "flaky" | "rugger" | null
  updated_at:     number | null;
  verdict:        Verdict;
}

export interface NetworkStats {
  total_indexed:  number;
  merchant_count: number;
  active_alerts:  number;
  per_minute:     number;
  vol_24h:        number;
}

export interface LeaderboardEntry {
  merchant:        string;
  name:            string;
  category:        string;
  trust_score:     number;
  reliability_pct: number;
  avg_latency_ms:  number;
  price_per_call:  number;
  total_calls:     number;
  fraud_flag:      string | null;
}

export interface WebhookRegistration {
  webhook_id: number;
  url:        string;
  events:     string[];
  message:    string;
}

export interface FeedPayment {
  id:            number;
  tx_hash:       string;
  timestamp:     number;
  merchant:      string;
  merchant_name: string;
  buyer:         string;
  amount_usdc:   number;
  endpoint:      string;
  latency_ms:    number | null;
  delivered:     number;
  trust_score:   number | null;
}

export interface BattleStats {
  naive:  AgentStats | null;
  repute: AgentStats | null;
  recent_calls: FeedPayment[];
  updated_at: number;
}

export interface AgentStats {
  address:      string;
  total_calls:  number;
  successes:    number;
  failures:     number;
  success_rate: number;
  total_spent:  number;
  wasted_usdc:  number;
  avg_latency:  number | null;
}

// ── Client ────────────────────────────────────────────────────────────────

export class Repute {
  private baseUrl: string;
  private headers: Record<string, string>;

  constructor(config: ReputeConfig = {}) {
    this.baseUrl = (config.baseUrl ?? "http://localhost:3001").replace(/\/$/, "");
    this.headers = { "Content-Type": "application/json" };
    if (config.paymentProof)  this.headers["X-Payment-Proof"]   = config.paymentProof;
    if (config.callerAddress) this.headers["X-Caller-Address"]  = config.callerAddress;
  }

  private async get<T>(path: string): Promise<T> {
    const res = await fetch(`${this.baseUrl}${path}`, { headers: this.headers });
    if (!res.ok) {
      const body = await res.json().catch(() => ({})) as any;
      throw Object.assign(
        new Error(body.error ?? `HTTP ${res.status}`),
        { status: res.status, body }
      );
    }
    return res.json() as Promise<T>;
  }

  private async post<T>(path: string, payload: unknown): Promise<T> {
    const res = await fetch(`${this.baseUrl}${path}`, {
      method: "POST",
      headers: this.headers,
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      const body = await res.json().catch(() => ({})) as any;
      throw Object.assign(
        new Error(body.error ?? `HTTP ${res.status}`),
        { status: res.status, body }
      );
    }
    return res.json() as Promise<T>;
  }

  /**
   * Query a merchant's full trust profile.
   * Cost: $0.0001 USDC (auto-bypassed in DEMO_MODE).
   *
   * @example
   * const score = await repute.score('0x15481D7B...');
   * if (score.verdict === 'SAFE_TO_PAY') { ... }
   */
  async score(address: string): Promise<ScoreResult> {
    return this.get<ScoreResult>(`/score/${address}`);
  }

  /**
   * Batch score up to 20 addresses in one call.
   * Cost: $0.0005 USDC.
   */
  async batchScore(addresses: string[]): Promise<{ scores: ScoreResult[] }> {
    return this.post<{ scores: ScoreResult[] }>("/batch-scores", { addresses });
  }

  /**
   * Get network-wide statistics: payment count, merchant count, 24h volume.
   * Free endpoint, no payment required.
   */
  async stats(): Promise<NetworkStats> {
    return this.get<NetworkStats>("/stats");
  }

  /**
   * Get the full merchant leaderboard, sorted by trust score.
   * Free endpoint.
   */
  async leaderboard(): Promise<{ merchants: LeaderboardEntry[] }> {
    return this.get<{ merchants: LeaderboardEntry[] }>("/leaderboard");
  }

  /**
   * Get recent payments from the live feed.
   * Free endpoint.
   */
  async feed(limit = 50): Promise<{ payments: FeedPayment[] }> {
    return this.get<{ payments: FeedPayment[] }>(`/feed?limit=${limit}`);
  }

  /**
   * Get live NaiveAgent vs ReputeAgent benchmark data.
   * Free endpoint.
   */
  async battle(): Promise<BattleStats> {
    return this.get<BattleStats>("/battle");
  }

  /**
   * Subscribe a webhook URL to fraud events.
   * Events: "fraud_flag" | "incident"
   *
   * @example
   * await repute.subscribe('https://myagent.xyz/webhooks/repute', ['fraud_flag']);
   */
  async subscribe(
    url: string,
    events: string[] = ["fraud_flag", "incident"],
    label?: string
  ): Promise<WebhookRegistration> {
    return this.post<WebhookRegistration>("/subscribe", { url, events, label });
  }

  /**
   * List your active webhook subscriptions.
   */
  async subscriptions(): Promise<{ webhooks: any[] }> {
    return this.get<{ webhooks: any[] }>("/subscriptions");
  }

  /**
   * Open an SSE stream and call onPayment for each new indexed payment.
   * Returns a close() function.
   *
   * @example
   * const close = repute.stream(payment => {
   *   console.log(payment.merchant_name, payment.amount_usdc);
   * });
   * // later: close();
   */
  stream(onPayment: (payment: FeedPayment) => void): () => void {
    const es = new EventSource(`${this.baseUrl}/feed/stream`);
    es.onmessage = (e) => {
      try {
        const msg = JSON.parse(e.data);
        const payments: FeedPayment[] = msg.payments ?? [];
        payments.forEach(onPayment);
      } catch {}
    };
    return () => es.close();
  }
}

// ── Convenience singleton for quick scripts ───────────────────────────────

/** Pre-configured client pointing at localhost:3001 */
export const repute = new Repute();

export default Repute;
