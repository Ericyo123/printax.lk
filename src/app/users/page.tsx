'use client'
import { useEffect, useState } from 'react'
import { AppShell } from '@/components/AppShell'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { Pagination } from '@/components/Pagination'

export default function UsersPage() {
  const { data: session } = useSession()
  const router = useRouter()
  const [users, setUsers] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [showEditModal, setShowEditModal] = useState(false)
  const [editingUser, setEditingUser] = useState<any | null>(null)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({ name: '', email: '', password: '', role: 'STAFF' })
  const [editForm, setEditForm] = useState({ name: '', password: '', role: 'STAFF' })
  
  // Pagination
  const [currentPage, setCurrentPage] = useState(1)
  const itemsPerPage = 10
  const paginatedUsers = users.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage)

  useEffect(() => {
    if (session && session.user?.role !== 'ADMIN') { router.push('/jobs/new'); return }
    fetch('/api/users').then(r => r.json()).then(d => { setUsers(d); setLoading(false) })
  }, [session])

  async function createUser() {
    if (!form.name || !form.email || !form.password) return
    setSaving(true)
    const res = await fetch('/api/users', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form) })
    const data = await res.json()
    setSaving(false)
    if (res.ok) {
      setShowModal(false)
      setForm({ name: '', email: '', password: '', role: 'STAFF' })
      fetch('/api/users').then(r => r.json()).then(d => setUsers(d))
    } else {
      alert(data.error || 'Failed to create user. The database might be full or offline.')
    }
  }

  async function updateUser() {
    if (!editingUser || !editForm.name) return
    setSaving(true)
    const body: any = {
      name: editForm.name,
      role: editForm.role,
    }
    if (editForm.password) {
      body.password = editForm.password
    }
    const res = await fetch(`/api/users/${editingUser.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    })
    const data = await res.json()
    setSaving(false)
    if (res.ok) {
      setShowEditModal(false)
      setEditingUser(null)
      fetch('/api/users').then(r => r.json()).then(d => setUsers(d))
    } else {
      alert(data.error || 'Failed to update user.')
    }
  }

  async function toggleActive(id: string, active: boolean) {
    const res = await fetch(`/api/users/${id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ active: !active }) })
    const data = await res.json()
    if (res.ok) {
      fetch('/api/users').then(r => r.json()).then(d => setUsers(d))
    } else {
      alert(data.error || 'Failed to update user status.')
    }
  }

  async function deleteUser(id: string) {
    if (window.confirm('Are you sure you want to permanently delete this user?')) {
      const res = await fetch(`/api/users/${id}`, { method: 'DELETE' })
      const data = await res.json()
      if (res.ok) {
        fetch('/api/users').then(r => r.json()).then(d => setUsers(d))
      } else {
        alert(data.error || 'Failed to delete user')
      }
    }
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

      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        <div className="table-wrapper" style={{ margin: 0, border: 'none', borderRadius: 0 }}>
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
              ) : paginatedUsers.map(u => (
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
                    <div style={{ display: 'flex', gap: '0.5rem' }}>
                      <button className="btn btn-ghost btn-sm" onClick={() => {
                        setEditingUser(u)
                        setEditForm({ name: u.name, password: '', role: u.role })
                        setShowEditModal(true)
                      }}>
                        ✏️ Edit
                      </button>
                      {u.id !== session?.user?.id && (
                        <>
                          <button className="btn btn-ghost btn-sm" onClick={() => toggleActive(u.id, u.active)}>
                            {u.active ? '🚫 Disable' : '✓ Enable'}
                          </button>
                          <button className="btn btn-ghost btn-sm" style={{ color: 'var(--danger)' }} onClick={() => deleteUser(u.id)}>
                            🗑 Delete
                          </button>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {!loading && users.length > itemsPerPage && (
          <Pagination 
            currentPage={currentPage} 
            totalItems={users.length} 
            itemsPerPage={itemsPerPage} 
            onPageChange={setCurrentPage} 
          />
        )}
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

      {showEditModal && editingUser && (
        <div className="modal-overlay" onClick={() => { setShowEditModal(false); setEditingUser(null); }}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Edit User / Change Password</h3>
              <button className="btn btn-ghost" onClick={() => { setShowEditModal(false); setEditingUser(null); }}>✕</button>
            </div>
            <div className="modal-body">
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.875rem' }}>
                <div className="form-group">
                  <label className="form-label">Full Name *</label>
                  <input className="form-control" value={editForm.name} onChange={e => setEditForm(f => ({ ...f, name: e.target.value }))} />
                </div>
                <div className="form-group">
                  <label className="form-label">Email (Cannot be changed)</label>
                  <input className="form-control" value={editingUser.email} disabled style={{ opacity: 0.6 }} />
                </div>
                <div className="form-group">
                  <label className="form-label">New Password (Leave blank to keep current)</label>
                  <input type="password" className="form-control" placeholder="Leave blank to keep current" value={editForm.password} onChange={e => setEditForm(f => ({ ...f, password: e.target.value }))} />
                </div>
                <div className="form-group">
                  <label className="form-label">Role</label>
                  <div style={{ display: 'flex', gap: '0.5rem' }}>
                    {[['STAFF', 'Staff'], ['ADMIN', 'Admin']].map(([val, label]) => (
                      <button key={val} type="button" className={`btn ${editForm.role === val ? 'btn-primary' : 'btn-secondary'}`}
                        style={{ flex: 1, justifyContent: 'center' }}
                        disabled={editingUser.id === session?.user?.id}
                        onClick={() => setEditForm(f => ({ ...f, role: val }))}>
                        {label}
                      </button>
                    ))}
                  </div>
                  {editingUser.id === session?.user?.id && (
                    <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.25rem', display: 'block' }}>
                      You cannot change your own role.
                    </span>
                  )}
                </div>
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => { setShowEditModal(false); setEditingUser(null); }}>Cancel</button>
              <button className="btn btn-primary" onClick={updateUser} disabled={saving || !editForm.name}>
                {saving ? <span className="spinner" /> : null} Save Changes
              </button>
            </div>
          </div>
        </div>
      )}
    </AppShell>
  )
}
