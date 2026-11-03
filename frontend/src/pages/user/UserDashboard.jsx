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
  const [sources, setSources] = useState(null)
  const [stockSymbol, setStockSymbol] = useState('RELIANCE')
  const [stockExchange, setStockExchange] = useState('NSE')
  const [stockFrom, setStockFrom] = useState('')
  const [stockTo, setStockTo] = useState('')
  const [stockHistory, setStockHistory] = useState(null)
  const [stockAdjusted, setStockAdjusted] = useState(null)
  const [stockDelivery, setStockDelivery] = useState(null)
  const [stockExtraLoading, setStockExtraLoading] = useState(false)
  const [stockExtraError, setStockExtraError] = useState(null)
  const [stockLoading, setStockLoading] = useState(false)
  const [stockError, setStockError] = useState(null)
  const [enrichmentSection, setEnrichmentSection] = useState('financials')
  const [enrichmentData, setEnrichmentData] = useState(null)
  const [enrichmentLoading, setEnrichmentLoading] = useState(false)
  const [enrichmentError, setEnrichmentError] = useState(null)
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

  const loadSources = async () => {
    try {
      const response = await marketAPI.getSources()
      setSources(response.data)
    } catch {
      setSources(null)
    }
  }

  const loadStockHistory = async (event) => {
    event?.preventDefault()
    const symbol = stockSymbol.trim().toUpperCase()
    if (!symbol) return
    setStockLoading(true)
    setStockError(null)
    setStockHistory(null)
    setStockAdjusted(null)
    setStockDelivery(null)
    setStockExtraError(null)
    setEnrichmentData(null)
    try {
      const response = await marketAPI.getStockEOD(symbol, stockExchange, stockFrom || undefined, stockTo || undefined)
      setStockHistory(response.data)
    } catch (e) {
      setStockError(e.response?.data?.detail || e.message || 'Unable to load TejHQ EOD history')
    } finally {
      setStockLoading(false)
    }
  }

  const loadTejExtra = async (kind) => {
    const symbol = stockSymbol.trim().toUpperCase()
    if (!symbol) return
    if (kind === 'delivery' && stockExchange !== 'NSE') {
      setStockExtraError('TejHQ delivery history is available for NSE only.')
      return
    }
    setStockExtraLoading(true)
    setStockExtraError(null)
    try {
      const response = kind === 'adjusted'
        ? await marketAPI.getStockAdjusted(symbol, stockExchange, stockFrom || undefined, stockTo || undefined)
        : await marketAPI.getStockDelivery(symbol, stockExchange, stockFrom || undefined, stockTo || undefined)
      if (kind === 'adjusted') setStockAdjusted(response.data)
      else setStockDelivery(response.data)
    } catch (e) {
      setStockExtraError(e.response?.data?.detail || e.message || `Unable to load TejHQ ${kind} data`)
    } finally {
      setStockExtraLoading(false)
    }
  }

  const loadEnrichment = async () => {
    const symbol = stockSymbol.trim().toUpperCase()
    if (!symbol) return
    setEnrichmentLoading(true)
    setEnrichmentError(null)
    setEnrichmentData(null)
    try {
      const response = await marketAPI.getStockEnrichment(
        symbol,
        enrichmentSection,
        stockExchange,
        enrichmentSection === 'financials' ? { period_type: 'annual', page_size: 10 } : { page_size: 20 }
      )
      setEnrichmentData(response.data)
    } catch (e) {
      setEnrichmentError(e.response?.data?.detail || e.message || 'Unable to load BharatStock enrichment')
    } finally {
      setEnrichmentLoading(false)
    }
  }

  useEffect(() => {
    load()
    loadSources()
  }, [])



  const stockRows = [...(stockHistory?.data || [])]
    .sort((a, b) => String(b.date || b.trade_date || '').localeCompare(String(a.date || a.trade_date || '')))
    .slice(0, 5)

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

      {/* Data provider routing: EOD is primary; live quotes are a separate secondary feed. */}
      <Card style={{ padding:20, marginBottom:20 }}>
        <div style={{ fontSize:11, fontWeight:800, color:'var(--primary)', letterSpacing:'0.08em', marginBottom:12 }}>
          MARKET DATA SOURCES
        </div>
        <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(190px,1fr))', gap:12 }}>
          {[
            ['PRIMARY EOD · EQUITIES', sources?.primary_eod],
            ['EOD ENRICHMENT', sources?.eod_enrichment],
            ['LIVE DATA', sources?.live],
            ['INDEX DIAGNOSIS', sources?.index_diagnosis],
          ].map(([label, source]) => (
            <div key={label} style={{ padding:14, background:'var(--violet-50)', border:'1px solid var(--border)', borderRadius:10 }}>
              <div style={{ fontSize:10, fontWeight:800, color:'var(--text-muted)', letterSpacing:'0.05em' }}>{label}</div>
              <div style={{ fontSize:14, fontWeight:800, color:'var(--text)', marginTop:6 }}>
                {source?.provider || 'Checking provider…'}
              </div>
              <div style={{ fontSize:11, marginTop:5, color:source?.configured || source?.status==='ready' ? '#059669' : '#b45309', fontWeight:700 }}>
                {source?.status==='disabled' ? 'Disabled · provider not selected' : source?.configured ? 'Configured' : source?.status==='ready' ? 'Ready · no key required' : source?.status==='fallback' ? 'Fallback source' : source?.status==='needs_api_key' ? 'API key required' : source?.status==='needs_credentials' ? 'Credentials required' : 'Status unavailable'}
              </div>
              <div style={{ fontSize:11, color:'var(--text-muted)', lineHeight:1.5, marginTop:7 }}>
                {source?.coverage ? `NSE ${source.coverage.NSE} · BSE ${source.coverage.BSE}` : source?.daily_quota || source?.note || 'Provider metadata loading'}
              </div>
            </div>
          ))}
        </div>
        <div style={{ fontSize:11, color:'var(--text-muted)', marginTop:12, lineHeight:1.5 }}>
          TejHQ supplies individual-stock EOD candles. BharatStock adds fundamentals on request. Intraday/live quotes are intentionally disabled until a replacement provider is selected. Current Nifty, Sensex, India VIX and Bank Nifty diagnosis still uses the clearly labelled index fallback.
        </div>
      </Card>



      {/* TejHQ stock EOD history and optional BharatStock enrichment. */}
      <Card style={{ padding:20, marginBottom:20 }}>
        <div style={{ fontSize:11, fontWeight:800, color:'var(--primary)', letterSpacing:'0.08em', marginBottom:12 }}>
          EQUITY EOD DATA EXPLORER · TEJ BAZAAR
        </div>
        <form onSubmit={loadStockHistory} style={{ display:'flex', flexWrap:'wrap', gap:8, alignItems:'center' }}>
          <input
            value={stockSymbol}
            onChange={e=>setStockSymbol(e.target.value.toUpperCase())}
            placeholder="Stock symbol e.g. RELIANCE"
            aria-label="Stock symbol"
            style={{ flex:'1 1 180px', minWidth:150, padding:'10px 12px', border:'1px solid var(--border)', borderRadius:8, fontSize:13, fontFamily:'var(--font)' }}
          />
          <input type="date" value={stockFrom} onChange={e=>setStockFrom(e.target.value)} aria-label="History start date"
            style={{ padding:'10px 12px', border:'1px solid var(--border)', borderRadius:8, fontSize:12, fontFamily:'var(--font)' }}/>
          <input type="date" value={stockTo} onChange={e=>setStockTo(e.target.value)} aria-label="History end date"
            style={{ padding:'10px 12px', border:'1px solid var(--border)', borderRadius:8, fontSize:12, fontFamily:'var(--font)' }}/>
          <select value={stockExchange} onChange={e=>{setStockExchange(e.target.value);setStockFrom('')}} aria-label="Exchange"
            style={{ padding:'10px 12px', border:'1px solid var(--border)', borderRadius:8, fontSize:13, fontFamily:'var(--font)', background:'#fff' }}>
            <option value="NSE">NSE</option><option value="BSE">BSE</option>
          </select>
          <button type="submit" disabled={stockLoading} style={{ padding:'10px 16px', border:0, borderRadius:8, background:'var(--primary)', color:'#fff', fontWeight:700, cursor:'pointer', fontFamily:'var(--font)' }}>
            {stockLoading ? 'Loading…' : 'Load EOD history'}
          </button>
        </form>
        {stockError && <div style={{ color:'#b91c1c', fontSize:12, marginTop:10 }}>{stockError}</div>}
        {stockHistory && (
          <div style={{ marginTop:16 }}>
            <div style={{ display:'flex', justifyContent:'space-between', flexWrap:'wrap', gap:8, marginBottom:10 }}>
              <div style={{ fontSize:13, fontWeight:800 }}>{stockHistory.symbol} · {stockHistory.exchange} · {stockHistory.count} daily rows</div>
              <div style={{ fontSize:11, color:'var(--text-muted)' }}>Source: {stockHistory.provider} · As of {stockHistory.as_of || 'date unavailable'}</div>
            </div>
            <div style={{ overflowX:'auto' }}>
              <table style={{ width:'100%', borderCollapse:'collapse', fontSize:12 }}>
                <thead><tr>{['Date','Open','High','Low','Close','Volume','Delivery %'].map(label=><th key={label} style={{ textAlign:'right', padding:'8px 10px', borderBottom:'1px solid var(--border)', color:'var(--text-muted)' }}>{label}</th>)}</tr></thead>
                <tbody>
                  {stockRows.map((row,i)=>(
                    <tr key={row.date || row.trade_date || i}>
                      <td style={{ padding:'8px 10px', textAlign:'right' }}>{row.date || row.trade_date || '—'}</td>
                      {[row.open,row.high,row.low,row.close,row.volume,row.delivery_pct].map((value,j)=>(
                        <td key={j} style={{ padding:'8px 10px', textAlign:'right' }}>{value == null ? '—' : Number(value).toLocaleString('en-IN',{maximumFractionDigits:2})}</td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div style={{ fontSize:10, color:'var(--text-muted)', marginTop:8 }}>{stockHistory.notice}</div>
          </div>
        )}
        <div style={{ display:'flex', flexWrap:'wrap', gap:8, alignItems:'center', marginTop:12 }}>
          <button type="button" onClick={()=>loadTejExtra('adjusted')} disabled={stockExtraLoading || !stockHistory || !sources?.primary_eod?.free_key_status || sources.primary_eod.free_key_status!=='configured'}
            style={{ padding:'8px 12px', border:'1px solid var(--border)', borderRadius:8, background:'#fff', color:'var(--text)', fontSize:12, fontWeight:700, cursor:'pointer', opacity:sources?.primary_eod?.free_key_status==='configured'?1:0.55 }}>
            {stockExtraLoading ? 'Loading…' : 'Load adjusted prices'}
          </button>
          <button type="button" onClick={()=>loadTejExtra('delivery')} disabled={stockExtraLoading || !stockHistory || stockExchange!=='NSE' || sources?.primary_eod?.free_key_status!=='configured'}
            style={{ padding:'8px 12px', border:'1px solid var(--border)', borderRadius:8, background:'#fff', color:'var(--text)', fontSize:12, fontWeight:700, cursor:'pointer', opacity:sources?.primary_eod?.free_key_status==='configured' && stockExchange==='NSE'?1:0.55 }}>
            {stockExtraLoading ? 'Loading…' : 'Load NSE delivery'}
          </button>
          {sources?.primary_eod?.free_key_status!=='configured' && <span style={{ fontSize:11, color:'var(--text-muted)' }}>Set TEJ_API_KEY to unlock adjusted prices and delivery (free key · 1,000 requests/day).</span>}
        </div>
        {stockExtraError && <div style={{ color:'#b91c1c', fontSize:12, marginTop:8 }}>{stockExtraError}</div>}
        {(stockAdjusted || stockDelivery) && (
          <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(230px,1fr))', gap:10, marginTop:12 }}>
            {stockAdjusted && <div style={{ padding:12, border:'1px solid var(--border)', borderRadius:8, background:'var(--violet-50)' }}>
              <div style={{ fontSize:11, fontWeight:800, marginBottom:6 }}>BACK-ADJUSTED PRICES</div>
              <div style={{ fontSize:11, color:'var(--text-muted)', marginBottom:8 }}>{stockAdjusted.count} rows · {stockAdjusted.provider}</div>
              <pre style={{ whiteSpace:'pre-wrap', overflowX:'auto', maxHeight:170, fontSize:10 }}>{JSON.stringify(stockAdjusted.data?.slice?.(-3) || stockAdjusted.data,null,2)}</pre>
            </div>}
            {stockDelivery && <div style={{ padding:12, border:'1px solid var(--border)', borderRadius:8, background:'var(--violet-50)' }}>
              <div style={{ fontSize:11, fontWeight:800, marginBottom:6 }}>NSE DELIVERY HISTORY</div>
              <div style={{ fontSize:11, color:'var(--text-muted)', marginBottom:8 }}>{stockDelivery.count} rows · {stockDelivery.provider}</div>
              <pre style={{ whiteSpace:'pre-wrap', overflowX:'auto', maxHeight:170, fontSize:10 }}>{JSON.stringify(stockDelivery.data?.slice?.(-3) || stockDelivery.data,null,2)}</pre>
            </div>}
          </div>
        )}
        <div style={{ display:'flex', flexWrap:'wrap', gap:8, alignItems:'center', marginTop:16, paddingTop:14, borderTop:'1px solid var(--border)' }}>
          <span style={{ fontSize:12, fontWeight:700, color:'var(--text)' }}>BharatStock enrichment</span>
          <select value={enrichmentSection} onChange={e=>setEnrichmentSection(e.target.value)} aria-label="Enrichment type"
            style={{ padding:'8px 10px', border:'1px solid var(--border)', borderRadius:8, fontSize:12, background:'#fff' }}>
            <option value="financials">Financial statements</option>
            <option value="ratios">Valuation ratios</option>
            <option value="shareholding">Shareholding</option>
            <option value="corporate-actions">Corporate actions</option>
          </select>
          <button type="button" onClick={loadEnrichment} disabled={enrichmentLoading || !sources?.eod_enrichment?.configured}
            style={{ padding:'9px 13px', border:'1px solid var(--border)', borderRadius:8, background:'#fff', color:'var(--text)', fontWeight:700, cursor:'pointer', fontFamily:'var(--font)', opacity:sources?.eod_enrichment?.configured?1:0.55 }}>
            {enrichmentLoading ? 'Loading…' : 'Load enrichment'}
          </button>
          {!sources?.eod_enrichment?.configured && <span style={{ fontSize:11, color:'var(--text-muted)' }}>Set BHARATSTOCK_API_KEY in backend environment to enable (60 requests/day on Free).</span>}
        </div>
        {enrichmentError && <div style={{ color:'#b91c1c', fontSize:12, marginTop:8 }}>{enrichmentError}</div>}
        {enrichmentData && <pre style={{ whiteSpace:'pre-wrap', overflowX:'auto', maxHeight:260, padding:12, marginTop:10, background:'var(--violet-50)', borderRadius:8, fontSize:11, color:'var(--text)' }}>{JSON.stringify(enrichmentData.data,null,2)}</pre>}
      </Card>

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
