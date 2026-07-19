'use client'
import { useEffect, useState } from 'react'
import { AppShell } from '@/components/AppShell'
import { CreditCard } from 'lucide-react'
import { Pagination } from '@/components/Pagination'
import Link from 'next/link'

export default function PaymentsPage() {
  const [invoices, setInvoices] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [statusFilter, setStatusFilter] = useState('UNPAID')
  const [showPayModal, setShowPayModal] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [currentPage, setCurrentPage] = useState(1)
  const [selected, setSelected] = useState<any>(null)
  const [payMethod, setPayMethod] = useState('CASH')
  const [saving, setSaving] = useState(false)

  function fetchInvoices() {
    fetch(`/api/invoices?status=${statusFilter}&limit=100`).then(r => r.json()).then(d => {
      setInvoices(d.invoices || [])
      setLoading(false)
    })
  }

  useEffect(() => { setLoading(true); fetchInvoices() }, [statusFilter])

  async function markPaid() {
    setSaving(true)
    await fetch(`/api/invoices/${selected.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ paymentStatus: 'PAID', paymentMethod: payMethod }),
    })
    setSaving(false); setShowPayModal(false); setSelected(null); fetchInvoices()
  }

  const paymentLabel: Record<string, string> = { CASH: 'Cash', BANK_TRANSFER: 'Bank Transfer', CARD: 'Card', ONLINE: 'Online Transfer', OTHER: 'Other' }

  const itemsPerPage = 10
  const filteredInvoices = invoices.filter(i => 
    i.invoiceNumber.toLowerCase().includes(searchQuery.toLowerCase()) || 
    (i.customer?.name || '').toLowerCase().includes(searchQuery.toLowerCase())
  )
  const paginatedInvoices = filteredInvoices.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage)

  useEffect(() => { setCurrentPage(1) }, [searchQuery, statusFilter])

  return (
    <AppShell>
      <div className="page-header">
        <div className="page-title-group">
          <h1 className="page-title">Payments</h1>
          <p className="page-subtitle">Track and record invoice payments</p>
        </div>
        <div className="page-actions">
          <input type="text" className="form-control" placeholder="Search invoices..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)} style={{ width: 250 }} />
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
        <div className="alert alert-warning mb-4">
          <span>⚠</span>
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
              <th>Amount</th>
              <th>Status</th>
              <th>Method</th>
              <th>Paid On</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={8} style={{ textAlign: 'center', padding: '3rem' }}><span className="spinner" /></td></tr>
            ) : filteredInvoices.length === 0 ? (
              <tr><td colSpan={8}><div className="empty-state"><div className="empty-state-icon"><CreditCard size={40} /></div><p>No invoices match this filter</p></div></td></tr>
            ) : paginatedInvoices.map(inv => (
              <tr key={inv.id}>
                <td><Link href={`/invoices/${inv.id}`} style={{ fontWeight: 700, color: 'var(--primary-light)' }}>{inv.invoiceNumber}</Link></td>
                <td style={{ color: 'var(--text-secondary)', fontSize: '0.8125rem' }}>{new Date(inv.date).toLocaleDateString()}</td>
                <td>{inv.customer?.name || <span style={{ color: 'var(--text-muted)' }}>Walk-in</span>}</td>
                <td style={{ fontWeight: 700 }}>Rs. {inv.totalAmount.toLocaleString()}</td>
                <td><span className={`badge ${inv.paymentStatus === 'PAID' ? 'badge-success' : 'badge-warning'}`}>{inv.paymentStatus}</span></td>
                <td style={{ color: 'var(--text-secondary)', fontSize: '0.8125rem' }}>{paymentLabel[inv.paymentMethod] || '-'}</td>
                <td style={{ color: 'var(--text-secondary)', fontSize: '0.8125rem' }}>
                  {inv.paymentDate ? new Date(inv.paymentDate).toLocaleDateString() : '-'}
                </td>
                <td>
                  {inv.paymentStatus !== 'PAID' ? (
                    <button className="btn btn-success btn-sm" onClick={() => { setSelected(inv); setShowPayModal(true) }}>
                      ✓ Mark Paid
                    </button>
                  ) : (
                    <Link href={`/invoices/${inv.id}`} className="btn btn-secondary btn-sm">View</Link>
                  )}
                </td>
              </tr>
            ))}
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

      {/* Pay Modal */}
      {showPayModal && selected && (
        <div className="modal-overlay" onClick={() => setShowPayModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Record Payment - {selected.invoiceNumber}</h3>
              <button className="btn btn-ghost" onClick={() => setShowPayModal(false)}>✕</button>
            </div>
            <div className="modal-body">
              <div className="form-group">
                <label className="form-label">Payment Method *</label>
                <select className="form-control" value={payMethod} onChange={e => setPayMethod(e.target.value)}>
                  <option value="CASH">Cash</option>
                  <option value="BANK_TRANSFER">Bank Transfer</option>
                  <option value="CARD">Card</option>
                  <option value="ONLINE">Online Transfer</option>
                  <option value="OTHER">Other</option>
                </select>
              </div>
              <div style={{ marginTop: '1rem', padding: '1rem', background: 'var(--bg-elevated)', borderRadius: 8, display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--text-secondary)' }}>Amount</span>
                <span style={{ fontWeight: 700, color: 'var(--primary-light)', fontSize: '1.125rem' }}>Rs. {selected.totalAmount.toLocaleString()}</span>
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setShowPayModal(false)}>Cancel</button>
              <button className="btn btn-success" onClick={markPaid} disabled={saving}>
                {saving ? <span className="spinner" /> : '✓'} Confirm Payment
              </button>
            </div>
          </div>
        </div>
      )}
    </AppShell>
  )
}
