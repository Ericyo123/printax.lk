'use client'
import { useEffect, useState } from 'react'
import { AppShell } from '@/components/AppShell'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'

export default function UsersPage() {
  const { data: session } = useSession()
  const router = useRouter()
  const [users, setUsers] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({ name: '', email: '', password: '', role: 'STAFF' })

  useEffect(() => {
    if (session && session.user?.role !== 'ADMIN') { router.push('/dashboard'); return }
    fetch('/api/users').then(r => r.json()).then(d => { setUsers(d); setLoading(false) })
  }, [session])

  async function createUser() {
    if (!form.name || !form.email || !form.password) return
    setSaving(true)
    await fetch('/api/users', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form) })
    setSaving(false); setShowModal(false)
    setForm({ name: '', email: '', password: '', role: 'STAFF' })
    fetch('/api/users').then(r => r.json()).then(d => setUsers(d))
  }

  async function toggleActive(id: string, active: boolean) {
    await fetch(`/api/users/${id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ active: !active }) })
    fetch('/api/users').then(r => r.json()).then(d => setUsers(d))
  }

  return (
    <AppShell>
      <div className="page-header">
        <div className="page-title-group">
          <h1 className="page-title">User Management</h1>
          <p className="page-subtitle">Manage system users and roles</p>
        </div>
        <div className="page-actions">
          <button className="btn btn-primary" onClick={() => setShowModal(true)}>+ Add User</button>
        </div>
      </div>

      <div className="table-wrapper">
        <table>
          <thead>
            <tr>
              <th>Name</th>
              <th>Email</th>
              <th>Role</th>
              <th>Status</th>
              <th>Joined</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={6} style={{ textAlign: 'center', padding: '3rem' }}><span className="spinner" /></td></tr>
            ) : users.map(u => (
              <tr key={u.id}>
                <td style={{ fontWeight: 600 }}>{u.name}</td>
                <td style={{ color: 'var(--text-secondary)', fontSize: '0.875rem' }}>{u.email}</td>
                <td>
                  <span className={`badge ${u.role === 'ADMIN' ? 'badge-purple' : 'badge-muted'}`}>
                    {u.role}
                  </span>
                </td>
                <td>
                  <span className={`badge ${u.active ? 'badge-success' : 'badge-danger'}`}>
                    {u.active ? 'Active' : 'Disabled'}
                  </span>
                </td>
                <td style={{ color: 'var(--text-secondary)', fontSize: '0.8125rem' }}>
                  {new Date(u.createdAt).toLocaleDateString()}
                </td>
                <td>
                  {u.id !== session?.user?.id && (
                    <button className="btn btn-ghost btn-sm" onClick={() => toggleActive(u.id, u.active)}>
                      {u.active ? '🚫 Disable' : '✓ Enable'}
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Add New User</h3>
              <button className="btn btn-ghost" onClick={() => setShowModal(false)}>✕</button>
            </div>
            <div className="modal-body">
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.875rem' }}>
                <div className="form-group">
                  <label className="form-label">Full Name *</label>
                  <input className="form-control" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
                </div>
                <div className="form-group">
                  <label className="form-label">Email *</label>
                  <input type="email" className="form-control" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} />
                </div>
                <div className="form-group">
                  <label className="form-label">Password *</label>
                  <input type="password" className="form-control" value={form.password} onChange={e => setForm(f => ({ ...f, password: e.target.value }))} />
                </div>
                <div className="form-group">
                  <label className="form-label">Role</label>
                  <div style={{ display: 'flex', gap: '0.5rem' }}>
                    {[['STAFF', 'Staff'], ['ADMIN', 'Admin']].map(([val, label]) => (
                      <button key={val} type="button" className={`btn ${form.role === val ? 'btn-primary' : 'btn-secondary'}`}
                        style={{ flex: 1, justifyContent: 'center' }}
                        onClick={() => setForm(f => ({ ...f, role: val }))}>
                        {label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setShowModal(false)}>Cancel</button>
              <button className="btn btn-primary" onClick={createUser} disabled={saving || !form.name || !form.email || !form.password}>
                {saving ? <span className="spinner" /> : null} Add User
              </button>
            </div>
          </div>
        </div>
      )}
    </AppShell>
  )
}
