import React, { useState, useEffect } from 'react'
import { marketAPI } from '../../utils/api.js'
import { useAuthStore } from '../../store/authStore.js'
import { Activity, TrendingUp, TrendingDown, RefreshCw, AlertTriangle, Zap, Target, Shield } from 'lucide-react'
import { RadialBarChart, RadialBar, ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid, ReferenceLine } from 'recharts'

const REGIME_COLOR = {
  Bull:'#10b981', Bear:'#ef4444', Stable:'#10b981',
  Cautious:'#f59e0b', Stressed:'#ef4444', Sideways:'#6366f1'
}
const TREND_COLOR = { Bullish:'#10b981', Bearish:'#ef4444', Neutral:'#f59e0b' }

function Card({ children, style={} }) {
  return <div style={{ background:'#fff', borderRadius:'var(--radius)', border:'1px solid var(--border)', boxShadow:'var(--shadow)', ...style }}>{children}</div>
}

function ScoreGauge({ score }) {
  const color = score >= 65 ? '#10b981' : score >= 40 ? '#f59e0b' : '#ef4444'
  return (
    <div style={{ position:'relative', width:170, height:170, margin:'0 auto' }}>
      <ResponsiveContainer width="100%" height="100%">
        <RadialBarChart innerRadius="72%" outerRadius="100%" data={[{value:score}]} startAngle={225} endAngle={-45}>
          <RadialBar dataKey="value" cornerRadius={8} fill={color} background={{ fill:'var(--violet-100)' }}/>
        </RadialBarChart>
      </ResponsiveContainer>
      <div style={{ position:'absolute', inset:0, display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center' }}>
        <div style={{ fontSize:36, fontWeight:800, color, lineHeight:1 }}>{Math.round(score)}</div>
        <div style={{ fontSize:11, color:'var(--text-muted)', marginTop:3 }}>/ 100</div>
      </div>
    </div>
  )
}

function Pillar({ label, score, desc, weight }) {
  const color = score >= 65 ? '#10b981' : score >= 40 ? '#f59e0b' : '#ef4444'
  return (
    <div style={{ background:'var(--violet-50)', borderRadius:12, padding:16, border:'1px solid var(--border)' }}>
      <div style={{ display:'flex', justifyContent:'space-between', marginBottom:6 }}>
        <div>
          <div style={{ fontSize:12, fontWeight:700, color:'var(--text-soft)', textTransform:'uppercase', letterSpacing:'0.05em' }}>{label}</div>
          <div style={{ fontSize:10, color:'var(--text-muted)' }}>Weight: {weight}%</div>
        </div>
        <span style={{ fontWeight:800, fontSize:18, color }}>{Math.round(score)}</span>
      </div>
      <div style={{ height:6, background:'var(--violet-200)', borderRadius:3, overflow:'hidden', marginBottom:8 }}>
        <div style={{ height:'100%', width:`${score}%`, background:color, borderRadius:3, transition:'width 1.2s ease' }}/>
      </div>
      <div style={{ fontSize:11, color:'var(--text-muted)', lineHeight:1.5 }}>{desc}</div>
    </div>
  )
}

function MiniChart({ data, dates }) {
  if (!data || data.length === 0) return null
  const chartData = data.map((v,i) => ({ v, d: dates?.[i]?.slice(5) || i }))
  const min = Math.min(...data)
  const max = Math.max(...data)
  const isUp = data[data.length-1] >= data[0]
  return (
    <ResponsiveContainer width="100%" height={80}>
      <LineChart data={chartData} margin={{ top:4, right:4, bottom:4, left:4 }}>
        <Line type="monotone" dataKey="v" stroke={isUp?'#10b981':'#ef4444'} strokeWidth={1.5} dot={false}/>
        <Tooltip
          content={({ active, payload }) =>
            active && payload?.length ? (
              <div style={{ background:'#fff', border:'1px solid var(--border)', borderRadius:6, padding:'4px 8px', fontSize:11 }}>
                {payload[0]?.payload?.d}: {payload[0]?.value?.toLocaleString('en-IN',{maximumFractionDigits:2})}
              </div>
            ) : null
          }
        />
      </LineChart>
    </ResponsiveContainer>
  )
}

export default function UserDashboard() {
  const [data, setData] = useState(null)
  const [chart, setChart] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const { user } = useAuthStore()

  const load = async () => {
    setLoading(true); setError(null)
    try {
      const [eodRes, chartRes] = await Promise.allSettled([
        marketAPI.getEOD(), marketAPI.getChart()
      ])
      if (eodRes.status === 'fulfilled') setData(eodRes.value.data)
      else throw new Error(eodRes.reason?.response?.data?.detail || 'Failed to load')
      if (chartRes.status === 'fulfilled') setChart(chartRes.value.data)
    } catch (e) {
      setError(e.message || 'Failed to load market data')
    } finally { setLoading(false) }
  }

  useEffect(() => { load() }, [])

  const hs  = data?.health_score
  const nse = data?.nse
  const bse = data?.bse
  const exc = data?.exchange_comparison
  const bnk = data?.bank_nifty
  const nseChange = nse ? ((nse.nifty_close - nse.nifty_open)/nse.nifty_open*100) : 0
  const bseChange = bse ? ((bse.sensex_close - bse.sensex_open)/bse.sensex_open*100) : 0
  const regime_color = hs ? REGIME_COLOR[hs.regime] || '#888' : '#888'
  const trend_color  = hs ? TREND_COLOR[hs.trend_signal] || '#888' : '#888'

  return (
    <div>
      {/* Header */}
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:24 }}>
        <div>
          <h1 style={{ fontSize:24, fontWeight:800, color:'var(--text)' }}>Market Dashboard</h1>
          <p style={{ color:'var(--text-muted)', fontSize:14, marginTop:2 }}>
            Welcome, {user?.full_name} · 5-Pillar Structural Diagnosis · NSE & BSE
          </p>
        </div>
        <button onClick={load} disabled={loading} style={{ display:'flex', alignItems:'center', gap:8, padding:'9px 18px', background:'var(--primary)', color:'#fff', border:'none', borderRadius:'var(--radius-sm)', fontSize:13, fontWeight:600, cursor:'pointer', fontFamily:'var(--font)' }}>
          <RefreshCw size={14} style={{ animation:loading?'spin 1s linear infinite':'none' }}/> Refresh Data
        </button>
      </div>

      {loading && !data && (
        <div style={{ textAlign:'center', padding:80 }}>
          <Activity size={36} color="var(--primary)" style={{ marginBottom:12 }}/>
          <div style={{ color:'var(--text-muted)' }}>Fetching EOD data · Running 10-module pipeline…</div>
        </div>
      )}

      {error && (
        <Card style={{ padding:20, marginBottom:24, border:'1px solid #fecaca', background:'#fef2f2' }}>
          <div style={{ display:'flex', gap:12 }}>
            <AlertTriangle size={18} color="#dc2626" style={{ flexShrink:0, marginTop:2 }}/>
            <div>
              <div style={{ fontWeight:700, color:'#dc2626' }}>Data Unavailable</div>
              <div style={{ fontSize:13, color:'#991b1b', marginTop:4 }}>{error}</div>
              <div style={{ fontSize:12, color:'#b91c1c', marginTop:6 }}>Market may be closed. Try refreshing after 4:00 PM IST on weekdays.</div>
            </div>
          </div>
        </Card>
      )}

      {data && hs && (
        <>
          {/* Row 1: Score + Signal Cards */}
          <div style={{ display:'grid', gridTemplateColumns:'240px 1fr', gap:20, marginBottom:20 }}>
            <Card style={{ padding:24, textAlign:'center' }}>
              <div style={{ fontSize:11, fontWeight:700, color:'var(--text-muted)', letterSpacing:'0.08em', marginBottom:16 }}>HEALTH SCORE</div>
              <ScoreGauge score={hs.overall}/>
              <div style={{ marginTop:14, display:'flex', flexDirection:'column', gap:8 }}>
                <span style={{ display:'inline-flex', alignItems:'center', justifyContent:'center', gap:6, padding:'5px 14px', borderRadius:20, fontSize:13, fontWeight:700, background:`${regime_color}22`, border:`1px solid ${regime_color}55`, color:regime_color }}>
                  <span style={{ width:7, height:7, borderRadius:'50%', background:regime_color }}/>
                  {hs.regime} Regime
                </span>
                <span style={{ display:'inline-flex', alignItems:'center', justifyContent:'center', gap:6, padding:'4px 12px', borderRadius:20, fontSize:12, fontWeight:600, background:`${trend_color}18`, color:trend_color }}>
                  {hs.trend_signal === 'Bullish' ? '↑' : hs.trend_signal === 'Bearish' ? '↓' : '→'} {hs.trend_signal} Trend
                </span>
              </div>
              <div style={{ marginTop:12, fontSize:12, color:'var(--text-muted)' }}>
                Stress: <b style={{ color:hs.stress_level>6?'#ef4444':'var(--text)' }}>{hs.stress_level}/10</b>
              </div>
              {hs.support_level > 0 && (
                <div style={{ marginTop:8, fontSize:11, color:'var(--text-muted)' }}>
                  Support: <b style={{ color:'#10b981' }}>₹{hs.support_level.toLocaleString('en-IN',{maximumFractionDigits:0})}</b>
                  {' '} · Resist: <b style={{ color:'#ef4444' }}>₹{hs.resistance_level.toLocaleString('en-IN',{maximumFractionDigits:0})}</b>
                </div>
              )}
            </Card>

            {/* XAI breakdown */}
            <Card style={{ padding:24 }}>
              <div style={{ fontSize:11, fontWeight:700, color:'var(--text-muted)', letterSpacing:'0.08em', marginBottom:16 }}>
                EXPLAINABLE AI · 5-PILLAR BREAKDOWN (Module 9)
              </div>
              <div style={{ display:'flex', flexDirection:'column', gap:12 }}>
                {Object.entries(hs.explanations || {}).map(([k,v]) => {
                  const c = v.score>=65?'#10b981':v.score>=40?'#f59e0b':'#ef4444'
                  return (
                    <div key={k} style={{ display:'flex', alignItems:'center', gap:12 }}>
                      <div style={{ width:110, fontSize:11, fontWeight:700, color:'var(--primary)', textTransform:'uppercase', letterSpacing:'0.04em', flexShrink:0 }}>
                        {k.replace('_',' ')}
                        <span style={{ color:'var(--text-muted)', fontWeight:400 }}> {Math.round(v.weight*100)}%</span>
                      </div>
                      <div style={{ flex:1, height:8, background:'var(--violet-100)', borderRadius:4, overflow:'hidden' }}>
                        <div style={{ height:'100%', borderRadius:4, width:`${v.score}%`, background:c, transition:'width 0.8s ease' }}/>
                      </div>
                      <div style={{ width:32, fontWeight:800, fontSize:14, color:c, textAlign:'right' }}>{Math.round(v.score)}</div>
                      <div style={{ flex:2, fontSize:11, color:'var(--text-muted)', lineHeight:1.4 }}>{v.description}</div>
                    </div>
                  )
                })}
              </div>
            </Card>
          </div>

          {/* Row 2: NSE + BSE + Bank Nifty */}
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:16, marginBottom:20 }}>
            {[
              { ex:'NSE', idx:'NIFTY 50', open:nse?.nifty_open, close:nse?.nifty_close, high:nse?.nifty_high, low:nse?.nifty_low, adv:nse?.advances, dec:nse?.declines, chg:nseChange, vix:nse?.vix, rsi:nse?.rsi, hist:chart?.nse },
              { ex:'BSE', idx:'SENSEX',   open:bse?.sensex_open, close:bse?.sensex_close, high:bse?.sensex_high, low:bse?.sensex_low, adv:bse?.advances, dec:bse?.declines, chg:bseChange, hist:chart?.bse },
            ].map(({ ex, idx, open, close, high, low, adv, dec, chg, vix, rsi, hist }) => (
              <Card key={ex} style={{ padding:20 }}>
                <div style={{ display:'flex', justifyContent:'space-between', marginBottom:12 }}>
                  <div>
                    <div style={{ fontSize:11, fontWeight:700, color:'var(--primary)', letterSpacing:'0.08em' }}>{ex}</div>
                    <div style={{ fontSize:16, fontWeight:800 }}>{idx}</div>
                  </div>
                  <div style={{ textAlign:'right' }}>
                    <div style={{ fontSize:20, fontWeight:800 }}>{close?.toLocaleString('en-IN',{maximumFractionDigits:2})}</div>
                    <div style={{ display:'flex', alignItems:'center', gap:4, justifyContent:'flex-end', color:chg>=0?'#10b981':'#ef4444', fontSize:13, fontWeight:600 }}>
                      {chg>=0?<TrendingUp size={13}/>:<TrendingDown size={13}/>}
                      {chg>=0?'+':''}{chg?.toFixed(2)}%
                    </div>
                  </div>
                </div>
                {hist && hist.length > 0 && <MiniChart data={hist} dates={chart?.dates}/>}
                <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:6, marginTop:10 }}>
                  {[['Open',open],['High',high],['Low',low],['Close',close]].map(([l,v])=>(
                    <div key={l} style={{ background:'var(--violet-50)', borderRadius:7, padding:'6px 10px' }}>
                      <div style={{ fontSize:10, color:'var(--text-muted)' }}>{l}</div>
                      <div style={{ fontSize:13, fontWeight:700 }}>{v?.toLocaleString('en-IN',{maximumFractionDigits:2})}</div>
                    </div>
                  ))}
                </div>
                <div style={{ display:'flex', gap:12, marginTop:10, fontSize:12 }}>
                  <span style={{ color:'#10b981', fontWeight:600 }}>▲ {adv?.toLocaleString()}</span>
                  <span style={{ color:'#ef4444', fontWeight:600 }}>▼ {dec?.toLocaleString()}</span>
                  {vix && <span style={{ color:'var(--text-muted)' }}>VIX <b style={{ color:vix>20?'#ef4444':vix>15?'#f59e0b':'#10b981' }}>{vix}</b></span>}
                  {rsi  && <span style={{ color:'var(--text-muted)' }}>RSI <b>{rsi}</b></span>}
                </div>
              </Card>
            ))}

            {/* Bank Nifty card */}
            <Card style={{ padding:20 }}>
              <div style={{ fontSize:11, fontWeight:700, color:'var(--primary)', letterSpacing:'0.08em', marginBottom:4 }}>BANK NIFTY</div>
              <div style={{ fontSize:16, fontWeight:800, marginBottom:8 }}>Financial Sector</div>
              <div style={{ fontSize:26, fontWeight:800, color:bnk?.return_pct>=0?'#10b981':'#ef4444' }}>
                {bnk?.close?.toLocaleString('en-IN',{maximumFractionDigits:2}) || '—'}
              </div>
              <div style={{ fontSize:14, fontWeight:600, color:bnk?.return_pct>=0?'#10b981':'#ef4444', marginTop:4 }}>
                {bnk?.return_pct!=null ? `${bnk.return_pct>=0?'+':''}${bnk.return_pct.toFixed(2)}%` : '—'}
              </div>
              <div style={{ marginTop:12, padding:'10px 12px', background:'var(--violet-50)', borderRadius:10, fontSize:12, color:'var(--text-muted)', lineHeight:1.6 }}>
                {exc?.bank_nifty_signal === 'positive' ? '🏦 Financials led the market — positive sector signal' :
                 exc?.bank_nifty_signal === 'negative' ? '🏦 Financials lagged — sector under pressure' :
                 '🏦 Financials range-bound — neutral sector signal'}
              </div>
            </Card>
          </div>

          {/* Row 3: 5 Pillars */}
          <div style={{ display:'grid', gridTemplateColumns:'repeat(5, 1fr)', gap:12, marginBottom:20 }}>
            {[
              { label:'Volatility',   score:hs.pillars.volatility,      desc:hs.explanations.volatility?.description,      weight:30 },
              { label:'Participation',score:hs.pillars.participation,   desc:hs.explanations.participation?.description,   weight:25 },
              { label:'Stability',    score:hs.pillars.stability,       desc:hs.explanations.stability?.description,       weight:20 },
              { label:'Exch. Sync',  score:hs.pillars.exchange_sync,   desc:hs.explanations.exchange_sync?.description,   weight:15 },
              { label:'Momentum',     score:hs.pillars.momentum || 50,  desc:hs.explanations.momentum?.description || '—', weight:10 },
            ].map(p => <Pillar key={p.label} {...p}/>)}
          </div>

          {/* Row 4: Risk Flags */}
          {hs.risk_flags?.length > 0 && (
            <Card style={{ padding:20, marginBottom:20, border:'1px solid #fecaca' }}>
              <div style={{ fontSize:11, fontWeight:700, color:'#dc2626', letterSpacing:'0.08em', marginBottom:12 }}>
                🚨 ACTIVE RISK FLAGS ({hs.risk_flags.length})
              </div>
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8 }}>
                {hs.risk_flags.map((f,i) => (
                  <div key={i} style={{ padding:'10px 14px', background:'#fef2f2', borderRadius:8, fontSize:13, color:'#991b1b', border:'1px solid #fecaca' }}>{f}</div>
                ))}
              </div>
            </Card>
          )}

          {/* Row 5: Exchange Comparison */}
          {exc && (
            <Card style={{ padding:20, marginBottom:20 }}>
              <div style={{ fontSize:11, fontWeight:700, color:'var(--text-muted)', letterSpacing:'0.08em', marginBottom:12 }}>
                MODULE 6 · EXCHANGE COMPARISON
              </div>
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr 1fr', gap:12, marginBottom:12 }}>
                {[
                  ['NSE Return', `${exc.nse_return>=0?'+':''}${exc.nse_return?.toFixed(2)}%`, exc.nse_return>=0?'#10b981':'#ef4444'],
                  ['BSE Return', `${exc.bse_return>=0?'+':''}${exc.bse_return?.toFixed(2)}%`, exc.bse_return>=0?'#10b981':'#ef4444'],
                  ['Stronger', exc.stronger_exchange, 'var(--primary)'],
                  ['Divergence', `${exc.divergence?.toFixed(3)}%`, exc.divergence>0.5?'#ef4444':'#10b981'],
                ].map(([label, val, color]) => (
                  <div key={label} style={{ textAlign:'center', padding:14, background:'var(--violet-50)', borderRadius:10 }}>
                    <div style={{ fontSize:11, color:'var(--text-muted)', marginBottom:4 }}>{label}</div>
                    <div style={{ fontSize:20, fontWeight:800, color }}>{val}</div>
                  </div>
                ))}
              </div>
              <p style={{ fontSize:13, color:'var(--text-soft)', lineHeight:1.7 }}>{exc.analysis}</p>
            </Card>
          )}

          {/* Compliance */}
          <div style={{ padding:'12px 16px', background:'var(--violet-50)', border:'1px solid var(--border)', borderRadius:'var(--radius-sm)', fontSize:12, color:'var(--text-muted)' }}>
            <Zap size={12} style={{ verticalAlign:'middle', marginRight:4, color:'var(--primary)' }}/>
            <b style={{ color:'var(--primary)' }}>Compliance Notice:</b> This platform provides structural market diagnosis only. It does not give buy/sell recommendations, predict prices, or replace financial advisors. For research and educational use only. NSE & BSE EOD data.
          </div>
        </>
      )}
    </div>
  )
}
