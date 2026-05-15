import React, { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { authAPI } from '../../utils/api.js'
import { useAuthStore } from '../../store/authStore.js'
import { ShieldCheck, Eye, EyeOff } from 'lucide-react'

export default function AdminLoginPage() {
  const [form, setForm] = useState({ email:'', password:'' })
  const [show, setShow] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const login = useAuthStore(s => s.login)
  const nav = useNavigate()

  const submit = async (e) => {
    e.preventDefault()
    setLoading(true); setError('')
    try {
      const res = await authAPI.adminLogin(form)
      login(res.data)
      nav('/admin')
    } catch (err) {
      setError(err.response?.data?.detail || 'Invalid admin credentials')
    } finally { setLoading(false) }
  }

  return (
    <div style={{
      minHeight:'100vh', display:'flex', alignItems:'center', justifyContent:'center',
      background: 'linear-gradient(135deg, #1e1b4b 0%, #4c1d95 50%, #6d28d9 100%)',
      padding:24,
    }}>
      <div style={{ width:'100%', maxWidth:420 }}>
        {/* Header */}
        <div style={{ textAlign:'center', marginBottom:32, color:'#fff' }}>
          <div style={{
            width:64, height:64, borderRadius:20, background:'rgba(255,255,255,0.15)',
            border:'2px solid rgba(255,255,255,0.3)',
            display:'flex', alignItems:'center', justifyContent:'center', margin:'0 auto 16px',
          }}>
            <ShieldCheck size={32} color="#fff" />
          </div>
          <h2 style={{ fontSize:26, fontWeight:800 }}>Admin Portal</h2>
          <p style={{ fontSize:13, opacity:0.7, marginTop:4 }}>Market Diagnosis Platform</p>
        </div>

        {/* Card */}
        <div style={{ background:'rgba(255,255,255,0.07)', borderRadius:'var(--radius)', padding:36, border:'1px solid rgba(255,255,255,0.15)', backdropFilter:'blur(12px)' }}>
          <div style={{ background:'rgba(239,68,68,0.15)', border:'1px solid rgba(239,68,68,0.3)', borderRadius:'var(--radius-sm)', padding:'10px 14px', marginBottom:24, fontSize:12, color:'#fca5a5', display:'flex', gap:8, alignItems:'center' }}>
            <ShieldCheck size={14}/> Restricted access · Administrators only. No public registration.
          </div>

          <form onSubmit={submit} style={{ display:'flex', flexDirection:'column', gap:16 }}>
            <div>
              <label style={lbl}>Admin Email</label>
              <input style={inp} type="email" placeholder="admin@mdp.com" required
                value={form.email} onChange={e => setForm({...form, email:e.target.value})} />
            </div>
            <div style={{ position:'relative' }}>
              <label style={lbl}>Password</label>
              <input style={inp} type={show?'text':'password'} placeholder="••••••••" required
                value={form.password} onChange={e => setForm({...form, password:e.target.value})} />
              <button type="button" onClick={() => setShow(!show)} style={{ position:'absolute', right:12, top:34, background:'none', border:'none', color:'rgba(255,255,255,0.5)' }}>
                {show ? <EyeOff size={16}/> : <Eye size={16}/>}
              </button>
            </div>
            {error && <div style={errBox}>{error}</div>}
            <button type="submit" disabled={loading} style={btn}>
              {loading ? '⏳ Authenticating…' : '🔐 Admin Sign In'}
            </button>
          </form>
        </div>

        <p style={{ textAlign:'center', marginTop:20, fontSize:13, color:'rgba(255,255,255,0.5)' }}>
          Not an admin?{' '}
          <Link to="/login/user" style={{ color:'var(--accent)', fontWeight:700 }}>User login →</Link>
        </p>
        <p style={{ textAlign:'center', marginTop:8, fontSize:11, color:'rgba(255,255,255,0.3)' }}>
          Default: admin@mdp.com / Admin@123
        </p>
      </div>
    </div>
  )
}

const lbl = { display:'block', fontSize:13, fontWeight:600, color:'rgba(255,255,255,0.8)', marginBottom:6 }
const inp = {
  width:'100%', padding:'12px 14px', border:'2px solid rgba(255,255,255,0.2)',
  borderRadius:'var(--radius-sm)', fontSize:14, outline:'none',
  background:'rgba(255,255,255,0.08)', color:'#fff', fontFamily:'var(--font)',
}
const btn = { padding:'13px', background:'rgba(255,255,255,0.15)', color:'#fff', border:'2px solid rgba(255,255,255,0.3)', borderRadius:'var(--radius-sm)', fontSize:15, fontWeight:700, cursor:'pointer', backdropFilter:'blur(4px)' }
const errBox = { background:'rgba(239,68,68,0.15)', border:'1px solid rgba(239,68,68,0.3)', color:'#fca5a5', borderRadius:'var(--radius-sm)', padding:'10px 14px', fontSize:13 }
