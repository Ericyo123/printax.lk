'use client'
import { useEffect, useState } from 'react'
import { AppShell } from '@/components/AppShell'
import Link from 'next/link'

export default function InvoicesPage() {
  const [invoices, setInvoices] = useState<any[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [search, setSearch] = useState('')

  useEffect(() => {
    const params = new URLSearchParams({ limit: '100' })
    if (statusFilter) params.set('status', statusFilter)
    fetch(`/api/invoices?${params}`).then(r => r.json()).then(d => {
      setInvoices(d.invoices || [])
      setTotal(d.total || 0)
      setLoading(false)
    })
  }, [statusFilter])

  const filtered = invoices.filter(inv =>
    !search || inv.invoiceNumber.toLowerCase().includes(search.toLowerCase()) ||
    inv.customer?.name?.toLowerCase().includes(search.toLowerCase())
  )

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
          <p className="page-subtitle">{total} total invoices</p>
        </div>
        <div className="page-actions">
          <Link href="/jobs/new" className="btn btn-primary">+ New Job</Link>
        </div>
      </div>

      {/* Filters */}
      <div style={{ display: 'flex', gap: '0.75rem', marginBottom: '1.5rem', flexWrap: 'wrap', alignItems: 'center' }}>
        <div className="search-bar" style={{ flex: '1 1 280px' }}>
          <span style={{ color: 'var(--text-muted)' }}>🔍</span>
          <input placeholder="Search by invoice # or customer..." value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <div className="tabs">
          {['', 'UNPAID', 'PAID', 'PARTIAL'].map(s => (
            <button key={s} className={`tab ${statusFilter === s ? 'active' : ''}`} onClick={() => setStatusFilter(s)}>
              {s || 'All'}
            </button>
          ))}
        </div>
      </div>

      <div className="table-wrapper">
        <table>
          <thead>
            <tr>
              <th>Invoice #</th>
              <th>Date</th>
              <th>Customer</th>
              <th>Jobs</th>
              <th>Amount</th>
              <th>Status</th>
              <th>Payment</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={8} style={{ textAlign: 'center', padding: '3rem' }}><span className="spinner" /></td></tr>
            ) : filtered.length === 0 ? (
              <tr><td colSpan={8}>
                <div className="empty-state">
                  <div className="empty-state-icon">🧾</div>
                  <p>No invoices found</p>
                  <Link href="/jobs/new" className="btn btn-primary btn-sm">Create first job</Link>
                </div>
              </td></tr>
            ) : filtered.map(inv => (
              <tr key={inv.id}>
                <td><span style={{ fontWeight: 700, color: 'var(--primary-light)' }}>{inv.invoiceNumber}</span></td>
                <td style={{ color: 'var(--text-secondary)', fontSize: '0.8125rem' }}>{new Date(inv.date).toLocaleDateString()}</td>
                <td>{inv.customer?.name || <span style={{ color: 'var(--text-muted)' }}>Walk-in</span>}</td>
                <td style={{ color: 'var(--text-secondary)' }}>{inv.jobs?.length || 0} item(s)</td>
                <td style={{ fontWeight: 700 }}>Rs. {inv.totalAmount.toLocaleString()}</td>
                <td>{statusBadge(inv.paymentStatus)}</td>
                <td style={{ color: 'var(--text-secondary)', fontSize: '0.8125rem' }}>{paymentLabel[inv.paymentMethod] || '—'}</td>
                <td>
                  <div style={{ display: 'flex', gap: '0.375rem' }}>
                    <Link href={`/invoices/${inv.id}`} className="btn btn-secondary btn-sm">View</Link>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </AppShell>
  )
}
