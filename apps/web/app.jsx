/* Main App — real API data wired into the Repute design */

function App() {
  const [page, setPage] = useState('feed');
  const [selectedMerchant, setSelectedMerchant] = useState(1);
  const [paused, setPaused] = useState(false);

  // Feed state — empty until SSE/snapshot delivers real data
  const [feed, setFeed] = useState([]);

  // Stats state — from real API, no hardcoded fallback values
  const [stats, setStats] = useState(() => ({
    payments: window.REPUTE_STATE?.stats?.payments || 0,
    merchants: window.REPUTE_STATE?.stats?.merchants || 0,
    vol24: window.REPUTE_STATE?.stats?.vol24 || 0,
    failRate: window.REPUTE_STATE?.stats?.failRate || 0,
    activeFraud: window.REPUTE_STATE?.stats?.activeFraud || 0,
    block: window.REPUTE_STATE?.stats?.block || 0,
    pm: window.REPUTE_STATE?.stats?.pm || 0,
  }));

  // ── Subscribe to API events ───────────────────────────────────────────────

  useEffect(() => {
    const onStats = () => {
      const s = window.REPUTE_STATE?.stats;
      if (!s) return;
      setStats(prev => ({ ...prev, ...s }));
    };
    window.addEventListener('repute:stats', onStats);
    return () => window.removeEventListener('repute:stats', onStats);
  }, []);

  // On merchant update, refresh the feed merchant objects
  useEffect(() => {
    const onMerchants = () => {
      // Feed rows reference merchant objects — refresh on merchant update
      setFeed(prev => prev.map(tx => {
        const updated = window.REPUTE_STATE?.merchants?.find(
          m => m._fullAddr === tx.merchant?._fullAddr
        );
        return updated ? { ...tx, merchant: updated } : tx;
      }));
    };
    window.addEventListener('repute:merchants', onMerchants);
    return () => window.removeEventListener('repute:merchants', onMerchants);
  }, []);

  // Snapshot load — also seeds directly in offline mode because the
  // repute:feed-snapshot event fires before React mounts (Babel is async)
  useEffect(() => {
    const onSnapshot = (e) => {
      if (e.detail?.length) setFeed(e.detail);
    };
    window.addEventListener('repute:feed-snapshot', onSnapshot);

    // Offline: Babel compiles async, so the event from api.js fires before
    // this listener exists. Seed the feed directly on mount instead.
    if (!window.API_BASE && typeof seedFeed === 'function') {
      const demo = seedFeed(50);
      if (demo.length) setFeed(demo);
    }

    return () => window.removeEventListener('repute:feed-snapshot', onSnapshot);
  }, []);

  // Offline demo ticker — adds a new live-looking row every ~1.5s so the
  // feed feels alive on Vercel without a backend
  useEffect(() => {
    if (window.API_BASE) return; // only in offline/demo mode
    const id = setInterval(() => {
      const pool = window.DEMO_MERCHANTS;
      if (!pool?.length || typeof genTx !== 'function') return;
      const m = pool[Math.floor(Math.random() * pool.length)];
      const tx = genTx(m, new Date());
      setFeed(prev => [tx, ...prev].slice(0, 200));
    }, 1500);
    return () => clearInterval(id);
  }, []);

  // ── SSE live feed ─────────────────────────────────────────────────────────

  useEffect(() => {
    if (paused) {
      disconnectSSE();
      return;
    }

    // Connect SSE — real Arc indexer data only
    connectSSE((txs, isSnapshot) => {
      if (isSnapshot) {
        if (txs.length) setFeed(txs);
      } else {
        setFeed(prev => [...txs, ...prev].slice(0, 200));
        setStats(s => ({
          ...s,
          payments: s.payments + txs.length,
          pm: window.REPUTE_STATE?.stats?.pm || s.pm,
        }));
      }
    });

    return () => {
      disconnectSSE();
    };
  }, [paused]);

  // ── Navigation ────────────────────────────────────────────────────────────

  function selectMerchant(id) {
    setSelectedMerchant(id);
    setPage('merchant');
  }

  const alertCount = (() => {
    const a = window.REPUTE_STATE?.alerts || window.ALERTS;
    return (a?.red?.length || 0) + (a?.amber?.length || 0);
  })();

  const counts = {
    feed: 'LIVE',
    battle: 'LIVE',
    merchants: stats.merchants > 0 ? stats.merchants.toLocaleString() : '…',
    alerts: alertCount,
  };

  return (
    <div className="app">
      <Topbar stats={stats} />
      <Sidebar active={page} onNav={setPage} counts={counts} />
      <div className="main">
        {page === 'feed' && (
          <LiveFeed
            feed={feed}
            onSelectMerchant={selectMerchant}
            paused={paused}
            setPaused={setPaused}
            stats={stats}
          />
        )}
        {page === 'battle' && (
          <BattlePanel />
        )}
        {page === 'board' && (
          <Leaderboard onSelectMerchant={selectMerchant} />
        )}
        {page === 'merchant' && (
          <MerchantProfile
            merchantId={selectedMerchant}
            feed={feed}
            onBack={() => setPage('board')}
          />
        )}
        {page === 'alerts' && (
          <Alerts onSelectMerchant={selectMerchant} />
        )}
        {page === 'api' && (
          <ApiExplorer />
        )}
        {page === 'docs' && (
          <DocsPage />
        )}
      </div>
    </div>
  );
}

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(<App />);
