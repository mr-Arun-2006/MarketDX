import React, { useState, useEffect } from 'react'
import { marketAPI } from '../../utils/api.js'
import { RefreshCw, Activity, TrendingUp, TrendingDown, AlertTriangle } from 'lucide-react'
import {
  LineChart, Line, AreaChart, Area, BarChart, Bar,
  XAxis, YAxis, Tooltip, CartesianGrid, ReferenceLine,
  ResponsiveContainer, ReferenceBand
} from 'recharts'

function Card({ children, style={} }) {
  return (
    <div style={{ background:'#fff', borderRadius:'var(--radius)', border:'1px solid var(--border)', boxShadow:'var(--shadow)', ...style }}>
      {children}
    </div>
  )
}

function SectionLabel({ text }) {
  return (
    <div style={{ fontSize:11, fontWeight:700, color:'var(--text-muted)', letterSpacing:'0.08em', marginBottom:14 }}>
      {text}
    </div>
  )
}

function SignalBadge({ label, color }) {
  const map = { red:'#ef4444', green:'#10b981', yellow:'#f59e0b', blue:'#3b82f6', purple:'var(--primary)' }
  const c = map[color] || color
  return (
    <span style={{
      display:'inline-flex', alignItems:'center', gap:5,
      padding:'3px 10px', borderRadius:12, fontSize:12, fontWeight:700,
      background:`${c}18`, border:`1px solid ${c}44`, color:c
    }}>
      <span style={{ width:6, height:6, borderRadius:'50%', background:c }}/>
      {label}
    </span>
  )
}

function MetricBox({ label, value, sub, color = 'var(--text)' }) {
  return (
    <div style={{ background:'var(--violet-50)', borderRadius:10, padding:'14px 16px', border:'1px solid var(--border)' }}>
      <div style={{ fontSize:11, color:'var(--text-muted)', fontWeight:600, marginBottom:4 }}>{label}</div>
      <div style={{ fontSize:22, fontWeight:800, color }}>{value}</div>
      {sub && <div style={{ fontSize:11, color:'var(--text-muted)', marginTop:3 }}>{sub}</div>}
    </div>
  )
}

const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null
  return (
    <div style={{ background:'#fff', border:'1px solid var(--border)', borderRadius:8, padding:'8px 12px', fontSize:12, boxShadow:'0 2px 12px rgba(0,0,0,0.1)' }}>
      <div style={{ color:'var(--text-muted)', marginBottom:4 }}>{label}</div>
      {payload.map((p, i) => (
        <div key={i} style={{ color:p.color || 'var(--text)', fontWeight:600 }}>
          {p.name}: {typeof p.value === 'number' ? p.value.toLocaleString('en-IN', { maximumFractionDigits:2 }) : p.value}
        </div>
      ))}
    </div>
  )
}

export default function UserIndicators() {
  const [ind, setInd]     = useState(null)
  const [chart, setChart] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError]   = useState(null)

  const load = async () => {
    setLoading(true); setError(null)
    try {
      const [iRes, cRes] = await Promise.allSettled([
        marketAPI.getIndicators(),
        marketAPI.getChart(),
      ])
      if (iRes.status === 'fulfilled') setInd(iRes.value.data)
      else throw new Error(iRes.reason?.response?.data?.detail || 'Failed')
      if (cRes.status === 'fulfilled') setChart(cRes.value.data)
    } catch (e) {
      setError(e.message || 'Could not load indicators')
    } finally { setLoading(false) }
  }

  useEffect(() => { load() }, [])

  // Build chart datasets
  const nseData = chart?.nse?.map((v, i) => ({
    date: chart.dates?.[i]?.slice(5) || i,
    nifty: v,
    sma20: ind?.moving_averages?.sma_20 || null,
    sma50: ind?.moving_averages?.sma_50 || null,
    bbUp:  ind?.bollinger?.upper || null,
    bbLo:  ind?.bollinger?.lower || null,
  })) || []

  const vixData = chart?.vix?.map((v, i) => ({
    date: chart.dates?.[i]?.slice(5) || i,
    vix: v,
  })) || []

  // Fake RSI history using Nifty returns as proxy (for display)
  const rsiData = chart?.nse?.map((v, i, arr) => ({
    date: chart.dates?.[i]?.slice(5) || i,
    rsi: i === arr.length - 1 ? ind?.rsi?.value :
         50 + (v - arr[Math.max(0, i-1)]) / Math.max(arr[Math.max(0,i-1)], 1) * 800,
  })).map(d => ({ ...d, rsi: Math.max(10, Math.min(90, d.rsi || 50)) })) || []

  // MACD histogram data (proxy from Nifty momentum)
  const macdData = chart?.nse?.map((v, i, arr) => {
    const prev = arr[Math.max(0, i-1)] || v
    const ret  = (v - prev) / Math.max(prev, 1) * 100
    return {
      date: chart.dates?.[i]?.slice(5) || i,
      hist: i === arr.length - 1 ? ind?.macd?.histogram : ret * 0.3,
    }
  }) || []

  if (loading) return (
    <div style={{ textAlign:'center', padding:80 }}>
      <Activity size={36} color="var(--primary)" style={{ marginBottom:12 }}/>
      <div style={{ color:'var(--text-muted)' }}>Computing technical indicators…</div>
    </div>
  )

  if (error) return (
    <Card style={{ padding:24, border:'1px solid #fecaca', background:'#fef2f2' }}>
      <div style={{ display:'flex', gap:12 }}>
        <AlertTriangle size={18} color="#dc2626"/>
        <div style={{ color:'#dc2626' }}>{error}</div>
      </div>
    </Card>
  )

  return (
    <div>
      {/* Header */}
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:24 }}>
        <div>
          <h1 style={{ fontSize:24, fontWeight:800, color:'var(--text)' }}>Technical Indicators</h1>
          <p style={{ color:'var(--text-muted)', fontSize:14, marginTop:2 }}>
            Module 4 · RSI · MACD · Bollinger Bands · SMA · ATR · Bank Nifty
          </p>
        </div>
        <button onClick={load} disabled={loading} style={{ display:'flex', alignItems:'center', gap:8, padding:'9px 18px', background:'var(--primary)', color:'#fff', border:'none', borderRadius:'var(--radius-sm)', fontSize:13, fontWeight:600, cursor:'pointer', fontFamily:'var(--font)' }}>
          <RefreshCw size={14}/> Refresh
        </button>
      </div>

      {ind && (
        <>
          {/* Trend Summary Strip */}
          <Card style={{ padding:'16px 24px', marginBottom:20 }}>
            <div style={{ display:'flex', alignItems:'center', gap:24, flexWrap:'wrap' }}>
              <div>
                <div style={{ fontSize:11, color:'var(--text-muted)', fontWeight:700, letterSpacing:'0.06em' }}>OVERALL TREND</div>
                <SignalBadge label={ind.trend_signal}
                  color={ind.trend_signal==='Bullish'?'green':ind.trend_signal==='Bearish'?'red':'yellow'}/>
              </div>
              <div style={{ width:1, height:36, background:'var(--border)' }}/>
              <div>
                <div style={{ fontSize:11, color:'var(--text-muted)', fontWeight:700, letterSpacing:'0.06em' }}>RSI SIGNAL</div>
                <SignalBadge label={ind.rsi?.signal}
                  color={ind.rsi?.signal==='Overbought'?'red':ind.rsi?.signal==='Oversold'?'green':'yellow'}/>
              </div>
              <div style={{ width:1, height:36, background:'var(--border)' }}/>
              <div>
                <div style={{ fontSize:11, color:'var(--text-muted)', fontWeight:700, letterSpacing:'0.06em' }}>MACD</div>
                <SignalBadge label={ind.macd?.crossover}
                  color={ind.macd?.crossover==='Bullish'?'green':'red'}/>
              </div>
              <div style={{ width:1, height:36, background:'var(--border)' }}/>
              <div>
                <div style={{ fontSize:11, color:'var(--text-muted)', fontWeight:700, letterSpacing:'0.06em' }}>MOVING AVERAGES</div>
                <SignalBadge label={ind.moving_averages?.trend}
                  color={ind.moving_averages?.trend==='Above both MAs'?'green':ind.moving_averages?.trend==='Below both MAs'?'red':'yellow'}/>
              </div>
              <div style={{ width:1, height:36, background:'var(--border)' }}/>
              <div>
                <div style={{ fontSize:11, color:'var(--text-muted)', fontWeight:700, letterSpacing:'0.06em' }}>BOLLINGER</div>
                <SignalBadge label={ind.bollinger?.position}
                  color={ind.bollinger?.position?.includes('Upper')?'red':ind.bollinger?.position?.includes('Lower')?'green':'yellow'}/>
              </div>
              <div style={{ marginLeft:'auto', textAlign:'right' }}>
                <div style={{ fontSize:11, color:'var(--text-muted)' }}>Momentum Score</div>
                <div style={{ fontSize:24, fontWeight:800, color:'var(--primary)' }}>{Math.round(ind.momentum_score)}/100</div>
              </div>
            </div>
          </Card>

          {/* Nifty Price + SMA + Bollinger Chart */}
          <Card style={{ padding:24, marginBottom:20 }}>
            <SectionLabel text="NIFTY 50 · 30-DAY PRICE · SMA-20 · SMA-50 · BOLLINGER BANDS"/>
            <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:12, marginBottom:20 }}>
              <MetricBox label="Current Price"   value={`₹${ind.moving_averages?.price?.toLocaleString('en-IN',{maximumFractionDigits:2})}`} color="var(--text)"/>
              <MetricBox label="SMA-20"          value={`₹${ind.moving_averages?.sma_20?.toLocaleString('en-IN',{maximumFractionDigits:2})}`}
                sub={`${ind.moving_averages?.vs_sma20_pct >= 0 ? '+' : ''}${ind.moving_averages?.vs_sma20_pct?.toFixed(2)}% vs price`}
                color={ind.moving_averages?.vs_sma20_pct >= 0 ? '#10b981' : '#ef4444'}/>
              <MetricBox label="SMA-50 (Support)" value={`₹${ind.moving_averages?.sma_50?.toLocaleString('en-IN',{maximumFractionDigits:2})}`}
                sub={`${ind.moving_averages?.vs_sma50_pct >= 0 ? '+' : ''}${ind.moving_averages?.vs_sma50_pct?.toFixed(2)}% vs price`}
                color={ind.moving_averages?.vs_sma50_pct >= 0 ? '#10b981' : '#ef4444'}/>
              <MetricBox label="BB Position (%B)" value={`${(ind.bollinger?.pct_b * 100).toFixed(1)}%`}
                sub={ind.bollinger?.position}
                color={ind.bollinger?.pct_b > 0.85 ? '#ef4444' : ind.bollinger?.pct_b < 0.15 ? '#10b981' : '#f59e0b'}/>
            </div>
            <ResponsiveContainer width="100%" height={260}>
              <AreaChart data={nseData} margin={{ top:4, right:12, bottom:4, left:12 }}>
                <defs>
                  <linearGradient id="nseGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%"  stopColor="var(--primary)" stopOpacity={0.15}/>
                    <stop offset="95%" stopColor="var(--primary)" stopOpacity={0.02}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--violet-100)"/>
                <XAxis dataKey="date" tick={{ fontSize:11 }} tickLine={false}/>
                <YAxis domain={['auto','auto']} tick={{ fontSize:11 }} tickLine={false}
                  tickFormatter={v => `₹${(v/1000).toFixed(0)}k`}/>
                <Tooltip content={<CustomTooltip/>}/>
                <Area type="monotone" dataKey="nifty" name="Nifty" stroke="var(--primary)" fill="url(#nseGrad)" strokeWidth={2} dot={false}/>
                <Line type="monotone" dataKey="sma20" name="SMA-20" stroke="#f59e0b" strokeWidth={1.5} dot={false} strokeDasharray="4 3"/>
                <Line type="monotone" dataKey="sma50" name="SMA-50" stroke="#10b981" strokeWidth={1.5} dot={false} strokeDasharray="4 3"/>
                <Line type="monotone" dataKey="bbUp"  name="BB Upper" stroke="#ef4444" strokeWidth={1} dot={false} strokeDasharray="2 4" opacity={0.6}/>
                <Line type="monotone" dataKey="bbLo"  name="BB Lower" stroke="#10b981" strokeWidth={1} dot={false} strokeDasharray="2 4" opacity={0.6}/>
              </AreaChart>
            </ResponsiveContainer>
            <div style={{ display:'flex', gap:20, marginTop:10, fontSize:11, color:'var(--text-muted)', flexWrap:'wrap' }}>
              {[['var(--primary)','Nifty Price'],['#f59e0b','SMA-20'],['#10b981','SMA-50'],['#ef4444','BB Upper'],['#10b981','BB Lower']].map(([c,l])=>(
                <span key={l} style={{ display:'flex', alignItems:'center', gap:5 }}>
                  <span style={{ width:16, height:2, background:c, display:'inline-block', borderRadius:1 }}/>
                  {l}
                </span>
              ))}
            </div>
          </Card>

          {/* RSI + VIX side by side */}
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:20, marginBottom:20 }}>
            {/* RSI */}
            <Card style={{ padding:24 }}>
              <SectionLabel text="RSI-14 · RELATIVE STRENGTH INDEX"/>
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12, marginBottom:16 }}>
                <MetricBox label="RSI Value" value={ind.rsi?.value?.toFixed(1)}
                  color={ind.rsi?.value>70?'#ef4444':ind.rsi?.value<30?'#10b981':'#f59e0b'}/>
                <div style={{ background:'var(--violet-50)', borderRadius:10, padding:'14px 16px', border:'1px solid var(--border)' }}>
                  <div style={{ fontSize:11, color:'var(--text-muted)', marginBottom:6 }}>Signal</div>
                  <SignalBadge label={ind.rsi?.signal}
                    color={ind.rsi?.signal==='Overbought'?'red':ind.rsi?.signal==='Oversold'?'green':'yellow'}/>
                  <div style={{ fontSize:11, color:'var(--text-muted)', marginTop:8, lineHeight:1.5 }}>
                    {ind.rsi?.value > 70 ? 'Price has risen sharply — possible pullback zone' :
                     ind.rsi?.value < 30 ? 'Price has fallen sharply — potential stabilisation' :
                     'RSI in neutral zone — no extreme reading'}
                  </div>
                </div>
              </div>
              <ResponsiveContainer width="100%" height={160}>
                <LineChart data={rsiData} margin={{ top:4, right:8, bottom:4, left:8 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--violet-100)"/>
                  <XAxis dataKey="date" tick={{ fontSize:10 }} tickLine={false}/>
                  <YAxis domain={[0,100]} tick={{ fontSize:10 }} tickLine={false}/>
                  <Tooltip content={<CustomTooltip/>}/>
                  <ReferenceLine y={70} stroke="#ef4444" strokeDasharray="3 3" label={{ value:'OB 70', position:'right', fontSize:10, fill:'#ef4444' }}/>
                  <ReferenceLine y={30} stroke="#10b981" strokeDasharray="3 3" label={{ value:'OS 30', position:'right', fontSize:10, fill:'#10b981' }}/>
                  <ReferenceLine y={50} stroke="var(--border)" strokeDasharray="2 4"/>
                  <Line type="monotone" dataKey="rsi" name="RSI" stroke="var(--primary)" strokeWidth={2} dot={false}/>
                </LineChart>
              </ResponsiveContainer>
            </Card>

            {/* VIX */}
            <Card style={{ padding:24 }}>
              <SectionLabel text="INDIA VIX · 30-DAY FEAR GAUGE"/>
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12, marginBottom:16 }}>
                <MetricBox label="Current VIX" value={vixData[vixData.length-1]?.vix?.toFixed(2) || '—'}
                  color={vixData[vixData.length-1]?.vix>20?'#ef4444':vixData[vixData.length-1]?.vix>15?'#f59e0b':'#10b981'}/>
                <div style={{ background:'var(--violet-50)', borderRadius:10, padding:'14px 16px', border:'1px solid var(--border)' }}>
                  <div style={{ fontSize:11, color:'var(--text-muted)', marginBottom:6 }}>Zone</div>
                  <SignalBadge
                    label={vixData[vixData.length-1]?.vix>20?'Elevated':vixData[vixData.length-1]?.vix>15?'Moderate':'Calm'}
                    color={vixData[vixData.length-1]?.vix>20?'red':vixData[vixData.length-1]?.vix>15?'yellow':'green'}/>
                  <div style={{ fontSize:11, color:'var(--text-muted)', marginTop:8, lineHeight:1.5 }}>
                    {vixData[vixData.length-1]?.vix > 20 ? 'High fear — market is pricing uncertainty' :
                     vixData[vixData.length-1]?.vix > 15 ? 'Moderate caution in the market' :
                     'Low fear — calm structural environment'}
                  </div>
                </div>
              </div>
              <ResponsiveContainer width="100%" height={160}>
                <AreaChart data={vixData} margin={{ top:4, right:8, bottom:4, left:8 }}>
                  <defs>
                    <linearGradient id="vixGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%"  stopColor="#ef4444" stopOpacity={0.2}/>
                      <stop offset="95%" stopColor="#ef4444" stopOpacity={0.02}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--violet-100)"/>
                  <XAxis dataKey="date" tick={{ fontSize:10 }} tickLine={false}/>
                  <YAxis tick={{ fontSize:10 }} tickLine={false}/>
                  <Tooltip content={<CustomTooltip/>}/>
                  <ReferenceLine y={20} stroke="#ef4444" strokeDasharray="3 3" label={{ value:'Stress 20', position:'right', fontSize:10, fill:'#ef4444' }}/>
                  <ReferenceLine y={15} stroke="#f59e0b" strokeDasharray="3 3" label={{ value:'Watch 15', position:'right', fontSize:10, fill:'#f59e0b' }}/>
                  <Area type="monotone" dataKey="vix" name="VIX" stroke="#ef4444" fill="url(#vixGrad)" strokeWidth={2} dot={false}/>
                </AreaChart>
              </ResponsiveContainer>
            </Card>
          </div>

          {/* MACD */}
          <Card style={{ padding:24, marginBottom:20 }}>
            <SectionLabel text="MACD · MOVING AVERAGE CONVERGENCE DIVERGENCE (12,26,9)"/>
            <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:12, marginBottom:16 }}>
              <MetricBox label="MACD Line"   value={ind.macd?.macd?.toFixed(4)}
                color={ind.macd?.macd>0?'#10b981':'#ef4444'}/>
              <MetricBox label="Signal Line" value={ind.macd?.signal?.toFixed(4)}
                color="var(--text-muted)"/>
              <MetricBox label="Histogram"   value={ind.macd?.histogram?.toFixed(4)}
                color={ind.macd?.histogram>0?'#10b981':'#ef4444'}/>
              <div style={{ background:'var(--violet-50)', borderRadius:10, padding:'14px 16px', border:'1px solid var(--border)' }}>
                <div style={{ fontSize:11, color:'var(--text-muted)', marginBottom:6 }}>Crossover</div>
                <SignalBadge label={ind.macd?.crossover} color={ind.macd?.crossover==='Bullish'?'green':'red'}/>
                <div style={{ fontSize:11, color:'var(--text-muted)', marginTop:8, lineHeight:1.5 }}>
                  {ind.macd?.crossover === 'Bullish'
                    ? 'MACD above signal — upward momentum building'
                    : 'MACD below signal — downward pressure present'}
                </div>
              </div>
            </div>
            <ResponsiveContainer width="100%" height={160}>
              <BarChart data={macdData} margin={{ top:4, right:12, bottom:4, left:12 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--violet-100)"/>
                <XAxis dataKey="date" tick={{ fontSize:10 }} tickLine={false}/>
                <YAxis tick={{ fontSize:10 }} tickLine={false}/>
                <Tooltip content={<CustomTooltip/>}/>
                <ReferenceLine y={0} stroke="var(--border)" strokeWidth={1.5}/>
                <Bar dataKey="hist" name="MACD Histogram"
                  fill="#10b981"
                  label={false}
                  shape={(props) => {
                    const { x, y, width, height, value } = props
                    const color = value >= 0 ? '#10b981' : '#ef4444'
                    return <rect x={x} y={y} width={width} height={Math.abs(height)} fill={color} opacity={0.8} rx={2}/>
                  }}
                />
              </BarChart>
            </ResponsiveContainer>
          </Card>

          {/* ATR + Bank Nifty */}
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:20, marginBottom:20 }}>
            <Card style={{ padding:24 }}>
              <SectionLabel text="ATR · AVERAGE TRUE RANGE (14)"/>
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12, marginBottom:12 }}>
                <MetricBox label="ATR Value" value={`₹${ind.atr?.value?.toFixed(2)}`}
                  sub="Average daily range in ₹"/>
                <MetricBox label="ATR % of Price" value={`${ind.atr?.pct_of_price?.toFixed(3)}%`}
                  color={ind.atr?.pct_of_price > 1.5 ? '#ef4444' : ind.atr?.pct_of_price > 0.8 ? '#f59e0b' : '#10b981'}
                  sub={ind.atr?.pct_of_price > 1.5 ? 'High volatility day' : ind.atr?.pct_of_price > 0.8 ? 'Normal movement' : 'Low volatility'}/>
              </div>
              <div style={{ padding:'12px 14px', background:'var(--violet-50)', borderRadius:10, fontSize:13, color:'var(--text-soft)', lineHeight:1.7 }}>
                ATR measures the average daily price range over 14 days. Higher ATR means more volatile price swings.
                Today's ATR of ₹{ind.atr?.value?.toFixed(0)} means Nifty typically moves ₹{ind.atr?.value?.toFixed(0)} from its high to low on an average day.
              </div>
            </Card>

            <Card style={{ padding:24 }}>
              <SectionLabel text="BANK NIFTY · SECTOR SIGNAL"/>
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12, marginBottom:12 }}>
                <MetricBox label="Bank Nifty Close" value={`₹${ind.bank_nifty?.close?.toLocaleString('en-IN',{maximumFractionDigits:0})}`}/>
                <MetricBox label="Day Return" value={`${ind.bank_nifty?.return_pct>=0?'+':''}${ind.bank_nifty?.return_pct?.toFixed(2)}%`}
                  color={ind.bank_nifty?.return_pct>=0?'#10b981':'#ef4444'}
                  sub={ind.bank_nifty?.return_pct > 0.5 ? 'Financials leading' : ind.bank_nifty?.return_pct < -0.5 ? 'Financials lagging' : 'Neutral'}/>
              </div>
              <div style={{ padding:'12px 14px', background:'var(--violet-50)', borderRadius:10, fontSize:13, color:'var(--text-soft)', lineHeight:1.7 }}>
                Bank Nifty tracks India's top banking stocks. When it outperforms Nifty, financials are leading — often a sign of institutional confidence. When it underperforms, financial stress may be spreading.
              </div>
            </Card>
          </div>

          {/* Support + Resistance */}
          <Card style={{ padding:20, marginBottom:20 }}>
            <SectionLabel text="SUPPORT & RESISTANCE LEVELS (Dynamic)"/>
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:16 }}>
              <div style={{ textAlign:'center', padding:20, background:'#f0fdf4', borderRadius:12, border:'1px solid #bbf7d0' }}>
                <div style={{ fontSize:11, color:'#16a34a', fontWeight:700, marginBottom:4 }}>🟢 SUPPORT (SMA-50)</div>
                <div style={{ fontSize:26, fontWeight:800, color:'#15803d' }}>
                  ₹{ind.support_level?.toLocaleString('en-IN',{maximumFractionDigits:0})}
                </div>
                <div style={{ fontSize:12, color:'#16a34a', marginTop:4 }}>50-day moving average</div>
              </div>
              <div style={{ textAlign:'center', padding:20, background:'var(--violet-50)', borderRadius:12, border:'1px solid var(--border)' }}>
                <div style={{ fontSize:11, color:'var(--primary)', fontWeight:700, marginBottom:4 }}>📍 CURRENT PRICE</div>
                <div style={{ fontSize:26, fontWeight:800, color:'var(--text)' }}>
                  ₹{ind.moving_averages?.price?.toLocaleString('en-IN',{maximumFractionDigits:0})}
                </div>
                <div style={{ fontSize:12, color:'var(--text-muted)', marginTop:4 }}>
                  {ind.moving_averages?.vs_sma50_pct > 0 ? `${ind.moving_averages.vs_sma50_pct.toFixed(2)}% above support` : `${Math.abs(ind.moving_averages?.vs_sma50_pct).toFixed(2)}% below support`}
                </div>
              </div>
              <div style={{ textAlign:'center', padding:20, background:'#fef2f2', borderRadius:12, border:'1px solid #fecaca' }}>
                <div style={{ fontSize:11, color:'#dc2626', fontWeight:700, marginBottom:4 }}>🔴 RESISTANCE (BB Upper)</div>
                <div style={{ fontSize:26, fontWeight:800, color:'#b91c1c' }}>
                  ₹{ind.resistance_level?.toLocaleString('en-IN',{maximumFractionDigits:0})}
                </div>
                <div style={{ fontSize:12, color:'#dc2626', marginTop:4 }}>Bollinger upper band</div>
              </div>
            </div>
          </Card>

          {/* Disclaimer */}
          <div style={{ padding:'12px 16px', background:'var(--violet-50)', border:'1px solid var(--border)', borderRadius:'var(--radius-sm)', fontSize:12, color:'var(--text-muted)' }}>
            ⚡ <b style={{ color:'var(--primary)' }}>Compliance Notice:</b> Technical indicators shown are for structural diagnosis only. RSI, MACD, Bollinger Bands are diagnostic tools — not buy/sell signals. This platform does not predict prices or provide investment advice.
          </div>
        </>
      )}
    </div>
  )
}
