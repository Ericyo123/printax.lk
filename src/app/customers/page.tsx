'use client'
import { useEffect, useState } from 'react'
import { AppShell } from '@/components/AppShell'
import Link from 'next/link'
import { Pagination } from '@/components/Pagination'
import { Users, Search, Pencil, Trash2, Check, X } from 'lucide-react'

import { clientCache } from '@/lib/clientCache'

export default function CustomersPage() {
  const cachedData = clientCache.get('customers_all')
  const [customers, setCustomers] = useState<any[]>(Array.isArray(cachedData) ? cachedData : [])
  const [loading, setLoading] = useState(!cachedData)
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
    const cached = clientCache.get('customers_all')
    if (!cached) setLoading(true)
    const params = new URLSearchParams()
    if (typeFilter) params.set('type', typeFilter)
    fetch(`/api/customers?${params}`)
      .then(r => r.json())
      .then(d => { 
        if (Array.isArray(d)) {
          setCustomers(d)
          if (!typeFilter) {
            clientCache.set('customers_all', d)
          }
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
      clientCache.invalidate('customers_all')
      clientCache.invalidate('dashboard_data')
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

  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const [deletingBatch, setDeletingBatch] = useState(false)

  async function deleteCustomer(id: string) {
    if (!confirm('Delete this customer?')) return
    const res = await fetch(`/api/customers/${id}`, { method: 'DELETE' })
    const data = await res.json()
    if (res.ok) {
      setSelectedIds(prev => prev.filter(selId => selId !== id))
      clientCache.invalidate('customers_all')
      clientCache.invalidate('dashboard_data')
      fetchCustomers()
    } else {
      alert(data.error || 'Failed to delete customer.')
    }
  }

  async function handleBatchDelete() {
    if (selectedIds.length === 0) return
    if (!confirm(`Permanently delete ${selectedIds.length} selected customer(s)? This will remove them from the system.`)) return
    setDeletingBatch(true)
    try {
      const res = await fetch('/api/customers', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids: selectedIds })
      })
      setDeletingBatch(false)
      if (res.ok) {
        const remaining = customers.filter(c => !selectedIds.includes(c.id))
        setCustomers(remaining)
        setSelectedIds([])
        clientCache.invalidate('customers_all')
        clientCache.invalidate('dashboard_data')
        fetchCustomers()
      } else {
        const data = await res.json()
        alert(data.error || 'Failed to delete selected customers')
      }
    } catch {
      setDeletingBatch(false)
      alert('Error deleting customers')
    }
  }

  async function settleCustomerBalance(id: string) {
    if (!confirm('Are you sure you want to mark all outstanding invoices for this customer as PAID?')) return
    const res = await fetch(`/api/customers/${id}/clear`, { method: 'POST' })
    if (res.ok) {
      clientCache.invalidate('customers_all')
      clientCache.invalidate('invoices_all')
      clientCache.invalidate('dashboard_data')
      clientCache.invalidate('statements_all')
      fetchCustomers()
    } else {
      alert('Failed to settle balance.')
    }
  }

  const filtered = customers.filter(c => !search || c.name?.toLowerCase().includes(search.toLowerCase()) || c.phone?.includes(search) || c.email?.toLowerCase().includes(search.toLowerCase()))
  
  const paginatedCustomers = filtered.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage)

  const isAllSelected = paginatedCustomers.length > 0 && paginatedCustomers.every(c => selectedIds.includes(c.id))

  function toggleSelectAll() {
    if (isAllSelected) {
      setSelectedIds(prev => prev.filter(id => !paginatedCustomers.some(c => c.id === id)))
    } else {
      const newIds = paginatedCustomers.map(c => c.id)
      setSelectedIds(prev => Array.from(new Set([...prev, ...newIds])))
    }
  }

  function toggleSelect(id: string) {
    setSelectedIds(prev => prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id])
  }

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
          <input placeholder="Search name, phone, email..." value={search} onChange={e => { setSearch(e.target.value); setCurrentPage(1) }} />
        </div>
      </div>

      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        <div className="table-wrapper" style={{ margin: 0, border: 'none', borderRadius: 0 }}>
          <table>
            <thead>
              <tr>
                <th style={{ width: '40px', textAlign: 'center' }}>
                  <input
                    type="checkbox"
                    checked={isAllSelected}
                    onChange={toggleSelectAll}
                    style={{ width: '16px', height: '16px', cursor: 'pointer' }}
                  />
                </th>
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
              {loading && customers.length === 0 ? (
                <tr><td colSpan={8} style={{ textAlign: 'center', padding: '3rem' }}><span className="spinner" /></td></tr>
              ) : filtered.length === 0 ? (
                <tr><td colSpan={8}><div className="empty-state"><div className="empty-state-icon"><Users size={40} /></div><p>No customers found</p></div></td></tr>
              ) : paginatedCustomers.map(c => {
                const isSelected = selectedIds.includes(c.id)
                return (
                  <tr key={c.id} style={{ background: isSelected ? 'var(--primary-subtle, #f0f7ff)' : undefined }}>
                    <td style={{ textAlign: 'center' }} onClick={e => e.stopPropagation()}>
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => toggleSelect(c.id)}
                        style={{ width: '16px', height: '16px', cursor: 'pointer' }}
                      />
                    </td>
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
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.375rem', alignItems: 'flex-start' }}>
                          <span style={{ color: 'var(--danger)', fontWeight: 700 }}>Rs. {c.outstandingBalance.toLocaleString()}</span>
                          <button className="btn btn-success btn-sm" style={{ padding: '0.2rem 0.5rem', fontSize: '0.75rem', height: 'auto', display: 'inline-flex', alignItems: 'center', gap: '0.25rem' }} onClick={() => settleCustomerBalance(c.id)}>
                            <Check size={12} /> Settle
                          </button>
                        </div>
                      ) : (
                        <span className="badge badge-success">Clear</span>
                      )}
                    </td>
                    <td>
                      <div style={{ display: 'flex', gap: '0.25rem' }}>
                        <Link href={`/customers/${c.id}`} className="btn btn-secondary btn-sm" style={{ padding: '0.375rem 0.5rem', height: 'auto' }}>View</Link>
                        <button className="btn btn-ghost btn-sm" style={{ padding: '0.375rem', height: 'auto', color: 'var(--text-secondary)' }} onClick={() => openEdit(c)} title="Edit"><Pencil size={16} /></button>
                        <button className="btn btn-ghost btn-sm" style={{ padding: '0.375rem', height: 'auto', color: 'var(--danger)' }} onClick={() => deleteCustomer(c.id)} title="Delete"><Trash2 size={16} /></button>
                      </div>
                    </td>
                  </tr>
                )
              })}
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
              <button className="btn btn-ghost" onClick={() => setShowModal(false)}><X size={18} /></button>
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

      {/* Floating Batch Actions Bar */}
      {selectedIds.length > 0 && (
        <div style={{
          position: 'fixed',
          bottom: '2rem',
          left: '50%',
          transform: 'translateX(-50%)',
          background: '#1e293b',
          color: '#fff',
          padding: '0.75rem 1.5rem',
          borderRadius: '50px',
          boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.3), 0 8px 10px -6px rgba(0, 0, 0, 0.3)',
          zIndex: 999,
          display: 'flex',
          alignItems: 'center',
          gap: '1.25rem',
          animation: 'fadeIn 0.2s ease-in-out'
        }}>
          <span style={{ fontSize: '0.875rem', fontWeight: 600 }}>
            {selectedIds.length} customer{selectedIds.length === 1 ? '' : 's'} selected
          </span>
          <button
            onClick={handleBatchDelete}
            disabled={deletingBatch}
            className="btn btn-sm"
            style={{
              background: '#ef4444',
              color: '#fff',
              border: 'none',
              padding: '0.45rem 1rem',
              borderRadius: '25px',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.4rem',
              fontWeight: 600,
              cursor: 'pointer'
            }}
          >
            <Trash2 size={15} />
            {deletingBatch ? 'Deleting...' : `Delete Selected (${selectedIds.length})`}
          </button>
          <button
            onClick={() => setSelectedIds([])}
            style={{
              background: 'transparent',
              color: '#94a3b8',
              border: 'none',
              fontSize: '0.8125rem',
              cursor: 'pointer',
              padding: '0.2rem 0.4rem',
              textDecoration: 'underline'
            }}
          >
            Deselect
          </button>
        </div>
      )}
    </AppShell>
  )
}
