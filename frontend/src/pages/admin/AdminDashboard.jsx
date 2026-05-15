import React, { useState, useEffect } from 'react'
import { adminAPI, marketAPI } from '../../utils/api.js'
import { Users, Activity, TrendingUp, ShieldCheck, RefreshCw } from 'lucide-react'

function StatCard({ icon: Icon, label, value, sub, color = 'var(--primary)' }) {
  return (
    <div style={{ background:'#fff', borderRadius:'var(--radius)', border:'1px solid var(--border)', boxShadow:'var(--shadow)', padding:24, display:'flex', alignItems:'flex-start', gap:16 }}>
      <div style={{ width:48, height:48, borderRadius:14, background:`${color}18`, display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
        <Icon size={24} color={color}/>
      </div>
      <div>
        <div style={{ fontSize:12, fontWeight:700, color:'var(--text-muted)', letterSpacing:'0.06em', textTransform:'uppercase' }}>{label}</div>
        <div style={{ fontSize:28, fontWeight:800, color:'var(--text)', lineHeight:1.2, marginTop:2 }}>{value ?? '—'}</div>
        {sub && <div style={{ fontSize:12, color:'var(--text-muted)', marginTop:3 }}>{sub}</div>}
      </div>
    </div>
  )
}

export default function AdminDashboard() {
  const [stats, setStats] = useState(null)
  const [market, setMarket] = useState(null)
  const [loading, setLoading] = useState(true)

  const load = async () => {
    setLoading(true)
    try {
      const [sRes, mRes] = await Promise.allSettled([adminAPI.getStats(), marketAPI.getEOD()])
      if (sRes.status === 'fulfilled') setStats(sRes.value.data)
      if (mRes.status === 'fulfilled') setMarket(mRes.value.data)
    } finally { setLoading(false) }
  }

  useEffect(() => { load() }, [])

  const hs = market?.health_score
  const regime = hs?.regime || '—'
  const regimeColor = { Bull:'var(--bull)', Bear:'var(--bear)', Stable:'var(--stable)', Cautious:'var(--cautious)', Stressed:'var(--stressed)', Sideways:'var(--sideways)' }[regime] || 'var(--primary)'

  return (
    <div>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:28 }}>
        <div>
          <h1 style={{ fontSize:24, fontWeight:800, color:'var(--text)' }}>Admin Dashboard</h1>
          <p style={{ color:'var(--text-muted)', fontSize:14, marginTop:2 }}>Platform overview & market monitor</p>
        </div>
        <button onClick={load} disabled={loading} style={{ display:'flex', alignItems:'center', gap:8, padding:'9px 16px', background:'var(--primary)', color:'#fff', border:'none', borderRadius:'var(--radius-sm)', fontSize:13, fontWeight:600, cursor:'pointer' }}>
          <RefreshCw size={14} style={{ animation:loading?'spin 1s linear infinite':'none' }}/> Refresh
        </button>
      </div>

      {/* Stats row */}
      <div style={{ display:'grid', gridTemplateColumns:'repeat(4, 1fr)', gap:16, marginBottom:24 }}>
        <StatCard icon={Users}       label="Total Users"   value={stats?.total_users}   sub="Registered accounts"   color="var(--primary)" />
        <StatCard icon={Activity}    label="Active Users"  value={stats?.active_users}  sub="Currently active"      color="var(--green)" />
        <StatCard icon={ShieldCheck} label="Admins"        value={stats?.total_admins}  sub="Admin accounts"        color="var(--violet-700)" />
        <StatCard icon={TrendingUp}  label="Market Score"  value={hs ? `${Math.round(hs.overall)}/100` : '—'} sub={`Regime: ${regime}`} color={regimeColor} />
      </div>

      {/* Market snapshot */}
      {market && hs && (
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:20 }}>
          {/* Health overview */}
          <div style={{ background:'#fff', borderRadius:'var(--radius)', border:'1px solid var(--border)', boxShadow:'var(--shadow)', padding:24 }}>
            <div style={{ fontSize:11, fontWeight:700, color:'var(--text-muted)', letterSpacing:'0.08em', marginBottom:16 }}>TODAY'S MARKET HEALTH</div>
            <div style={{ display:'flex', alignItems:'center', gap:20, marginBottom:20 }}>
              <div style={{ fontSize:52, fontWeight:800, color: hs.overall>=65?'var(--stable)':hs.overall>=40?'var(--cautious)':'var(--stressed)', lineHeight:1 }}>
                {Math.round(hs.overall)}
              </div>
              <div>
                <div style={{ fontSize:11, color:'var(--text-muted)', marginBottom:4 }}>REGIME</div>
                <span style={{ display:'inline-block', padding:'4px 12px', borderRadius:16, fontSize:13, fontWeight:700, background:`${regimeColor}22`, color:regimeColor, border:`1px solid ${regimeColor}44` }}>
                  {regime}
                </span>
                <div style={{ fontSize:12, color:'var(--text-muted)', marginTop:8 }}>Stress: <b>{hs.stress_level}/10</b></div>
              </div>
            </div>
            {/* Pillar bars */}
            {Object.entries(hs.pillars || {}).map(([k,v]) => {
              const c = v>=65?'var(--stable)':v>=40?'var(--cautious)':'var(--stressed)'
              return (
                <div key={k} style={{ marginBottom:10 }}>
                  <div style={{ display:'flex', justifyContent:'space-between', fontSize:12, marginBottom:4 }}>
                    <span style={{ color:'var(--text-muted)', fontWeight:600, textTransform:'capitalize' }}>{k.replace('_',' ')}</span>
                    <span style={{ fontWeight:700, color:c }}>{Math.round(v)}</span>
                  </div>
                  <div style={{ height:6, background:'var(--violet-100)', borderRadius:3, overflow:'hidden' }}>
                    <div style={{ height:'100%', width:`${v}%`, background:c, borderRadius:3 }}/>
                  </div>
                </div>
              )
            })}
          </div>

          {/* NSE/BSE summary */}
          <div style={{ background:'#fff', borderRadius:'var(--radius)', border:'1px solid var(--border)', boxShadow:'var(--shadow)', padding:24 }}>
            <div style={{ fontSize:11, fontWeight:700, color:'var(--text-muted)', letterSpacing:'0.08em', marginBottom:16 }}>EXCHANGE SUMMARY</div>
            {[
              { ex:'NSE', label:'NIFTY 50', close:market.nse?.nifty_close, open:market.nse?.nifty_open, adv:market.nse?.advances, dec:market.nse?.declines, vix:market.nse?.vix },
              { ex:'BSE', label:'SENSEX',   close:market.bse?.sensex_close, open:market.bse?.sensex_open, adv:market.bse?.advances, dec:market.bse?.declines },
            ].map(({ ex, label, close, open, adv, dec, vix }) => {
              const chg = close && open ? ((close-open)/open*100) : 0
              return (
                <div key={ex} style={{ padding:16, background:'var(--violet-50)', borderRadius:12, marginBottom:12, border:'1px solid var(--border)' }}>
                  <div style={{ display:'flex', justifyContent:'space-between', marginBottom:8 }}>
                    <div>
                      <div style={{ fontSize:10, fontWeight:700, color:'var(--primary)', letterSpacing:'0.08em' }}>{ex}</div>
                      <div style={{ fontSize:15, fontWeight:800 }}>{label}</div>
                    </div>
                    <div style={{ textAlign:'right' }}>
                      <div style={{ fontSize:18, fontWeight:800 }}>{close?.toLocaleString('en-IN',{maximumFractionDigits:2})}</div>
                      <div style={{ fontSize:12, fontWeight:700, color:chg>=0?'var(--green)':'var(--red)' }}>{chg>=0?'+':''}{chg.toFixed(2)}%</div>
                    </div>
                  </div>
                  <div style={{ display:'flex', gap:12, fontSize:12 }}>
                    <span style={{ color:'var(--green)', fontWeight:600 }}>▲ {adv?.toLocaleString()}</span>
                    <span style={{ color:'var(--red)', fontWeight:600 }}>▼ {dec?.toLocaleString()}</span>
                    {vix && <span style={{ color:'var(--text-muted)' }}>VIX: <b>{vix.toFixed(2)}</b></span>}
                  </div>
                </div>
              )
            })}

            {/* Exchange comparison */}
            {market.exchange_comparison && (
              <div style={{ padding:12, background:'var(--violet-100)', borderRadius:10, fontSize:13, color:'var(--text-soft)', lineHeight:1.6 }}>
                {market.exchange_comparison.analysis}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
