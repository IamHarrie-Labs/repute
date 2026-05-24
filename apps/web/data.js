/* data.js — utility functions + demo fallback data. Real data comes from api.js. */

// Demo fallback merchants — used when the API is offline (e.g. Vercel preview)
const DEMO_MERCHANTS = [
  { id:1, addr:'0x15481D...7b2F', _fullAddr:'0x15481D7b2F', name:'PriceFeed Pro',   cat:'Oracle',  score:99, rel:99.2, lat:87,  price:0.0003, vol:18.42, trend:[82,85,88,90,93,96,98,99], status:'top' },
  { id:2, addr:'0x8aF3c1...4d9A', _fullAddr:'0x8aF3c14d9A', name:'ChainOracle',     cat:'Oracle',  score:94, rel:97.4, lat:121, price:0.0002, vol:11.20, trend:[78,80,84,87,90,91,93,94] },
  { id:3, addr:'0x2b91eE...c302', _fullAddr:'0x2b91eEc302', name:'Inference Node',  cat:'AI',      score:88, rel:95.1, lat:201, price:0.0005, vol:8.91,  trend:[70,72,76,80,83,85,87,88] },
  { id:4, addr:'0xf04Da0...81bB', _fullAddr:'0xf04Da081bB', name:'StoragePeer',     cat:'Storage', score:82, rel:93.8, lat:178, price:0.0001, vol:5.44,  trend:[65,68,71,74,77,79,81,82] },
  { id:5, addr:'0x77b2Ac...990C', _fullAddr:'0x77b2Ac990C', name:'DataRelay',        cat:'Data',    score:76, rel:90.2, lat:245, price:0.0002, vol:3.12,  trend:[60,62,65,67,70,72,74,76] },
  { id:6, addr:'0xd3F19b...e44D', _fullAddr:'0xd3F19be44D', name:'ComputeGrid',      cat:'Compute', score:71, rel:88.6, lat:312, price:0.0004, vol:2.80,  trend:[55,58,60,63,66,68,70,71] },
  { id:7, addr:'0xA891cC...3f0E', _fullAddr:'0xA891cC3f0E', name:'ShadowAPI',        cat:'Data',    score:12, rel:18.4, lat:890, price:0.0003, vol:0.84,  trend:[55,40,30,25,18,15,13,12], scam:'ghost' },
  { id:8, addr:'0x3c00FF...ba12', _fullAddr:'0x3c00FFba12', name:'FlakyNode',         cat:'Oracle',  score:31, rel:42.1, lat:740, price:0.0002, vol:1.20,  trend:[68,60,52,45,40,36,33,31], scam:'flaky' },
];

// MERCHANTS — starts with demo data, overwritten by api.js when live
let MERCHANTS = [...DEMO_MERCHANTS];

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
  const pool = MERCHANTS.length ? MERCHANTS : DEMO_MERCHANTS;
  let t = new Date();
  for (let i = 0; i < n; i++) {
    // skew toward higher-volume merchants (first 60%)
    const topN = Math.max(1, Math.floor(pool.length * 0.6));
    const r = Math.random();
    let m;
    if (r < 0.55) m = pool[Math.floor(Math.random() * topN)];
    else m = pool[Math.floor(Math.random() * pool.length)];
    if (!m) m = pool[0];
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

// Seed window.MERCHANTS immediately with demo data so leaderboard/feed
// render something useful before api.js finishes its first fetch.
window.MERCHANTS = MERCHANTS;

Object.assign(window, {
  MERCHANTS, DEMO_MERCHANTS, ENDPOINTS, ALERTS, FRAUD_TRAIL, INCIDENTS, ENDPOINT_BREAKDOWN,
  rand, pick, tsFmt, genTx, seedFeed,
});

// Keep module-level MERCHANTS ref in sync when api.js updates window.MERCHANTS
window.addEventListener('repute:merchants', () => { MERCHANTS = window.MERCHANTS || []; });
window.addEventListener('repute:alerts',    () => { ALERTS = window.ALERTS || { red: [], amber: [], green: [] }; });
