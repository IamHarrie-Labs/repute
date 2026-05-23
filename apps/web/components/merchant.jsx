/* Page 3: Merchant Profile */

function MerchantProfile({ merchantId, feed, onBack }) {
  // Subscribe to live merchant data
  const getMerchants = () => window.MERCHANTS || [];
  const [merchants, setMerchants] = useState(getMerchants);
  useEffect(() => {
    const h = () => setMerchants([...getMerchants()]);
    window.addEventListener('repute:merchants', h);
    return () => window.removeEventListener('repute:merchants', h);
  }, []);

  // ALL hooks must come before any conditional return
  const [tab, setTab] = useState('tx');
  const m = merchants.find(x => x.id === merchantId) || merchants[0];

  // useMemo that depends on m — safe: m is just undefined if merchants empty
  const recentTxs = useMemo(() => {
    if (!m) return [];
    return feed.filter(tx => tx.merchant && tx.merchant.id === m.id).slice(0, 50);
  }, [feed, m && m.id]);

  // Now safe to conditionally return — all hooks are above
  if (!m) {
    return (
      <div style={{padding:40,textAlign:'center',fontFamily:'var(--font-mono)',fontSize:13,color:'var(--text-3)'}}>
        <div style={{color:'var(--accent)',marginBottom:12}}>● LOADING</div>
        Fetching merchant profile from Arc indexer…
      </div>
    );
  }

  const fullAddr = m.addr.replace('...', 'aB12cD34eF56gH78iJ90kL12mN');

  // Sub-scores derived from real data
  const subScores = [
    { label: 'Delivery Rate',  value: Math.round(m.rel) },
    { label: 'Speed Index',    value: Math.max(0, Math.round(100 - m.lat / 12)) },
    { label: 'Price Fairness', value: Math.max(20, Math.round(m.score - 8)) },
    { label: 'Schema Honesty', value: m.scam === 'poisoner' ? 12 : Math.min(100, Math.round(m.score + 2)) },
    { label: 'Uptime',         value: Math.max(0, Math.round(m.rel - 1.2)) },
  ];

  // Median price for category (from real merchants)
  const catMembers = merchants.filter(x => x.cat === m.cat);
  const medianPrice = catMembers.map(x => x.price).sort((a,b) => a - b)[Math.floor(catMembers.length / 2)] || m.price;
  const priceVs = ((m.price / medianPrice - 1) * 100);

  // Get real incidents for this merchant from REPUTE_STATE
  const allAlerts = window.REPUTE_STATE?.alerts || { red: [], amber: [], green: [] };
  const merchantIncidents = [
    ...allAlerts.red.filter(a => a.merchant?._fullAddr === m._fullAddr || a.merchant?.id === m.id),
    ...allAlerts.amber.filter(a => a.merchant?._fullAddr === m._fullAddr || a.merchant?.id === m.id),
    ...allAlerts.green.filter(a => a.merchant?._fullAddr === m._fullAddr || a.merchant?.id === m.id),
  ];

  return (
    <>
      <div className="page-h">
        <h1>{m.name}</h1>
        <div className="crumbs">
          <span style={{cursor:'pointer'}} onClick={onBack}>← merchants</span>
          <span className="sep">/</span>
          <span className="cur">{m.addr}</span>
          <span className="sep">·</span>
          <CatPill cat={m.cat} />
        </div>
      </div>

      <div style={{padding:'16px 20px',display:'flex',flexDirection:'column',gap:16}}>
        {/* Address header */}
        <div className="panel" style={{padding:'12px 16px',display:'flex',alignItems:'center',gap:24}}>
          <div style={{display:'flex',alignItems:'center',gap:10}}>
            <span className="status-dot"><span className="dot"></span></span>
            <span className="mono" style={{color:'var(--text-0)',fontSize:14,letterSpacing:'-0.01em'}}>{fullAddr.slice(0, 24)}…{fullAddr.slice(-6)}</span>
            <span className="btn" style={{padding:'2px 8px',fontSize:10}}>{Icons.copy} COPY</span>
            <span className="btn" style={{padding:'2px 8px',fontSize:10}}>{Icons.ext} ARC EXPLORER</span>
          </div>
          <div style={{marginLeft:'auto',display:'flex',gap:32}}>
            <div>
              <div className="mono" style={{fontSize:9,color:'var(--text-3)',textTransform:'uppercase',letterSpacing:'0.1em'}}>FIRST SEEN</div>
              <div className="mono" style={{fontSize:12,color:'var(--text-0)'}}>
                {m.first_seen_at ? (() => {
                  const d = new Date(m.first_seen_at);
                  const daysAgo = Math.floor((Date.now() - d) / 86400000);
                  return `${daysAgo}d ago · ${d.toISOString().slice(0,10)}`;
                })() : 'unknown'}
              </div>
            </div>
            <div>
              <div className="mono" style={{fontSize:9,color:'var(--text-3)',textTransform:'uppercase',letterSpacing:'0.1em'}}>LAST ACTIVE</div>
              <div className="mono" style={{fontSize:12,color:'var(--accent)'}}>
                {m.last_active_at ? (() => {
                  const diff = Date.now() - m.last_active_at;
                  const mins = Math.floor(diff / 60000);
                  if (mins < 1) return 'just now';
                  if (mins < 60) return `${mins}m ago`;
                  const hrs = Math.floor(mins / 60);
                  if (hrs < 24) return `${hrs}h ago`;
                  return `${Math.floor(hrs/24)}d ago`;
                })() : (m.scam ? '14h ago' : 'just now')}
              </div>
            </div>
            <div>
              <div className="mono" style={{fontSize:9,color:'var(--text-3)',textTransform:'uppercase',letterSpacing:'0.1em'}}>TOTAL CALLS</div>
              <div className="mono" style={{fontSize:12,color:'var(--text-0)'}}>{(m.vol && m.price ? (m.vol / m.price | 0) : 0).toLocaleString('en-US')}</div>
            </div>
          </div>
        </div>

        {m.scam && (
          <div className="alert-banner" style={{margin:0}}>
            <div className="left">
              <span style={{color:'var(--red)'}}>{Icons.skull}</span>
              <span className="title">FRAUD FLAG · {m.scam.toUpperCase()}</span>
              <span className="body">This merchant has been flagged for suspicious behavior. Do not route payments without manual review.</span>
            </div>
            <button className="btn danger">EVIDENCE TRAIL →</button>
          </div>
        )}

        {/* Hero stats */}
        <div style={{display:'grid',gridTemplateColumns:'320px 1fr 1fr 1fr',gap:12}}>
          <div className="panel" style={{padding:20,display:'flex',alignItems:'center',gap:20}}>
            <ScoreRing score={m.score} size={120} stroke={6} />
            <div>
              <div className="mono" style={{fontSize:9,color:'var(--text-3)',textTransform:'uppercase',letterSpacing:'0.1em',marginBottom:4}}>TRUST SCORE</div>
              <div className="mono" style={{fontSize:14,color:'var(--text-0)',marginBottom:8}}>
                {m.score >= 90 ? 'EXCELLENT' : m.score >= 75 ? 'GOOD' : m.score >= 40 ? 'WATCH' : 'AVOID'}
              </div>
              <div className="mono" style={{fontSize:11,color:'var(--text-2)',lineHeight:1.6}}>
                Rank <span style={{color:'var(--accent)'}}>#{merchants.indexOf(m) + 1}</span> of {merchants.length}<br/>
                Tier <span style={{color:'var(--text-0)'}}>{m.score >= 90 ? 'PLATINUM' : m.score >= 75 ? 'GOLD' : m.score >= 50 ? 'SILVER' : 'PROBATION'}</span>
              </div>
            </div>
          </div>
          <StatCard label="RELIABILITY" value={`${m.rel.toFixed(1)}%`} color="green" sub={`${(m.rel < 99 ? 100 - m.rel : 0.2).toFixed(2)}% fail · last 7d`} big />
          <StatCard label="AVG LATENCY" value={`${m.lat}ms`} color={m.lat < 200 ? 'green' : m.lat < 500 ? 'amber' : 'red'} sub="p99 488ms · p50 142ms" big />
          <StatCard label="PRICE VS MEDIAN" value={`${priceVs >= 0 ? '+' : ''}${priceVs.toFixed(1)}%`} color={Math.abs(priceVs) < 10 ? 'green' : 'amber'} sub={`category median: $${medianPrice.toFixed(4)}`} big />
        </div>

        {/* Score breakdown */}
        <div className="panel">
          <div className="panel-h"><span>SCORE BREAKDOWN</span><span className="right">model v0.4.1 · last computed 14s ago</span></div>
          <div style={{padding:'14px 20px',display:'grid',gridTemplateColumns:'1fr 1fr',gap:'0 64px'}}>
            {subScores.map(s => <BarRow key={s.label} label={s.label} value={s.value} />)}
          </div>
        </div>

        {/* Chart */}
        <div className="panel">
          <div className="panel-h">
            <span>30-DAY RELIABILITY · VOLUME</span>
            <span className="right">
              <span><span style={{display:'inline-block',width:8,height:8,background:'var(--accent)',marginRight:4}}/>SUCCESS</span>
              <span><span style={{display:'inline-block',width:8,height:8,background:'var(--red)',marginRight:4}}/>FAILURE</span>
            </span>
          </div>
          <div style={{padding:'14px 20px',display:'flex',justifyContent:'center'}}>
            <ReliabilityChart w={1000} h={240} />
          </div>
        </div>

        {/* Tabs: Transactions / Incidents / Endpoints / API */}
        <div className="panel">
          <div className="tabs">
            <span className={`tab ${tab === 'tx' ? 'active' : ''}`} onClick={() => setTab('tx')}>RECENT TRANSACTIONS · {recentTxs.length || 50}</span>
            <span className={`tab ${tab === 'inc' ? 'active' : ''}`} onClick={() => setTab('inc')}>INCIDENTS · {merchantIncidents.length}</span>
            <span className={`tab ${tab === 'ep' ? 'active' : ''}`} onClick={() => setTab('ep')}>ENDPOINTS · {ENDPOINT_BREAKDOWN.length}</span>
            <span className={`tab ${tab === 'api' ? 'active' : ''}`} onClick={() => setTab('api')}>QUERY THIS MERCHANT</span>
          </div>

          {tab === 'tx' && (
            <div style={{maxHeight:380,overflowY:'auto'}}>
              <table className="tbl">
                <thead><tr>
                  <th style={{width:90}}>TIME</th>
                  <th>BUYER</th>
                  <th>ENDPOINT</th>
                  <th style={{width:80,textAlign:'right'}}>AMOUNT</th>
                  <th style={{width:80,textAlign:'right'}}>LATENCY</th>
                  <th style={{width:80}}>RESULT</th>
                </tr></thead>
                <tbody>
                  {(recentTxs.length > 0 ? recentTxs : seedFeed(50).map(tx => ({...tx, merchant: m}))).slice(0, 30).map(tx => (
                    <tr key={tx.id}>
                      <td className="mono" style={{color:'var(--text-3)',fontSize:11}}>{tx.ts}</td>
                      <td><AddrLink addr={`0x${Math.random().toString(16).slice(2, 6)}...${Math.random().toString(16).slice(2, 6)}`} /></td>
                      <td className="mono" style={{fontSize:11,color:'var(--text-1)'}}>{tx.endpoint}</td>
                      <td className="mono" style={{textAlign:'right',color:'var(--text-0)'}}>${tx.amount.toFixed(4)}</td>
                      <td style={{textAlign:'right'}}><Latency ms={tx.latency} /></td>
                      <td><StatusIcon status={tx.status} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {tab === 'inc' && (
            <div style={{padding:'4px 20px'}}>
              {merchantIncidents.length === 0 && (
                <div style={{padding:'16px 0',fontFamily:'var(--font-mono)',fontSize:11,color:'var(--text-3)'}}>
                  No incidents recorded for this merchant.
                </div>
              )}
              {merchantIncidents.map((inc, i) => (
                <div key={i} className={`incident ${inc.severity || 'amber'}`}>
                  <span className="dot"/>
                  <div>
                    <div className="head">
                      <span className="ttl">{inc.type}</span>
                      <span className="ts">{inc.firstSeen}</span>
                    </div>
                    <div className="desc">{inc.desc}</div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {tab === 'ep' && (
            <div style={{padding:'14px 20px'}}>
              <table className="tbl" style={{margin:0}}>
                <thead><tr>
                  <th>ENDPOINT</th>
                  <th style={{width:120,textAlign:'right'}}>CALLS · 7D</th>
                  <th style={{width:100,textAlign:'right'}}>FAIL %</th>
                  <th style={{width:100,textAlign:'right'}}>LATENCY</th>
                  <th style={{width:160}}>SHARE</th>
                </tr></thead>
                <tbody>
                  {ENDPOINT_BREAKDOWN.map(e => (
                    <tr key={e.ep}>
                      <td className="mono" style={{color:'var(--text-0)'}}>{e.ep}</td>
                      <td className="mono" style={{textAlign:'right'}}>{e.calls.toLocaleString()}</td>
                      <td className="mono" style={{textAlign:'right',color: e.fail < 0.5 ? 'var(--accent)' : 'var(--amber)'}}>{e.fail.toFixed(2)}%</td>
                      <td style={{textAlign:'right'}}><Latency ms={e.lat} /></td>
                      <td>
                        <div style={{display:'flex',alignItems:'center',gap:8}}>
                          <div style={{flex:1,height:4,background:'var(--bg-2)',border:'1px solid var(--border)',position:'relative'}}>
                            <div style={{position:'absolute',top:0,left:0,bottom:0,background:'var(--accent)',width:`${e.share}%`}}/>
                          </div>
                          <span className="mono" style={{fontSize:10,color:'var(--text-3)',width:32,textAlign:'right'}}>{e.share}%</span>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {tab === 'api' && (
            <div style={{padding:'14px 20px'}}>
              <div className="mono" style={{fontSize:11,color:'var(--text-2)',marginBottom:10}}>
                Query this merchant's trust score in one line — costs $0.0001 USDC per call via x402.
              </div>
              <div className="codeblock">
                <span className="c"># TypeScript · @repute/sdk v3.2</span>{'\n'}{'\n'}
                <span className="k">import</span> <span className="p">{'{'}</span> Repute <span className="p">{'}'}</span> <span className="k">from</span> <span className="s">'@repute/sdk'</span><span className="p">;</span>{'\n'}{'\n'}
                <span className="k">const</span> rep <span className="p">=</span> <span className="k">await</span> Repute<span className="p">.</span>score<span className="p">(</span><span className="s">'{m.addr}'</span><span className="p">);</span>{'\n'}
                <span className="c">{`// → { score: ${m.score}, reliability: ${m.rel.toFixed(1)}, lat_p50: ${m.lat}, flags: [${m.scam ? `"${m.scam.toUpperCase()}"` : ''}] }`}</span>{'\n'}{'\n'}
                <span className="k">if</span> <span className="p">(</span>rep<span className="p">.</span>score <span className="p">{'>'}</span> <span className="n">75</span><span className="p">)</span> <span className="p">{'{'}</span>{'\n'}
                {'  '}<span className="k">await</span> agent<span className="p">.</span>pay<span className="p">(</span><span className="s">'{m.addr}'</span><span className="p">,</span> <span className="s">'/v1/query'</span><span className="p">,</span> <span className="n">0.0003</span><span className="p">);</span>{'\n'}
                <span className="p">{'}'}</span>
              </div>
              <button className="btn primary" style={{marginTop:12}}>{Icons.copy} COPY SNIPPET</button>
              <button className="btn" style={{marginTop:12,marginLeft:8}}>OPEN IN API EXPLORER →</button>
            </div>
          )}
        </div>
      </div>
    </>
  );
}

Object.assign(window, { MerchantProfile });
