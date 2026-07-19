'use client'
import { useEffect, useState } from 'react'
import { AppShell } from '@/components/AppShell'
import Link from 'next/link'
import { Pagination } from '@/components/Pagination'
import { Users, Search } from 'lucide-react'

export default function CustomersPage() {
  const [customers, setCustomers] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [search, setSearch] = useState('')
  const [typeFilter, setTypeFilter] = useState('')
  const [form, setForm] = useState({ name: '', phone: '', email: '', address: '', notes: '', type: 'MONTHLY' })
  const [saving, setSaving] = useState(false)
  const [editCustomer, setEditCustomer] = useState<any>(null)

  // Pagination
  const [currentPage, setCurrentPage] = useState(1)
  const itemsPerPage = 10
  
  function fetchCustomers() {
    const params = new URLSearchParams()
    if (typeFilter) params.set('type', typeFilter)
    fetch(`/api/customers?${params}`)
      .then(r => r.json())
      .then(d => { 
        if (Array.isArray(d)) {
          setCustomers(d)
        } else {
          console.error('Failed to fetch customers:', d)
        }
        setLoading(false) 
      })
      .catch(e => {
        console.error('Error fetching customers:', e)
        setLoading(false)
      })
  }

  useEffect(() => { fetchCustomers() }, [typeFilter])

  async function saveCustomer() {
    setSaving(true)
    const url = editCustomer ? `/api/customers/${editCustomer.id}` : '/api/customers'
    const method = editCustomer ? 'PATCH' : 'POST'
    const res = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form) })
    const data = await res.json()
    setSaving(false)
    if (res.ok) {
      setShowModal(false)
      setEditCustomer(null)
      setForm({ name: '', phone: '', email: '', address: '', notes: '', type: 'MONTHLY' })
      fetchCustomers()
    } else {
      alert(data.error || 'Failed to save customer. The database might be full or offline.')
    }
  }

  function openEdit(c: any) {
    setEditCustomer(c)
    setForm({ name: c.name, phone: c.phone || '', email: c.email || '', address: c.address || '', notes: c.notes || '', type: c.type })
    setShowModal(true)
  }

  async function deleteCustomer(id: string) {
    if (!confirm('Delete this customer?')) return
    const res = await fetch(`/api/customers/${id}`, { method: 'DELETE' })
    const data = await res.json()
    if (res.ok) {
      fetchCustomers()
    } else {
      alert(data.error || 'Failed to delete customer.')
    }
  }

  async function settleCustomerBalance(id: string) {
    if (!confirm('Are you sure you want to mark all outstanding invoices for this customer as PAID?')) return
    const res = await fetch(`/api/customers/${id}/clear`, { method: 'POST' })
    if (res.ok) {
      fetchCustomers()
    } else {
      alert('Failed to settle balance.')
    }
  }

  const filtered = customers.filter(c => !search || c.name?.toLowerCase().includes(search.toLowerCase()) || c.phone?.includes(search) || c.email?.toLowerCase().includes(search.toLowerCase()))
  
  const paginatedCustomers = filtered.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage)

  return (
    <AppShell>
      <div className="page-header">
        <div className="page-title-group">
          <h1 className="page-title">Customers</h1>
          <p className="page-subtitle">{customers.length} registered customers</p>
        </div>
        <div className="page-actions">
          <button className="btn btn-primary" onClick={() => { setEditCustomer(null); setForm({ name: '', phone: '', email: '', address: '', notes: '', type: 'MONTHLY' }); setShowModal(true) }}>
            + New Customer
          </button>
        </div>
      </div>

      <div style={{ display: 'flex', gap: '0.75rem', marginBottom: '1.5rem', flexWrap: 'wrap' }}>
        <div className="search-bar" style={{ flex: '1 1 280px' }}>
          <Search size={18} color="var(--text-muted)" />
          <input placeholder="Search name, phone, email..." value={search} onChange={e => setSearch(e.target.value)} />
        </div>
      </div>

      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        <div className="table-wrapper" style={{ margin: 0, border: 'none', borderRadius: 0 }}>
          <table>
            <thead>
              <tr>
                <th>Name</th>
                <th>Type</th>
                <th>Phone</th>
                <th>Email</th>
                <th>Invoices</th>
                <th>Outstanding</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={7} style={{ textAlign: 'center', padding: '3rem' }}><span className="spinner" /></td></tr>
              ) : filtered.length === 0 ? (
                <tr><td colSpan={7}><div className="empty-state"><div className="empty-state-icon"><Users size={40} /></div><p>No customers found</p></div></td></tr>
              ) : paginatedCustomers.map(c => (
                <tr key={c.id}>
                  <td style={{ fontWeight: 600 }}>{c.name}</td>
                  <td>
                    <span className={`badge ${c.type === 'MONTHLY' ? 'badge-purple' : 'badge-muted'}`}>
                      {c.type === 'MONTHLY' ? 'Monthly' : 'Walk-in'}
                    </span>
                  </td>
                  <td style={{ color: 'var(--text-secondary)' }}>{c.phone || '—'}</td>
                  <td style={{ color: 'var(--text-secondary)', fontSize: '0.8125rem' }}>{c.email || '—'}</td>
                  <td style={{ color: 'var(--text-secondary)' }}>{c._count?.invoices || 0}</td>
                  <td>
                    {c.outstandingBalance > 0 ? (
                      <span style={{ color: 'var(--danger)', fontWeight: 700 }}>Rs. {c.outstandingBalance.toLocaleString()}</span>
                    ) : (
                      <span className="badge badge-success">Clear</span>
                    )}
                  </td>
                  <td>
                    <div style={{ display: 'flex', gap: '0.375rem' }}>
                      <Link href={`/customers/${c.id}`} className="btn btn-secondary btn-sm">View</Link>
                      {c.outstandingBalance > 0 && (
                        <button className="btn btn-success btn-sm" onClick={() => settleCustomerBalance(c.id)}>✓ Settle</button>
                      )}
                      <button className="btn btn-ghost btn-sm" onClick={() => openEdit(c)}>✏</button>
                      <button className="btn btn-ghost btn-sm" style={{ color: 'var(--danger)' }} onClick={() => deleteCustomer(c.id)}>🗑</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {!loading && filtered.length > itemsPerPage && (
          <Pagination 
            currentPage={currentPage} 
            totalItems={filtered.length} 
            itemsPerPage={itemsPerPage} 
            onPageChange={setCurrentPage} 
          />
        )}
      </div>

      {/* Modal */}
      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3>{editCustomer ? 'Edit Customer' : 'New Customer'}</h3>
              <button className="btn btn-ghost" onClick={() => setShowModal(false)}>✕</button>
            </div>
            <div className="modal-body">
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.875rem' }}>
                <div className="form-group">
                  <label className="form-label">Name *</label>
                  <input className="form-control" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} required />
                </div>
                <div className="form-row">
                  <div className="form-group">
                    <label className="form-label">Phone</label>
                    <input className="form-control" value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Email</label>
                    <input type="email" className="form-control" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} />
                  </div>
                </div>
                <div className="form-group">
                  <label className="form-label">Address</label>
                  <textarea className="form-control" rows={2} value={form.address} onChange={e => setForm(f => ({ ...f, address: e.target.value }))} />
                </div>
                <div className="form-group">
                  <label className="form-label">Notes</label>
                  <textarea className="form-control" rows={2} value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} />
                </div>
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setShowModal(false)}>Cancel</button>
              <button className="btn btn-primary" onClick={saveCustomer} disabled={saving || !form.name}>
                {saving ? <span className="spinner" /> : null}
                {saving ? 'Saving…' : 'Save Customer'}
              </button>
            </div>
          </div>
        </div>
      )}
    </AppShell>
  )
}
