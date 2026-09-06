'use client'
import { useEffect, useState } from 'react'
import { AppShell } from '@/components/AppShell'
import Link from 'next/link'
import { Pagination } from '@/components/Pagination'
import { FileText, Info, MessageSquare, Eye, Printer, X, Download, Check } from 'lucide-react'
import { useSession } from 'next-auth/react'
import { downloadStatementPDF, openStatementWhatsApp, MONTH_NAMES } from '@/lib/statementPdf'
import { WhatsAppModal } from '@/components/WhatsAppModal'

import { clientCache } from '@/lib/clientCache'

export default function StatementsPage() {
  const { data: session } = useSession()
  const isAdmin = session?.user?.role === 'ADMIN'

  const cachedData = clientCache.get('statements_all')
  const cachedCusts = clientCache.get('customers_all')
  const initialCustomers = Array.isArray(cachedCusts) ? cachedCusts.filter((c: any) => c.type === 'MONTHLY') : []

  const [statements, setStatements] = useState<any[]>(Array.isArray(cachedData) ? cachedData : [])
  const [customers, setCustomers] = useState<any[]>(initialCustomers)
  const [searchQuery, setSearchQuery] = useState('')
  const [loading, setLoading] = useState(!cachedData)
  const [showModal, setShowModal] = useState(false)
  const [saving, setSaving] = useState(false)
  const [whatsAppModalStmt, setWhatsAppModalStmt] = useState<any>(null)
  const [form, setForm] = useState({ customerId: '', month: new Date().getMonth() + 1, year: new Date().getFullYear(), dueDate: '' })
  const [availableInvoices, setAvailableInvoices] = useState<any[]>([])
  const [selectedInvoices, setSelectedInvoices] = useState<string[]>([])
  const [previewStatement, setPreviewStatement] = useState<any | null>(null)

  function fetchStatements() {
    const cached = clientCache.get('statements_all')
    if (!cached) setLoading(true)
    fetch('/api/statements')
      .then(r => r.json())
      .then(d => {
        if (Array.isArray(d)) {
          setStatements(d)
          clientCache.set('statements_all', d)
        }
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }

  useEffect(() => {
    fetchStatements()
    fetch('/api/customers?type=MONTHLY')
      .then(r => r.json())
      .then(d => {
        if (Array.isArray(d)) setCustomers(d)
      })
      .catch(() => {})
  }, [])

  useEffect(() => {
    if (form.customerId) {
      fetch(`/api/invoices?customerId=${form.customerId}&status=UNPAID&limit=200`)
        .then(r => r.json())
        .then(d => {
          const invs = d.invoices || []
          setAvailableInvoices(invs)
          setSelectedInvoices(invs.map((i: any) => i.id))
        })
        .catch(() => {})
    } else {
      setAvailableInvoices([])
      setSelectedInvoices([])
    }
  }, [form.customerId])

  async function generateStatement() {
    if (!form.customerId || selectedInvoices.length === 0) return
    setSaving(true)
    try {
      const res = await fetch('/api/statements', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...form, invoiceIds: selectedInvoices }),
      })
      setSaving(false)
      if (res.ok) {
        setShowModal(false)
        clientCache.invalidate('statements_all')
        clientCache.invalidate('invoices_all')
        clientCache.invalidate('dashboard_data')
        fetchStatements()
      } else {
        const d = await res.json()
        alert(d.error || 'Failed to generate statement')
      }
    } catch {
      setSaving(false)
      alert('Error generating statement')
    }
  }

  // Pagination
  const [currentPage, setCurrentPage] = useState(1)
  const itemsPerPage = 10

  const filteredStatements = statements.filter(s =>
    s.statementNo?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (s.customer?.name || '').toLowerCase().includes(searchQuery.toLowerCase())
  )
  const paginatedStatements = filteredStatements.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage)

  useEffect(() => { setCurrentPage(1) }, [searchQuery])

  async function markAsPaid(id: string) {
    if (window.confirm('Are you sure you want to mark this statement and all its invoices as PAID?')) {
      const res = await fetch(`/api/statements/${id}/pay`, { method: 'POST' })
      const data = await res.json()
      if (res.ok) {
        clientCache.invalidate('statements_all')
        clientCache.invalidate('invoices_all')
        clientCache.invalidate('dashboard_data')
        fetchStatements()
      } else {
        alert(data.error || 'Failed to mark as paid')
      }
    }
  }

  return (
    <AppShell>
      <div className="page-header">
        <div className="page-title-group">
          <h1 className="page-title">Monthly Statements</h1>
          <p className="page-subtitle">Generate and send consolidated statements to monthly customers</p>
        </div>
        <div className="page-actions" style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
          <input
            type="text"
            className="form-control"
            placeholder="Search statements..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            style={{ width: 250 }}
          />
          <button className="btn btn-primary" onClick={() => setShowModal(true)}>
            + Generate Statement
          </button>
        </div>
      </div>

      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        <div className="table-wrapper" style={{ margin: 0, border: 'none', borderRadius: 0 }}>
          <table>
            <thead>
              <tr>
                <th>Statement #</th>
                <th>Customer</th>
                <th>Period</th>
                <th>Invoices</th>
                <th>Total</th>
                <th>Status</th>
                <th>Due Date</th>
                <th style={{ textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading && statements.length === 0 ? (
                <tr>
                  <td colSpan={8} style={{ textAlign: 'center', padding: '3rem' }}>
                    <span className="spinner" />
                  </td>
                </tr>
              ) : filteredStatements.length === 0 ? (
                <tr>
                  <td colSpan={8}>
                    <div className="empty-state">
                      <div className="empty-state-icon"><FileText size={40} /></div>
                      <p>No statements generated yet</p>
                      <button onClick={() => setShowModal(true)} className="btn btn-primary btn-sm" style={{ marginTop: '0.5rem' }}>
                        Generate Statement
                      </button>
                    </div>
                  </td>
                </tr>
              ) : paginatedStatements.map(s => (
                <tr key={s.id}>
                  <td style={{ fontWeight: 700, color: '#000' }}>{s.statementNo}</td>
                  <td style={{ fontWeight: 600 }}>{s.customer?.name || '-'}</td>
                  <td style={{ color: 'var(--text-secondary)' }}>{MONTH_NAMES[(s.month || 1) - 1]} {s.year}</td>
                  <td style={{ color: 'var(--text-secondary)' }}>{s.invoices?.length || 0} invoices</td>
                  <td style={{ fontWeight: 700 }}>Rs. {(s.totalAmount || 0).toLocaleString()}</td>
                  <td>
                    <span className={`badge ${s.status === 'PAID' ? 'badge-success' : 'badge-warning'}`}>
                      {s.status}
                    </span>
                  </td>
                  <td style={{ color: 'var(--text-secondary)', fontSize: '0.8125rem' }}>
                    {s.dueDate ? new Date(s.dueDate).toLocaleDateString() : '-'}
                  </td>
                  <td style={{ textAlign: 'right' }}>
                    <div style={{ display: 'flex', gap: '0.35rem', justifyContent: 'flex-end', alignItems: 'center' }}>
                      <button
                        className="btn btn-secondary btn-sm"
                        onClick={() => setPreviewStatement(s)}
                        title="View Statement Preview"
                        style={{ padding: '0.35rem 0.55rem' }}
                      >
                        <Eye size={14} style={{ marginRight: '0.2rem' }} /> View
                      </button>
                      <button
                        className="btn btn-secondary btn-sm"
                        onClick={() => downloadStatementPDF(s)}
                        title="Download Statement PDF"
                        style={{ padding: '0.35rem 0.55rem', display: 'inline-flex', alignItems: 'center', gap: '0.25rem' }}
                      >
                        <Download size={13} /> PDF
                      </button>
                      <button
                        className="btn btn-sm"
                        onClick={() => setWhatsAppModalStmt(s)}
                        title="Send Statement to Customer via WhatsApp"
                        style={{
                          background: '#25D366',
                          color: '#fff',
                          border: 'none',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '0.25rem',
                          padding: '0.35rem 0.6rem',
                          fontWeight: 600
                        }}
                      >
                        <MessageSquare size={13} /> WhatsApp
                      </button>
                      {s.status !== 'PAID' && (
                        <button
                          className="btn btn-primary btn-sm"
                          onClick={() => markAsPaid(s.id)}
                          style={{ padding: '0.35rem 0.6rem', display: 'inline-flex', alignItems: 'center', gap: '0.25rem' }}
                        >
                          <Check size={13} /> Paid
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {!loading && filteredStatements.length > itemsPerPage && (
          <Pagination
            currentPage={currentPage}
            totalItems={filteredStatements.length}
            itemsPerPage={itemsPerPage}
            onPageChange={setCurrentPage}
          />
        )}
      </div>

      {/* Generate Modal */}
      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal modal-lg" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Generate Monthly Statement</h3>
              <button className="btn btn-ghost" onClick={() => setShowModal(false)}><X size={18} /></button>
            </div>
            <div className="modal-body">
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                <div className="form-row">
                  <div className="form-group">
                    <label className="form-label">Customer *</label>
                    <select
                      className="form-control"
                      value={form.customerId}
                      onChange={e => setForm(f => ({ ...f, customerId: e.target.value }))}
                    >
                      <option value="">Select monthly customer</option>
                      {customers.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                    </select>
                  </div>
                  <div className="form-group">
                    <label className="form-label">Month</label>
                    <select
                      className="form-control"
                      value={form.month}
                      onChange={e => setForm(f => ({ ...f, month: +e.target.value }))}
                    >
                      {MONTH_NAMES.map((m, i) => <option key={i} value={i + 1}>{m}</option>)}
                    </select>
                  </div>
                  <div className="form-group">
                    <label className="form-label">Year</label>
                    <input
                      type="number"
                      className="form-control"
                      value={form.year}
                      onChange={e => setForm(f => ({ ...f, year: +e.target.value }))}
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Due Date</label>
                    <input
                      type="date"
                      className="form-control"
                      value={form.dueDate}
                      onChange={e => setForm(f => ({ ...f, dueDate: e.target.value }))}
                    />
                  </div>
                </div>

                {form.customerId && availableInvoices.length > 0 && (
                  <div>
                    <div style={{ fontSize: '0.8125rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '0.5rem' }}>
                      Select Invoices ({selectedInvoices.length} of {availableInvoices.length} selected)
                    </div>
                    <div style={{ maxHeight: 280, overflowY: 'auto', border: '1px solid var(--border)', borderRadius: 8 }}>
                      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                        <thead>
                          <tr>
                            <th style={{ ...thStyle }}>
                              <input
                                type="checkbox"
                                checked={availableInvoices.length > 0 && selectedInvoices.length === availableInvoices.length}
                                onChange={e => setSelectedInvoices(e.target.checked ? availableInvoices.map((i: any) => i.id) : [])}
                              />
                            </th>
                            <th style={{ ...thStyle }}>Invoice #</th>
                            <th style={{ ...thStyle }}>Date</th>
                            <th style={{ ...thStyle }}>Amount</th>
                          </tr>
                        </thead>
                        <tbody>
                          {availableInvoices.map((inv: any) => (
                            <tr key={inv.id} style={{ borderBottom: '1px solid rgba(0,0,0,0.06)' }}>
                              <td style={{ padding: '0.5rem 0.75rem' }}>
                                <input
                                  type="checkbox"
                                  checked={selectedInvoices.includes(inv.id)}
                                  onChange={e => setSelectedInvoices(prev => e.target.checked ? [...prev, inv.id] : prev.filter(id => id !== inv.id))}
                                />
                              </td>
                              <td style={{ padding: '0.5rem 0.75rem', fontSize: '0.875rem', fontWeight: 600, color: '#000' }}>
                                {inv.invoiceNumber}
                              </td>
                              <td style={{ padding: '0.5rem 0.75rem', fontSize: '0.8125rem', color: 'var(--text-secondary)' }}>
                                {new Date(inv.date).toLocaleDateString()}
                              </td>
                              <td style={{ padding: '0.5rem 0.75rem', fontSize: '0.875rem', fontWeight: 600 }}>
                                Rs. {inv.totalAmount.toLocaleString()}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                    <div style={{ marginTop: '0.75rem', textAlign: 'right', fontWeight: 700, color: '#000' }}>
                      Total: Rs. {availableInvoices.filter(i => selectedInvoices.includes(i.id)).reduce((s: number, i: any) => s + i.totalAmount, 0).toLocaleString()}
                    </div>
                  </div>
                )}

                {form.customerId && availableInvoices.length === 0 && (
                  <div className="alert alert-info">
                    <Info size={16} /> No unpaid invoices found for this customer.
                  </div>
                )}
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setShowModal(false)}>Cancel</button>
              <button
                className="btn btn-primary"
                onClick={generateStatement}
                disabled={saving || !form.customerId || selectedInvoices.length === 0}
              >
                {saving ? <span className="spinner" /> : <FileText size={16} />} Generate Statement
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Statement Preview Modal */}
      {previewStatement && (
        <div
          className="modal-overlay"
          onClick={() => setPreviewStatement(null)}
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'rgba(0,0,0,0.6)',
            zIndex: 1000,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '1rem'
          }}
        >
          <div
            className="card"
            onClick={e => e.stopPropagation()}
            style={{
              width: '100%',
              maxWidth: '750px',
              maxHeight: '90vh',
              overflowY: 'auto',
              padding: '2rem',
              position: 'relative'
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1.5rem', borderBottom: '1px solid var(--border)', paddingBottom: '1rem' }}>
              <div>
                <h2 style={{ margin: 0, fontSize: '1.5rem', color: '#132549' }}>
                  {previewStatement.statementNo}
                </h2>
                <div style={{ fontSize: '0.875rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>
                  Statement for {MONTH_NAMES[(previewStatement.month || 1) - 1]} {previewStatement.year}
                </div>
              </div>
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <button
                  className="btn btn-secondary btn-sm"
                  onClick={() => downloadStatementPDF(previewStatement)}
                  style={{ display: 'inline-flex', alignItems: 'center', gap: '0.3rem' }}
                >
                  <Download size={14} /> Download PDF
                </button>
                <button
                  className="btn btn-sm"
                  onClick={() => setWhatsAppModalStmt(previewStatement)}
                  style={{
                    background: '#25D366',
                    color: '#fff',
                    border: 'none',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '0.3rem',
                    padding: '0.4rem 0.8rem',
                    fontWeight: 600
                  }}
                >
                  <MessageSquare size={14} /> Send WhatsApp
                </button>
                <button
                  className="btn btn-ghost btn-sm"
                  onClick={() => setPreviewStatement(null)}
                >
                  <X size={18} />
                </button>
              </div>
            </div>

            {/* Customer Details */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1.25rem', marginBottom: '1.5rem', background: '#f8fafc', padding: '1rem', borderRadius: '8px' }}>
              <div>
                <div style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Billed To</div>
                <div style={{ fontWeight: 700, fontSize: '1rem', color: '#000', marginTop: '0.2rem' }}>{previewStatement.customer?.name || 'Customer'}</div>
                {previewStatement.customer?.phone && (
                  <div style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)' }}>{previewStatement.customer.phone}</div>
                )}
                {previewStatement.customer?.email && (
                  <div style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)' }}>{previewStatement.customer.email}</div>
                )}
              </div>
              <div>
                <div style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Status</div>
                <div style={{ marginTop: '0.2rem' }}>
                  <span className={`badge ${previewStatement.status === 'PAID' ? 'badge-success' : 'badge-warning'}`}>
                    {previewStatement.status}
                  </span>
                </div>
                {previewStatement.dueDate && (
                  <div style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)', marginTop: '0.4rem' }}>
                    Due: {new Date(previewStatement.dueDate).toLocaleDateString()}
                  </div>
                )}
              </div>
            </div>

            {/* Invoices List */}
            <div style={{ marginBottom: '1.5rem' }}>
              <h4 style={{ marginBottom: '0.75rem' }}>Invoices Included ({previewStatement.invoices?.length || 0})</h4>
              <table style={{ width: '100%', borderCollapse: 'collapse', border: '1px solid var(--border)' }}>
                <thead>
                  <tr style={{ background: '#f1f5f9' }}>
                    <th style={{ padding: '0.6rem 0.8rem', textAlign: 'left', fontSize: '0.75rem' }}>#</th>
                    <th style={{ padding: '0.6rem 0.8rem', textAlign: 'left', fontSize: '0.75rem' }}>Invoice #</th>
                    <th style={{ padding: '0.6rem 0.8rem', textAlign: 'center', fontSize: '0.75rem' }}>Date</th>
                    <th style={{ padding: '0.6rem 0.8rem', textAlign: 'center', fontSize: '0.75rem' }}>Status</th>
                    <th style={{ padding: '0.6rem 0.8rem', textAlign: 'right', fontSize: '0.75rem' }}>Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {(previewStatement.invoices || []).map((inv: any, idx: number) => (
                    <tr key={inv.id || idx} style={{ borderBottom: '1px solid #e2e8f0' }}>
                      <td style={{ padding: '0.6rem 0.8rem', fontSize: '0.8125rem', color: 'var(--text-muted)' }}>{idx + 1}</td>
                      <td style={{ padding: '0.6rem 0.8rem', fontSize: '0.875rem', fontWeight: 600, color: '#000' }}>{inv.invoiceNumber}</td>
                      <td style={{ padding: '0.6rem 0.8rem', fontSize: '0.8125rem', textAlign: 'center', color: 'var(--text-secondary)' }}>
                        {inv.date ? new Date(inv.date).toLocaleDateString() : '-'}
                      </td>
                      <td style={{ padding: '0.6rem 0.8rem', fontSize: '0.8125rem', textAlign: 'center' }}>
                        <span className={`badge ${inv.paymentStatus === 'PAID' ? 'badge-success' : 'badge-warning'}`}>
                          {inv.paymentStatus || 'UNPAID'}
                        </span>
                      </td>
                      <td style={{ padding: '0.6rem 0.8rem', fontSize: '0.875rem', fontWeight: 700, textAlign: 'right' }}>
                        Rs. {(inv.totalAmount || 0).toLocaleString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr style={{ background: '#f8fafc' }}>
                    <td colSpan={4} style={{ padding: '0.75rem 0.8rem', textAlign: 'right', fontWeight: 700, fontSize: '0.95rem' }}>
                      Total Due:
                    </td>
                    <td style={{ padding: '0.75rem 0.8rem', textAlign: 'right', fontWeight: 800, fontSize: '1.1rem', color: '#132549' }}>
                      Rs. {(previewStatement.totalAmount || 0).toLocaleString()}.00
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem' }}>
              <button className="btn btn-secondary" onClick={() => setPreviewStatement(null)}>
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {whatsAppModalStmt && (
        <WhatsAppModal
          isOpen={!!whatsAppModalStmt}
          onClose={() => setWhatsAppModalStmt(null)}
          statement={whatsAppModalStmt}
        />
      )}
    </AppShell>
  )
}

const thStyle: React.CSSProperties = {
  padding: '0.625rem 0.75rem',
  textAlign: 'left',
  fontSize: '0.6875rem',
  fontWeight: 700,
  textTransform: 'uppercase',
  letterSpacing: '0.06em',
  color: 'var(--text-muted)',
  background: 'var(--bg-elevated)',
  borderBottom: '1px solid var(--border)',
}
