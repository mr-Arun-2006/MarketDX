import React, { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { authAPI } from '../../utils/api.js'
import { useAuthStore } from '../../store/authStore.js'
import { Eye, EyeOff, TrendingUp, Stethoscope } from 'lucide-react'

export default function UserLoginPage() {
  const [form, setForm] = useState({ email: '', password: '' })
  const [show, setShow] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const login = useAuthStore(s => s.login)
  const nav = useNavigate()

  const submit = async (e) => {
    e.preventDefault()
    setLoading(true); setError('')
    try {
      const res = await authAPI.userLogin(form)
      login(res.data)
      nav('/dashboard')
    } catch (err) {
      setError(err.response?.data?.detail || 'Login failed. Check credentials.')
    } finally { setLoading(false) }
  }

  return (
    <div style={{ minHeight:'100vh', background:'var(--bg-soft)', display:'flex' }}>
      {/* Left panel */}
      <div style={{
        width: 480, background:'var(--sidebar-bg)', display:'flex', flexDirection:'column',
        justifyContent:'center', alignItems:'center', padding:48,
        background: 'linear-gradient(145deg, #4c1d95 0%, #6d28d9 50%, #7c3aed 100%)',
      }}>
        <div style={{ textAlign:'center', color:'#fff' }}>
          <div style={{
            width:72, height:72, borderRadius:20, background:'rgba(255,255,255,0.15)',
            display:'flex', alignItems:'center', justifyContent:'center', margin:'0 auto 24px',
            border:'2px solid rgba(255,255,255,0.3)',
          }}>
            <Stethoscope size={36} color="#fff" />
          </div>
          <h1 style={{ fontSize:28, fontWeight:800, marginBottom:8 }}>Market Diagnosis</h1>
          <p style={{ fontSize:14, opacity:0.75, lineHeight:1.7, maxWidth:280 }}>
            Structural intelligence for NSE & BSE.<br/>
            Diagnosis, not prediction.
          </p>
          <div style={{ marginTop:40, display:'flex', flexDirection:'column', gap:12 }}>
            {['📊 Market Health Score (0–100)','🔬 10-Module Analysis Pipeline','🤖 Explainable AI Insights','📈 NSE vs BSE Comparison'].map(t => (
              <div key={t} style={{ background:'rgba(255,255,255,0.1)', borderRadius:10, padding:'10px 16px', fontSize:13, textAlign:'left', border:'1px solid rgba(255,255,255,0.15)' }}>{t}</div>
            ))}
          </div>
        </div>
      </div>

      {/* Right panel */}
      <div style={{ flex:1, display:'flex', alignItems:'center', justifyContent:'center', padding:48 }}>
        <div style={{ width:'100%', maxWidth:400 }}>
          <h2 style={{ fontSize:26, fontWeight:800, color:'var(--text)', marginBottom:4 }}>Welcome back</h2>
          <p style={{ color:'var(--text-muted)', marginBottom:32, fontSize:14 }}>
            Sign in to your account · <Link to="/login/admin" style={{ color:'var(--primary)', fontWeight:600 }}>Admin login →</Link>
          </p>

          <form onSubmit={submit} style={{ display:'flex', flexDirection:'column', gap:16 }}>
            <div>
              <label style={lbl}>Email</label>
              <input style={inp} type="email" placeholder="you@email.com" required
                value={form.email} onChange={e => setForm({...form, email:e.target.value})} />
            </div>
            <div style={{ position:'relative' }}>
              <label style={lbl}>Password</label>
              <input style={inp} type={show?'text':'password'} placeholder="••••••••" required
                value={form.password} onChange={e => setForm({...form, password:e.target.value})} />
              <button type="button" onClick={() => setShow(!show)} style={{ position:'absolute', right:12, top:34, background:'none', border:'none', color:'var(--text-muted)' }}>
                {show ? <EyeOff size={16}/> : <Eye size={16}/>}
              </button>
            </div>
            {error && <div style={errBox}>{error}</div>}
            <button type="submit" disabled={loading} style={btn}>
              {loading ? '⏳ Signing in…' : 'Sign In'}
            </button>
          </form>

          <p style={{ textAlign:'center', marginTop:24, fontSize:14, color:'var(--text-muted)' }}>
            Don't have an account?{' '}
            <Link to="/signup" style={{ color:'var(--primary)', fontWeight:700 }}>Create account</Link>
          </p>
        </div>
      </div>
    </div>
  )
}

const lbl = { display:'block', fontSize:13, fontWeight:600, color:'var(--text)', marginBottom:6 }
const inp = {
  width:'100%', padding:'12px 14px', border:'2px solid var(--border)',
  borderRadius:'var(--radius-sm)', fontSize:14, outline:'none', background:'#fff',
  fontFamily:'var(--font)', transition:'border-color 0.2s',
}
const btn = {
  padding:'13px', background:'var(--primary)', color:'#fff', border:'none',
  borderRadius:'var(--radius-sm)', fontSize:15, fontWeight:700,
  cursor:'pointer', transition:'background 0.2s',
}
const errBox = {
  background:'#fef2f2', border:'1px solid #fecaca', color:'#dc2626',
  borderRadius:'var(--radius-sm)', padding:'10px 14px', fontSize:13,
}
