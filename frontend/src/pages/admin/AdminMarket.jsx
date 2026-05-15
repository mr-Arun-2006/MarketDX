import React, { useState, useEffect } from 'react'
import { marketAPI } from '../../utils/api.js'
import { RefreshCw, Activity, CheckCircle, Clock } from 'lucide-react'
import { BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, ResponsiveContainer, Cell } from 'recharts'

function Card({ children, style={} }) {
  return <div style={{ background:'#fff', borderRadius:'var(--radius)', border:'1px solid var(--border)', boxShadow:'var(--shadow)', ...style }}>{children}</div>
}

function SLabel({ text }) {
  return <div style={{ fontSize:11, fontWeight:700, color:'var(--text-muted)', letterSpacing:'0.08em', marginBottom:12 }}>{text}</div>
}

function Feature({ label, value, color='var(--text)' }) {
  return (
    <div style={{ background:'var(--violet-50)', borderRadius:10, padding:'12px 14px', border:'1px solid var(--border)' }}>
      <div style={{ fontSize:10, color:'var(--text-muted)', fontWeight:600, marginBottom:3 }}>{label}</div>
      <div style={{ fontSize:16, fontWeight:800, color }}>{value ?? '—'}</div>
    </div>
  )
}

const MODULES = [
  { n:1,  label:'Login System',      check:(d)=>true },
  { n:2,  label:'Data Collection',   check:(d)=>!!d?.nse?.nifty_close },
  { n:3,  label:'Data Cleaning',     check:(d)=>!!d?.nse?.nifty_open },
  { n:4,  label:'Feature Eng.',      check:(d)=>!!d?.nse?.rsi },
  { n:5,  label:'Health Score',      check:(d)=>!!d?.health_score?.overall },
  { n:6,  label:'Exchange Comp.',    check:(d)=>!!d?.exchange_comparison },
  { n:7,  label:'Regime Class.',     check:(d)=>!!d?.health_score?.regime },
  { n:8,  label:'Regime Analysis',   check:(d)=>d?.health_score?.stress_level !== undefined },
  { n:9,  label:'XAI Narrative',     check:(d,r)=>!!r?.narrative },
  { n:10, label:'Reporting',         check:(d)=>!!d?.health_score?.overall },
]

export default function AdminMarket() {
  const [data,   setData]   = useState(null)
  const [ind,    setInd]    = useState(null)
  const [report, setReport] = useState(null)
  const [loading, setLoading] = useState(true)

  const load = async () => {
    setLoading(true)
    try {
      const [eodR, indR, repR] = await Promise.allSettled([
        marketAPI.getEOD(),
        marketAPI.getIndicators(),
        marketAPI.getReport(),
      ])
      if (eodR.status === 'fulfilled') setData(eodR.value.data)
      if (indR.status === 'fulfilled') setInd(indR.value.data)
      if (repR.status === 'fulfilled') setReport(repR.value.data)
    } finally { setLoading(false) }
  }

  useEffect(() => { load() }, [])

  const hs = data?.health_score

  // Pillar chart data
  const pillarData = hs ? [
    { name:'Volatility',     score:hs.pillars.volatility,       weight:30 },
    { name:'Participation',  score:hs.pillars.participation,    weight:25 },
    { name:'Stability',      score:hs.pillars.stability,        weight:20 },
    { name:'Exch. Sync',    score:hs.pillars.exchange_sync,    weight:15 },
    { name:'Momentum',       score:hs.pillars.momentum || 50,   weight:10 },
  ] : []

  const barColor = (score) =>
    score >= 65 ? '#10b981' : score >= 40 ? '#f59e0b' : '#ef4444'

  return (
    <div>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:24 }}>
        <div>
          <h1 style={{ fontSize:24, fontWeight:800, color:'var(--text)' }}>Market Monitor</h1>
          <p style={{ color:'var(--text-muted)', fontSize:14, marginTop:2 }}>Full 10-module pipeline · 5-pillar scores · Technical indicators · Admin view</p>
        </div>
        <button onClick={load} style={{ display:'flex', alignItems:'center', gap:8, padding:'9px 16px', background:'var(--primary)', color:'#fff', border:'none', borderRadius:'var(--radius-sm)', fontSize:13, fontWeight:600, cursor:'pointer', fontFamily:'var(--font)' }}>
          <RefreshCw size={14} style={{ animation:loading?'spin 1s linear infinite':'none' }}/> Refresh All
        </button>
      </div>

      {loading && (
        <div style={{ textAlign:'center', padding:60, color:'var(--text-muted)' }}>
          <Activity size={32} color="var(--primary)" style={{ marginBottom:12 }}/>
          <div>Running full pipeline…</div>
        </div>
      )}

      {data && hs && (
        <>
          {/* Module pipeline grid */}
          <Card style={{ padding:24, marginBottom:20 }}>
            <SLabel text={`10-MODULE PIPELINE STATUS · ${data.date}`}/>
            <div style={{ display:'grid', gridTemplateColumns:'repeat(5,1fr)', gap:10 }}>
              {MODULES.map(({ n, label, check }) => {
                const ok = check(data, report)
                return (
                  <div key={n} style={{ padding:'14px 10px', textAlign:'center', borderRadius:10, border:`1px solid ${ok?'#bbf7d0':'var(--border)'}`, background:ok?'#f0fdf4':'var(--violet-50)' }}>
                    <div style={{ fontSize:20, marginBottom:4 }}>{ok ? '✅' : '⏳'}</div>
                    <div style={{ fontSize:10, fontWeight:700, color:ok?'#16a34a':'var(--text-muted)', letterSpacing:'0.04em' }}>MOD {n}</div>
                    <div style={{ fontSize:11, color:'var(--text)', marginTop:2, fontWeight:600, lineHeight:1.3 }}>{label}</div>
                  </div>
                )
              })}
            </div>
          </Card>

          {/* Score + Pillar Chart */}
          <div style={{ display:'grid', gridTemplateColumns:'220px 1fr', gap:20, marginBottom:20 }}>
            <Card style={{ padding:24, textAlign:'center' }}>
              <SLabel text="OVERALL SCORE"/>
              <div style={{ fontSize:60, fontWeight:800, lineHeight:1,
                color: hs.overall>=65?'#10b981':hs.overall>=40?'#f59e0b':'#ef4444' }}>
                {Math.round(hs.overall)}
              </div>
              <div style={{ fontSize:13, color:'var(--text-muted)', marginTop:4 }}>/ 100</div>
              <div style={{ marginTop:14, display:'flex', flexDirection:'column', gap:8 }}>
                {[
                  ['Regime',    hs.regime],
                  ['Trend',     hs.trend_signal],
                  ['Stress',    `${hs.stress_level}/10`],
                  ['Flags',     `${hs.risk_flags?.length || 0} active`],
                ].map(([l,v]) => (
                  <div key={l} style={{ display:'flex', justifyContent:'space-between', fontSize:12, padding:'4px 0', borderBottom:'1px solid var(--border)' }}>
                    <span style={{ color:'var(--text-muted)' }}>{l}</span>
                    <b style={{ color:'var(--text)' }}>{v}</b>
                  </div>
                ))}
              </div>
            </Card>

            <Card style={{ padding:24 }}>
              <SLabel text="5-PILLAR SCORE BREAKDOWN (MODULES 5–8)"/>
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={pillarData} margin={{ top:4, right:12, bottom:4, left:12 }} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--violet-100)" horizontal={false}/>
                  <XAxis type="number" domain={[0,100]} tick={{ fontSize:11 }} tickLine={false}/>
                  <YAxis type="category" dataKey="name" tick={{ fontSize:12 }} tickLine={false} width={100}/>
                  <Tooltip
                    content={({ active, payload }) =>
                      active && payload?.length ? (
                        <div style={{ background:'#fff', border:'1px solid var(--border)', borderRadius:8, padding:'8px 12px', fontSize:12 }}>
                          <b>{payload[0]?.payload?.name}</b><br/>
                          Score: {payload[0]?.value?.toFixed(1)}<br/>
                          Weight: {payload[0]?.payload?.weight}%
                        </div>
                      ) : null
                    }
                  />
                  <Bar dataKey="score" radius={[0,6,6,0]}>
                    {pillarData.map((entry, i) => (
                      <Cell key={i} fill={barColor(entry.score)}/>
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </Card>
          </div>

          {/* Feature engineering output */}
          <Card style={{ padding:24, marginBottom:20 }}>
            <SLabel text="MODULE 4 · FEATURE ENGINEERING — ALL COMPUTED VALUES"/>
            <div style={{ display:'grid', gridTemplateColumns:'repeat(6,1fr)', gap:10 }}>
              <Feature label="Nifty Open"    value={`₹${data.nse.nifty_open?.toLocaleString('en-IN',{maximumFractionDigits:0})}`}/>
              <Feature label="Nifty Close"   value={`₹${data.nse.nifty_close?.toLocaleString('en-IN',{maximumFractionDigits:0})}`}/>
              <Feature label="Nifty High"    value={`₹${data.nse.nifty_high?.toLocaleString('en-IN',{maximumFractionDigits:0})}`}/>
              <Feature label="Nifty Low"     value={`₹${data.nse.nifty_low?.toLocaleString('en-IN',{maximumFractionDigits:0})}`}/>
              <Feature label="India VIX"     value={data.nse.vix?.toFixed(2)}
                color={data.nse.vix>20?'#ef4444':data.nse.vix>15?'#f59e0b':'#10b981'}/>
              <Feature label="RSI-14"        value={data.nse.rsi?.toFixed(2)}
                color={data.nse.rsi>70?'#ef4444':data.nse.rsi<30?'#10b981':'var(--text)'}/>
              {ind && <>
                <Feature label="MACD Line"   value={ind.macd?.macd?.toFixed(4)} color={ind.macd?.macd>0?'#10b981':'#ef4444'}/>
                <Feature label="MACD Hist"   value={ind.macd?.histogram?.toFixed(4)} color={ind.macd?.histogram>0?'#10b981':'#ef4444'}/>
                <Feature label="SMA-20"      value={`₹${ind.moving_averages?.sma_20?.toLocaleString('en-IN',{maximumFractionDigits:0})}`}/>
                <Feature label="SMA-50"      value={`₹${ind.moving_averages?.sma_50?.toLocaleString('en-IN',{maximumFractionDigits:0})}`}/>
                <Feature label="BB Upper"    value={`₹${ind.bollinger?.upper?.toLocaleString('en-IN',{maximumFractionDigits:0})}`} color="#ef4444"/>
                <Feature label="BB Lower"    value={`₹${ind.bollinger?.lower?.toLocaleString('en-IN',{maximumFractionDigits:0})}`} color="#10b981"/>
                <Feature label="ATR"         value={`₹${ind.atr?.value?.toFixed(2)}`}/>
                <Feature label="Bank Nifty"  value={`₹${ind.bank_nifty?.close?.toLocaleString('en-IN',{maximumFractionDigits:0})}`}/>
              </>}
              <Feature label="NSE Advances"  value={data.nse.advances?.toLocaleString()} color="#10b981"/>
              <Feature label="NSE Declines"  value={data.nse.declines?.toLocaleString()} color="#ef4444"/>
              <Feature label="BSE Advances"  value={data.bse.advances?.toLocaleString()} color="#10b981"/>
              <Feature label="BSE Declines"  value={data.bse.declines?.toLocaleString()} color="#ef4444"/>
            </div>
          </Card>

          {/* XAI explanations */}
          <Card style={{ padding:24, marginBottom:20 }}>
            <SLabel text="MODULE 9 · XAI FACTOR EXPLANATIONS"/>
            <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
              {Object.entries(hs.explanations || {}).map(([k,v]) => {
                const c = v.score>=65?'#10b981':v.score>=40?'#f59e0b':'#ef4444'
                return (
                  <div key={k} style={{ display:'flex', alignItems:'center', gap:14, padding:'12px 16px', background:'var(--violet-50)', borderRadius:10, border:'1px solid var(--border)' }}>
                    <div style={{ width:110, fontSize:12, fontWeight:700, color:'var(--primary)', textTransform:'capitalize', flexShrink:0 }}>
                      {k.replace('_',' ')}<br/>
                      <span style={{ color:'var(--text-muted)', fontWeight:400, fontSize:10 }}>Weight: {v.weight*100}%</span>
                    </div>
                    <div style={{ width:200, flexShrink:0 }}>
                      <div style={{ display:'flex', justifyContent:'space-between', marginBottom:4, fontSize:12 }}>
                        <span style={{ color:'var(--text-muted)' }}>Score</span>
                        <b style={{ color:c }}>{Math.round(v.score)}/100</b>
                      </div>
                      <div style={{ height:8, background:'var(--violet-200)', borderRadius:4, overflow:'hidden' }}>
                        <div style={{ height:'100%', width:`${v.score}%`, background:c, borderRadius:4 }}/>
                      </div>
                    </div>
                    <div style={{ flex:1, fontSize:13, color:'var(--text-soft)', lineHeight:1.5 }}>{v.description}</div>
                    <div style={{ fontSize:13, fontWeight:700, color:'var(--text-muted)', flexShrink:0 }}>
                      +{(v.score * v.weight).toFixed(1)} pts
                    </div>
                  </div>
                )
              })}
            </div>
          </Card>

          {/* Risk flags */}
          {hs.risk_flags?.length > 0 && (
            <Card style={{ padding:24, marginBottom:20, border:'1px solid #fecaca' }}>
              <SLabel text={`MODULE 8 · ACTIVE RISK FLAGS (${hs.risk_flags.length})`}/>
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8 }}>
                {hs.risk_flags.map((f,i) => (
                  <div key={i} style={{ padding:'10px 14px', background:'#fef2f2', borderRadius:8, fontSize:13, color:'#991b1b', border:'1px solid #fecaca' }}>{f}</div>
                ))}
              </div>
            </Card>
          )}

          {/* AI Report preview */}
          {report && (
            <Card style={{ padding:24 }}>
              <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:12 }}>
                <SLabel text="MODULE 10 · AI DIAGNOSTIC REPORT (ADMIN PREVIEW)"/>
                <span style={{ fontSize:11, background:'var(--violet-100)', color:'var(--primary)', padding:'3px 10px', borderRadius:8, fontWeight:600 }}>
                  {report.generated_by}
                </span>
              </div>
              <div style={{ fontSize:14, lineHeight:1.8, color:'var(--text)', whiteSpace:'pre-wrap', maxHeight:280, overflow:'auto', padding:'16px', background:'var(--violet-50)', borderRadius:10 }}>
                {report.narrative}
              </div>
              {report.key_findings?.length > 0 && (
                <div style={{ marginTop:16 }}>
                  <div style={{ fontSize:11, fontWeight:700, color:'var(--text-muted)', marginBottom:8 }}>KEY FINDINGS</div>
                  <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:6 }}>
                    {report.key_findings.map((f,i) => (
                      <div key={i} style={{ display:'flex', gap:8, padding:'8px 12px', background:'var(--violet-50)', borderRadius:8, border:'1px solid var(--border)', fontSize:13, color:'var(--text)' }}>
                        <CheckCircle size={14} color="var(--primary)" style={{ flexShrink:0, marginTop:1 }}/>
                        {f}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </Card>
          )}
        </>
      )}
    </div>
  )
}
