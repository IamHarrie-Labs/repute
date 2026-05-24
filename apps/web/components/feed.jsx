/* Page 1: Live Feed */

function FeedRow({ tx, isNew }) {
  return (
    <div className={`feed-row ${isNew ? 'new' : ''}`}>
      <span className="ts">{tx.ts}</span>
      <span style={{display:'flex',alignItems:'center',gap:6,minWidth:0,overflow:'hidden'}}>
        <ScoreBadge score={tx.merchant.score} />
        <span style={{display:'flex',alignItems:'center',gap:4,minWidth:0,overflow:'hidden'}}>
          <AddrLink addr={tx.merchant.addr} />
          <span style={{color:'var(--text-3)',fontSize:10,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap',flexShrink:1}}>· {tx.merchant.name}</span>
        </span>
      </span>
      <span className="ep" style={{overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{tx.endpoint}</span>
      <span className="amt">${tx.amount.toFixed(4)}</span>
      <span style={{textAlign:'right'}}><Latency ms={tx.latency} /></span>
      <span><StatusIcon status={tx.status} /> <span style={{color:'var(--text-3)',fontSize:10}}>{tx.status === 'ok' ? 'delivered' : tx.status === 'fail' ? 'failed' : 'suspect'}</span></span>
      <span><CatPill cat={tx.merchant.cat} small /></span>
    </div>
  );
}

function FeedFilterBar({ filter, setFilter, paused, setPaused }) {
  const cats = ['ALL', 'Data', 'Compute', 'AI', 'Oracle', 'Storage'];
  const statuses = ['ALL', 'OK', 'FAIL', 'SUSPECT'];
  return (
    <div style={{display:'flex',alignItems:'center',padding:'8px 14px 10px',borderBottom:'1px solid var(--border)',gap:24,background:'var(--bg-0)',flexWrap:'wrap'}}>
      <div style={{display:'flex',alignItems:'center',gap:8}}>
        <span className="mono" style={{fontSize:10,color:'var(--text-3)',letterSpacing:'0.08em'}}>CATEGORY</span>
        <div style={{display:'flex',gap:0,border:'1px solid var(--border)'}}>
          {cats.map(c => (
            <span key={c}
              onClick={() => setFilter(f => ({...f, cat: c}))}
              className="mono"
              style={{
                padding:'4px 10px',
                fontSize:10,
                cursor:'pointer',
                color: filter.cat === c ? 'var(--bg-0)' : 'var(--text-2)',
                background: filter.cat === c ? 'var(--accent)' : 'transparent',
                textTransform:'uppercase',letterSpacing:'0.04em',
                borderRight:'1px solid var(--border)',
              }}
            >{c}</span>
          ))}
        </div>
      </div>

      <div style={{display:'flex',alignItems:'center',gap:8}}>
        <span className="mono" style={{fontSize:10,color:'var(--text-3)',letterSpacing:'0.08em'}}>STATUS</span>
        <div style={{display:'flex',gap:0,border:'1px solid var(--border)'}}>
          {statuses.map(c => (
            <span key={c}
              onClick={() => setFilter(f => ({...f, status: c}))}
              className="mono"
              style={{
                padding:'4px 10px',
                fontSize:10,
                cursor:'pointer',
                color: filter.status === c ? 'var(--bg-0)' : 'var(--text-2)',
                background: filter.status === c ? 'var(--accent)' : 'transparent',
                textTransform:'uppercase',letterSpacing:'0.04em',
                borderRight:'1px solid var(--border)',
              }}
            >{c}</span>
          ))}
        </div>
      </div>

      <div style={{display:'flex',alignItems:'center',gap:8}}>
        <span className="mono" style={{fontSize:10,color:'var(--text-3)',letterSpacing:'0.08em'}}>MIN SCORE</span>
        <input
          type="range" min="0" max="100" value={filter.minScore}
          onChange={e => setFilter(f => ({...f, minScore: +e.target.value}))}
          style={{width:80, accentColor:'#00FF87'}}
        />
        <span className="mono" style={{fontSize:11,color:'var(--text-1)',width:24}}>{filter.minScore}</span>
      </div>

      <div style={{marginLeft:'auto', display:'flex', gap:8}}>
        <button className="btn" onClick={() => setPaused(p => !p)}>
          {paused ? '▶  RESUME' : '❚❚  PAUSE'}
        </button>
        <button className="btn">EXPORT CSV</button>
      </div>
    </div>
  );
}

function RightStatsPanel({ feed, stats }) {
  // Re-render when alerts, merchants, or battle state updates
  const [_v, forceUpdate] = useState(0);
  useEffect(() => {
    const h = () => forceUpdate(v => v + 1);
    window.addEventListener('repute:alerts', h);
    window.addEventListener('repute:merchants', h);
    window.addEventListener('repute:battle', h);
    return () => {
      window.removeEventListener('repute:alerts', h);
      window.removeEventListener('repute:merchants', h);
      window.removeEventListener('repute:battle', h);
    };
  }, []);

  const perMin = stats.pm;
  const failRate = stats.failRate;
  const liveMerchants = window.REPUTE_STATE?.merchants || window.MERCHANTS || [];
  const newMerch = liveMerchants.length;

  // USDC saved = what ReputeAgent avoided paying vs what NaiveAgent wasted
  const battleState = window.REPUTE_STATE?.battle || null;
  const usdcSaved = battleState
    ? Math.max(0, (battleState.naive?.wasted_usdc || 0) - (battleState.repute?.wasted_usdc || 0))
    : (stats.usdcSaved || 0);

  const liveAlerts = window.REPUTE_STATE?.alerts || { red: [], amber: [], green: [] };
  const topFraudFlag = liveAlerts.red[0] || liveAlerts.amber[0] || null;

  // Endpoint volume bars
  const epStats = useMemo(() => {
    const map = {};
    feed.slice(0, 200).forEach(tx => {
      map[tx.endpoint] = (map[tx.endpoint] || 0) + 1;
    });
    const arr = Object.entries(map).map(([ep, c]) => ({ep, c}));
    arr.sort((a,b) => b.c - a.c);
    const max = arr[0] ? arr[0].c : 1;
    return arr.slice(0, 6).map(x => ({...x, pct: (x.c / max) * 100}));
  }, [feed]);

  return (
    <div style={{display:'flex',flexDirection:'column',gap:12,padding:'12px 16px 16px',width:'100%',overflowY:'auto'}}>
      <div className="panel">
        <div className="panel-h"><span>FLOW · LIVE</span><span className="right"><span style={{color:'var(--accent)'}}>● </span>STREAMING</span></div>
        <div style={{padding:14,display:'grid',gridTemplateColumns:'1fr 1fr',gap:12}}>
          <StatCard label="PAYMENTS / MIN" value={<Counter value={perMin} fmt={fmtNum} />} sub="live from indexer" color="green" />
          <StatCard label="FAIL RATE · 1H" value={`${failRate.toFixed(2)}%`} color="amber" sub="failed / total calls" />
          <StatCard label="MERCHANTS TRACKED" value={<Counter value={newMerch} fmt={fmtNum} />} color="green" sub="scored this cycle" />
          <StatCard label="USDC SAVED" value={`$${usdcSaved.toFixed(4)}`} sub="ReputeAgent vs Naive" color="green" />
        </div>
      </div>

      <div className="panel">
        <div className="panel-h"><span>TOP ENDPOINTS · 60s</span></div>
        <div style={{padding:'10px 14px',display:'flex',flexDirection:'column',gap:8}}>
          {epStats.map(e => (
            <div key={e.ep} style={{display:'grid',gridTemplateColumns:'1fr 32px',gap:8,alignItems:'center'}}>
              <div>
                <div className="mono" style={{fontSize:11,color:'var(--text-1)',marginBottom:3}}>{e.ep}</div>
                <div style={{height:4,background:'var(--bg-2)',position:'relative',border:'1px solid var(--border)'}}>
                  <div style={{position:'absolute',top:0,left:0,bottom:0,background:'var(--accent)',width:`${e.pct}%`}}/>
                </div>
              </div>
              <div className="mono" style={{fontSize:11,color:'var(--text-0)',textAlign:'right'}}>{e.c}</div>
            </div>
          ))}
        </div>
      </div>

      <div className="panel">
        <div className="panel-h"><span>MERCHANTS · TRACKED</span><span className="right" style={{color:'var(--accent)',fontVariantNumeric:'tabular-nums'}}>{newMerch > 0 ? newMerch : '…'} live</span></div>
        <div style={{padding:'10px 14px',display:'flex',flexDirection:'column',gap:6}}>
          {(window.REPUTE_STATE?.merchants || window.MERCHANTS || []).slice(0, 5).map(m => (
            <div key={m.id} style={{display:'flex',justifyContent:'space-between',alignItems:'center',padding:'4px 0'}}>
              <div style={{display:'flex',alignItems:'center',gap:8,minWidth:0}}>
                <ScoreBadge score={m.score} />
                <AddrLink addr={m.addr} />
              </div>
              <CatPill cat={m.cat} small />
            </div>
          ))}
        </div>
      </div>

      {topFraudFlag ? (
        <div className="panel">
          <div className="panel-h" style={{color:'var(--red)',borderBottomColor:'rgba(239,68,68,0.3)'}}>
            <span>⚠ TOP FRAUD FLAG</span><span className="right">{topFraudFlag.severity?.toUpperCase() || 'CRITICAL'}</span>
          </div>
          <div style={{padding:14}}>
            <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:8}}>
              <AddrLink addr={topFraudFlag.merchant.addr} color="var(--red)" />
              <span className="pill err">{topFraudFlag.type}</span>
            </div>
            <div className="mono" style={{fontSize:11,color:'var(--text-2)',marginBottom:10,lineHeight:1.5}}>
              {topFraudFlag.desc}
            </div>
            <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'4px 12px',fontSize:10,fontFamily:'JetBrains Mono'}}>
              <span style={{color:'var(--text-3)'}}>EVIDENCE</span>
              <span style={{color:'var(--text-0)',textAlign:'right'}}>{topFraudFlag.evidence} txs</span>
              <span style={{color:'var(--text-3)'}}>USDC LOST</span>
              <span style={{color:'var(--red)',textAlign:'right'}}>${topFraudFlag.lost.toFixed(4)}</span>
              <span style={{color:'var(--text-3)'}}>FIRST SEEN</span>
              <span style={{color:'var(--text-0)',textAlign:'right'}}>{topFraudFlag.firstSeen}</span>
            </div>
            <button className="btn danger" style={{width:'100%',marginTop:12,justifyContent:'center'}}>VIEW EVIDENCE TRAIL</button>
          </div>
        </div>
      ) : (
        <div className="panel">
          <div className="panel-h" style={{color:'var(--text-3)'}}>
            <span>FRAUD FLAGS</span><span className="right">MONITORING</span>
          </div>
          <div style={{padding:14,fontFamily:'var(--font-mono)',fontSize:11,color:'var(--text-3)'}}>
            No active flags detected.
          </div>
        </div>
      )}
    </div>
  );
}

function LiveFeed({ feed, onSelectMerchant, paused, setPaused, stats }) {
  const [filter, setFilter] = useState({ cat: 'ALL', status: 'ALL', minScore: 0 });

  const filtered = useMemo(() => {
    return feed.filter(tx => {
      if (filter.cat !== 'ALL' && tx.merchant.cat !== filter.cat) return false;
      if (filter.status === 'OK' && tx.status !== 'ok') return false;
      if (filter.status === 'FAIL' && tx.status !== 'fail') return false;
      if (filter.status === 'SUSPECT' && tx.status !== 'warn') return false;
      if (tx.merchant.score < filter.minScore) return false;
      return true;
    });
  }, [feed, filter]);

  return (
    <>
      <div className="page-h">
        <h1>LIVE FEED · x402 PAYMENTS</h1>
        <div className="crumbs">
          <span>arc.payments</span><span className="sep">/</span>
          <span className="cur">stream</span>
          <span className="sep">·</span>
          <span style={{color:paused ? 'var(--amber)' : 'var(--accent)'}}>● {paused ? 'PAUSED' : 'STREAMING'}</span>
        </div>
      </div>

      <div style={{display:'grid',gridTemplateColumns:'1fr 360px',height:'calc(100vh - 64px - 53px)',minHeight:0}}>
        <div style={{display:'flex',flexDirection:'column',borderRight:'1px solid var(--border)',minWidth:0,minHeight:0}}>
          <FeedFilterBar filter={filter} setFilter={setFilter} paused={paused} setPaused={setPaused} />

          {/* Column header */}
          <div className="feed-row" style={{cursor:'default',background:'var(--bg-0)',color:'var(--text-3)',fontSize:10,textTransform:'uppercase',letterSpacing:'0.08em',borderBottom:'1px solid var(--border)'}}>
            <span>TIME</span>
            <span>MERCHANT</span>
            <span>ENDPOINT</span>
            <span style={{textAlign:'right'}}>AMOUNT</span>
            <span style={{textAlign:'right'}}>LATENCY</span>
            <span>STATUS</span>
            <span>CAT</span>
          </div>

          {/* Feed */}
          <div style={{overflowY:'auto',flex:1,minHeight:0}}>
            {filtered.slice(0, 80).map((tx, i) => (
              <div key={tx.id} onClick={() => onSelectMerchant(tx.merchant.id)}>
                <FeedRow tx={tx} isNew={i === 0 && !paused} />
              </div>
            ))}
          </div>
        </div>

        <div style={{overflowY:'auto'}}>
          <RightStatsPanel feed={feed} stats={stats} />
        </div>
      </div>
    </>
  );
}

Object.assign(window, { LiveFeed });
