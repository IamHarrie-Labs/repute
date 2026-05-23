/* Topbar + Sidebar shell */

function ThemeToggle() {
  const [theme, setTheme] = useState(() => {
    if (typeof window === 'undefined') return 'dark';
    return localStorage.getItem('repute-theme') || 'dark';
  });

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('repute-theme', theme);
    window.dispatchEvent(new Event('theme-change'));
  }, [theme]);

  const isDark = theme === 'dark';

  return (
    <button
      onClick={() => setTheme(isDark ? 'light' : 'dark')}
      style={{
        display: 'inline-flex', alignItems: 'center', gap: 8,
        background: 'transparent', border: '1px solid var(--border)',
        color: 'var(--text-2)', padding: '4px',
        cursor: 'pointer', height: 28, fontFamily: 'Poppins, system-ui, sans-serif', fontSize: 10,
        letterSpacing: '0.06em', textTransform: 'uppercase'
      }}
      title={`Switch to ${isDark ? 'light' : 'dark'} mode`}>
      
      <span style={{
        padding: '2px 8px',
        background: isDark ? 'var(--accent)' : 'transparent',
        color: isDark ? 'var(--bg-0)' : 'var(--text-3)',
        transition: 'all 0.12s'
      }}>
        <svg width="11" height="11" viewBox="0 0 12 12" fill="none" style={{ display: 'block' }}>
          <path d="M9 6.5A4 4 0 0 1 4.5 2 4 4 0 1 0 9 6.5z" stroke="currentColor" strokeWidth="1" fill={isDark ? 'currentColor' : 'none'} />
        </svg>
      </span>
      <span style={{
        padding: '2px 8px',
        background: !isDark ? 'var(--accent)' : 'transparent',
        color: !isDark ? 'var(--bg-0)' : 'var(--text-3)',
        transition: 'all 0.12s'
      }}>
        <svg width="11" height="11" viewBox="0 0 12 12" fill="none" style={{ display: 'block' }}>
          <circle cx="6" cy="6" r="2.2" stroke="currentColor" strokeWidth="1" fill={!isDark ? 'currentColor' : 'none'} />
          <g stroke="currentColor" strokeWidth="1" strokeLinecap="square">
            <line x1="6" y1="0.5" x2="6" y2="2" />
            <line x1="6" y1="10" x2="6" y2="11.5" />
            <line x1="0.5" y1="6" x2="2" y2="6" />
            <line x1="10" y1="6" x2="11.5" y2="6" />
            <line x1="2" y1="2" x2="3" y2="3" />
            <line x1="9" y1="9" x2="10" y2="10" />
            <line x1="2" y1="10" x2="3" y2="9" />
            <line x1="9" y1="3" x2="10" y2="2" />
          </g>
        </svg>
      </span>
    </button>);

}

function Topbar({ stats }) {
  return (
    <div className="topbar">
      {/* Logo — clicking goes back to landing page */}
      <a href="/" style={{ textDecoration: 'none' }}>
        <div className="brand">
          <span className="mark">
            <span className="word">Repute<span className="dot">.</span></span>
            <span className="underline">
              <span className="seg a"></span>
              <span className="seg b"></span>
              <span className="seg c"></span>
              <span className="seg d"></span>
            </span>
          </span>
          <span className="ver">v0.4.1-arc</span>
        </div>
      </a>

      {/* Condensed stats — smaller text, tighter layout */}
      <div className="topbar-stats">
        <div className="tstat">
          <div className="label">PAYMENTS</div>
          <div className="value"><Counter value={stats.payments} fmt={fmtNum} /></div>
        </div>
        <div className="tstat">
          <div className="label">MERCHANTS</div>
          <div className="value"><Counter value={stats.merchants} fmt={fmtNum} /></div>
        </div>
        <div className="tstat">
          <div className="label">VOL 24H</div>
          <div className="value">$<Counter value={stats.vol24} fmt={(n) => n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} /></div>
        </div>
        <div className="tstat">
          <div className="label">FAIL · 1H</div>
          <div className="value amber">{stats.failRate.toFixed(2)}%</div>
        </div>
      </div>

      <div className="topbar-right">
        <div className="kbd-input" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ color: 'var(--text-3)' }}>{Icons.search}</span>
          <input
            style={{ background: 'transparent', border: 'none', outline: 'none', color: 'var(--text-1)', fontFamily: 'inherit', fontSize: 'inherit', width: '100%' }}
            placeholder="Search merchant or 0x..." />
          <span className="mono" style={{ color: 'var(--text-4)', fontSize: 10 }}>⌘K</span>
        </div>

        <div className="fraud-badge">
          <span className="dot"></span>
          {stats.activeFraud} ACTIVE FRAUD
        </div>

        <div className="status-dot">
          <span className="dot"></span>
          ARC TESTNET · BLOCK {stats.block.toLocaleString()}
        </div>

        <ThemeToggle />
      </div>
    </div>);
}

function Sidebar({ active, onNav, counts }) {
  const battleIcon = (
    <svg width="13" height="13" viewBox="0 0 13 13" fill="none" style={{marginRight:8}}>
      <path d="M2 10L6.5 3L11 10" stroke="currentColor" strokeWidth="1.2" strokeLinejoin="round"/>
      <circle cx="6.5" cy="2.5" r="1.2" fill="currentColor"/>
    </svg>
  );

  const items = [
  { id: 'feed',    label: 'Live Feed',       icon: Icons.feed,  count: counts.feed },
  { id: 'battle',  label: 'Live Benchmark',  icon: battleIcon,  count: counts.battle ?? 'NEW', alert: false },
  { id: 'board',   label: 'Leaderboard',     icon: Icons.board, count: counts.merchants },
  { id: 'merchant',label: 'Merchants',       icon: Icons.merch },
  { id: 'alerts',  label: 'Alerts',          icon: Icons.alert, count: counts.alerts, alert: true },
  { id: 'api',     label: 'API Explorer',    icon: Icons.api },
  { id: 'docs',    label: 'Documentation',    icon: Icons.ext }];

  return (
    <div className="sidebar">
      <div className="nav-section">Intelligence</div>
      {items.map((it) =>
      <div
        key={it.id}
        className={`nav-item ${active === it.id ? 'active' : ''}`}
        onClick={() => onNav(it.id)}>
        
          <span style={{ display: 'flex', alignItems: 'center' }}>
            <span className="ico">{it.icon}</span>
            {it.label}
          </span>
          {it.count !== undefined &&
        <span className="count" style={it.alert && it.count > 0 ? { color: 'var(--red)' } : {}}>
              {it.count}
            </span>
        }
        </div>
      )}

      <div className="nav-section">Tools</div>
      <div className="nav-item"><span style={{ display: 'flex', alignItems: 'center' }}><span className="ico">{Icons.api}</span>SDK · TS</span><span className="count">v3.2</span></div>
      <div className="nav-item"><span style={{ display: 'flex', alignItems: 'center' }}><span className="ico">{Icons.api}</span>SDK · PY</span><span className="count">v1.4</span></div>
      <div className="nav-item"><span style={{ display: 'flex', alignItems: 'center' }}><span className="ico">{Icons.ext}</span>x402 Spec</span></div>

      <div className="sidebar-foot">
        <div className="row"><span>NETWORK</span><span className="v">arc-testnet</span></div>
        <div className="row"><span>RPC</span><span className="v">rpc.arc.xyz</span></div>
        <div className="row"><span>UPTIME</span><span className="v" style={{ color: 'var(--accent)' }}>99.998%</span></div>
        <div className="row"><span>OPERATOR</span><span className="v">agent.0x4d2A</span></div>
      </div>
    </div>);

}

Object.assign(window, { Topbar, Sidebar });