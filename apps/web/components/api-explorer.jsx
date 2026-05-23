/* Page 5: API Explorer */

function ApiExplorer() {
  const [addr, setAddr] = useState('0x7a3F...c91d');
  const [endpoint, setEndpoint] = useState('score');
  const [format, setFormat] = useState('json');
  const [tab, setTab] = useState('ts');
  const [loading, setLoading] = useState(false);
  const [log, setLog] = useState([]);
  const [response, setResponse] = useState({
    address: '0x7a3F...c91d',
    name: 'oracle.pricefeed.eth',
    score: 98,
    tier: 'PLATINUM',
    rank: 1,
    reliability_pct: 99.8,
    latency: { p50: 87, p95: 142, p99: 198 },
    price_per_call: 0.0002,
    volume_7d_usdc: 18420.55,
    category: 'Oracle',
    flags: [],
    first_seen: '2025-11-19T14:22:41Z',
    last_active_ms_ago: 12000,
    sub_scores: {
      delivery_rate: 100,
      speed_index: 93,
      price_fairness: 90,
      schema_honesty: 100,
      uptime: 99
    }
  });

  async function runQuery() {
    setLoading(true);
    setLog([]);
    const steps = [
      { t: 0, msg: 'POST https://api.repute.xyz/v1/score', kind: 'k' },
      { t: 220, msg: '⏎ HTTP 402 Payment Required', kind: 'amber' },
      { t: 480, msg: 'Required: 0.0001 USDC → 0xrepute...arc', kind: 'mono' },
      { t: 760, msg: '⚡ Signing x402 payment intent...', kind: 'mono' },
      { t: 1100, msg: '✓ Payment broadcast · tx 0x8af1...e213', kind: 'green' },
      { t: 1450, msg: '⏱ Awaiting Arc confirmation (block 12,840,219)...', kind: 'mono' },
      { t: 1900, msg: '✓ Confirmed in 1 block · 412ms', kind: 'green' },
      { t: 2120, msg: 'Retry POST with payment receipt header...', kind: 'mono' },
      { t: 2380, msg: '⏎ HTTP 200 OK · 1.2KB · 142ms', kind: 'green' },
      { t: 2480, msg: '────────────────────────────────', kind: 'dim' },
      { t: 2520, msg: 'Total: $0.0001 USDC · 2.48s end-to-end', kind: 'accent' },
    ];
    for (const s of steps) {
      await new Promise(r => setTimeout(r, s.t === 0 ? 50 : steps[steps.indexOf(s)].t - (steps[steps.indexOf(s)-1]?.t || 0)));
      setLog(l => [...l, s]);
    }
    setLoading(false);
  }

  const snippets = {
    ts: `import { Repute } from '@repute/sdk';

// Query trust score for a merchant
const score = await Repute.score('${addr}');

if (score.value > 75 && !score.flags.length) {
  // safe to pay
  const result = await agent.x402.pay({
    to: '${addr}',
    endpoint: '/v1/query',
    maxPrice: 0.0010
  });
} else {
  agent.log.warn('Skipping low-trust merchant', score);
}`,
    py: `from repute import Repute

# Query trust score for a merchant
score = Repute.score("${addr}")

if score.value > 75 and not score.flags:
    # safe to pay
    result = agent.x402.pay(
        to="${addr}",
        endpoint="/v1/query",
        max_price=0.0010,
    )
else:
    agent.log.warn("Skipping low-trust merchant", score)`,
    curl: `curl -X POST https://api.repute.xyz/v1/score \\
  -H "X-Agent-Key: $AGENT_KEY" \\
  -H "X-Payment-Authorize: x402" \\
  -d '{"address": "${addr}"}'

# 402 → sign x402 intent → retry with X-Payment-Receipt header
# total cost: 0.0001 USDC`,
  };

  return (
    <>
      <div className="page-h">
        <h1>API EXPLORER · x402</h1>
        <div className="crumbs">
          <span>arc.api</span><span className="sep">/</span>
          <span className="cur">interactive</span>
          <span className="sep">·</span>
          <span>$0.0001 USDC / query</span>
        </div>
      </div>

      <div style={{display:'grid',gridTemplateColumns:'420px 1fr',height:'calc(100vh - 48px - 53px)'}}>
        {/* LEFT: Form */}
        <div style={{borderRight:'1px solid var(--border)',padding:'16px 20px',display:'flex',flexDirection:'column',gap:16,overflowY:'auto'}}>

          <div>
            <div className="mono" style={{fontSize:10,color:'var(--text-3)',textTransform:'uppercase',letterSpacing:'0.08em',marginBottom:6}}>ENDPOINT</div>
            <div style={{display:'flex',gap:0,border:'1px solid var(--border)'}}>
              {[{k:'score',l:'score'},{k:'history',l:'history'},{k:'flags',l:'flags'},{k:'subscores',l:'sub_scores'}].map(e => (
                <span key={e.k} onClick={() => setEndpoint(e.k)} className="mono"
                  style={{
                    flex:1,padding:'8px 10px',fontSize:11,textAlign:'center',cursor:'pointer',
                    color: endpoint===e.k ? 'var(--bg-0)' : 'var(--text-2)',
                    background: endpoint===e.k ? 'var(--accent)' : 'transparent',
                    borderRight:'1px solid var(--border)',
                  }}
                >/v1/{e.l}</span>
              ))}
            </div>
          </div>

          <div>
            <div className="mono" style={{fontSize:10,color:'var(--text-3)',textTransform:'uppercase',letterSpacing:'0.08em',marginBottom:6}}>MERCHANT ADDRESS</div>
            <input
              value={addr}
              onChange={e => setAddr(e.target.value)}
              className="mono"
              style={{
                width:'100%',background:'var(--bg-1)',border:'1px solid var(--border)',padding:'8px 10px',
                color:'var(--text-0)',fontSize:12,outline:'none'
              }}
            />
            <div style={{display:'flex',gap:6,marginTop:6,flexWrap:'wrap'}}>
              {MERCHANTS.slice(0, 4).map(m => (
                <span key={m.id} onClick={() => setAddr(m.addr)} className="pill" style={{cursor:'pointer'}}>
                  {m.addr}
                </span>
              ))}
            </div>
          </div>

          <div>
            <div className="mono" style={{fontSize:10,color:'var(--text-3)',textTransform:'uppercase',letterSpacing:'0.08em',marginBottom:6}}>RESPONSE FORMAT</div>
            <div style={{display:'flex',gap:0,border:'1px solid var(--border)'}}>
              {['json','msgpack','cbor'].map(f => (
                <span key={f} onClick={() => setFormat(f)} className="mono"
                  style={{flex:1,padding:'6px 10px',fontSize:11,textAlign:'center',cursor:'pointer',
                    color:format===f?'var(--bg-0)':'var(--text-2)',
                    background:format===f?'var(--accent)':'transparent',
                    borderRight:'1px solid var(--border)',textTransform:'uppercase'}}
                >{f}</span>
              ))}
            </div>
          </div>

          <div>
            <div className="mono" style={{fontSize:10,color:'var(--text-3)',textTransform:'uppercase',letterSpacing:'0.08em',marginBottom:6}}>OPTIONS</div>
            <div style={{display:'flex',flexDirection:'column',gap:6,fontFamily:'JetBrains Mono',fontSize:11}}>
              <label style={{display:'flex',alignItems:'center',gap:8,color:'var(--text-1)'}}>
                <input type="checkbox" defaultChecked style={{accentColor:'#00FF87'}}/> include_sub_scores
              </label>
              <label style={{display:'flex',alignItems:'center',gap:8,color:'var(--text-1)'}}>
                <input type="checkbox" defaultChecked style={{accentColor:'#00FF87'}}/> include_flags
              </label>
              <label style={{display:'flex',alignItems:'center',gap:8,color:'var(--text-2)'}}>
                <input type="checkbox" style={{accentColor:'#00FF87'}}/> include_history (7d)
              </label>
              <label style={{display:'flex',alignItems:'center',gap:8,color:'var(--text-2)'}}>
                <input type="checkbox" style={{accentColor:'#00FF87'}}/> raw_evidence
              </label>
            </div>
          </div>

          <button className="btn primary" style={{justifyContent:'center',padding:'10px 14px',fontSize:12}} onClick={runQuery} disabled={loading}>
            {loading ? '⏳ EXECUTING x402...' : '▶  QUERY NOW · $0.0001 USDC'}
          </button>

          {/* Payment log */}
          <div className="panel">
            <div className="panel-h"><span>x402 PAYMENT FLOW</span><span className="right">{loading ? 'LIVE' : log.length ? 'DONE' : 'IDLE'}</span></div>
            <div style={{padding:'10px 14px',background:'var(--bg-1)',minHeight:120,fontFamily:'JetBrains Mono',fontSize:10.5,lineHeight:1.65,maxHeight:240,overflowY:'auto'}}>
              {log.length === 0 && (
                <span style={{color:'var(--text-3)'}}>// Click QUERY NOW to begin. Each query triggers a real x402 micropayment to the Repute indexer.</span>
              )}
              {log.map((l, i) => (
                <div key={i} style={{
                  color: l.kind === 'green' ? 'var(--accent)' :
                         l.kind === 'amber' ? 'var(--amber)' :
                         l.kind === 'accent' ? 'var(--accent)' :
                         l.kind === 'dim' ? 'var(--text-4)' :
                         l.kind === 'k' ? 'var(--violet)' : 'var(--text-1)'
                }}>
                  <span style={{color:'var(--text-4)',marginRight:8}}>{String(i).padStart(2,'0')}</span>{l.msg}
                </div>
              ))}
              {loading && <div style={{color:'var(--accent)'}}><span style={{color:'var(--text-4)',marginRight:8}}>{String(log.length).padStart(2,'0')}</span>▌</div>}
            </div>
          </div>

          {/* Your usage */}
          <div className="panel">
            <div className="panel-h"><span>YOUR USAGE · 7D</span><span className="right">agent.0x4d2A</span></div>
            <div style={{padding:'12px 14px',display:'grid',gridTemplateColumns:'1fr 1fr',gap:10}}>
              <div>
                <div className="mono" style={{fontSize:9,color:'var(--text-3)'}}>QUERIES MADE</div>
                <div className="mono" style={{fontSize:16,color:'var(--text-0)'}}>14,802</div>
              </div>
              <div>
                <div className="mono" style={{fontSize:9,color:'var(--text-3)'}}>USDC SPENT</div>
                <div className="mono" style={{fontSize:16,color:'var(--text-0)'}}>$1.48</div>
              </div>
              <div>
                <div className="mono" style={{fontSize:9,color:'var(--text-3)'}}>FRAUD CAUGHT</div>
                <div className="mono" style={{fontSize:16,color:'var(--accent)'}}>42</div>
              </div>
              <div>
                <div className="mono" style={{fontSize:9,color:'var(--text-3)'}}>USDC SAVED</div>
                <div className="mono" style={{fontSize:16,color:'var(--accent)'}}>$284.10</div>
              </div>
            </div>
          </div>

        </div>

        {/* RIGHT: Response */}
        <div style={{display:'flex',flexDirection:'column',minWidth:0}}>
          <div style={{padding:'10px 16px',borderBottom:'1px solid var(--border)',display:'flex',justifyContent:'space-between',alignItems:'center',background:'var(--bg-0)'}}>
            <div className="mono" style={{fontSize:11,color:'var(--text-2)'}}>
              <span style={{color:'var(--accent)'}}>200</span> OK
              <span style={{color:'var(--text-4)',margin:'0 8px'}}>·</span>
              <span style={{color:'var(--text-3)'}}>POST /v1/{endpoint}</span>
              <span style={{color:'var(--text-4)',margin:'0 8px'}}>·</span>
              <span style={{color:'var(--text-1)'}}>142ms</span>
              <span style={{color:'var(--text-4)',margin:'0 8px'}}>·</span>
              <span style={{color:'var(--text-1)'}}>1.2KB</span>
            </div>
            <div style={{display:'flex',gap:6}}>
              <button className="btn" style={{padding:'4px 8px',fontSize:10}}>{Icons.copy} COPY</button>
              <button className="btn" style={{padding:'4px 8px',fontSize:10}}>{Icons.ext} OPEN RAW</button>
            </div>
          </div>

          <div style={{flex:1,overflow:'auto',background:'var(--bg-1)',position:'relative'}}>
            {/* Line numbers */}
            <div style={{display:'flex'}}>
              <div style={{padding:'14px 8px',color:'var(--text-4)',fontFamily:'JetBrains Mono',fontSize:11,lineHeight:1.55,textAlign:'right',userSelect:'none',background:'var(--bg-0)',borderRight:'1px solid var(--border)',minWidth:36}}>
                {Array.from({length:34}).map((_,i) => <div key={i}>{i+1}</div>)}
              </div>
              <div style={{flex:1}}>
                <JsonView data={response} />
              </div>
            </div>
          </div>

          {/* Code snippet tabs */}
          <div style={{borderTop:'1px solid var(--border)'}}>
            <div className="tabs">
              <span className={`tab ${tab==='ts'?'active':''}`} onClick={() => setTab('ts')}>TYPESCRIPT</span>
              <span className={`tab ${tab==='py'?'active':''}`} onClick={() => setTab('py')}>PYTHON</span>
              <span className={`tab ${tab==='curl'?'active':''}`} onClick={() => setTab('curl')}>cURL</span>
              <div style={{marginLeft:'auto',display:'flex',alignItems:'center',padding:'4px 12px',gap:8}}>
                <button className="btn" style={{padding:'2px 8px',fontSize:10}}>{Icons.copy} COPY</button>
              </div>
            </div>
            <pre style={{
              margin:0,padding:'14px 18px',background:'var(--bg-1)',color:'var(--text-1)',
              fontFamily:'JetBrains Mono',fontSize:11,lineHeight:1.6,overflowX:'auto',maxHeight:240,
              borderTop:'1px solid var(--border)'
            }}>{snippets[tab]}</pre>
          </div>
        </div>
      </div>
    </>
  );
}

Object.assign(window, { ApiExplorer });
