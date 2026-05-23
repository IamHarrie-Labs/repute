/* Shared atomic components */

const { useState, useEffect, useRef, useMemo } = React;

// Score ring
function ScoreRing({ score, size = 56, stroke = 4, animate = true }) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const [dash, setDash] = useState(animate ? c : c - (score / 100) * c);
  useEffect(() => {
    if (!animate) return;
    const t = setTimeout(() => setDash(c - (score / 100) * c), 50);
    return () => clearTimeout(t);
  }, [score, c, animate]);
  // Read actual hex for gradient stops (needs concrete color, not var())
  const themeColor = useThemeColor(score < 40 ? '--red' : score < 75 ? '--amber' : '--accent');
  const gridColor = useThemeColor('--border');

  const gradId = `g-${score}-${size}-${themeColor.replace('#','')}`;
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{display:'block'}}>
      <defs>
        <linearGradient id={gradId} x1="0" x2="1" y1="0" y2="1">
          <stop offset="0%" stopColor={themeColor} stopOpacity="0.4"/>
          <stop offset="100%" stopColor={themeColor} stopOpacity="1"/>
        </linearGradient>
      </defs>
      <circle cx={size/2} cy={size/2} r={r} fill="none" stroke={gridColor} strokeWidth={stroke} />
      <circle
        cx={size/2} cy={size/2} r={r}
        fill="none"
        stroke={`url(#${gradId})`}
        strokeWidth={stroke}
        strokeDasharray={c}
        strokeDashoffset={dash}
        transform={`rotate(-90 ${size/2} ${size/2})`}
        style={{transition: 'stroke-dashoffset 1.2s cubic-bezier(.22,.61,.36,1)'}}
        strokeLinecap="butt"
      />
      <text
        x="50%" y="50%"
        textAnchor="middle"
        dominantBaseline="central"
        fill={themeColor}
        fontFamily="JetBrains Mono, monospace"
        fontSize={size * 0.32}
        fontVariantNumeric="tabular-nums"
        style={{letterSpacing:'-0.02em'}}
      >{score}</text>
    </svg>
  );
}

// Read current theme value of a CSS variable (forces a re-render via window-level theme tick)
function useThemeColor(varName) {
  const [tick, setTick] = useState(0);
  useEffect(() => {
    const onTheme = () => setTick(t => t + 1);
    window.addEventListener('theme-change', onTheme);
    return () => window.removeEventListener('theme-change', onTheme);
  }, []);
  if (typeof window === 'undefined') return '#00FF87';
  return getComputedStyle(document.documentElement).getPropertyValue(varName).trim() || '#00FF87';
}

// Score mini badge (no number, just ring + number for table)
function ScoreBadge({ score }) {
  let color = 'var(--accent)';
  if (score < 40) color = 'var(--red)';
  else if (score < 75) color = 'var(--amber)';
  return (
    <span style={{display:'inline-flex', alignItems:'center', gap:6}}>
      <ScoreRing score={score} size={24} stroke={2.5} />
      <span className="mono" style={{color, fontSize: 11}}>{score}</span>
    </span>
  );
}

// Sparkline
function Sparkline({ data, w = 80, h = 22, strokeW = 1.5 }) {
  const accent = useThemeColor('--accent');
  const red = useThemeColor('--red');
  if (!data || data.length === 0) return null;
  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;
  const step = w / (data.length - 1);
  const pts = data.map((v, i) => `${i * step},${h - ((v - min) / range) * (h - 2) - 1}`).join(' ');
  const last = data[data.length - 1];
  const first = data[0];
  const trendColor = last >= first ? accent : red;
  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} style={{display:'block'}}>
      <polyline fill="none" stroke={trendColor} strokeWidth={strokeW} points={pts} />
      <circle cx={(data.length - 1) * step} cy={h - ((last - min) / range) * (h - 2) - 1} r="1.5" fill={trendColor} />
    </svg>
  );
}

// Status icon
function StatusIcon({ status }) {
  if (status === 'ok') return <span className="status-i ok">✓</span>;
  if (status === 'fail') return <span className="status-i fail">✗</span>;
  return <span className="status-i warn">⚠</span>;
}

// Category pill
function CatPill({ cat, small }) {
  const cls = `pill cat-${cat.toLowerCase()}`;
  return <span className={cls} style={small ? {fontSize:9, padding:'1px 6px'} : {}}>{cat}</span>;
}

// Address with truncation + hover
function AddrLink({ addr, full, color }) {
  return <span className="addr mono" style={color ? {color} : {}}>{full || addr}</span>;
}

// Latency color
function Latency({ ms }) {
  let cls = 'lat-good';
  if (ms > 500) cls = 'lat-bad';
  else if (ms > 200) cls = 'lat-mid';
  return <span className={`mono ${cls}`}>{ms}ms</span>;
}

// Stat card
function StatCard({ label, value, sub, color, big }) {
  return (
    <div className="stat-card">
      <div className="l">{label}</div>
      <div className={`v ${color || ''}`} style={big ? {fontSize: 28} : {}}>{value}</div>
      {sub && <div className="sub">{sub}</div>}
    </div>
  );
}

// Bar row (used for sub-scores)
function BarRow({ label, value, max = 100, color }) {
  const pct = Math.min(100, (value / max) * 100);
  let c = color;
  if (!c) {
    if (value < 40) c = 'var(--red)';
    else if (value < 75) c = 'var(--amber)';
    else c = 'var(--accent)';
  }
  return (
    <div className="bar-row">
      <div className="lbl">{label}</div>
      <div className="bar-track">
        <div className="bar-fill" style={{width: `${pct}%`, background: c, transition:'width 1s cubic-bezier(.22,.61,.36,1)'}} />
      </div>
      <div className="v">{value}</div>
    </div>
  );
}

// Line+volume chart (success/fail rate + volume bars)
function ReliabilityChart({ days = 30, w = 760, h = 220 }) {
  // Generate deterministic-ish data
  const pts = useMemo(() => {
    const out = [];
    let succ = 96 + Math.random() * 2;
    let fail = 100 - succ;
    for (let i = 0; i < days; i++) {
      succ += (Math.random() - 0.5) * 1.2;
      succ = Math.max(85, Math.min(99.9, succ));
      // create a dip somewhere
      if (i === 18) succ = 91.4;
      if (i === 19) succ = 93.8;
      fail = 100 - succ;
      const vol = 400 + Math.random() * 800 + (i > 20 ? 200 : 0);
      out.push({ succ, fail, vol });
    }
    return out;
  }, [days]);

  const padL = 36, padR = 12, padT = 12, padB = 64;
  const chartW = w - padL - padR;
  const chartH = h - padT - padB;
  const stepX = chartW / (days - 1);

  // Volume area
  const volMax = Math.max(...pts.map(p => p.vol));
  const volBarsH = 40;
  const volBarsY = h - padB + 14;

  // y axes: 85–100
  const yMin = 85, yMax = 100;
  const yFor = v => padT + chartH - ((v - yMin) / (yMax - yMin)) * chartH;

  const succPath = pts.map((p, i) => `${i === 0 ? 'M' : 'L'} ${padL + i*stepX} ${yFor(p.succ)}`).join(' ');
  // Failure as inverse — show on second axis (0–15%) but inverted in same area for contrast
  const failYFor = v => padT + chartH - ((15 - v) / 15) * chartH; // wait, want fail near bottom
  // Simpler: scale fail (0..15) to bottom band
  const failYFor2 = v => padT + chartH * 0.7 + (v / 15) * (chartH * 0.3);
  const failPath = pts.map((p, i) => `${i === 0 ? 'M' : 'L'} ${padL + i*stepX} ${failYFor2(p.fail)}`).join(' ');

  // y grid
  const yTicks = [85, 90, 95, 100];

  const grid = useThemeColor('--border');
  const subText = useThemeColor('--text-3');
  const text1 = useThemeColor('--text-1');
  const accent = useThemeColor('--accent');
  const red = useThemeColor('--red');
  const borderStrong = useThemeColor('--border-strong');

  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} style={{display:'block'}}>
      {/* y grid */}
      {yTicks.map(t => (
        <g key={t}>
          <line x1={padL} x2={w - padR} y1={yFor(t)} y2={yFor(t)} stroke={grid} />
          <text x={padL - 6} y={yFor(t) + 3} textAnchor="end" fontSize="9" fontFamily="JetBrains Mono" fill={subText}>{t}%</text>
        </g>
      ))}

      {/* success path */}
      <path d={succPath} fill="none" stroke={accent} strokeWidth="1.5" />
      {/* failure path */}
      <path d={failPath} fill="none" stroke={red} strokeWidth="1.2" strokeDasharray="0" opacity="0.85" />

      {/* volume bars */}
      {pts.map((p, i) => {
        const bw = Math.max(2, stepX - 3);
        const bh = (p.vol / volMax) * volBarsH;
        return <rect key={i} x={padL + i*stepX - bw/2} y={volBarsY + (volBarsH - bh)} width={bw} height={bh} fill={borderStrong} />;
      })}
      {/* axis baseline for volume */}
      <line x1={padL} x2={w - padR} y1={volBarsY + volBarsH} y2={volBarsY + volBarsH} stroke={borderStrong} />
      <text x={padL - 6} y={volBarsY + 8} textAnchor="end" fontSize="9" fontFamily="JetBrains Mono" fill={subText}>VOL</text>

      {/* x labels */}
      <text x={padL} y={h - 4} fontSize="9" fontFamily="JetBrains Mono" fill={subText}>30d ago</text>
      <text x={w - padR} y={h - 4} textAnchor="end" fontSize="9" fontFamily="JetBrains Mono" fill={subText}>now</text>

      {/* legend */}
      <g transform={`translate(${padL + 4}, ${padT + 6})`}>
        <rect x="0" y="0" width="6" height="6" fill={accent} />
        <text x="10" y="6" fontSize="9" fontFamily="JetBrains Mono" fill={text1}>SUCCESS RATE</text>
        <rect x="110" y="0" width="6" height="6" fill={red} />
        <text x="120" y="6" fontSize="9" fontFamily="JetBrains Mono" fill={text1}>FAIL RATE</text>
      </g>
    </svg>
  );
}

// Animated counter
function Counter({ value, fmt }) {
  const [v, setV] = useState(value);
  const prev = useRef(value);
  const [tick, setTick] = useState(false);
  useEffect(() => {
    if (value !== prev.current) {
      setTick(true);
      setV(value);
      prev.current = value;
      const t = setTimeout(() => setTick(false), 400);
      return () => clearTimeout(t);
    }
  }, [value]);
  return <span className={`ticker mono ${tick ? 'tick' : ''}`}>{fmt ? fmt(v) : v}</span>;
}

function fmtNum(n) { return n.toLocaleString('en-US'); }
function fmtUSDC(n) {
  if (n >= 1000) return '$' + n.toLocaleString('en-US', {maximumFractionDigits: 0});
  if (n >= 1) return '$' + n.toFixed(2);
  return '$' + n.toFixed(4);
}

// JSON renderer with syntax highlighting
function JsonView({ data }) {
  function render(v, indent = 0) {
    const pad = '  '.repeat(indent);
    if (v === null) return <span style={{color:'var(--text-3)'}}>null</span>;
    if (typeof v === 'boolean') return <span style={{color:'var(--violet)'}}>{String(v)}</span>;
    if (typeof v === 'number') return <span style={{color:'var(--amber)'}}>{v}</span>;
    if (typeof v === 'string') return <span style={{color:'var(--accent)'}}>"{v}"</span>;
    if (Array.isArray(v)) {
      return (
        <>
          <span style={{color:'var(--text-2)'}}>[</span>
          {v.map((x, i) => (
            <div key={i} style={{paddingLeft: 16}}>
              {render(x, indent + 1)}{i < v.length - 1 && <span style={{color:'var(--text-2)'}}>,</span>}
            </div>
          ))}
          <span style={{color:'var(--text-2)'}}>{pad}]</span>
        </>
      );
    }
    if (typeof v === 'object') {
      const keys = Object.keys(v);
      return (
        <>
          <span style={{color:'var(--text-2)'}}>{'{'}</span>
          {keys.map((k, i) => (
            <div key={k} style={{paddingLeft: 16}}>
              <span style={{color:'var(--cyan)'}}>"{k}"</span>
              <span style={{color:'var(--text-2)'}}>: </span>
              {render(v[k], indent + 1)}
              {i < keys.length - 1 && <span style={{color:'var(--text-2)'}}>,</span>}
            </div>
          ))}
          <span style={{color:'var(--text-2)'}}>{pad}{'}'}</span>
        </>
      );
    }
    return String(v);
  }
  return <div className="json-line" style={{padding: 14, fontFamily:'JetBrains Mono', fontSize: 11.5, lineHeight: 1.55}}>{render(data)}</div>;
}

// Simple icons
const Icons = {
  feed: (<svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M2 4h10M2 7h10M2 10h7" stroke="currentColor" strokeWidth="1.2" strokeLinecap="square"/></svg>),
  board: (<svg width="14" height="14" viewBox="0 0 14 14" fill="none"><rect x="2" y="9" width="2.5" height="3" stroke="currentColor" strokeWidth="1"/><rect x="5.75" y="6" width="2.5" height="6" stroke="currentColor" strokeWidth="1"/><rect x="9.5" y="3" width="2.5" height="9" stroke="currentColor" strokeWidth="1"/></svg>),
  merch: (<svg width="14" height="14" viewBox="0 0 14 14" fill="none"><circle cx="7" cy="5" r="2.2" stroke="currentColor" strokeWidth="1"/><path d="M2.5 12c0-2.5 2-4 4.5-4s4.5 1.5 4.5 4" stroke="currentColor" strokeWidth="1"/></svg>),
  alert: (<svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M7 1.5L13 12H1L7 1.5z" stroke="currentColor" strokeWidth="1"/><path d="M7 5.5v3" stroke="currentColor" strokeWidth="1.2"/><circle cx="7" cy="10.3" r="0.6" fill="currentColor"/></svg>),
  api: (<svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M5 3l-3 4 3 4M9 3l3 4-3 4" stroke="currentColor" strokeWidth="1" fill="none"/></svg>),
  search: (<svg width="12" height="12" viewBox="0 0 12 12" fill="none"><circle cx="5" cy="5" r="3.5" stroke="currentColor" strokeWidth="1"/><path d="M7.5 7.5L10 10" stroke="currentColor" strokeWidth="1"/></svg>),
  copy: (<svg width="12" height="12" viewBox="0 0 12 12" fill="none"><rect x="3" y="3" width="7" height="7" stroke="currentColor" strokeWidth="1"/><path d="M2 8V2h6" stroke="currentColor" strokeWidth="1"/></svg>),
  ext: (<svg width="10" height="10" viewBox="0 0 10 10" fill="none"><path d="M3 3h4v4M3 7l4-4" stroke="currentColor" strokeWidth="1"/></svg>),
  skull: (<svg width="11" height="11" viewBox="0 0 11 11" fill="none"><path d="M2 5.5C2 3.5 3.5 2 5.5 2s3.5 1.5 3.5 3.5v2.5L7.5 9h-4L2 8V5.5z" stroke="currentColor" strokeWidth="1"/><circle cx="4" cy="5.5" r="0.7" fill="currentColor"/><circle cx="7" cy="5.5" r="0.7" fill="currentColor"/></svg>),
  chev: (<svg width="10" height="10" viewBox="0 0 10 10" fill="none"><path d="M4 2l3 3-3 3" stroke="currentColor" strokeWidth="1.2"/></svg>),
};

Object.assign(window, {
  ScoreRing, ScoreBadge, Sparkline, StatusIcon, CatPill, AddrLink, Latency,
  StatCard, BarRow, ReliabilityChart, Counter, JsonView, Icons,
  fmtNum, fmtUSDC,
});
