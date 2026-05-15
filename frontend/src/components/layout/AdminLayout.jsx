import React from 'react'
import { Outlet, NavLink, useNavigate } from 'react-router-dom'
import { LayoutDashboard, Users, TrendingUp, LogOut, ShieldCheck } from 'lucide-react'
import { useAuthStore } from '../../store/authStore.js'

const nav = [
  { to:'/admin',        icon:LayoutDashboard, label:'Dashboard', end:true },
  { to:'/admin/users',  icon:Users,           label:'User Management' },
  { to:'/admin/market', icon:TrendingUp,       label:'Market Monitor' },
]

export default function AdminLayout() {
  const { user, logout } = useAuthStore()
  const go = useNavigate()

  return (
    <div style={{ display:'flex', minHeight:'100vh' }}>
      <aside style={{
        width:240, position:'fixed', top:0, left:0, bottom:0, zIndex:100,
        background:'linear-gradient(180deg, #1e1b4b 0%, #312e81 60%, #4c1d95 100%)',
        display:'flex', flexDirection:'column',
        boxShadow:'4px 0 32px rgba(30,27,75,0.4)',
      }}>
        {/* Logo */}
        <div style={{ padding:'28px 20px 24px', borderBottom:'1px solid rgba(255,255,255,0.1)' }}>
          <div style={{ display:'flex', alignItems:'center', gap:10 }}>
            <div style={{ width:40, height:40, borderRadius:12, background:'rgba(255,255,255,0.12)', display:'flex', alignItems:'center', justifyContent:'center', border:'1px solid rgba(255,255,255,0.2)' }}>
              <ShieldCheck size={22} color="#a78bfa"/>
            </div>
            <div>
              <div style={{ fontWeight:800, fontSize:15, color:'#fff' }}>Admin Panel</div>
              <div style={{ fontSize:10, color:'rgba(255,255,255,0.4)', marginTop:1 }}>Market Diagnosis Platform</div>
            </div>
          </div>
        </div>

        {/* Admin badge */}
        <div style={{ margin:'12px 16px', background:'rgba(167,139,250,0.15)', border:'1px solid rgba(167,139,250,0.3)', borderRadius:8, padding:'6px 12px', fontSize:11, color:'#a78bfa', fontWeight:700, letterSpacing:'0.08em', textAlign:'center' }}>
          ⚡ ADMINISTRATOR ACCESS
        </div>

        <nav style={{ flex:1, padding:'8px 12px' }}>
          {nav.map(({ to, icon:Icon, label, end }) => (
            <NavLink key={to} to={to} end={end} style={({ isActive }) => ({
              display:'flex', alignItems:'center', gap:10,
              padding:'10px 12px', borderRadius:10, marginBottom:4,
              textDecoration:'none', fontSize:14, fontWeight:isActive?700:400,
              color: isActive ? '#fff' : 'rgba(255,255,255,0.55)',
              background: isActive ? 'rgba(167,139,250,0.2)' : 'transparent',
              borderLeft: isActive ? '3px solid #a78bfa' : '3px solid transparent',
            })}>
              <Icon size={16}/>{label}
            </NavLink>
          ))}
        </nav>

        <div style={{ padding:'16px 16px 24px', borderTop:'1px solid rgba(255,255,255,0.1)' }}>
          <div style={{ fontSize:12, fontWeight:700, color:'#a78bfa', marginBottom:2 }}>{user?.full_name}</div>
          <div style={{ fontSize:11, color:'rgba(255,255,255,0.35)', marginBottom:12 }}>Administrator</div>
          <button onClick={() => { logout(); go('/login/admin') }} style={{ display:'flex', alignItems:'center', gap:8, padding:'8px 12px', background:'rgba(239,68,68,0.15)', border:'1px solid rgba(239,68,68,0.3)', borderRadius:8, color:'#fca5a5', fontSize:13, cursor:'pointer', width:'100%' }}>
            <LogOut size={14}/> Sign Out
          </button>
        </div>
      </aside>

      <main style={{ marginLeft:240, flex:1, minHeight:'100vh', background:'var(--bg-soft)' }}>
        <div style={{ background:'#fff', borderBottom:'1px solid var(--border)', padding:'14px 28px', display:'flex', justifyContent:'space-between', alignItems:'center' }}>
          <div style={{ fontSize:12, color:'var(--primary)', fontWeight:700, letterSpacing:'0.06em' }}>🛡️ ADMIN CONTROL CENTER · MARKET DIAGNOSIS PLATFORM</div>
          <div style={{ fontSize:12, color:'var(--text-muted)' }}>{new Date().toLocaleDateString('en-IN', { weekday:'short', year:'numeric', month:'short', day:'numeric' })}</div>
        </div>
        <div style={{ padding:28 }}><Outlet/></div>
      </main>
    </div>
  )
}
