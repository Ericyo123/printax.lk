'use client'
import { useEffect, useState } from 'react'
import { AppShell } from '@/components/AppShell'
import { CreditCard, AlertCircle, Trash2, Check } from 'lucide-react'
import { Pagination } from '@/components/Pagination'
import Link from 'next/link'

// In-memory cache to eliminate loading flicker on navigation
let cachedPaymentsInvoices: any[] | null = null

export default function PaymentsPage() {
  const [invoices, setInvoices] = useState<any[]>(cachedPaymentsInvoices || [])
  const [loading, setLoading] = useState(!cachedPaymentsInvoices)
  const [statusFilter, setStatusFilter] = useState('UNPAID')
  const [searchQuery, setSearchQuery] = useState('')
  const [currentPage, setCurrentPage] = useState(1)
  const [saving, setSaving] = useState(false)
  const [actionId, setActionId] = useState<string | null>(null)

  function fetchInvoices() {
    if (!cachedPaymentsInvoices) setLoading(true)
    fetch(`/api/invoices?status=${statusFilter}&limit=100`).then(r => r.json()).then(d => {
      const data = d.invoices || []
      setInvoices(data)
      cachedPaymentsInvoices = data
      setLoading(false)
    }).catch(() => setLoading(false))
  }

  useEffect(() => {
    fetchInvoices()
  }, [statusFilter])

  async function markPaid(id: string) {
    if (!window.confirm('Are you sure you want to mark this invoice as PAID?')) return
    setActionId(id)
    try {
      await fetch(`/api/invoices/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ paymentStatus: 'PAID', paymentMethod: 'CASH' }),
      })
      fetchInvoices()
    } finally {
      setActionId(null)
    }
  }

  async function deleteInvoice(id: string, invNum: string) {
    if (!window.confirm(`Permanently delete invoice ${invNum}? This will remove it and any associated records.`)) return
    setActionId(id)
    try {
      const res = await fetch(`/api/invoices/${id}`, { method: 'DELETE' })
      if (res.ok) {
        const updated = invoices.filter(i => i.id !== id)
        setInvoices(updated)
        cachedPaymentsInvoices = updated
      } else {
        const data = await res.json()
        alert(data.error || 'Failed to delete invoice')
      }
    } catch {
      alert('Error deleting invoice')
    } finally {
      setActionId(null)
    }
  }

  const paymentLabel: Record<string, string> = {
    CASH: 'Cash', BANK_TRANSFER: 'Bank Transfer', CARD: 'Card', ONLINE: 'Online Transfer', OTHER: 'Other'
  }

  const itemsPerPage = 10
  const filteredInvoices = invoices.filter(i => 
    i.invoiceNumber.toLowerCase().includes(searchQuery.toLowerCase()) || 
    (i.customer?.name || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
    (i.customerName || '').toLowerCase().includes(searchQuery.toLowerCase())
  )
  const paginatedInvoices = filteredInvoices.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage)

  useEffect(() => { setCurrentPage(1) }, [searchQuery, statusFilter])

  return (
    <AppShell>
      <div className="page-header">
        <div className="page-title-group">
          <h1 className="page-title">Payments</h1>
          <p className="page-subtitle">Track, record, and manage invoice payments</p>
        </div>
        <div className="page-actions">
          <input
            type="text"
            className="form-control"
            placeholder="Search invoices..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            style={{ width: 250 }}
          />
        </div>
      </div>

      <div style={{ display: 'flex', gap: '0.75rem', marginBottom: '1.5rem' }}>
        <div className="tabs">
          {[['UNPAID', 'Unpaid'], ['PAID', 'Paid'], ['', 'All']].map(([val, label]) => (
            <button key={val} className={`tab ${statusFilter === val ? 'active' : ''}`} onClick={() => setStatusFilter(val)}>{label}</button>
          ))}
        </div>
      </div>

      {/* Summary */}
      {!loading && statusFilter === 'UNPAID' && invoices.length > 0 && (
        <div className="alert alert-danger mb-4" style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <AlertCircle size={20} />
          <span>
            <strong>{invoices.length}</strong> unpaid invoice(s) totalling{' '}
            <strong>Rs. {invoices.reduce((s, i) => s + i.totalAmount, 0).toLocaleString()}</strong>
          </span>
        </div>
      )}

      <div className="table-wrapper">
        <table>
          <thead>
            <tr>
              <th>Invoice #</th>
              <th>Date</th>
              <th>Customer</th>
              <th>Description</th>
              <th>Amount</th>
              <th>Status</th>
              <th>Method</th>
              <th>Paid On</th>
              <th style={{ textAlign: 'right' }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading && invoices.length === 0 ? (
              <tr><td colSpan={9} style={{ textAlign: 'center', padding: '3rem' }}><span className="spinner" /></td></tr>
            ) : filteredInvoices.length === 0 ? (
              <tr><td colSpan={9}><div className="empty-state"><div className="empty-state-icon"><CreditCard size={40} /></div><p>No invoices match this filter</p></div></td></tr>
            ) : paginatedInvoices.map(inv => {
              const customerDisplay = inv.customer?.name || inv.customerName || <span style={{ color: 'var(--text-muted)' }}>Walk-in</span>
              const isActioning = actionId === inv.id
              return (
                <tr key={inv.id}>
                  <td><Link href={`/invoices/${inv.id}`} style={{ fontWeight: 700, color: '#000' }}>{inv.invoiceNumber}</Link></td>
                  <td style={{ color: 'var(--text-secondary)', fontSize: '0.8125rem' }}>{new Date(inv.date).toLocaleDateString()}</td>
                  <td>{customerDisplay}</td>
                  <td style={{ maxWidth: '200px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', fontSize: '0.8125rem' }}>
                    {inv.jobs?.map((j: any) => j.description).filter(Boolean).join(', ') || '-'}
                  </td>
                  <td style={{ fontWeight: 700 }}>Rs. {inv.totalAmount.toLocaleString()}</td>
                  <td><span className={`badge ${inv.paymentStatus === 'PAID' ? 'badge-success' : 'badge-warning'}`}>{inv.paymentStatus}</span></td>
                  <td style={{ color: 'var(--text-secondary)', fontSize: '0.8125rem' }}>{paymentLabel[inv.paymentMethod] || '-'}</td>
                  <td style={{ color: 'var(--text-secondary)', fontSize: '0.8125rem' }}>
                    {inv.paymentDate ? new Date(inv.paymentDate).toLocaleDateString() : '-'}
                  </td>
                  <td style={{ textAlign: 'right' }}>
                    <div style={{ display: 'flex', gap: '0.35rem', justifyContent: 'flex-end', alignItems: 'center' }}>
                      {inv.paymentStatus !== 'PAID' && (
                        <button
                          className="btn btn-success btn-sm"
                          onClick={() => markPaid(inv.id)}
                          disabled={isActioning}
                          style={{ padding: '0.3rem 0.65rem', display: 'inline-flex', alignItems: 'center', gap: '0.3rem' }}
                        >
                          <Check size={14} /> Mark Paid
                        </button>
                      )}

                      <Link href={`/invoices/${inv.id}`} className="btn btn-secondary btn-sm" style={{ padding: '0.3rem 0.55rem' }}>
                        View
                      </Link>

                      <button
                        onClick={() => deleteInvoice(inv.id, inv.invoiceNumber)}
                        disabled={isActioning}
                        className="btn btn-sm"
                        title="Delete invoice"
                        style={{
                          color: 'var(--danger)',
                          background: 'transparent',
                          border: '1px solid var(--border)',
                          padding: '0.3rem 0.55rem',
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
      {!loading && filteredInvoices.length > itemsPerPage && (
        <Pagination 
          currentPage={currentPage} 
          totalItems={filteredInvoices.length} 
          itemsPerPage={itemsPerPage} 
          onPageChange={setCurrentPage} 
        />
      )}
    </AppShell>
  )
}
