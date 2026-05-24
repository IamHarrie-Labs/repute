/* Live Benchmark — NaiveAgent vs ReputeAgent live comparison panel */

// Static demo data shown when backend is offline (Vercel / no agents running)
const DEMO_BATTLE = {
  naive: {
    address: '0xNaive000000000000000000000000000000000000',
    total_calls: 100, successes: 69, failures: 31,
    success_rate: 69.0, total_spent: 0.0450, wasted_usdc: 0.0142, avg_latency: 412,
  },
  repute: {
    address: '0xRepute00000000000000000000000000000000000',
    total_calls: 100, successes: 98, failures: 2,
    success_rate: 98.1, total_spent: 0.0410, wasted_usdc: 0.0003, avg_latency: 127,
  },
  recent_calls: [
    { id:1, buyer:'0xRepute000', merchant:'0x15481D7b2F', merchant_name:'PriceFeed Pro', delivered:1, amount_usdc:0.0003, latency_ms:87,  trust_score:99 },
    { id:2, buyer:'0xNaive0000', merchant:'0xA891cC3f0E', merchant_name:'ShadowAPI',     delivered:0, amount_usdc:0.0003, latency_ms:null, trust_score:12 },
    { id:3, buyer:'0xRepute000', merchant:'0x8aF3c14d9A', merchant_name:'ChainOracle',   delivered:1, amount_usdc:0.0002, latency_ms:121, trust_score:94 },
    { id:4, buyer:'0xNaive0000', merchant:'0x3c00FFba12', merchant_name:'FlakyNode',     delivered:0, amount_usdc:0.0002, latency_ms:740, trust_score:31 },
    { id:5, buyer:'0xRepute000', merchant:'0x2b91eEc302', merchant_name:'Inference Node',delivered:1, amount_usdc:0.0005, latency_ms:201, trust_score:88 },
    { id:6, buyer:'0xNaive0000', merchant:'0x15481D7b2F', merchant_name:'PriceFeed Pro', delivered:1, amount_usdc:0.0003, latency_ms:91,  trust_score:99 },
  ],
  updated_at: Date.now(),
};

function BattlePanel() {
  const isOffline = !window.API_BASE;
  const [data, setData] = useState(isOffline ? DEMO_BATTLE : null);
  const [error, setError] = useState(null);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    if (isOffline) return; // use static demo data, no polling needed
    let alive = true;

    async function loadBattle() {
      try {
        const res = await fetch(`${window.API_BASE}/battle`);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const json = await res.json();
        if (alive) { setData(json); setError(null); }
      } catch (e) {
        if (alive) setError(e.message);
      }
    }

    loadBattle();
    const id = setInterval(() => {
      loadBattle();
      setTick(t => t + 1);
    }, 4000);

    return () => { alive = false; clearInterval(id); };
  }, []);

  const naive  = data?.naive;
  const repute = data?.repute;
  const recent = data?.recent_calls ?? [];

  const diff = naive && repute
    ? (repute.success_rate - naive.success_rate).toFixed(1)
    : null;
  const savedPct = naive && repute && naive.wasted_usdc > 0
    ? ((1 - repute.wasted_usdc / (naive.wasted_usdc || 0.0001)) * 100).toFixed(0)
    : null;

  return (
    <div style={{ padding: '20px 24px', minHeight: '100%' }}>

      {/* Header */}
      <div style={{ marginBottom: 24 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 6 }}>
          <h2 style={{ margin: 0, fontSize: 15, fontWeight: 600, letterSpacing: '-0.01em', color: 'var(--text-0)' }}>
            Live Benchmark
          </h2>
          <span style={{ fontSize: 10, color: isOffline ? 'var(--amber)' : 'var(--accent)', background: 'color-mix(in srgb, var(--accent) 15%, transparent)', padding: '2px 8px', letterSpacing: '0.08em' }}>
            {isOffline ? 'DEMO' : 'LIVE'}
          </span>
        </div>
        <p style={{ margin: 0, color: 'var(--text-2)', fontSize: 13 }}>
          Two autonomous agents, same merchant economy. One consults Repute, one doesn't. Watch the gap grow.
        </p>
      </div>

      {/* Headline stat */}
      {diff !== null && parseFloat(diff) > 0 && (
        <div style={{
          background: 'color-mix(in srgb, var(--accent) 10%, var(--bg-1))',
          border: '1px solid color-mix(in srgb, var(--accent) 30%, transparent)',
          padding: '12px 20px', marginBottom: 20,
          display: 'flex', alignItems: 'center', gap: 20,
          fontFamily: 'Poppins, system-ui, sans-serif',
        }}>
          <span style={{ fontSize: 28, fontWeight: 700, color: 'var(--accent)' }}>
            +{diff}%
          </span>
          <div>
            <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-1)', letterSpacing: '0.05em' }}>
              REPUTE AGENT SUCCESS ADVANTAGE
            </div>
            <div style={{ fontSize: 10, color: 'var(--text-3)', marginTop: 2 }}>
              Trust-routed agent avoids fraud, picks reliable merchants — measured live on Arc testnet
            </div>
          </div>
          {savedPct && parseFloat(savedPct) > 0 && (
            <div style={{ marginLeft: 'auto', textAlign: 'right' }}>
              <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--green, #4ade80)' }}>{savedPct}%</div>
              <div style={{ fontSize: 10, color: 'var(--text-3)' }}>LESS USDC WASTED</div>
            </div>
          )}
        </div>
      )}

      {/* Agent cards */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 24 }}>
        <AgentCard
          label="NaiveAgent"
          subtitle="Picks merchants at random"
          color="var(--amber, #f59e0b)"
          stats={naive}
          tag="NO INTELLIGENCE"
        />
        <AgentCard
          label="ReputeAgent"
          subtitle="Routes by trust score"
          color="var(--accent)"
          stats={repute}
          tag="TRUST-ROUTED"
          highlight
        />
      </div>

      {/* Recent calls log */}
      <div>
        <div style={{ fontSize: 10, color: 'var(--text-3)', letterSpacing: '0.08em', marginBottom: 10 }}>
          RECENT CALLS · {recent.length} captured
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 2, maxHeight: 320, overflowY: 'auto' }}>
          {recent.length === 0 && (
            <div style={{ color: 'var(--text-4)', fontSize: 11, fontFamily: 'Poppins, system-ui, sans-serif', padding: '20px 0', textAlign: 'center' }}>
              {error ? `API offline — run pnpm start locally to see live calls` : 'Waiting for agent calls…'}
            </div>
          )}
          {recent.map((call, i) => {
            const naiveAddr  = naive?.address ?? '';
            const reputeAddr = repute?.address ?? '';
            const isRepute   = call.buyer?.toLowerCase() === reputeAddr.toLowerCase();
            const isNaive    = call.buyer?.toLowerCase() === naiveAddr.toLowerCase();
            const agentTag   = isRepute ? 'REPUTE' : isNaive ? 'NAIVE' : '?';
            const agentColor = isRepute ? 'var(--accent)' : 'var(--amber, #f59e0b)';

            return (
              <div key={`${call.id}-${i}`} style={{
                display: 'grid',
                gridTemplateColumns: '68px 80px 1fr 80px 70px',
                gap: 8,
                padding: '5px 10px',
                background: i % 2 === 0 ? 'var(--bg-1)' : 'transparent',
                fontFamily: 'Poppins, system-ui, sans-serif',
                fontSize: 11,
                alignItems: 'center',
              }}>
                <span style={{ color: agentColor, fontWeight: 600, fontSize: 10 }}>
                  {agentTag}
                </span>
                <span style={{
                  color: call.delivered ? 'var(--green, #4ade80)' : 'var(--red)',
                  fontWeight: 600,
                  fontSize: 10,
                }}>
                  {call.delivered ? '✓ SUCCESS' : '✗ FAILED'}
                </span>
                <span style={{ color: 'var(--text-2)' }} title={call.merchant}>
                  {call.merchant_name || call.merchant?.slice(0, 10) + '…'}
                </span>
                <span style={{ color: 'var(--text-3)', textAlign: 'right' }}>
                  {call.latency_ms != null ? `${call.latency_ms}ms` : '—'}
                </span>
                <span style={{ color: 'var(--text-3)', textAlign: 'right' }}>
                  ${(call.amount_usdc ?? 0).toFixed(4)}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function AgentCard({ label, subtitle, color, stats, tag, highlight }) {
  const calls   = stats?.total_calls  ?? 0;
  const success = stats?.success_rate ?? 0;
  const spent   = stats?.total_spent  ?? 0;
  const wasted  = stats?.wasted_usdc  ?? 0;
  const latency = stats?.avg_latency;

  const barWidth = Math.max(0, Math.min(100, success));

  return (
    <div style={{
      background: 'var(--bg-1)',
      border: `1px solid ${highlight ? color : 'var(--border)'}`,
      padding: '16px 18px',
      position: 'relative',
      overflow: 'hidden',
    }}>
      {/* Background glow for repute agent */}
      {highlight && (
        <div style={{
          position: 'absolute', top: 0, right: 0, width: 120, height: 120,
          background: `radial-gradient(circle, color-mix(in srgb, ${color} 12%, transparent) 0%, transparent 70%)`,
          pointerEvents: 'none',
        }} />
      )}

      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 14 }}>
        <div>
          <div style={{ fontFamily: 'Poppins, system-ui, sans-serif', fontSize: 13, fontWeight: 700, color: 'var(--text-1)', letterSpacing: '0.04em' }}>
            {label}
          </div>
          <div style={{ fontFamily: 'Poppins, system-ui, sans-serif', fontSize: 10, color: 'var(--text-3)', marginTop: 2 }}>
            {subtitle}
          </div>
        </div>
        <span style={{
          fontFamily: 'Poppins, system-ui, sans-serif', fontSize: 9, fontWeight: 600,
          letterSpacing: '0.1em', padding: '2px 8px',
          background: `color-mix(in srgb, ${color} 20%, transparent)`,
          color,
        }}>
          {tag}
        </span>
      </div>

      {/* Success rate bar */}
      <div style={{ marginBottom: 14 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 5 }}>
          <span style={{ fontFamily: 'Poppins, system-ui, sans-serif', fontSize: 10, color: 'var(--text-3)', letterSpacing: '0.06em' }}>SUCCESS RATE</span>
          <span style={{ fontFamily: 'Poppins, system-ui, sans-serif', fontSize: 13, fontWeight: 700, color }}>
            {success.toFixed(1)}%
          </span>
        </div>
        <div style={{ height: 4, background: 'var(--bg-0)', position: 'relative' }}>
          <div style={{
            position: 'absolute', top: 0, left: 0,
            height: '100%', width: `${barWidth}%`,
            background: color,
            transition: 'width 0.6s ease',
          }} />
        </div>
      </div>

      {/* Stats grid */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px 16px' }}>
        <Stat label="CALLS" value={calls.toLocaleString()} />
        <Stat label="SUCCEEDED" value={stats?.successes?.toLocaleString() ?? '0'} />
        <Stat label="USDC SPENT" value={`$${spent.toFixed(4)}`} />
        <Stat label="USDC WASTED" value={`$${wasted.toFixed(4)}`} dimColor={wasted > 0 ? 'var(--red)' : undefined} />
        {latency && <Stat label="AVG LATENCY" value={`${latency}ms`} />}
        {stats?.address && (
          <Stat label="WALLET" value={stats.address.slice(0, 8) + '…'} mono />
        )}
      </div>

      {/* Top merchants */}
      {stats?.top_merchants?.length > 0 && (
        <div style={{ marginTop: 14, borderTop: '1px solid var(--border)', paddingTop: 10 }}>
          <div style={{ fontFamily: 'Poppins, system-ui, sans-serif', fontSize: 9, color: 'var(--text-4)', letterSpacing: '0.1em', marginBottom: 6 }}>
            TOP MERCHANTS CALLED
          </div>
          {stats.top_merchants.map((m, i) => (
            <div key={i} style={{
              display: 'flex', justifyContent: 'space-between',
              fontFamily: 'Poppins, system-ui, sans-serif', fontSize: 10, color: 'var(--text-2)',
              marginBottom: 3,
            }}>
              <span>{m.name || m.merchant?.slice(0, 10) + '…'}</span>
              <span style={{ color: 'var(--text-3)' }}>{m.calls}×</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function Stat({ label, value, dimColor, mono }) {
  return (
    <div>
      <div style={{ fontFamily: 'Poppins, system-ui, sans-serif', fontSize: 9, color: 'var(--text-4)', letterSpacing: '0.1em', marginBottom: 2 }}>{label}</div>
      <div style={{
        fontFamily: 'Poppins, system-ui, sans-serif', fontSize: 12, fontWeight: 600,
        color: dimColor ?? 'var(--text-1)',
      }}>
        {value}
      </div>
    </div>
  );
}

Object.assign(window, { BattlePanel });
