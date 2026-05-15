import React from 'react'
import { Outlet, NavLink, useNavigate } from 'react-router-dom'
import { BarChart3, Activity, FileText, Bot, LogOut, Stethoscope } from 'lucide-react'
import { useAuthStore } from '../../store/authStore.js'

const nav = [
  { to:'/dashboard',  icon:BarChart3,  label:'Dashboard' },
  { to:'/indicators', icon:Activity,   label:'Indicators' },
  { to:'/report',     icon:FileText,   label:'AI Report' },
  { to:'/ai-chat',    icon:Bot,        label:'AI Assistant' },
]

export default function UserLayout() {
  const { user, logout } = useAuthStore()
  const go = useNavigate()
  const doLogout = () => { logout(); go('/login/user') }

  return (
    <div style={{ display:'flex', minHeight:'100vh' }}>
      <aside style={{
        width:230, position:'fixed', top:0, left:0, bottom:0, zIndex:100,
        background:'linear-gradient(180deg, #4c1d95 0%, #6d28d9 100%)',
        display:'flex', flexDirection:'column',
        boxShadow:'4px 0 24px rgba(109,40,217,0.25)',
      }}>
        <div style={{ padding:'28px 20px 24px', borderBottom:'1px solid rgba(255,255,255,0.12)' }}>
          <div style={{ display:'flex', alignItems:'center', gap:10 }}>
            <div style={{ width:38, height:38, borderRadius:12, background:'rgba(255,255,255,0.15)', display:'flex', alignItems:'center', justifyContent:'center', border:'1px solid rgba(255,255,255,0.25)' }}>
              <Stethoscope size={20} color="#fff"/>
            </div>
            <div>
              <div style={{ fontWeight:800, fontSize:15, color:'#fff' }}>MDP v2</div>
              <div style={{ fontSize:10, color:'rgba(255,255,255,0.55)', marginTop:1 }}>Market Diagnosis</div>
            </div>
          </div>
        </div>

        <nav style={{ flex:1, padding:'16px 12px' }}>
          <div style={{ fontSize:10, color:'rgba(255,255,255,0.4)', fontWeight:700, letterSpacing:'0.1em', padding:'0 8px', marginBottom:8 }}>NAVIGATION</div>
          {nav.map(({ to, icon:Icon, label }) => (
            <NavLink key={to} to={to} style={({ isActive }) => ({
              display:'flex', alignItems:'center', gap:10,
              padding:'10px 12px', borderRadius:10, marginBottom:4,
              textDecoration:'none', fontSize:14,
              fontWeight: isActive ? 700 : 500,
              color: isActive ? '#fff' : 'rgba(255,255,255,0.65)',
              background: isActive ? 'rgba(255,255,255,0.18)' : 'transparent',
              borderLeft: isActive ? '3px solid rgba(255,255,255,0.8)' : '3px solid transparent',
              transition:'all 0.15s',
            })}>
              <Icon size={16}/>{label}
            </NavLink>
          ))}
        </nav>

        <div style={{ padding:'16px 16px 24px', borderTop:'1px solid rgba(255,255,255,0.12)' }}>
          <div style={{ fontSize:13, fontWeight:600, color:'#fff', marginBottom:2, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
            {user?.full_name || 'User'}
          </div>
          <div style={{ fontSize:11, color:'rgba(255,255,255,0.45)', marginBottom:12 }}>User Account</div>
          <button onClick={doLogout} style={{ display:'flex', alignItems:'center', gap:8, padding:'8px 12px', background:'rgba(255,255,255,0.1)', border:'1px solid rgba(255,255,255,0.2)', borderRadius:8, color:'rgba(255,255,255,0.75)', fontSize:13, cursor:'pointer', width:'100%', fontFamily:'var(--font)' }}>
            <LogOut size={14}/> Sign Out
          </button>
        </div>
      </aside>

      <main style={{ marginLeft:230, flex:1, minHeight:'100vh', background:'var(--bg-soft)' }}>
        <div style={{ background:'#fff', borderBottom:'1px solid var(--border)', padding:'14px 28px', display:'flex', justifyContent:'space-between', alignItems:'center' }}>
          <div style={{ fontSize:12, color:'var(--text-muted)', fontWeight:600, letterSpacing:'0.05em' }}>
            MARKET DIAGNOSIS PLATFORM v2 · NSE & BSE · 5-Pillar Analysis · AI Powered
          </div>
          <div style={{ fontSize:12, color:'var(--text-muted)' }}>
            {new Date().toLocaleDateString('en-IN', { weekday:'short', year:'numeric', month:'short', day:'numeric' })}
          </div>
        </div>
        <div style={{ padding:28 }}><Outlet/></div>
      </main>
    </div>
  )
}
