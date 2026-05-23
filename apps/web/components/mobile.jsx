/* Mobile responsive variants — Live Feed + Leaderboard */

function MobileTopBar({ stats }) {
  return (
    <div className="mobile-topbar">
      <div style={{display:'flex',flexDirection:'column',alignItems:'flex-start',gap:3,lineHeight:1}}>
        <span style={{fontFamily:"'Poppins', system-ui", fontWeight:600, fontSize:15, letterSpacing:'-0.02em', color:'var(--text-0)'}}>
          Repute<span style={{color:'var(--accent)'}}>.</span>
        </span>
        <span style={{display:'flex',gap:2,height:2}}>
          <span style={{width:20,height:2,background:'var(--accent)'}}></span>
          <span style={{width:3,height:2,background:'var(--text-3)'}}></span>
          <span style={{width:10,height:2,background:'var(--text-4)'}}></span>
          <span style={{width:5,height:2,background:'var(--accent)',opacity:0.6}}></span>
        </span>
      </div>
      <div style={{display:'flex',alignItems:'center',gap:8,fontSize:10,color:'var(--text-2)'}}>
        <span style={{color:'var(--accent)'}}>●</span> ARC
        <span style={{color:'var(--text-4)'}}>·</span>
        <span className="mono"><Counter value={stats.payments} fmt={fmtNum} /></span>
      </div>
    </div>
  );
}

function MobileLiveFeed({ feed }) {
  return (
    <div className="mobile-frame">
      <MobileTopBar stats={{payments: 18420422}} />
      <div className="mobile-tab">
        <div className="t active">FEED</div>
        <div className="t">RANK</div>
        <div className="t">ALERTS</div>
        <div className="t">YOU</div>
      </div>

      {/* Quick stats */}
      <div style={{padding:'10px 14px',borderBottom:'1px solid var(--border)',display:'grid',gridTemplateColumns:'1fr 1fr 1fr',gap:10}}>
        <div>
          <div className="mono" style={{fontSize:8,color:'var(--text-3)',textTransform:'uppercase'}}>PMTS/MIN</div>
          <div className="mono" style={{fontSize:14,color:'var(--text-0)'}}>2,418</div>
        </div>
        <div>
          <div className="mono" style={{fontSize:8,color:'var(--text-3)',textTransform:'uppercase'}}>FAIL · 1H</div>
          <div className="mono" style={{fontSize:14,color:'var(--amber)'}}>1.84%</div>
        </div>
        <div>
          <div className="mono" style={{fontSize:8,color:'var(--text-3)',textTransform:'uppercase'}}>FRAUD</div>
          <div className="mono" style={{fontSize:14,color:'var(--red)'}}>3 ●</div>
        </div>
      </div>

      {/* Filter chips */}
      <div style={{display:'flex',gap:6,padding:'8px 12px',borderBottom:'1px solid var(--border)',overflowX:'auto'}}>
        <span className="pill" style={{background:'var(--accent)',color:'var(--bg-0)',border:'none'}}>ALL</span>
        <span className="pill">DATA</span>
        <span className="pill">COMPUTE</span>
        <span className="pill">AI</span>
        <span className="pill">ORACLE</span>
      </div>

      {/* Feed rows — compact */}
      <div>
        {feed.slice(0, 8).map((tx, i) => (
          <div key={tx.id} style={{
            padding:'10px 14px',borderBottom:'1px solid var(--border)',
            display:'flex',flexDirection:'column',gap:6
          }}>
            <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',gap:10}}>
              <div style={{display:'flex',alignItems:'center',gap:8,minWidth:0}}>
                <ScoreBadge score={tx.merchant.score} />
                <AddrLink addr={tx.merchant.addr} />
              </div>
              <span className="mono" style={{color:'var(--text-3)',fontSize:9}}>{tx.ts.split('.')[0]}</span>
            </div>
            <div style={{display:'flex',justifyContent:'space-between',alignItems:'center'}}>
              <span className="mono" style={{fontSize:10,color:'var(--text-1)'}}>{tx.endpoint}</span>
              <span style={{display:'flex',alignItems:'center',gap:10}}>
                <span className="mono" style={{fontSize:11,color:'var(--text-0)'}}>${tx.amount.toFixed(4)}</span>
                <Latency ms={tx.latency} />
                <StatusIcon status={tx.status} />
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function MobileLeaderboard() {
  return (
    <div className="mobile-frame">
      <MobileTopBar stats={{payments: 18420422}} />
      <div className="mobile-tab">
        <div className="t">FEED</div>
        <div className="t active">RANK</div>
        <div className="t">ALERTS</div>
        <div className="t">YOU</div>
      </div>

      {/* Filter chips */}
      <div style={{display:'flex',gap:6,padding:'8px 12px',borderBottom:'1px solid var(--border)',overflowX:'auto'}}>
        <span className="pill" style={{background:'var(--accent)',color:'var(--bg-0)',border:'none'}}>ALL · 1,284</span>
        <span className="pill">7D</span>
        <span className="pill">DATA</span>
        <span className="pill">ORACLE</span>
      </div>

      <div style={{display:'flex',padding:'8px 14px',borderBottom:'1px solid var(--border)',fontSize:9,color:'var(--text-3)',textTransform:'uppercase',letterSpacing:'0.08em',fontFamily:'JetBrains Mono'}}>
        <span style={{flex:1}}>MERCHANT</span>
        <span style={{width:50,textAlign:'right'}}>SCORE</span>
        <span style={{width:60,textAlign:'right'}}>TREND</span>
      </div>

      <div>
        {MERCHANTS.slice(0, 9).map((m, i) => (
          <div key={m.id} style={{
            padding:'10px 14px',borderBottom:'1px solid var(--border)',
            display:'flex',alignItems:'center',gap:10,
            borderLeft: i < 3 ? '2px solid var(--accent)' : (m.scam ? '2px solid var(--red)' : '2px solid transparent')
          }}>
            <span className="mono" style={{color:'var(--text-3)',fontSize:10,width:18}}>
              {m.scam ? <span style={{color:'var(--red)'}}>{Icons.skull}</span> : `#${i+1}`}
            </span>
            <div style={{flex:1,minWidth:0}}>
              <div className="mono" style={{fontSize:11,color:'var(--text-0)',whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis'}}>{m.name}</div>
              <div style={{display:'flex',alignItems:'center',gap:6,marginTop:2}}>
                <AddrLink addr={m.addr} />
                <CatPill cat={m.cat} small />
              </div>
            </div>
            <div style={{width:50,display:'flex',justifyContent:'flex-end'}}>
              <ScoreRing score={m.score} size={28} stroke={2.5} />
            </div>
            <div style={{width:60,display:'flex',justifyContent:'flex-end'}}>
              <Sparkline data={m.trend} w={56} h={18} />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function MobileShowcase({ feed }) {
  return (
    <div style={{display:'flex',gap:24,padding:'40px 32px',justifyContent:'center',alignItems:'flex-start',background:'var(--bg-0)',minHeight:'calc(100vh - 48px - 53px)'}}>
      <div style={{display:'flex',flexDirection:'column',alignItems:'center',gap:12}}>
        <div className="mono" style={{fontSize:11,color:'var(--text-3)',textTransform:'uppercase',letterSpacing:'0.1em'}}>MOBILE · LIVE FEED · 390px</div>
        <MobileLiveFeed feed={feed} />
      </div>
      <div style={{display:'flex',flexDirection:'column',alignItems:'center',gap:12}}>
        <div className="mono" style={{fontSize:11,color:'var(--text-3)',textTransform:'uppercase',letterSpacing:'0.1em'}}>MOBILE · LEADERBOARD · 390px</div>
        <MobileLeaderboard />
      </div>
    </div>
  );
}

Object.assign(window, { MobileShowcase, MobileLiveFeed, MobileLeaderboard });
