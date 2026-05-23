/* data.js — utility functions only. Real merchant + alert data comes from api.js. */

// MERCHANTS starts empty — populated by api.js after /leaderboard fetch
let MERCHANTS = [];

const ENDPOINTS = [
  '/v1/price-feed', '/v1/embed', '/v1/oracle/eth-usd', '/v2/inference',
  '/v1/quote', '/v1/storage/get', '/v1/compute/job', '/v1/sentiment',
  '/v2/route', '/v1/translate', '/v1/weather', '/v1/dex/quote',
  '/v1/proof', '/v2/image/gen', '/v1/aggregate', '/v1/relay',
];

function rand(min, max) { return Math.random() * (max - min) + min; }
function pick(arr) { return arr[Math.floor(Math.random() * arr.length)]; }
function tsFmt(d) {
  const h = String(d.getHours()).padStart(2, '0');
  const m = String(d.getMinutes()).padStart(2, '0');
  const s = String(d.getSeconds()).padStart(2, '0');
  const ms = String(d.getMilliseconds()).padStart(3, '0');
  return `${h}:${m}:${s}.${ms}`;
}

function genTx(merchant, dt) {
  const ep = pick(ENDPOINTS);
  // base latency on merchant's avg, ±25%
  const lat = Math.max(20, Math.round(merchant.lat * rand(0.7, 1.3)));
  const amt = +(merchant.price * rand(0.92, 1.12)).toFixed(4);
  // failure prob inversely related to reliability
  const r = Math.random() * 100;
  let status = 'ok';
  if (r > merchant.rel) status = 'fail';
  else if (r > merchant.rel - 1.4) status = 'warn';
  // scammers fail more visibly
  if (merchant.scam === 'ghost' && Math.random() < 0.85) status = 'fail';
  if (merchant.scam === 'poisoner' && Math.random() < 0.6) status = 'warn';
  return {
    id: Math.random().toString(36).slice(2, 10),
    ts: tsFmt(dt),
    merchant,
    endpoint: ep,
    amount: amt,
    latency: lat,
    status,
  };
}

function seedFeed(n) {
  const out = [];
  let t = new Date();
  for (let i = 0; i < n; i++) {
    // skew toward higher-volume merchants
    const r = Math.random();
    let m;
    if (r < 0.45) m = MERCHANTS[Math.floor(Math.random() * 6)];
    else if (r < 0.85) m = MERCHANTS[6 + Math.floor(Math.random() * 10)];
    else m = MERCHANTS[16 + Math.floor(Math.random() * 4)];
    t = new Date(t.getTime() - Math.round(rand(80, 800)));
    out.push(genTx(m, t));
  }
  return out;
}

// ALERTS starts empty — populated by api.js after /incidents fetch
let ALERTS = { red: [], amber: [], green: [] };

const FRAUD_TRAIL = [
  { ts: '2026-05-19 14:22:11', severity: 'red', title: 'Schema poisoning confirmed',
    desc: 'Response field `price` switched from number to string-with-suffix across 60% of calls. No version bump.' },
  { ts: '2026-05-19 09:14:02', severity: 'amber', title: 'Anomaly detected by drift monitor',
    desc: 'JSON schema hash diverged from 7-day baseline. Confidence 0.82.' },
  { ts: '2026-05-18 22:08:54', severity: 'amber', title: 'Caller agent reported bad data',
    desc: 'agent.trading.alpha.eth flagged response as unparseable. First external report.' },
  { ts: '2026-05-17 03:41:27', severity: 'green', title: 'Merchant onboarded',
    desc: 'First seen on Arc. 98 successful calls in first 48h. No flags.' },
];

const INCIDENTS = [
  { ts: '14h ago', severity: 'amber', title: 'Latency spike — p99 hit 480ms',
    desc: 'Brief degradation between 02:14–02:38 UTC. Recovered without intervention. Caused by upstream pool exhaustion.' },
  { ts: '3d ago', severity: 'green', title: 'Recovered from regional outage',
    desc: 'EU-west region restored after 4m21s downtime. Cross-region failover took effect on call #841.' },
  { ts: '6d ago', severity: 'amber', title: 'Schema version bump v2.1.0 → v2.2.0',
    desc: 'Added `confidence` field. Backward compatible. 0 caller breakage.' },
  { ts: '14d ago', severity: 'red', title: 'Dropped 18 consecutive calls',
    desc: 'TLS cert rotated mid-call. Affected agents reimbursed via dispute pool.' },
];

const ENDPOINT_BREAKDOWN = [
  { ep: '/v1/price-feed', calls: 18420, fail: 0.2, lat: 87, share: 62 },
  { ep: '/v1/aggregate', calls: 6210, fail: 0.4, lat: 102, share: 21 },
  { ep: '/v2/quote-stream', calls: 3140, fail: 0.6, lat: 118, share: 11 },
  { ep: '/v1/historical', calls: 1820, fail: 0.3, lat: 142, share: 6 },
];

Object.assign(window, {
  MERCHANTS, ENDPOINTS, ALERTS, FRAUD_TRAIL, INCIDENTS, ENDPOINT_BREAKDOWN,
  rand, pick, tsFmt, genTx, seedFeed,
});

// Keep module-level MERCHANTS ref in sync when api.js updates window.MERCHANTS
window.addEventListener('repute:merchants', () => { MERCHANTS = window.MERCHANTS || []; });
window.addEventListener('repute:alerts',    () => { ALERTS = window.ALERTS || { red: [], amber: [], green: [] }; });
