import React, { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { authAPI } from '../../utils/api.js'
import { Eye, EyeOff, UserPlus } from 'lucide-react'

export default function UserSignupPage() {
  const [form, setForm] = useState({ full_name:'', email:'', password:'' })
  const [show, setShow] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)
  const [loading, setLoading] = useState(false)
  const nav = useNavigate()

  const submit = async (e) => {
    e.preventDefault()
    if (form.password.length < 6) { setError('Password must be at least 6 characters'); return }
    setLoading(true); setError('')
    try {
      await authAPI.userSignup(form)
      setSuccess(true)
      setTimeout(() => nav('/login/user'), 2000)
    } catch (err) {
      setError(err.response?.data?.detail || 'Signup failed')
    } finally { setLoading(false) }
  }

  return (
    <div style={{ minHeight:'100vh', background:'var(--bg-soft)', display:'flex', alignItems:'center', justifyContent:'center', padding:24 }}>
      <div style={{ width:'100%', maxWidth:440, background:'#fff', borderRadius:'var(--radius)', padding:40, boxShadow:'var(--shadow-md)', border:'1px solid var(--border)' }}>
        <div style={{ textAlign:'center', marginBottom:32 }}>
          <div style={{ width:56, height:56, borderRadius:16, background:'var(--violet-100)', display:'flex', alignItems:'center', justifyContent:'center', margin:'0 auto 16px' }}>
            <UserPlus size={28} color="var(--primary)" />
          </div>
          <h2 style={{ fontSize:24, fontWeight:800, color:'var(--text)' }}>Create Account</h2>
          <p style={{ color:'var(--text-muted)', fontSize:13, marginTop:4 }}>Join Market Diagnosis Platform</p>
        </div>

        {success ? (
          <div style={{ textAlign:'center', padding:24, background:'#f0fdf4', borderRadius:'var(--radius-sm)', border:'1px solid #bbf7d0' }}>
            <div style={{ fontSize:32, marginBottom:8 }}>✅</div>
            <div style={{ fontWeight:700, color:'#15803d' }}>Account created!</div>
            <div style={{ fontSize:13, color:'#16a34a', marginTop:4 }}>Redirecting to login…</div>
          </div>
        ) : (
          <form onSubmit={submit} style={{ display:'flex', flexDirection:'column', gap:16 }}>
            <div>
              <label style={lbl}>Full Name</label>
              <input style={inp} placeholder="Aakash R" required
                value={form.full_name} onChange={e => setForm({...form, full_name:e.target.value})} />
            </div>
            <div>
              <label style={lbl}>Email</label>
              <input style={inp} type="email" placeholder="you@email.com" required
                value={form.email} onChange={e => setForm({...form, email:e.target.value})} />
            </div>
            <div style={{ position:'relative' }}>
              <label style={lbl}>Password</label>
              <input style={inp} type={show?'text':'password'} placeholder="Min 6 characters" required
                value={form.password} onChange={e => setForm({...form, password:e.target.value})} />
              <button type="button" onClick={() => setShow(!show)} style={{ position:'absolute', right:12, top:34, background:'none', border:'none', color:'var(--text-muted)' }}>
                {show ? <EyeOff size={16}/> : <Eye size={16}/>}
              </button>
            </div>
            {error && <div style={errBox}>{error}</div>}
            <button type="submit" disabled={loading} style={btn}>
              {loading ? '⏳ Creating…' : 'Create Account'}
            </button>
          </form>
        )}

        <p style={{ textAlign:'center', marginTop:20, fontSize:14, color:'var(--text-muted)' }}>
          Already have an account?{' '}
          <Link to="/login/user" style={{ color:'var(--primary)', fontWeight:700 }}>Sign in</Link>
        </p>
      </div>
    </div>
  )
}

const lbl = { display:'block', fontSize:13, fontWeight:600, color:'var(--text)', marginBottom:6 }
const inp = { width:'100%', padding:'12px 14px', border:'2px solid var(--border)', borderRadius:'var(--radius-sm)', fontSize:14, outline:'none', background:'#fff', fontFamily:'var(--font)' }
const btn = { padding:'13px', background:'var(--primary)', color:'#fff', border:'none', borderRadius:'var(--radius-sm)', fontSize:15, fontWeight:700, cursor:'pointer' }
const errBox = { background:'#fef2f2', border:'1px solid #fecaca', color:'#dc2626', borderRadius:'var(--radius-sm)', padding:'10px 14px', fontSize:13 }
