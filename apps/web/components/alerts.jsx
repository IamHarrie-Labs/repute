/* Page 4: Fraud & Scam Alerts */

function AlertCard({ alert, severity, onClick }) {
  return (
    <div className={`alert-card ${severity}`} onClick={onClick}>
      <div className="head">
        <div style={{display:'flex',flexDirection:'column',gap:4}}>
          <span className="addr-l">{alert.merchant.name}</span>
          <AddrLink addr={alert.merchant.addr} />
        </div>
        <span className={`pill ${severity === 'red' ? 'err' : severity === 'amber' ? 'warn' : 'ok'}`}>
          {alert.type}
        </span>
      </div>

      <div className="mono" style={{fontSize:11,color:'var(--text-2)',lineHeight:1.5}}>
        {alert.desc}
      </div>

      {severity !== 'green' && (
        <div className="meta">
          <span>FIRST SEEN</span><span className="v" style={{textAlign:'right'}}>{alert.firstSeen}</span>
          <span>EVIDENCE</span><span className="v" style={{textAlign:'right'}}>{alert.evidence} txs</span>
          <span>USDC LOST</span><span className="v" style={{textAlign:'right',color: alert.lost > 50 ? 'var(--red)' : 'var(--amber)'}}>${alert.lost.toFixed(2)}</span>
          <span>SEVERITY</span><span className="v" style={{textAlign:'right',textTransform:'uppercase'}}>{alert.severity}</span>
        </div>
      )}

      {severity === 'green' && (
        <div className="meta">
          <span>RESOLVED</span><span className="v" style={{textAlign:'right',color:'var(--accent)'}}>{alert.firstSeen}</span>
        </div>
      )}
    </div>
  );
}

function FraudTrail({ alert }) {
  return (
    <div className="panel">
      <div className="panel-h" style={{color:'var(--red)',borderBottomColor:'rgba(239,68,68,0.3)'}}>
        <span>EVIDENCE TRAIL · {alert.merchant.addr}</span>
        <span className="right">{alert.evidence} TXS · ${alert.lost.toFixed(2)} LOST</span>
      </div>
      <div style={{padding:'4px 20px'}}>
        {FRAUD_TRAIL.map((ev, i) => (
          <div key={i} className={`incident ${ev.severity}`}>
            <span className="dot"/>
            <div>
              <div className="head">
                <span className="ttl">{ev.title}</span>
                <span className="ts">{ev.ts}</span>
              </div>
              <div className="desc">{ev.desc}</div>
            </div>
          </div>
        ))}
      </div>

      {/* Raw data trail */}
      <div style={{padding:'14px 20px',borderTop:'1px solid var(--border)'}}>
        <div className="mono" style={{fontSize:10,color:'var(--text-3)',textTransform:'uppercase',letterSpacing:'0.08em',marginBottom:8}}>RAW DATA · LAST 5 BAD RESPONSES</div>
        <div className="codeblock" style={{fontSize:10.5}}>
          <span className="c">[14:22:11] tx 0x3a8f... expected:</span> <span className="p">{'{'}</span> <span className="b">"price"</span><span className="p">:</span> <span className="n">2418.50</span> <span className="p">{'}'}</span>{'\n'}
          <span className="c">[14:22:11] tx 0x3a8f...   actual:</span> <span className="p">{'{'}</span> <span className="b">"price"</span><span className="p">:</span> <span className="s">"2418.50 USD (approx)"</span> <span className="p">{'}'}</span> <span style={{color:'var(--red)'}}>✗ TYPE MISMATCH</span>{'\n'}
          <span className="c">[14:21:48] tx 0xb12c... expected:</span> <span className="p">{'{'}</span> <span className="b">"confidence"</span><span className="p">:</span> <span className="n">0.97</span> <span className="p">{'}'}</span>{'\n'}
          <span className="c">[14:21:48] tx 0xb12c...   actual:</span> <span className="p">{'{'}</span> <span className="p">{'}'}</span> <span style={{color:'var(--red)'}}>✗ MISSING FIELD</span>{'\n'}
          <span className="c">[14:21:30] tx 0xc91d... </span>HTTP 200 · body length: 0 <span style={{color:'var(--red)'}}>✗ EMPTY BODY</span>{'\n'}
          <span className="c">[14:21:14] tx 0x4e02... </span>HTTP 200 · drift score: <span style={{color:'var(--red)'}}>0.84</span>{'\n'}
          <span className="c">[14:20:58] tx 0xd23a... </span>HTTP 200 · drift score: <span style={{color:'var(--red)'}}>0.81</span>
        </div>
      </div>
    </div>
  );
}

function Alerts({ onSelectMerchant }) {
  // Subscribe to live alert updates from api.js
  const getAlerts = () => window.REPUTE_STATE?.alerts || window.ALERTS || { red: [], amber: [], green: [] };
  const [alerts, setAlerts] = useState(getAlerts);

  useEffect(() => {
    const h = () => setAlerts({ ...getAlerts() });
    window.addEventListener('repute:alerts', h);
    return () => window.removeEventListener('repute:alerts', h);
  }, []);

  const [selected, setSelected] = useState(null);
  // Auto-select first critical alert when data arrives
  useEffect(() => {
    if (!selected && alerts.red.length > 0) setSelected(alerts.red[0]);
  }, [alerts.red.length]);

  const totalLost = [...alerts.red, ...alerts.amber].reduce((a, b) => a + b.lost, 0);
  const totalFlagged = alerts.red.length + alerts.amber.length;

  if (totalFlagged === 0 && alerts.green.length === 0) {
    return (
      <div style={{padding:40,textAlign:'center',fontFamily:'var(--font-mono)',fontSize:13,color:'var(--text-3)'}}>
        <div style={{color:'var(--accent)',marginBottom:12}}>● LOADING</div>
        Fetching incident data from Arc indexer…
      </div>
    );
  }

  const topAlert = alerts.red[0] || alerts.amber[0];

  return (
    <>
      <div className="page-h">
        <h1>FRAUD & SCAM ALERTS</h1>
        <div className="crumbs">
          <span>arc.intel</span><span className="sep">/</span>
          <span className="cur">active alerts</span>
          <span className="sep">·</span>
          <span style={{color:'var(--red)'}}>{alerts.red.length} critical</span>
        </div>
      </div>

      {topAlert && (
        <div className="alert-banner">
          <div className="left">
            <span style={{color:'var(--red)',fontSize:14}}>{Icons.alert}</span>
            <span className="title">ACTIVE · {topAlert.severity?.toUpperCase() || 'HIGH'} SEVERITY</span>
            <span className="body">
              <span style={{color:'var(--text-0)'}}>{topAlert.merchant.name}</span> — {topAlert.desc}
            </span>
          </div>
          <button className="btn danger">EVIDENCE TRAIL →</button>
        </div>
      )}

      <div style={{padding:'0 20px 20px',display:'flex',flexDirection:'column',gap:16}}>
        {/* Summary stats */}
        <div style={{display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:12}}>
          <StatCard label="ACTIVE FLAGS · CRITICAL" value={alerts.red.length} color="red" sub={`${alerts.red.length > 0 ? 'live' : 'none'} · ${alerts.red.length} total`} />
          <StatCard label="UNDER INVESTIGATION" value={alerts.amber.length} color="amber" sub="awaiting evidence" />
          <StatCard label="USDC LOST · DETECTED" value={`$${totalLost.toFixed(4)}`} color="red" sub={`${totalFlagged} flagged merchants`} />
          <StatCard label="RECENTLY CLEARED" value={alerts.green.length} color="green" sub="14d window" />
        </div>

        {/* Three columns */}
        <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:12}}>
          {/* Confirmed */}
          <div className="panel">
            <div className="panel-h">
              <span style={{display:'flex',alignItems:'center',gap:6}}><span style={{color:'var(--red)'}}>●</span> CONFIRMED SCAMS · {alerts.red.length}</span>
              <span className="right">QUARANTINED</span>
            </div>
            <div style={{padding:10,display:'flex',flexDirection:'column',gap:10}}>
              {alerts.red.length === 0 && <div style={{padding:'12px 0',fontFamily:'var(--font-mono)',fontSize:11,color:'var(--text-3)'}}>No critical flags</div>}
              {alerts.red.map(a => (
                <AlertCard key={a.id} alert={a} severity="red" onClick={() => setSelected(a)} />
              ))}
            </div>
          </div>

          {/* Investigating */}
          <div className="panel">
            <div className="panel-h">
              <span style={{display:'flex',alignItems:'center',gap:6}}><span style={{color:'var(--amber)'}}>●</span> UNDER INVESTIGATION · {alerts.amber.length}</span>
              <span className="right">AUTO-MONITORED</span>
            </div>
            <div style={{padding:10,display:'flex',flexDirection:'column',gap:10}}>
              {alerts.amber.length === 0 && <div style={{padding:'12px 0',fontFamily:'var(--font-mono)',fontSize:11,color:'var(--text-3)'}}>No active investigations</div>}
              {alerts.amber.map(a => (
                <AlertCard key={a.id} alert={a} severity="amber" onClick={() => setSelected(a)} />
              ))}
            </div>
          </div>

          {/* Cleared */}
          <div className="panel">
            <div className="panel-h">
              <span style={{display:'flex',alignItems:'center',gap:6}}><span style={{color:'var(--accent)'}}>●</span> RECENTLY CLEARED · {alerts.green.length}</span>
              <span className="right">14D WINDOW</span>
            </div>
            <div style={{padding:10,display:'flex',flexDirection:'column',gap:10}}>
              {alerts.green.length === 0 && <div style={{padding:'12px 0',fontFamily:'var(--font-mono)',fontSize:11,color:'var(--text-3)'}}>No cleared alerts</div>}
              {alerts.green.map(a => (
                <AlertCard key={a.id} alert={a} severity="green" />
              ))}
            </div>
          </div>
        </div>

        {/* Evidence trail for selected */}
        {selected && <FraudTrail alert={selected} />}
      </div>
    </>
  );
}

Object.assign(window, { Alerts });
