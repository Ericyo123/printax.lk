'use client'
import { useEffect, useState } from 'react'
import { AppShell } from '@/components/AppShell'
import Link from 'next/link'
import { Pagination } from '@/components/Pagination'
import { FileText, Plus, Search, Eye, ArrowRightCircle, Trash2, Clock } from 'lucide-react'
import { useRouter } from 'next/navigation'

import { clientCache } from '@/lib/clientCache'

export default function QuotationsPage() {
  const router = useRouter()
  const cachedData = clientCache.get('quotations_all')
  const [quotations, setQuotations] = useState<any[]>(cachedData?.quotations || [])
  const [total, setTotal] = useState<number>(cachedData?.total || 0)
  const [loading, setLoading] = useState(!cachedData)
  const [statusFilter, setStatusFilter] = useState('')
  const [search, setSearch] = useState('')
  const [convertingId, setConvertingId] = useState<string | null>(null)
  const [localDraft, setLocalDraft] = useState<any>(null)
  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const [deletingBatch, setDeletingBatch] = useState(false)

  // Pagination
  const [currentPage, setCurrentPage] = useState(1)
  const itemsPerPage = 12

  useEffect(() => {
    try {
      const cached = localStorage.getItem('printax_new_quotation_cache')
      if (cached) {
        const parsed = JSON.parse(cached)
        const hasData = (parsed.clientName && parsed.clientName.trim()) ||
          (parsed.items && parsed.items.some((it: any) => it.description && it.description.trim()))
        if (hasData) {
          setLocalDraft(parsed)
        }
      }
    } catch (e) {
      console.error('Failed to read quotation cache', e)
    }
  }, [])

  function discardLocalDraft() {
    if (!window.confirm('Are you sure you want to discard this unfinished draft quotation?')) return
    localStorage.removeItem('printax_new_quotation_cache')
    setLocalDraft(null)
  }

  function fetchQuotations() {
    const cached = clientCache.get('quotations_all')
    if (!cached) setLoading(true)
    const params = new URLSearchParams({ limit: '500' })
    if (statusFilter) params.set('status', statusFilter)
    if (search) params.set('search', search)
    fetch(`/api/quotations?${params}`)
      .then(r => r.json())
      .then(d => {
        const list = d.quotations || []
        setQuotations(list)
        setTotal(d.total || 0)
        if (!statusFilter && !search) {
          clientCache.set('quotations_all', d)
        }
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }

  useEffect(() => {
    fetchQuotations()
  }, [statusFilter])

  const filtered = quotations.filter(q => {
    if (!search) return true
    const term = search.toLowerCase()
    return (
      q.quotationNumber?.toLowerCase().includes(term) ||
      q.customerName?.toLowerCase().includes(term) ||
      q.customer?.name?.toLowerCase().includes(term) ||
      q.notes?.toLowerCase().includes(term)
    )
  })

  const paginated = filtered.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage)

  const isAllSelected = paginated.length > 0 && paginated.every(q => selectedIds.includes(q.id))

  function toggleSelectAll() {
    if (isAllSelected) {
      setSelectedIds(prev => prev.filter(id => !paginated.some(q => q.id === id)))
    } else {
      const newIds = paginated.map(q => q.id)
      setSelectedIds(prev => Array.from(new Set([...prev, ...newIds])))
    }
  }

  function toggleSelect(id: string) {
    setSelectedIds(prev => prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id])
  }

  async function handleBatchDelete() {
    if (selectedIds.length === 0) return
    if (!window.confirm(`Permanently delete ${selectedIds.length} selected quotation(s)? This cannot be undone.`)) return
    setDeletingBatch(true)
    try {
      const res = await fetch('/api/quotations', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids: selectedIds })
      })
      setDeletingBatch(false)
      if (res.ok) {
        const remaining = quotations.filter(q => !selectedIds.includes(q.id))
        setQuotations(remaining)
        setTotal(remaining.length)
        clientCache.set('quotations_all', { quotations: remaining, total: remaining.length })
        clientCache.invalidate('dashboard_data')
        setSelectedIds([])
      } else {
        const data = await res.json()
        alert(data.error || 'Failed to delete selected quotations')
      }
    } catch {
      setDeletingBatch(false)
      alert('Error deleting quotations')
    }
  }

  const statusBadge = (s: string) => {
    switch (s) {
      case 'ACCEPTED':
        return <span className="badge badge-success">Accepted</span>
      case 'CONVERTED':
        return <span className="badge badge-purple" style={{ background: '#ede9fe', color: '#6d28d9', borderColor: '#ddd6fe' }}>Converted to Invoice</span>
      case 'SENT':
        return <span className="badge badge-info">Sent</span>
      case 'REJECTED':
        return <span className="badge badge-danger">Rejected</span>
      case 'EXPIRED':
        return <span className="badge badge-muted">Expired</span>
      default:
        return <span className="badge badge-warning">Draft</span>
    }
  }

  async function convertToInvoice(id: string, e: React.MouseEvent) {
    e.stopPropagation()
    if (!window.confirm('Convert this quotation to an active invoice now?')) return
    setConvertingId(id)
    try {
      const res = await fetch(`/api/quotations/${id}/convert`, { method: 'POST' })
      const data = await res.json()
      setConvertingId(null)
      if (res.ok && data.invoice) {
        clientCache.invalidate('invoices_all')
        clientCache.invalidate('dashboard_data')
        router.push(`/invoices/${data.invoice.id}`)
      } else {
        alert(data.error || 'Failed to convert quotation')
      }
    } catch {
      setConvertingId(null)
      alert('Network error occurred during conversion.')
    }
  }

  async function deleteQuotation(id: string, e: React.MouseEvent) {
    e.stopPropagation()
    if (!window.confirm('Are you sure you want to delete this quotation?')) return
    try {
      const res = await fetch(`/api/quotations/${id}`, { method: 'DELETE' })
      if (res.ok) {
        const updated = quotations.filter(q => q.id !== id)
        const newTotal = Math.max(0, total - 1)
        setQuotations(updated)
        setTotal(newTotal)
        clientCache.set('quotations_all', { quotations: updated, total: newTotal })
        clientCache.invalidate('dashboard_data')
        setSelectedIds(prev => prev.filter(selId => selId !== id))
      } else {
        alert('Failed to delete quotation')
      }
    } catch {
      alert('Error deleting quotation')
    }
  }

  const fmt = (n: number) => `Rs. ${(n || 0).toLocaleString('en-LK', { minimumFractionDigits: 2 })}`

  // Metrics
  const totalValue = quotations.reduce((acc, q) => acc + (q.totalAmount || 0), 0)
  const convertedCount = quotations.filter(q => q.status === 'CONVERTED').length
  const rejectedCount = quotations.filter(q => q.status === 'REJECTED' || q.status === 'EXPIRED').length

  const localDraftSubtotal = localDraft?.items?.reduce((s: number, i: any) => s + (Number(i.totalAmount) || 0), 0) || 0
  const localDraftDiscount = Number(localDraft?.discount) || 0
  const localDraftTotal = Math.max(0, localDraftSubtotal - localDraftDiscount)

  return (
    <AppShell>
      <div className="page-header">
        <div className="page-title-group">
          <h1 className="page-title">Quotations</h1>
          <p className="page-subtitle">Create price estimates, manage quotes, and convert to invoices</p>
        </div>
        <div className="page-actions">
          <Link href="/quotations/new" className="btn btn-primary" style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
            <Plus size={18} /> New Quotation
          </Link>
        </div>
      </div>

      {/* Metric Cards */}
      <div className="stat-grid mb-6">
        <div className="stat-card">
          <div className="stat-label">Total Quotations</div>
          <div className="stat-value">{total + (localDraft ? 1 : 0)}</div>
          <div className="stat-sub">{fmt(totalValue + (localDraft ? localDraftTotal : 0))} total estimated value</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Converted to Invoices</div>
          <div className="stat-value" style={{ color: 'var(--primary)' }}>{convertedCount}</div>
          <div className="stat-sub">Successfully closed orders</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Rejected / Expired</div>
          <div className="stat-value" style={{ color: 'var(--danger)' }}>{rejectedCount}</div>
          <div className="stat-sub">Lost or expired quotes</div>
        </div>
      </div>

      {/* Local Draft In-Progress Banner */}
      {localDraft && (
        <div style={{
          background: '#fffbeb',
          border: '1px solid #fde68a',
          borderRadius: 'var(--radius)',
          padding: '0.85rem 1.25rem',
          marginBottom: '1.25rem',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '1rem',
          flexWrap: 'wrap'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <div style={{ background: '#fef3c7', color: '#b45309', padding: '0.45rem', borderRadius: '8px', display: 'flex', alignItems: 'center' }}>
              <FileText size={18} />
            </div>
            <div>
              <div style={{ fontWeight: 600, color: '#92400e', fontSize: '0.9rem' }}>
                Unsaved Quotation Draft in Progress
              </div>
              <div style={{ color: '#b45309', fontSize: '0.8125rem' }}>
                Client: <strong>{localDraft.clientName || 'Untitled Client'}</strong> &bull; Total: <strong>Rs. {localDraftTotal.toLocaleString()}</strong> &bull; {localDraft.items?.length || 0} item(s)
              </div>
            </div>
          </div>
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <button
              onClick={discardLocalDraft}
              className="btn btn-secondary btn-sm"
              style={{ background: 'white', borderColor: '#fcd34d', color: '#78350f' }}
            >
              Discard
            </button>
            <Link
              href="/quotations/new"
              className="btn btn-primary btn-sm"
              style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}
            >
              Continue Editing &rarr;
            </Link>
          </div>
        </div>
      )}

      {/* Filters and Search */}
      <div style={{ display: 'flex', gap: '0.75rem', marginBottom: '1.5rem', flexWrap: 'wrap', alignItems: 'center' }}>
        <div className="search-bar" style={{ flex: '1 1 280px' }}>
          <Search size={18} color="var(--text-muted)" />
          <input
            placeholder="Search by quote #, customer, notes..."
            value={search}
            onChange={e => { setSearch(e.target.value); setCurrentPage(1) }}
          />
        </div>
        <div className="tabs">
          {[
            { id: '', label: 'All' },
            { id: 'CONVERTED', label: 'Converted' },
            { id: 'REJECTED', label: 'Rejected' },
          ].map(t => (
            <button
              key={t.id}
              className={`tab ${statusFilter === t.id ? 'active' : ''}`}
              onClick={() => { setStatusFilter(t.id); setCurrentPage(1) }}
            >
              {t.label}
            </button>
          ))}
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
                <th>Quote #</th>
                <th>Date</th>
                <th>Customer</th>
                <th>Items</th>
                <th>Valid Until</th>
                <th>Total Amount</th>
                <th>Status</th>
                <th style={{ textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {/* If on All tab and local draft exists, show draft row at the very top */}
              {localDraft && !statusFilter && (
                <tr style={{ background: '#fffdf5', borderLeft: '3px solid #f59e0b', cursor: 'pointer' }} onClick={() => router.push('/quotations/new')}>
                  <td></td>
                  <td>
                    <span style={{ fontWeight: 700, color: '#d97706', display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}>
                      <Clock size={14} /> DRAFT (In Progress)
                    </span>
                  </td>
                  <td style={{ color: 'var(--text-secondary)', fontSize: '0.8125rem' }}>Unsaved (Local)</td>
                  <td>
                    <div style={{ fontWeight: 600, color: '#92400e' }}>{localDraft.clientName || 'Unsaved Client'}</div>
                    {localDraft.clientPhone && <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{localDraft.clientPhone}</div>}
                  </td>
                  <td>
                    <span className="badge badge-warning" style={{ background: '#fef3c7', color: '#b45309', borderColor: '#fde68a' }}>
                      {localDraft.items?.length || 0} item(s)
                    </span>
                  </td>
                  <td style={{ color: 'var(--text-muted)' }}>
                    {localDraft.validUntil ? new Date(localDraft.validUntil).toLocaleDateString('en-GB') : '—'}
                  </td>
                  <td>
                    <strong style={{ fontSize: '0.95rem', color: '#b45309' }}>Rs. {localDraftTotal.toLocaleString()}</strong>
                  </td>
                  <td>
                    <span className="badge badge-warning" style={{ background: '#fef3c7', color: '#b45309', borderColor: '#fde68a' }}>
                      In-Progress Draft
                    </span>
                  </td>
                  <td style={{ textAlign: 'right' }} onClick={e => e.stopPropagation()}>
                    <div style={{ display: 'flex', gap: '0.35rem', justifyContent: 'flex-end' }}>
                      <Link href="/quotations/new" className="btn btn-primary btn-sm" style={{ padding: '0.35rem 0.65rem' }}>
                        Continue Editing
                      </Link>
                      <button onClick={discardLocalDraft} className="btn btn-sm" title="Discard draft" style={{ color: 'var(--danger)', background: 'white', border: '1px solid var(--border)', padding: '0.35rem 0.5rem' }}>
                        <Trash2 size={15} />
                      </button>
                    </div>
                  </td>
                </tr>
              )}

              {loading && quotations.length === 0 ? (
                <tr>
                  <td colSpan={9} style={{ textAlign: 'center', padding: '3rem' }}>
                    <span className="spinner" />
                  </td>
                </tr>
              ) : filtered.length === 0 && !localDraft ? (
                <tr>
                  <td colSpan={9}>
                    <div className="empty-state">
                      <div className="empty-state-icon"><FileText size={40} /></div>
                      <p>No quotations found</p>
                      <Link href="/quotations/new" className="btn btn-primary btn-sm">Create First Quotation</Link>
                    </div>
                  </td>
                </tr>
              ) : (
                paginated.map(quote => {
                  const customerDisplay = quote.customer?.name || quote.customerName || 'Walk-in Customer'
                  const isSelected = selectedIds.includes(quote.id)
                  return (
                    <tr
                      key={quote.id}
                      style={{ cursor: 'pointer', background: isSelected ? 'var(--primary-subtle, #f0f7ff)' : undefined }}
                      onClick={() => router.push(`/quotations/${quote.id}`)}
                    >
                      <td style={{ textAlign: 'center' }} onClick={e => e.stopPropagation()}>
                        <input 
                          type="checkbox" 
                          checked={isSelected} 
                          onChange={() => toggleSelect(quote.id)}
                          style={{ width: '16px', height: '16px', cursor: 'pointer' }}
                        />
                      </td>
                      <td>
                        <span style={{ fontWeight: 600, color: 'var(--primary)' }}>
                          {quote.quotationNumber}
                        </span>
                      </td>
                      <td>{new Date(quote.date).toLocaleDateString('en-GB')}</td>
                      <td>
                        <div style={{ fontWeight: 500 }}>{customerDisplay}</div>
                        {(quote.customerPhone || quote.customer?.phone) && (
                          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                            {quote.customerPhone || quote.customer?.phone}
                          </div>
                        )}
                      </td>
                      <td>
                        <span className="badge badge-muted">
                          {quote.items?.length || 0} item{(quote.items?.length || 0) === 1 ? '' : 's'}
                        </span>
                      </td>
                      <td>
                        {quote.validUntil
                          ? new Date(quote.validUntil).toLocaleDateString('en-GB')
                          : <span style={{ color: 'var(--text-muted)' }}>—</span>
                        }
                      </td>
                      <td>
                        <strong style={{ fontSize: '0.95rem' }}>{fmt(quote.totalAmount)}</strong>
                        {quote.discount > 0 && (
                          <div style={{ fontSize: '0.75rem', color: 'var(--danger)' }}>
                            - {fmt(quote.discount)} off
                          </div>
                        )}
                      </td>
                      <td>{statusBadge(quote.status)}</td>
                      <td style={{ textAlign: 'right' }} onClick={e => e.stopPropagation()}>
                        <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end', alignItems: 'center' }}>
                          <Link
                            href={`/quotations/${quote.id}`}
                            className="btn btn-secondary btn-sm"
                            title="View Quotation"
                            style={{ padding: '0.35rem 0.6rem' }}
                          >
                            <Eye size={15} />
                          </Link>

                          {quote.status !== 'CONVERTED' ? (
                            <button
                              className="btn btn-primary btn-sm"
                              onClick={(e) => convertToInvoice(quote.id, e)}
                              disabled={convertingId === quote.id}
                              title="Convert directly into active Invoice"
                              style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', padding: '0.35rem 0.75rem' }}
                            >
                              <ArrowRightCircle size={15} />
                              {convertingId === quote.id ? 'Converting...' : 'Convert'}
                            </button>
                          ) : (
                            quote.invoices?.[0] && (
                              <Link
                                href={`/invoices/${quote.invoices[0].id}`}
                                className="btn btn-secondary btn-sm"
                                title="Open Converted Invoice"
                                style={{ color: '#6d28d9', borderColor: '#ddd6fe', background: '#f5f3ff', padding: '0.35rem 0.6rem' }}
                              >
                                {quote.invoices[0].invoiceNumber}
                              </Link>
                            )
                          )}

                          <button
                            className="btn btn-sm"
                            onClick={(e) => deleteQuotation(quote.id, e)}
                            title="Delete Quotation"
                            style={{ color: 'var(--danger)', background: 'transparent', border: '1px solid var(--border)', padding: '0.35rem 0.6rem' }}
                          >
                            <Trash2 size={15} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div style={{ marginTop: '1.5rem' }}>
        <Pagination
          currentPage={currentPage}
          totalItems={filtered.length}
          itemsPerPage={itemsPerPage}
          onPageChange={setCurrentPage}
        />
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
            {selectedIds.length} quotation{selectedIds.length === 1 ? '' : 's'} selected
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
