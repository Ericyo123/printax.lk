'use client'
import { useEffect, useState, useMemo } from 'react'
import { AppShell } from '@/components/AppShell'
import Link from 'next/link'
import { Pagination } from '@/components/Pagination'
import { Receipt, Search, Trash2, AlertCircle, Check, Calendar } from 'lucide-react'

import { clientCache } from '@/lib/clientCache'

const MONTH_NAMES = ['January','February','March','April','May','June','July','August','September','October','November','December']

export default function InvoicesPage() {
  const cachedData = clientCache.get('invoices_all')
  const [invoices, setInvoices] = useState<any[]>(cachedData?.invoices || [])
  const [total, setTotal] = useState<number>(cachedData?.total || 0)
  const [loading, setLoading] = useState(!cachedData)
  const [statusFilter, setStatusFilter] = useState('')
  const [search, setSearch] = useState('')
  const [deletingId, setDeletingId] = useState<string | null>(null)

  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const [deletingBatch, setDeletingBatch] = useState(false)

  // Month filter: 'all' | 'this-month' | 'last-month' | 'YYYY-MM'
  const now = new Date()
  const [monthFilter, setMonthFilter] = useState<string>('this-month')

  // Generate last 12 months for the dropdown
  const monthOptions = useMemo(() => {
    const options: { value: string; label: string }[] = [
      { value: 'this-month', label: 'This Month' },
      { value: 'last-month', label: 'Last Month' },
    ]
    // Add last 12 specific months
    for (let i = 0; i < 12; i++) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
      const val = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
      const label = `${MONTH_NAMES[d.getMonth()]} ${d.getFullYear()}`
      // Skip duplicates with this-month and last-month
      if (i >= 2) {
        options.push({ value: val, label })
      }
    }
    options.push({ value: 'all', label: 'All Time' })
    return options
  }, [])

  // Pagination
  const [currentPage, setCurrentPage] = useState(1)
  const itemsPerPage = 10

  function fetchInvoices() {
    const cached = clientCache.get('invoices_all')
    if (!cached) setLoading(true)
    const params = new URLSearchParams({ limit: '500' })
    if (statusFilter) params.set('status', statusFilter)
    
    fetch(`/api/invoices?${params}`).then(r => r.json()).then(d => {
      const data = d.invoices || []
      setInvoices(data)
      setTotal(d.total || 0)
      if (!statusFilter) {
        clientCache.set('invoices_all', d)
      }
      setLoading(false)
    }).catch(() => setLoading(false))
  }

  useEffect(() => {
    fetchInvoices()
  }, [statusFilter])

  async function handleMarkPaid(id: string) {
    if (!window.confirm('Mark this invoice as PAID?')) return
    try {
      const res = await fetch(`/api/invoices/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ paymentStatus: 'PAID', paymentMethod: 'CASH' }),
      })
      if (res.ok) {
        const updated = invoices.map(i => i.id === id ? { ...i, paymentStatus: 'PAID', paymentMethod: 'CASH' } : i)
        setInvoices(updated)
        clientCache.set('invoices_all', { invoices: updated, total })
        clientCache.invalidate('dashboard_data')
        clientCache.invalidate('statements_all')
      } else {
        alert('Failed to mark invoice as paid')
      }
    } catch {
      alert('Error marking invoice as paid')
    }
  }

  async function handleDelete(id: string, invNum: string) {
    if (!window.confirm(`Are you sure you want to permanently delete invoice ${invNum}? This cannot be undone.`)) return
    setDeletingId(id)
    try {
      const res = await fetch(`/api/invoices/${id}`, { method: 'DELETE' })
      setDeletingId(null)
      if (res.ok) {
        const updated = invoices.filter(i => i.id !== id)
        const newTotal = Math.max(0, total - 1)
        setInvoices(updated)
        setTotal(newTotal)
        clientCache.set('invoices_all', { invoices: updated, total: newTotal })
        clientCache.invalidate('dashboard_data')
        clientCache.invalidate('statements_all')
        setSelectedIds(prev => prev.filter(selId => selId !== id))
      } else {
        const data = await res.json()
        alert(data.error || 'Failed to delete invoice')
      }
    } catch {
      setDeletingId(null)
      alert('Error deleting invoice')
    }
  }

  async function handleBatchDelete() {
    if (selectedIds.length === 0) return
    if (!window.confirm(`Permanently delete ${selectedIds.length} selected invoice(s)? This cannot be undone.`)) return
    setDeletingBatch(true)
    try {
      const res = await fetch('/api/invoices', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids: selectedIds })
      })
      setDeletingBatch(false)
      if (res.ok) {
        const remaining = invoices.filter(i => !selectedIds.includes(i.id))
        setInvoices(remaining)
        setTotal(remaining.length)
        clientCache.set('invoices_all', { invoices: remaining, total: remaining.length })
        clientCache.invalidate('dashboard_data')
        clientCache.invalidate('statements_all')
        setSelectedIds([])
      } else {
        const data = await res.json()
        alert(data.error || 'Failed to delete selected invoices')
      }
    } catch {
      setDeletingBatch(false)
      alert('Error deleting invoices')
    }
  }

  const getMonthBounds = (filter: string) => {
    if (filter === 'all') return null
    let year: number, month: number
    if (filter === 'this-month') {
      year = now.getFullYear()
      month = now.getMonth()
    } else if (filter === 'last-month') {
      const d = new Date(now.getFullYear(), now.getMonth() - 1, 1)
      year = d.getFullYear()
      month = d.getMonth()
    } else {
      // YYYY-MM format
      const [y, m] = filter.split('-').map(Number)
      year = y
      month = m - 1
    }
    const start = new Date(year, month, 1)
    const end = new Date(year, month + 1, 0, 23, 59, 59, 999)
    return { start, end }
  }

  const filtered = invoices.filter(inv => {
    // Month filter
    const bounds = getMonthBounds(monthFilter)
    if (bounds) {
      const invDate = new Date(inv.date)
      if (invDate < bounds.start || invDate > bounds.end) return false
    }
    // Text search
    if (!search) return true
    const term = search.toLowerCase()
    return (
      inv.invoiceNumber?.toLowerCase().includes(term) ||
      inv.customer?.name?.toLowerCase().includes(term) ||
      inv.customerName?.toLowerCase().includes(term) ||
      inv.jobs?.some((j: any) => j.description?.toLowerCase().includes(term))
    )
  })

  const paginatedInvoices = filtered.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage)

  const isAllSelected = paginatedInvoices.length > 0 && paginatedInvoices.every(i => selectedIds.includes(i.id))

  function toggleSelectAll() {
    if (isAllSelected) {
      setSelectedIds(prev => prev.filter(id => !paginatedInvoices.some(i => i.id === id)))
    } else {
      const newIds = paginatedInvoices.map(i => i.id)
      setSelectedIds(prev => Array.from(new Set([...prev, ...newIds])))
    }
  }

  function toggleSelect(id: string) {
    setSelectedIds(prev => prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id])
  }

  const statusBadge = (s: string) => {
    const map: Record<string, string> = { PAID: 'badge-success', UNPAID: 'badge-warning', PARTIAL: 'badge-info' }
    return <span className={`badge ${map[s] || 'badge-muted'}`}>{s}</span>
  }

  const paymentLabel: Record<string, string> = {
    CASH: 'Cash', BANK_TRANSFER: 'Bank Transfer', CARD: 'Card', ONLINE: 'Online', OTHER: 'Other'
  }

  return (
    <AppShell>
      <div className="page-header">
        <div className="page-title-group">
          <h1 className="page-title">Invoices</h1>
          <p className="page-subtitle">
            {filtered.length === total 
              ? `${total} total invoices` 
              : `Showing ${filtered.length} of ${total} invoices`}
          </p>
        </div>
        <div className="page-actions">
          <Link href="/jobs/new" className="btn btn-primary">+ New Job</Link>
        </div>
      </div>

      {/* Filters */}
      <div style={{ display: 'flex', gap: '0.75rem', marginBottom: '1.5rem', flexWrap: 'wrap', alignItems: 'center' }}>
        <div className="search-bar" style={{ flex: '1 1 280px' }}>
          <Search size={18} color="var(--text-muted)" />
          <input 
            placeholder="Search by invoice # or customer..." 
            value={search} 
            onChange={e => { setSearch(e.target.value); setCurrentPage(1) }} 
          />
        </div>

        {/* Month Filter Dropdown */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
          <Calendar size={16} color="var(--text-muted)" />
          <select
            className="form-control"
            style={{ width: '180px', fontSize: '0.8125rem' }}
            value={monthFilter}
            onChange={e => { setMonthFilter(e.target.value); setCurrentPage(1) }}
          >
            {monthOptions.map(opt => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
        </div>

        <div className="tabs">
          {['', 'UNPAID', 'PAID', 'PARTIAL'].map(s => (
            <button 
              key={s} 
              className={`tab ${statusFilter === s ? 'active' : ''}`} 
              onClick={() => { setStatusFilter(s); setCurrentPage(1) }}
            >
              {s || 'All'}
            </button>
          ))}
        </div>
      </div>

      {/* Unpaid summary alert */}
      {statusFilter === 'UNPAID' && filtered.length > 0 && (
        <div className="alert alert-danger mb-4" style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <AlertCircle size={20} />
          <span>
            <strong>{filtered.length}</strong> unpaid invoice(s) totalling{' '}
            <strong>Rs. {filtered.reduce((s, i) => s + (i.totalAmount || 0), 0).toLocaleString()}</strong>
          </span>
        </div>
      )}

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
                <th>Invoice #</th>
                <th>Date</th>
                <th>Customer</th>
                <th>Description</th>
                <th>Jobs</th>
                <th>Amount</th>
                <th>Status</th>
                <th>Payment</th>
                <th style={{ textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading && invoices.length === 0 ? (
                <tr><td colSpan={10} style={{ textAlign: 'center', padding: '3rem' }}><span className="spinner" /></td></tr>
              ) : filtered.length === 0 ? (
                <tr><td colSpan={10}>
                  <div className="empty-state">
                    <div className="empty-state-icon"><Receipt size={40} /></div>
                    <p>No invoices found</p>
                    <Link href="/jobs/new" className="btn btn-primary btn-sm">Create first job</Link>
                  </div>
                </td></tr>
              ) : paginatedInvoices.map(inv => {
                const customerDisplay = inv.customer?.name || inv.customerName || <span style={{ color: 'var(--text-muted)' }}>Walk-in</span>
                const isSelected = selectedIds.includes(inv.id)
                return (
                  <tr key={inv.id} style={{ background: isSelected ? 'var(--primary-subtle, #f0f7ff)' : undefined }}>
                    <td style={{ textAlign: 'center' }} onClick={e => e.stopPropagation()}>
                      <input 
                        type="checkbox" 
                        checked={isSelected} 
                        onChange={() => toggleSelect(inv.id)}
                        style={{ width: '16px', height: '16px', cursor: 'pointer' }}
                      />
                    </td>
                    <td><span style={{ fontWeight: 700, color: '#000' }}>{inv.invoiceNumber}</span></td>
                    <td style={{ color: 'var(--text-secondary)', fontSize: '0.8125rem' }}>{new Date(inv.date).toLocaleDateString()}</td>
                    <td>{customerDisplay}</td>
                    <td style={{ maxWidth: '200px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', fontSize: '0.8125rem' }}>
                      {inv.jobs?.map((j: any) => j.description).filter(Boolean).join(', ') || '-'}
                    </td>
                    <td style={{ color: 'var(--text-secondary)' }}>{inv.jobs?.length || 0} item(s)</td>
                    <td style={{ fontWeight: 700 }}>Rs. {inv.totalAmount.toLocaleString()}</td>
                    <td>{statusBadge(inv.paymentStatus)}</td>
                    <td style={{ color: 'var(--text-secondary)', fontSize: '0.8125rem' }}>{paymentLabel[inv.paymentMethod] || '—'}</td>
                    <td style={{ textAlign: 'right' }}>
                      <div style={{ display: 'flex', gap: '0.375rem', justifyContent: 'flex-end', alignItems: 'center' }}>
                        {inv.paymentStatus !== 'PAID' && (
                          <button
                            onClick={() => handleMarkPaid(inv.id)}
                            className="btn btn-sm"
                            title="Mark Invoice as Paid"
                            style={{
                              background: 'rgba(16, 185, 129, 0.15)',
                              color: 'var(--success)',
                              border: '1px solid rgba(16, 185, 129, 0.3)',
                              padding: '0.35rem 0.55rem',
                              fontWeight: 600,
                              fontSize: '0.75rem',
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '0.2rem'
                            }}
                          >
                            <Check size={13} /> Paid
                          </button>
                        )}
                        <Link href={`/invoices/${inv.id}`} className="btn btn-secondary btn-sm" style={{ padding: '0.35rem 0.65rem' }}>
                          View
                        </Link>
                        <button
                          onClick={() => handleDelete(inv.id, inv.invoiceNumber)}
                          disabled={deletingId === inv.id}
                          className="btn btn-sm"
                          title="Delete invoice"
                          style={{
                            color: 'var(--danger)',
                            background: 'transparent',
                            border: '1px solid var(--border)',
                            padding: '0.35rem 0.6rem',
                            display: 'inline-flex',
                            alignItems: 'center'
                          }}
                        >
                          <Trash2 size={15} />
                        </button>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
        {filtered.length > itemsPerPage && (
          <Pagination 
            currentPage={currentPage} 
            totalItems={filtered.length} 
            itemsPerPage={itemsPerPage} 
            onPageChange={setCurrentPage} 
          />
        )}
      </div>

      {/* Floating Batch Action Bar */}
      {selectedIds.length > 0 && (
        <div style={{
          position: 'fixed',
          bottom: '2rem',
          left: '50%',
          transform: 'translateX(-50%)',
          zIndex: 100,
          background: '#0f172a',
          color: '#fff',
          padding: '0.75rem 1.5rem',
          borderRadius: '50px',
          boxShadow: '0 12px 30px rgba(0,0,0,0.35)',
          display: 'flex',
          alignItems: 'center',
          gap: '1.25rem',
          animation: 'fadeIn 0.2s ease-in-out'
        }}>
          <span style={{ fontSize: '0.875rem', fontWeight: 600 }}>
            {selectedIds.length} invoice{selectedIds.length === 1 ? '' : 's'} selected
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
