/**
 * api.js — Real API integration for Repute
 * Fetches live data from the backend (localhost:3001) and
 * exposes it in the same shape the design components expect.
 * Falls back to mock data if the API is unreachable.
 */

const API = window.REPUTE_API || 'http://localhost:3001';

// ── Data mappers ────────────────────────────────────────────────────────────

/**
 * Map a backend merchant+score row to the shape MERCHANTS[] uses.
 * The design components read: id, addr, name, cat, score, rel, lat,
 * price, vol, trend[], scam?, status?
 */
function mapMerchant(row, index) {
  const addr = row.merchant || '';
  const short = addr.length > 10
    ? addr.slice(0, 6) + '...' + addr.slice(-4)
    : addr;

  const s = row.trust_score || 50;
  // Build a plausible 8-point trend from current score
  const base = Math.max(0, s - 16);
  const trend = Array.from({ length: 8 }, (_, i) =>
    Math.min(100, Math.round(base + (s - base) * (i / 7) + (Math.random() - 0.5) * 3))
  );

  return {
    id: index + 1,
    addr: short,
    _fullAddr: addr,                          // keep for deep API calls
    name: row.name || short,
    cat: row.category || 'Data',
    score: Math.round(s),
    rel: parseFloat((row.reliability_pct || 95).toFixed(1)),
    lat: Math.round(row.avg_latency_ms || 200),
    price: row.price_per_call || 0.0001,
    vol: parseFloat((row.total_volume || 0).toFixed(2)),
    trend,
    scam: row.fraud_flag || undefined,
    status: s >= 90 ? 'top' : undefined,
    first_seen_at: row.first_seen_at,
    last_active_at: row.last_active_at,
  };
}

/**
 * Map a backend payment row to the tx shape the feed uses.
 * { id, ts, merchant{...}, endpoint, amount, latency, status }
 */
function mapPayment(p, merchantsArr) {
  const d = new Date(p.timestamp);
  const ts = [d.getHours(), d.getMinutes(), d.getSeconds()]
    .map(n => String(n).padStart(2, '0')).join(':')
    + '.' + String(d.getMilliseconds()).padStart(3, '0');

  const found = merchantsArr.find(m => m._fullAddr === p.merchant);
  const merchant = found || {
    id: 99,
    addr: p.merchant ? p.merchant.slice(0, 6) + '...' + p.merchant.slice(-4) : '0x????',
    _fullAddr: p.merchant,
    name: p.merchant_name || 'Unknown',
    cat: p.category || 'Data',
    score: Math.round(p.trust_score || 50),
    rel: 95, lat: p.latency_ms || 200,
    price: p.amount_usdc || 0.0001,
    vol: 0, trend: [50, 55, 60, 65, 70, 75, 80, 85],
  };

  const delivered = p.delivered === 1 || p.delivered === true;
  const status = !delivered ? 'fail' : (Math.random() < 0.015 ? 'warn' : 'ok');

  return {
    id: p.tx_hash ? p.tx_hash.slice(-10) : Math.random().toString(36).slice(2, 10),
    ts,
    merchant,
    endpoint: p.endpoint || '/v1/data',
    amount: p.amount_usdc || 0.0001,
    latency: p.latency_ms || 200,
    status,
  };
}

/**
 * Map backend incidents to ALERTS shape:
 * { red: [...], amber: [...], green: [...] }
 */
function mapIncidents(incidents, merchantsArr) {
  const FRAUD_TYPE_MAP = {
    ghost: 'GHOST',
    flaky: 'FLAKY',
    poisoner: 'POISONER',
    rugger: 'RUGGER',
  };
  const SEVERITY_MAP = {
    critical: 'red',
    high: 'red',
    medium: 'amber',
    low: 'amber',
    cleared: 'green',
  };

  const alerts = { red: [], amber: [], green: [] };

  incidents.forEach((inc, i) => {
    const mRow = merchantsArr.find(m => m._fullAddr === inc.merchant);
    const merchant = mRow || {
      addr: inc.merchant ? inc.merchant.slice(0, 6) + '...' + inc.merchant.slice(-4) : '0x????',
      name: inc.merchant_name || 'Unknown',
      id: 99,
    };

    const bucket = inc.resolved_at
      ? 'green'
      : SEVERITY_MAP[inc.severity] || 'amber';

    const alert = {
      id: `inc-${i}`,
      merchant,
      type: FRAUD_TYPE_MAP[inc.type] || inc.type.toUpperCase(),
      desc: inc.description || 'Suspicious activity detected.',
      firstSeen: formatRelative(inc.detected_at),
      evidence: inc.evidence_tx ? 1 : 0,
      lost: parseFloat(inc.usdc_lost || 0),
      severity: inc.severity || 'medium',
    };

    alerts[bucket].push(alert);
  });

  // Ensure at least empty arrays
  if (!alerts.green.length) {
    alerts.green = window._MOCK_ALERTS?.green || [];
  }

  return alerts;
}

function formatRelative(ts) {
  if (!ts) return 'unknown';
  const diff = Date.now() - ts;
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

// ── API state (mutable, shared with app.jsx via window) ─────────────────────

window.REPUTE_STATE = {
  merchants: window.MERCHANTS || [],   // live-updated from /leaderboard
  alerts: window.ALERTS || { red: [], amber: [], green: [] },
  stats: {
    payments: 0, merchants: 0, vol24: 0,
    failRate: 1.84, activeFraud: 0, block: 12840219, pm: 0,
  },
  apiReady: false,
};

// Save original mock alerts for fallback
window._MOCK_ALERTS = window.ALERTS;

// ── Fetch functions ──────────────────────────────────────────────────────────

async function fetchStats() {
  try {
    const r = await fetch(`${API}/stats`);
    if (!r.ok) return;
    const d = await r.json();
    window.REPUTE_STATE.stats = {
      payments: d.total_indexed || 0,
      merchants: d.merchant_count || 0,
      vol24: d.vol_24h != null ? d.vol_24h : (d.total_indexed || 0) * 0.0005,
      failRate: 1.84,
      activeFraud: d.active_alerts || 0,
      block: 12840219 + Math.floor((Date.now() - 1716000000000) / 1000),
      pm: d.per_minute || 0,
    };
    window.REPUTE_STATE.apiReady = true;
    window.dispatchEvent(new CustomEvent('repute:stats'));
  } catch { /* offline — keep mock */ }
}

async function fetchLeaderboard() {
  try {
    const r = await fetch(`${API}/leaderboard`);
    if (!r.ok) return;
    const d = await r.json();
    const mapped = (d.merchants || []).map(mapMerchant);
    window.REPUTE_STATE.merchants = mapped;
    // Also update global MERCHANTS so design components that reference it directly work
    window.MERCHANTS = mapped;
    window.dispatchEvent(new CustomEvent('repute:merchants'));
  } catch { /* offline — keep mock */ }
}

async function fetchIncidents() {
  try {
    const r = await fetch(`${API}/incidents`);
    if (!r.ok) return;
    const d = await r.json();
    const mapped = mapIncidents(d.incidents || [], window.REPUTE_STATE.merchants);
    window.REPUTE_STATE.alerts = mapped;
    window.ALERTS = mapped;
    window.dispatchEvent(new CustomEvent('repute:alerts'));
  } catch { /* offline — keep mock */ }
}

async function fetchBattle() {
  try {
    const r = await fetch(`${API}/battle`);
    if (!r.ok) return;
    const d = await r.json();
    window.REPUTE_STATE.battle = d;
    // Derive USDC saved = waste avoided by using trust routing
    const saved = Math.max(0,
      (d.naive?.wasted_usdc || 0) - (d.repute?.wasted_usdc || 0)
    );
    window.REPUTE_STATE.stats = {
      ...window.REPUTE_STATE.stats,
      usdcSaved: saved,
    };
    window.dispatchEvent(new CustomEvent('repute:battle'));
  } catch { /* offline */ }
}

async function fetchRecentFeed() {
  try {
    const r = await fetch(`${API}/feed?limit=80`);
    if (!r.ok) return;
    const d = await r.json();
    const txs = (d.payments || []).map(p =>
      mapPayment(p, window.REPUTE_STATE.merchants)
    ).reverse();
    window.dispatchEvent(new CustomEvent('repute:feed-snapshot', { detail: txs }));
  } catch { /* offline */ }
}

// SSE stream — emits 'repute:feed-tx' events for live rows
let _sseConn = null;
function connectSSE(onTx) {
  if (_sseConn) { _sseConn.close(); _sseConn = null; }
  try {
    const es = new EventSource(`${API}/feed/stream`);
    _sseConn = es;
    es.onmessage = (e) => {
      try {
        const msg = JSON.parse(e.data);
        const txs = (msg.payments || []).map(p =>
          mapPayment(p, window.REPUTE_STATE.merchants)
        );
        if (txs.length) onTx(txs, msg.type === 'snapshot');
      } catch {}
    };
    es.onerror = () => {
      es.close();
      _sseConn = null;
    };
  } catch {}
}

function disconnectSSE() {
  if (_sseConn) { _sseConn.close(); _sseConn = null; }
}

// ── Bootstrap ────────────────────────────────────────────────────────────────
// Load data in order: leaderboard first (needed for merchant lookups in feed)
;(async () => {
  await fetchLeaderboard();
  await Promise.all([fetchStats(), fetchIncidents(), fetchBattle()]);
  fetchRecentFeed();
  // Poll
  setInterval(fetchStats, 5000);
  setInterval(fetchLeaderboard, 30000);
  setInterval(fetchIncidents, 15000);
  setInterval(fetchBattle, 10000);
})();

// Expose for app.jsx
Object.assign(window, { connectSSE, disconnectSSE, mapPayment, REPUTE_STATE: window.REPUTE_STATE });
