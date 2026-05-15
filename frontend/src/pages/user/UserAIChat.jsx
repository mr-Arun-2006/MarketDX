import React, { useState, useRef, useEffect } from 'react'
import { aiAPI, marketAPI } from '../../utils/api.js'
import { Bot, Send, User, Sparkles, RefreshCw, Info } from 'lucide-react'
import { useAuthStore } from '../../store/authStore.js'

const STARTERS = [
  "What does today's health score mean?",
  "Explain the market regime in simple terms",
  "What is RSI and what does today's reading mean?",
  "How do NSE and BSE differ structurally today?",
  "What does India VIX tell us about the market?",
  "Explain MACD in plain language",
  "What is Bollinger Band position telling us?",
  "How is the momentum score calculated?",
]

function MsgBubble({ msg }) {
  const isUser = msg.role === 'user'
  return (
    <div style={{ display:'flex', gap:10, alignItems:'flex-start', flexDirection:isUser?'row-reverse':'row', animation:'fadeUp 0.3s ease' }}>
      <div style={{
        width:34, height:34, borderRadius:10, flexShrink:0,
        background: isUser ? 'var(--violet-200)' : 'var(--primary)',
        display:'flex', alignItems:'center', justifyContent:'center',
      }}>
        {isUser ? <User size={17} color="var(--primary)"/> : <Bot size={17} color="#fff"/>}
      </div>
      <div style={{
        maxWidth:'72%', padding:'13px 16px', borderRadius:12, fontSize:14, lineHeight:1.75,
        background: isUser ? 'var(--primary)' : '#fff',
        color: isUser ? '#fff' : 'var(--text)',
        border: isUser ? 'none' : '1px solid var(--border)',
        whiteSpace:'pre-wrap', wordBreak:'break-word',
        borderTopLeftRadius: isUser ? 12 : 2,
        borderTopRightRadius: isUser ? 2 : 12,
        boxShadow: isUser ? 'none' : 'var(--shadow)',
      }}>
        {msg.text}
      </div>
    </div>
  )
}

function TypingIndicator() {
  return (
    <div style={{ display:'flex', gap:10, alignItems:'center' }}>
      <div style={{ width:34, height:34, borderRadius:10, background:'var(--primary)', display:'flex', alignItems:'center', justifyContent:'center' }}>
        <Sparkles size={17} color="#fff"/>
      </div>
      <div style={{ padding:'12px 16px', background:'#fff', borderRadius:12, border:'1px solid var(--border)', display:'flex', gap:5 }}>
        {[0,1,2].map(i => (
          <div key={i} style={{
            width:7, height:7, borderRadius:'50%', background:'var(--primary)',
            animation:`bounce 1.2s ease ${i*0.2}s infinite`,
            opacity:0.6,
          }}/>
        ))}
      </div>
    </div>
  )
}

export default function UserAIChat() {
  const [messages, setMessages] = useState([{
    role: 'ai',
    text: "Hello! I'm your Market Diagnosis AI Assistant, powered by Google Gemini.\n\nI have access to today's live market context — health score, regime, RSI, MACD, VIX, and more.\n\nAsk me anything about market structure, technical indicators, or how the diagnostic scores work.\n\n⚠️ I do not give buy/sell recommendations or predict prices.",
  }])
  const [input, setInput]     = useState('')
  const [loading, setLoading] = useState(false)
  const [summary, setSummary] = useState(null)
  const bottom = useRef(null)
  const { user } = useAuthStore()

  useEffect(() => { bottom.current?.scrollIntoView({ behavior:'smooth' }) }, [messages])

  useEffect(() => {
    marketAPI.getSummary().then(r => setSummary(r.data)).catch(() => {})
  }, [])

  const send = async (text) => {
    const msg = text || input.trim()
    if (!msg) return
    setInput('')
    setMessages(m => [...m, { role:'user', text:msg }])
    setLoading(true)
    try {
      const res = await aiAPI.chat(msg)
      setMessages(m => [...m, { role:'ai', text:res.data.reply }])
    } catch (e) {
      setMessages(m => [...m, { role:'ai', text:'❌ Could not connect to AI. Check your GEMINI_API_KEY in .env and restart the backend.' }])
    } finally { setLoading(false) }
  }

  const clearChat = () => setMessages([{
    role:'ai',
    text:"Chat cleared. Ask me anything about today's market structure!",
  }])

  return (
    <div style={{ display:'flex', flexDirection:'column', height:'calc(100vh - 120px)', gap:16 }}>
      {/* Header */}
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start' }}>
        <div>
          <h1 style={{ fontSize:24, fontWeight:800, color:'var(--text)' }}>AI Assistant</h1>
          <p style={{ color:'var(--text-muted)', fontSize:14, marginTop:2 }}>Google Gemini · Live Market Context · Diagnosis Q&A Only</p>
        </div>
        <button onClick={clearChat} style={{ display:'flex', alignItems:'center', gap:6, padding:'8px 14px', background:'var(--violet-50)', border:'1px solid var(--border)', borderRadius:'var(--radius-sm)', fontSize:13, color:'var(--text-muted)', cursor:'pointer', fontFamily:'var(--font)' }}>
          <RefreshCw size={13}/> Clear Chat
        </button>
      </div>

      {/* Live context bar */}
      {summary && (
        <div style={{ background:'var(--violet-50)', borderRadius:'var(--radius-sm)', padding:'10px 16px', border:'1px solid var(--border)', display:'flex', gap:20, flexWrap:'wrap', fontSize:12 }}>
          <span style={{ color:'var(--text-muted)', fontWeight:700 }}>🔴 LIVE CONTEXT:</span>
          <span>Score <b style={{ color:'var(--primary)' }}>{Math.round(summary.score)}/100</b></span>
          <span>Regime <b>{summary.regime}</b></span>
          <span>Trend <b style={{ color:summary.trend_signal==='Bullish'?'#10b981':summary.trend_signal==='Bearish'?'#ef4444':'#f59e0b' }}>{summary.trend_signal}</b></span>
          <span>VIX <b style={{ color:summary.vix>20?'#ef4444':summary.vix>15?'#f59e0b':'#10b981' }}>{summary.vix}</b></span>
          <span>Nifty <b style={{ color:summary.nse_return>=0?'#10b981':'#ef4444' }}>{summary.nse_return>=0?'+':''}{summary.nse_return?.toFixed(2)}%</b></span>
          <span style={{ color:'var(--text-muted)', marginLeft:'auto', display:'flex', alignItems:'center', gap:4 }}><Info size={11}/> AI sees this context</span>
        </div>
      )}

      {/* Starter chips */}
      <div style={{ display:'flex', gap:6, flexWrap:'wrap' }}>
        {STARTERS.map(s => (
          <button key={s} onClick={() => send(s)} disabled={loading}
            style={{ padding:'6px 12px', background:'var(--violet-100)', border:'1px solid var(--border)', borderRadius:20, fontSize:12, color:'var(--primary)', fontWeight:600, cursor:'pointer', fontFamily:'var(--font)', transition:'all 0.15s' }}>
            {s}
          </button>
        ))}
      </div>

      {/* Chat area */}
      <div style={{ flex:1, background:'#fff', borderRadius:'var(--radius)', border:'1px solid var(--border)', overflow:'auto', padding:20, display:'flex', flexDirection:'column', gap:14 }}>
        <style>{`
          @keyframes bounce {
            0%,100% { transform:translateY(0); }
            50% { transform:translateY(-4px); }
          }
          @keyframes fadeUp {
            from { opacity:0; transform:translateY(6px); }
            to   { opacity:1; transform:translateY(0); }
          }
        `}</style>
        {messages.map((m, i) => <MsgBubble key={i} msg={m}/>)}
        {loading && <TypingIndicator/>}
        <div ref={bottom}/>
      </div>

      {/* Input bar */}
      <div style={{ display:'flex', gap:10 }}>
        <input
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && !e.shiftKey && !loading && send()}
          placeholder="Ask about RSI, MACD, regime, VIX, health score, exchange comparison…"
          disabled={loading}
          style={{ flex:1, padding:'13px 16px', border:'2px solid var(--border)', borderRadius:'var(--radius-sm)', fontSize:14, outline:'none', fontFamily:'var(--font)', background:'#fff', transition:'border-color 0.2s' }}
          onFocus={e => e.target.style.borderColor='var(--primary)'}
          onBlur={e => e.target.style.borderColor='var(--border)'}
        />
        <button
          onClick={() => send()}
          disabled={loading || !input.trim()}
          style={{ padding:'13px 20px', background: loading||!input.trim() ? 'var(--violet-200)' : 'var(--primary)', color:'#fff', border:'none', borderRadius:'var(--radius-sm)', cursor: loading||!input.trim() ? 'not-allowed' : 'pointer', display:'flex', alignItems:'center', gap:7, fontWeight:700, fontSize:14, fontFamily:'var(--font)', transition:'background 0.2s' }}>
          <Send size={16}/> Send
        </button>
      </div>
    </div>
  )
}
