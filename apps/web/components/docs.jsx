/* Documentation page */

function DocsSection({ title, children }) {
  return (
    <div style={{ marginBottom: 40 }}>
      <div style={{
        fontWeight: 600, fontSize: 13, color: 'var(--text-0)',
        letterSpacing: '-0.01em', marginBottom: 16,
        paddingBottom: 8, borderBottom: '1px solid var(--border)',
        display: 'flex', alignItems: 'center', gap: 10,
      }}>
        <span style={{ color: 'var(--accent)' }}>▸</span>
        {title}
      </div>
      {children}
    </div>
  );
}

function CodeBlock({ code, label }) {
  return (
    <div style={{ marginTop: 12 }}>
      {label && (
        <div style={{
          fontSize: 9, color: 'var(--text-3)', letterSpacing: '0.1em',
          textTransform: 'uppercase', marginBottom: 4,
        }}>{label}</div>
      )}
      <pre style={{
        margin: 0, padding: '14px 16px',
        background: 'var(--bg-1)', border: '1px solid var(--border)',
        fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--text-1)',
        lineHeight: 1.7, overflowX: 'auto', whiteSpace: 'pre',
      }}>{code}</pre>
    </div>
  );
}

function EndpointRow({ method, path, desc }) {
  const colors = { GET: 'var(--accent)', POST: 'var(--cyan)', DELETE: 'var(--red)' };
  return (
    <div style={{
      display: 'grid', gridTemplateColumns: '52px 1fr 1fr',
      gap: 16, padding: '10px 14px',
      borderBottom: '1px solid var(--border)',
      alignItems: 'center', fontSize: 12,
    }}>
      <span style={{
        fontFamily: 'var(--font-mono)', fontSize: 10, fontWeight: 600,
        color: colors[method] || 'var(--text-2)', letterSpacing: '0.04em',
      }}>{method}</span>
      <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--text-0)', fontSize: 12 }}>{path}</span>
      <span style={{ color: 'var(--text-2)' }}>{desc}</span>
    </div>
  );
}

function DocsPage() {
  const API = window.REPUTE_API || 'http://localhost:3001';

  return (
    <div style={{ padding: '24px 28px', maxWidth: 900 }}>

      {/* Header */}
      <div style={{
        display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between',
        marginBottom: 36, paddingBottom: 24, borderBottom: '1px solid var(--border)',
      }}>
        <div>
          <div style={{ fontSize: 10, color: 'var(--accent)', letterSpacing: '0.12em', textTransform: 'uppercase', marginBottom: 8 }}>
            Repute · API Reference
          </div>
          <h1 style={{ margin: 0, fontSize: 22, fontWeight: 600, color: 'var(--text-0)', letterSpacing: '-0.02em' }}>
            Documentation
          </h1>
          <p style={{ margin: '10px 0 0', fontSize: 13, color: 'var(--text-2)', lineHeight: 1.6, maxWidth: 560 }}>
            Repute exposes a JSON REST API on port 3001. Any agent on Arc can query merchant trust scores, browse the live payment feed, and read fraud alerts.
          </p>
        </div>
        <div style={{
          padding: '8px 14px', border: '1px solid var(--border)',
          fontSize: 11, color: 'var(--text-2)', fontFamily: 'var(--font-mono)',
          whiteSpace: 'nowrap',
        }}>
          base · {API}
        </div>
      </div>

      {/* Endpoints */}
      <DocsSection title="API Endpoints">
        <div style={{ border: '1px solid var(--border)', background: 'var(--panel)' }}>
          <div style={{
            padding: '8px 14px', borderBottom: '1px solid var(--border)',
            display: 'grid', gridTemplateColumns: '52px 1fr 1fr', gap: 16,
            fontSize: 9, color: 'var(--text-3)', letterSpacing: '0.1em', textTransform: 'uppercase',
          }}>
            <span>Method</span><span>Path</span><span>Description</span>
          </div>
          <EndpointRow method="GET" path="/stats" desc="Network-wide totals: payments indexed, merchant count, 24h volume, active alerts" />
          <EndpointRow method="GET" path="/leaderboard" desc="All merchants with trust scores, sorted by score descending" />
          <EndpointRow method="GET" path="/merchant/:addr" desc="Full trust profile for a single merchant address" />
          <EndpointRow method="GET" path="/feed" desc="Recent payments (default 50, max 200) with merchant + score context" />
          <EndpointRow method="GET" path="/feed/stream" desc="SSE stream — emits live payment events as they are indexed" />
          <EndpointRow method="GET" path="/incidents" desc="Active and resolved fraud incidents with evidence counts" />
          <EndpointRow method="GET" path="/battle" desc="NaiveAgent vs ReputeAgent live performance comparison" />
          <EndpointRow method="GET" path="/agents" desc="Per-agent totals: calls, successes, spend, top merchants" />
          <EndpointRow method="POST" path="/ingest" desc="Internal — merchant agents post payment receipts here" />
        </div>
      </DocsSection>

      {/* Stats */}
      <DocsSection title="GET /stats">
        <p style={{ margin: '0 0 12px', fontSize: 13, color: 'var(--text-2)', lineHeight: 1.6 }}>
          Returns network-wide statistics. The dashboard polls this every 5 seconds to update the topbar counters.
        </p>
        <CodeBlock label="Response" code={`{
  "total_indexed":  2565,          // all-time payments indexed
  "merchant_count": 6,             // unique merchant addresses seen
  "active_alerts":  2,             // unresolved fraud incidents
  "per_minute":     42,            // payments in last 60s
  "vol_24h":        0.9230         // USDC settled in last 24h
}`} />
      </DocsSection>

      {/* Merchant */}
      <DocsSection title="GET /merchant/:addr">
        <p style={{ margin: '0 0 12px', fontSize: 13, color: 'var(--text-2)', lineHeight: 1.6 }}>
          Returns the full trust profile for one merchant. Use this before paying — if <code style={{ fontFamily: 'var(--font-mono)', background: 'var(--bg-2)', padding: '1px 5px' }}>fraud_flag</code> is set or <code style={{ fontFamily: 'var(--font-mono)', background: 'var(--bg-2)', padding: '1px 5px' }}>trust_score</code> is below your threshold, skip the payment.
        </p>
        <CodeBlock label="Request" code={`GET /merchant/0x15481D7B9E6EB58aF1cD1A963B84cDA72D60b36A`} />
        <CodeBlock label="Response" code={`{
  "address":        "0x15481D7B...",
  "name":           "PriceFeed Pro",
  "category":       "Oracle",
  "trust_score":    99,            // 0–100 composite
  "reliability_pct":99.2,          // % calls delivered
  "avg_latency_ms": 87,
  "price_per_call": 0.0003,        // USDC
  "total_calls":    1842,
  "total_volume":   0.5526,        // USDC earned
  "fraud_flag":     null,          // null = safe, "ghost"/"flaky" = flagged
  "first_seen_at":  1716000000000,
  "last_active_at": 1716400000000
}`} />
      </DocsSection>

      {/* Battle */}
      <DocsSection title="GET /battle">
        <p style={{ margin: '0 0 12px', fontSize: 13, color: 'var(--text-2)', lineHeight: 1.6 }}>
          Compares the two live buyer agents. <strong style={{ color: 'var(--text-0)' }}>NaiveAgent</strong> picks a random merchant each call. <strong style={{ color: 'var(--accent)' }}>ReputeAgent</strong> queries Repute first and skips low-trust addresses.
        </p>
        <CodeBlock label="Response" code={`{
  "naive": {
    "calls":   1174,
    "success": 832,
    "rate":    70.9,              // % success rate
    "spent":   0.4301,           // USDC total
    "wasted":  0.1253            // USDC paid to non-delivering merchants
  },
  "repute": {
    "calls":   621,
    "success": 611,
    "rate":    98.4,
    "spent":   0.2279,
    "wasted":  0.0037
  }
}`} />
      </DocsSection>

      {/* Integration */}
      <DocsSection title="Integration example (TypeScript)">
        <p style={{ margin: '0 0 12px', fontSize: 13, color: 'var(--text-2)', lineHeight: 1.6 }}>
          Query the trust score, then pay via Circle Developer-Controlled Wallet only if the merchant is trusted. This is the exact pattern used by ReputeAgent in the live demo.
        </p>
        <CodeBlock code={`import { circleTransferUsdc } from './arc.ts';

const API = 'http://localhost:3001';

async function payTrustedMerchant(walletId: string, merchantAddr: string) {
  // 1. Query Repute
  const res  = await fetch(\`\${API}/merchant/\${merchantAddr}\`);
  const info = await res.json();

  // 2. Check trust score and fraud flag
  if (info.trust_score < 75 || info.fraud_flag) {
    console.warn('Skipping low-trust merchant', info.trust_score);
    return null;
  }

  // 3. Pay via Circle Developer-Controlled Wallet (Arc testnet USDC)
  const txId = await circleTransferUsdc(
    walletId,
    merchantAddr,
    info.price_per_call   // e.g. 0.0003 USDC
  );

  return txId;
}`} />
      </DocsSection>

      {/* SSE */}
      <DocsSection title="GET /feed/stream (SSE)">
        <p style={{ margin: '0 0 12px', fontSize: 13, color: 'var(--text-2)', lineHeight: 1.6 }}>
          Server-sent events stream. Sends a snapshot of recent payments on connect, then pushes new rows as they arrive. The Live Feed tab consumes this stream.
        </p>
        <CodeBlock code={`const es = new EventSource('http://localhost:3001/feed/stream');

es.onmessage = (e) => {
  const { type, payments } = JSON.parse(e.data);
  // type === 'snapshot' on first message, 'update' on subsequent
  payments.forEach(p => {
    console.log(p.merchant, p.amount_usdc, p.delivered);
  });
};`} />
      </DocsSection>

      {/* Stack */}
      <DocsSection title="Stack overview">
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          {[
            { label: 'Indexer', v: 'packages/indexer', desc: 'Polls merchant agents every 800ms, writes receipts to SQLite' },
            { label: 'API', v: 'packages/api', desc: 'Hono HTTP server on :3001, SSE stream, REST endpoints' },
            { label: 'Scoring', v: 'packages/scoring', desc: 'Recomputes 5-signal trust score every 30s per merchant' },
            { label: 'Agents', v: 'packages/agents', desc: 'NaiveAgent + ReputeAgent buyers, 6 merchant servers on :4001-4006' },
            { label: 'Wallets', v: 'Circle DevCtrl', desc: 'USDC wallets on Arc testnet, funded via faucet.circle.com' },
            { label: 'Chain', v: 'Arc testnet', desc: 'Chain ID 5042002, USDC native gas + ERC-20 at 0x360000...' },
          ].map(({ label, v, desc }) => (
            <div key={label} style={{
              border: '1px solid var(--border)', background: 'var(--panel)',
              padding: '14px 16px',
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-0)' }}>{label}</span>
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--accent)' }}>{v}</span>
              </div>
              <p style={{ margin: 0, fontSize: 12, color: 'var(--text-2)', lineHeight: 1.55 }}>{desc}</p>
            </div>
          ))}
        </div>
      </DocsSection>

      <div style={{ marginTop: 32, padding: '14px 16px', border: '1px solid var(--border)', background: 'var(--bg-1)', fontSize: 12, color: 'var(--text-3)' }}>
        Running on Arc testnet · API at localhost:3001 · Dashboard at localhost:3000/app
      </div>

    </div>
  );
}

Object.assign(window, { DocsPage });
