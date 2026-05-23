/* Page 2: Leaderboard */

function Leaderboard({ onSelectMerchant }) {
  const [sort, setSort] = useState({ key: 'score', dir: 'desc' });
  const [page, setPage] = useState(1);
  const [filter, setFilter] = useState('ALL');
  const [_v, forceUpdate] = useState(0);
  const perPage = 25;

  // Re-render whenever the API pushes fresh merchant data
  useEffect(() => {
    const h = () => forceUpdate(v => v + 1);
    window.addEventListener('repute:merchants', h);
    return () => window.removeEventListener('repute:merchants', h);
  }, []);

  const data = useMemo(() => {
    let arr = [...(window.MERCHANTS || [])];
    if (filter !== 'ALL') arr = arr.filter(m => m.cat === filter);
    arr.sort((a, b) => {
      let av = a[sort.key], bv = b[sort.key];
      if (typeof av === 'string') return sort.dir === 'asc' ? av.localeCompare(bv) : bv.localeCompare(av);
      return sort.dir === 'asc' ? av - bv : bv - av;
    });
    // assign rank
    arr = arr.map((m, i) => ({...m, rank: i + 1}));
    return arr;
  }, [sort, filter, _v]);

  function setSortKey(k) {
    setSort(s => s.key === k ? {key: k, dir: s.dir === 'asc' ? 'desc' : 'asc'} : {key: k, dir: 'desc'});
  }

  const sortArr = k => sort.key === k ? (sort.dir === 'asc' ? '▲' : '▼') : '◆';
  const cls = k => sort.key === k ? 'sorted' : '';

  // Derive category list from real merchants
  const allMerchants = window.MERCHANTS || [];
  const catSet = new Set(allMerchants.map(m => m.cat).filter(Boolean));
  const cats = ['ALL', ...Array.from(catSet).sort()];

  if (allMerchants.length === 0) {
    return (
      <div style={{padding:40,textAlign:'center',fontFamily:'var(--font-mono)',fontSize:13,color:'var(--text-3)'}}>
        <div style={{color:'var(--accent)',marginBottom:12}}>● LOADING</div>
        Fetching merchant data from Arc indexer…
      </div>
    );
  }

  return (
    <>
      <div className="page-h">
        <h1>MERCHANT LEADERBOARD</h1>
        <div className="crumbs">
          <span>arc.merchants</span><span className="sep">/</span>
          <span className="cur">ranked by trust score</span>
          <span className="sep">·</span>
          <span>{data.length} merchants</span>
        </div>
      </div>

      <div style={{display:'flex',alignItems:'center',padding:'8px 14px',borderBottom:'1px solid var(--border)',gap:24,background:'var(--bg-0)'}}>
        <div style={{display:'flex',alignItems:'center',gap:8}}>
          <span className="mono" style={{fontSize:10,color:'var(--text-3)',letterSpacing:'0.08em'}}>FILTER · CATEGORY</span>
          <div style={{display:'flex',gap:0,border:'1px solid var(--border)'}}>
            {cats.map(c => (
              <span key={c}
                onClick={() => setFilter(c)}
                className="mono"
                style={{
                  padding:'4px 10px',
                  fontSize:10,
                  cursor:'pointer',
                  color: filter === c ? 'var(--bg-0)' : 'var(--text-2)',
                  background: filter === c ? 'var(--accent)' : 'transparent',
                  textTransform:'uppercase',letterSpacing:'0.04em',
                  borderRight:'1px solid var(--border)',
                }}
              >{c}</span>
            ))}
          </div>
        </div>
        <div style={{marginLeft:'auto',display:'flex',gap:8,alignItems:'center'}}>
          <span className="mono" style={{fontSize:10,color:'var(--text-3)'}}>WINDOW</span>
          <div style={{display:'flex',gap:0,border:'1px solid var(--border)'}}>
            {['24H','7D','30D','ALL'].map((w, i) => (
              <span key={w} className="mono"
                style={{padding:'4px 10px',fontSize:10,cursor:'pointer',color: i===1 ? 'var(--bg-0)' : 'var(--text-2)', background: i===1 ? 'var(--accent)' : 'transparent', textTransform:'uppercase',borderRight:'1px solid var(--border)'}}
              >{w}</span>
            ))}
          </div>
          <button className="btn">EXPORT</button>
        </div>
      </div>

      <div style={{overflow:'auto',maxHeight:'calc(100vh - 48px - 53px - 41px - 48px)'}}>
        <table className="tbl">
          <thead>
            <tr>
              <th style={{width:48}} className={cls('rank')} onClick={() => setSortKey('rank')}>#<span className="arr">{sortArr('rank')}</span></th>
              <th onClick={() => setSortKey('name')} className={cls('name')}>MERCHANT<span className="arr">{sortArr('name')}</span></th>
              <th style={{width:90}}>CAT</th>
              <th style={{width:110}} onClick={() => setSortKey('rel')} className={cls('rel')}>RELIABILITY<span className="arr">{sortArr('rel')}</span></th>
              <th style={{width:110}} onClick={() => setSortKey('lat')} className={cls('lat')}>AVG LATENCY<span className="arr">{sortArr('lat')}</span></th>
              <th style={{width:110}} onClick={() => setSortKey('price')} className={cls('price')}>PRICE / CALL<span className="arr">{sortArr('price')}</span></th>
              <th style={{width:120}} onClick={() => setSortKey('vol')} className={cls('vol')}>7D VOLUME<span className="arr">{sortArr('vol')}</span></th>
              <th style={{width:130}} onClick={() => setSortKey('score')} className={cls('score')}>TRUST SCORE<span className="arr">{sortArr('score')}</span></th>
              <th style={{width:100}}>30D TREND</th>
            </tr>
          </thead>
          <tbody>
            {data.map(m => (
              <tr key={m.id}
                  className={m.scam ? 'scam' : (m.rank <= 3 ? 'top3' : '')}
                  onClick={() => onSelectMerchant(m.id)}>
                <td className="mono" style={{color:'var(--text-3)',fontSize:11}}>
                  {m.scam ? <span style={{color:'var(--red)'}}>{Icons.skull}</span> : `#${String(m.rank).padStart(2,'0')}`}
                </td>
                <td>
                  <div style={{display:'flex',flexDirection:'column',gap:2}}>
                    <span className="mono" style={{color:'var(--text-0)',fontSize:12}}>{m.name}</span>
                    <AddrLink addr={m.addr} />
                  </div>
                </td>
                <td><CatPill cat={m.cat} /></td>
                <td className="mono" style={{color: m.rel > 95 ? 'var(--accent)' : m.rel > 85 ? 'var(--amber)' : 'var(--red)'}}>
                  {m.rel.toFixed(1)}%
                </td>
                <td><Latency ms={m.lat} /></td>
                <td className="mono" style={{color:'var(--text-1)'}}>${m.price.toFixed(4)}</td>
                <td className="mono" style={{color:'var(--text-1)'}}>${m.vol.toLocaleString('en-US',{maximumFractionDigits:0})}</td>
                <td>
                  <div style={{display:'flex',alignItems:'center',gap:10}}>
                    <ScoreRing score={m.score} size={36} stroke={3} />
                  </div>
                </td>
                <td><Sparkline data={m.trend} w={84} h={22} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',padding:'10px 14px',borderTop:'1px solid var(--border)',background:'var(--bg-0)'}}>
        <span className="mono" style={{fontSize:10,color:'var(--text-3)'}}>
          SHOWING 1–{Math.min(perPage, data.length)} OF {data.length}
        </span>
        <div style={{display:'flex',gap:6}}>
          <button className="btn">← PREV</button>
          <button className="btn primary">1</button>
          <button className="btn">2</button>
          <button className="btn">3</button>
          <button className="btn">…</button>
          <button className="btn">NEXT →</button>
        </div>
      </div>
    </>
  );
}

Object.assign(window, { Leaderboard });
