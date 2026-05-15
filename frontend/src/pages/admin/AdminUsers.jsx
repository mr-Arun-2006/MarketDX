import React, { useState, useEffect } from 'react'
import { adminAPI } from '../../utils/api.js'
import { Users, CheckCircle, XCircle, RefreshCw, Search, UserX, UserCheck } from 'lucide-react'

export default function AdminUsers() {
  const [users, setUsers] = useState([])
  const [filtered, setFiltered] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [toggling, setToggling] = useState(null)

  const load = async () => {
    setLoading(true)
    try {
      const res = await adminAPI.getUsers()
      setUsers(res.data)
      setFiltered(res.data)
    } finally { setLoading(false) }
  }

  useEffect(() => { load() }, [])

  useEffect(() => {
    const q = search.toLowerCase()
    setFiltered(users.filter(u => u.full_name.toLowerCase().includes(q) || u.email.toLowerCase().includes(q)))
  }, [search, users])

  const toggle = async (id, current) => {
    setToggling(id)
    try {
      await adminAPI.toggleUser(id, !current)
      setUsers(u => u.map(x => x.id === id ? { ...x, is_active: !current } : x))
    } finally { setToggling(null) }
  }

  const roleUsers  = filtered.filter(u => u.role === 'user')
  const roleAdmins = filtered.filter(u => u.role === 'admin')

  const Table = ({ rows, title }) => (
    <div style={{ background:'#fff', borderRadius:'var(--radius)', border:'1px solid var(--border)', boxShadow:'var(--shadow)', marginBottom:24 }}>
      <div style={{ padding:'16px 24px', borderBottom:'1px solid var(--border)', display:'flex', justifyContent:'space-between', alignItems:'center' }}>
        <h3 style={{ fontSize:14, fontWeight:700, color:'var(--text)' }}>{title}</h3>
        <span style={{ fontSize:12, background:'var(--violet-100)', color:'var(--primary)', fontWeight:700, padding:'3px 10px', borderRadius:12 }}>{rows.length}</span>
      </div>
      <div style={{ overflowX:'auto' }}>
        <table style={{ width:'100%', borderCollapse:'collapse' }}>
          <thead>
            <tr style={{ background:'var(--violet-50)' }}>
              {['ID','Name','Email','Status','Last Login','Action'].map(h => (
                <th key={h} style={{ padding:'12px 16px', textAlign:'left', fontSize:11, fontWeight:700, color:'var(--text-muted)', letterSpacing:'0.06em', textTransform:'uppercase' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr><td colSpan={6} style={{ padding:32, textAlign:'center', color:'var(--text-muted)', fontSize:14 }}>No records found</td></tr>
            ) : rows.map((u, i) => (
              <tr key={u.id} style={{ borderTop:'1px solid var(--border)', background: i%2===0?'#fff':'var(--violet-50)' }}>
                <td style={{ padding:'12px 16px', fontSize:13, color:'var(--text-muted)', fontWeight:600 }}>#{u.id}</td>
                <td style={{ padding:'12px 16px', fontSize:14, fontWeight:600, color:'var(--text)' }}>{u.full_name}</td>
                <td style={{ padding:'12px 16px', fontSize:13, color:'var(--text-soft)' }}>{u.email}</td>
                <td style={{ padding:'12px 16px' }}>
                  <span style={{ display:'inline-flex', alignItems:'center', gap:5, padding:'3px 10px', borderRadius:12, fontSize:12, fontWeight:700,
                    background: u.is_active ? '#f0fdf4' : '#fef2f2',
                    color: u.is_active ? '#16a34a' : '#dc2626',
                    border: `1px solid ${u.is_active ? '#bbf7d0' : '#fecaca'}` }}>
                    {u.is_active ? <CheckCircle size={11}/> : <XCircle size={11}/>}
                    {u.is_active ? 'Active' : 'Inactive'}
                  </span>
                </td>
                <td style={{ padding:'12px 16px', fontSize:12, color:'var(--text-muted)' }}>
                  {u.last_login ? new Date(u.last_login).toLocaleDateString('en-IN', { day:'2-digit', month:'short', year:'numeric' }) : 'Never'}
                </td>
                <td style={{ padding:'12px 16px' }}>
                  {u.role === 'user' ? (
                    <button onClick={() => toggle(u.id, u.is_active)} disabled={toggling === u.id}
                      style={{ display:'flex', alignItems:'center', gap:5, padding:'6px 12px', fontSize:12, fontWeight:600, cursor:'pointer', borderRadius:8, border:'none', fontFamily:'var(--font)',
                        background: u.is_active ? '#fef2f2' : '#f0fdf4',
                        color: u.is_active ? '#dc2626' : '#16a34a',
                      }}>
                      {u.is_active ? <><UserX size={13}/> Deactivate</> : <><UserCheck size={13}/> Activate</>}
                    </button>
                  ) : (
                    <span style={{ fontSize:12, color:'var(--text-muted)' }}>—</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )

  return (
    <div>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:24 }}>
        <div>
          <h1 style={{ fontSize:24, fontWeight:800, color:'var(--text)' }}>User Management</h1>
          <p style={{ color:'var(--text-muted)', fontSize:14, marginTop:2 }}>View, search, and manage all platform accounts</p>
        </div>
        <button onClick={load} disabled={loading} style={{ display:'flex', alignItems:'center', gap:8, padding:'9px 16px', background:'var(--primary)', color:'#fff', border:'none', borderRadius:'var(--radius-sm)', fontSize:13, fontWeight:600, cursor:'pointer' }}>
          <RefreshCw size={14} style={{ animation:loading?'spin 1s linear infinite':'none' }}/> Refresh
        </button>
      </div>

      {/* Search */}
      <div style={{ position:'relative', marginBottom:24, maxWidth:400 }}>
        <Search size={16} style={{ position:'absolute', left:12, top:'50%', transform:'translateY(-50%)', color:'var(--text-muted)' }}/>
        <input value={search} onChange={e => setSearch(e.target.value)}
          placeholder="Search by name or email…"
          style={{ width:'100%', padding:'11px 12px 11px 38px', border:'2px solid var(--border)', borderRadius:'var(--radius-sm)', fontSize:14, outline:'none', fontFamily:'var(--font)', background:'#fff' }}/>
      </div>

      {loading ? (
        <div style={{ textAlign:'center', padding:60, color:'var(--text-muted)' }}><Users size={32} color="var(--primary)" style={{ marginBottom:12 }}/><div>Loading users…</div></div>
      ) : (
        <>
          <Table rows={roleUsers}  title="👤 Regular Users" />
          <Table rows={roleAdmins} title="🛡️ Administrators" />
        </>
      )}
    </div>
  )
}
