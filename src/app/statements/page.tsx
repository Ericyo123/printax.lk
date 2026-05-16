'use client'
import { useEffect, useState } from 'react'
import { AppShell } from '@/components/AppShell'
import Link from 'next/link'

const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December']

export default function StatementsPage() {
  const [statements, setStatements] = useState<any[]>([])
  const [customers, setCustomers] = useState<any[]>([])
  const [invoices, setInvoices] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({ customerId: '', month: new Date().getMonth() + 1, year: new Date().getFullYear(), dueDate: '' })
  const [availableInvoices, setAvailableInvoices] = useState<any[]>([])
  const [selectedInvoices, setSelectedInvoices] = useState<string[]>([])

  function fetchStatements() {
    fetch('/api/statements').then(r => r.json()).then(d => { setStatements(d); setLoading(false) })
  }

  useEffect(() => {
    fetchStatements()
    fetch('/api/customers?type=MONTHLY').then(r => r.json()).then(d => setCustomers(d))
  }, [])

  useEffect(() => {
    if (form.customerId) {
      fetch(`/api/invoices?customerId=${form.customerId}&status=UNPAID&limit=200`).then(r => r.json()).then(d => {
        setAvailableInvoices(d.invoices || [])
        setSelectedInvoices((d.invoices || []).map((i: any) => i.id))
      })
    }
  }, [form.customerId])

  async function generateStatement() {
    if (!form.customerId || selectedInvoices.length === 0) return
    setSaving(true)
    const res = await fetch('/api/statements', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...form, invoiceIds: selectedInvoices }),
    })
    setSaving(false)
    if (res.ok) { setShowModal(false); fetchStatements() }
    else { const d = await res.json(); alert(d.error) }
  }

  async function downloadStatementPDF(stmt: any) {
    try {
      const { default: jsPDF } = await import('jspdf')
      const { default: autoTable } = await import('jspdf-autotable')
      const doc = new jsPDF()

      // Load logo as base64 - Optional
      const getBase64 = (url: string): Promise<string> => {
        return new Promise((resolve) => {
          const img = new Image()
          img.onload = () => {
            try {
              const canvas = document.createElement('canvas')
              canvas.width = img.width
              canvas.height = img.height
              const ctx = canvas.getContext('2d')
              ctx?.drawImage(img, 0, 0)
              resolve(canvas.toDataURL('image/png'))
            } catch (e) { resolve('') }
          }
          img.onerror = () => resolve('')
          img.src = url
        })
      }

      const logoBase64 = await getBase64('/logo.png')

      const primaryColor = [21, 94, 150]
      const accentColor = [19, 37, 73]
      const greyColor = [100, 100, 100]

      // Header Background
      doc.setFillColor(primaryColor[0], primaryColor[1], primaryColor[2])
      doc.rect(0, 0, 210, 40, 'F')

      // Logo & Header Info
      if (logoBase64) {
        doc.addImage(logoBase64, 'PNG', 14, 12, 35, 12)
      } else {
        doc.setTextColor(255, 255, 255); doc.setFontSize(18); doc.setFont('helvetica', 'bold')
        doc.text('printax.lk', 14, 22)
      }
      doc.setTextColor(255, 255, 255)
      doc.setFontSize(10); doc.setFont('helvetica', 'normal')
      doc.text('Print Shop Management System', 14, 30)

    doc.setFontSize(22); doc.setFont('helvetica', 'bold')
    doc.text('MONTHLY STATEMENT', 196, 25, { align: 'right' })
    doc.setFontSize(10); doc.setFont('helvetica', 'normal')
    doc.text(stmt.statementNo, 196, 32, { align: 'right' })

    // Bill To & Statement Info
    let yPos = 55
    doc.setTextColor(accentColor[0], accentColor[1], accentColor[2])
    doc.setFontSize(12); doc.setFont('helvetica', 'bold')
    doc.text('STATEMENT FOR', 14, yPos)
    
    doc.text('BILLING PERIOD', 196, yPos, { align: 'right' })

    yPos += 8
    doc.setTextColor(30, 30, 30); doc.setFontSize(10); doc.setFont('helvetica', 'bold')
    doc.text(stmt.customer?.name || 'Customer', 14, yPos)
    
    doc.setFont('helvetica', 'normal')
    doc.text(`${MONTHS[stmt.month - 1]} ${stmt.year}`, 196, yPos, { align: 'right' })

    const rows = (stmt.invoices || []).map((inv: any) => [
      inv.invoiceNumber || '',
      inv.date ? new Date(inv.date).toLocaleDateString() : '',
      inv.jobs?.length || 0,
      inv.paymentStatus || '',
      `Rs. ${(inv.totalAmount || 0).toLocaleString()}`,
    ])

    try {
      autoTable(doc, {
        startY: yPos + 10,
        head: [['Invoice #', 'Date', 'Items', 'Status', 'Amount']],
        body: rows,
        theme: 'grid',
        styles: { fontSize: 9, cellPadding: 5 },
        headStyles: { fillColor: primaryColor, textColor: 255, fontStyle: 'bold' },
        columnStyles: {
          2: { halign: 'center' },
          4: { halign: 'right', fontStyle: 'bold' },
        },
        margin: { left: 14, right: 14 },
      })
    } catch (e) {
      console.error('Statement autoTable failed', e)
      doc.text('Table generation failed', 14, yPos + 10)
    }

    let finalY = ((doc as any).lastAutoTable?.finalY || yPos + 20) + 15
    
    // Summary Box
    doc.setFillColor(248, 250, 252)
    doc.rect(130, finalY - 5, 70, 30, 'F')
    doc.setDrawColor(226, 232, 240)
    doc.rect(130, finalY - 5, 70, 30, 'D')

    doc.setFontSize(14); doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]); doc.setFont('helvetica', 'bold')
    doc.text('TOTAL DUE:', 135, finalY + 10)
    doc.text(`Rs. ${(stmt.totalAmount || 0).toLocaleString()}`, 195, finalY + 10, { align: 'right' })

    finalY += 15
    const statusColor = stmt.status === 'PAID' ? [16, 185, 129] : [245, 158, 11]
    doc.setFontSize(10); doc.setTextColor(statusColor[0], statusColor[1], statusColor[2])
    doc.text(stmt.status || '', 195, finalY, { align: 'right' })

    // Footer Note
    doc.setFontSize(9); doc.setTextColor(greyColor[0], greyColor[1], greyColor[2]); doc.setFont('helvetica', 'italic')
    doc.text('Please make payment by the due date. Thank you!', 105, 280, { align: 'center' })

    doc.save(`${stmt.statementNo || 'statement'}.pdf`)
    } catch (err) {
      console.error('Statement PDF error:', err)
      alert('Failed to generate statement PDF. Please try again.')
    }
  }

  return (
    <AppShell>
      <div className="page-header">
        <div className="page-title-group">
          <h1 className="page-title">Monthly Statements</h1>
          <p className="page-subtitle">Generate consolidated billing for monthly customers</p>
        </div>
        <div className="page-actions">
          <button className="btn btn-primary" onClick={() => setShowModal(true)}>+ Generate Statement</button>
        </div>
      </div>

      <div className="table-wrapper">
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
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={8} style={{ textAlign: 'center', padding: '3rem' }}><span className="spinner" /></td></tr>
            ) : statements.length === 0 ? (
              <tr><td colSpan={8}><div className="empty-state"><div className="empty-state-icon">📋</div><p>No statements generated yet</p></div></td></tr>
            ) : statements.map(s => (
              <tr key={s.id}>
                <td style={{ fontWeight: 700, color: 'var(--primary-light)' }}>{s.statementNo}</td>
                <td style={{ fontWeight: 600 }}>{s.customer?.name || '—'}</td>
                <td style={{ color: 'var(--text-secondary)' }}>{MONTHS[s.month - 1]} {s.year}</td>
                <td style={{ color: 'var(--text-secondary)' }}>{s.invoices?.length} invoices</td>
                <td style={{ fontWeight: 700 }}>Rs. {s.totalAmount.toLocaleString()}</td>
                <td><span className={`badge ${s.status === 'PAID' ? 'badge-success' : 'badge-warning'}`}>{s.status}</span></td>
                <td style={{ color: 'var(--text-secondary)', fontSize: '0.8125rem' }}>
                  {s.dueDate ? new Date(s.dueDate).toLocaleDateString() : '—'}
                </td>
                <td>
                  <button className="btn btn-secondary btn-sm" onClick={() => downloadStatementPDF(s)}>⬇ PDF</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Generate Modal */}
      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal modal-lg" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Generate Monthly Statement</h3>
              <button className="btn btn-ghost" onClick={() => setShowModal(false)}>✕</button>
            </div>
            <div className="modal-body">
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                <div className="form-row">
                  <div className="form-group">
                    <label className="form-label">Customer *</label>
                    <select className="form-control" value={form.customerId} onChange={e => setForm(f => ({ ...f, customerId: e.target.value }))}>
                      <option value="">Select monthly customer</option>
                      {customers.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                    </select>
                  </div>
                  <div className="form-group">
                    <label className="form-label">Month</label>
                    <select className="form-control" value={form.month} onChange={e => setForm(f => ({ ...f, month: +e.target.value }))}>
                      {MONTHS.map((m, i) => <option key={i} value={i + 1}>{m}</option>)}
                    </select>
                  </div>
                  <div className="form-group">
                    <label className="form-label">Year</label>
                    <input type="number" className="form-control" value={form.year} onChange={e => setForm(f => ({ ...f, year: +e.target.value }))} />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Due Date</label>
                    <input type="date" className="form-control" value={form.dueDate} onChange={e => setForm(f => ({ ...f, dueDate: e.target.value }))} />
                  </div>
                </div>

                {form.customerId && availableInvoices.length > 0 && (
                  <div>
                    <div style={{ fontSize: '0.8125rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '0.5rem' }}>
                      Select Invoices ({selectedInvoices.length} of {availableInvoices.length} selected)
                    </div>
                    <div style={{ maxHeight: 280, overflowY: 'auto', border: '1px solid var(--border)', borderRadius: 8 }}>
                      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                        <thead><tr>
                          <th style={{ ...thStyle }}><input type="checkbox" checked={selectedInvoices.length === availableInvoices.length}
                            onChange={e => setSelectedInvoices(e.target.checked ? availableInvoices.map((i: any) => i.id) : [])} /></th>
                          <th style={{ ...thStyle }}>Invoice #</th>
                          <th style={{ ...thStyle }}>Date</th>
                          <th style={{ ...thStyle }}>Amount</th>
                        </tr></thead>
                        <tbody>
                          {availableInvoices.map((inv: any) => (
                            <tr key={inv.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                              <td style={{ padding: '0.5rem 0.75rem' }}>
                                <input type="checkbox" checked={selectedInvoices.includes(inv.id)}
                                  onChange={e => setSelectedInvoices(prev => e.target.checked ? [...prev, inv.id] : prev.filter(id => id !== inv.id))} />
                              </td>
                              <td style={{ padding: '0.5rem 0.75rem', fontSize: '0.875rem', fontWeight: 600, color: 'var(--primary-light)' }}>{inv.invoiceNumber}</td>
                              <td style={{ padding: '0.5rem 0.75rem', fontSize: '0.8125rem', color: 'var(--text-secondary)' }}>{new Date(inv.date).toLocaleDateString()}</td>
                              <td style={{ padding: '0.5rem 0.75rem', fontSize: '0.875rem', fontWeight: 600 }}>Rs. {inv.totalAmount.toLocaleString()}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                    <div style={{ marginTop: '0.75rem', textAlign: 'right', fontWeight: 700, color: 'var(--primary-light)' }}>
                      Total: Rs. {availableInvoices.filter(i => selectedInvoices.includes(i.id)).reduce((s: number, i: any) => s + i.totalAmount, 0).toLocaleString()}
                    </div>
                  </div>
                )}

                {form.customerId && availableInvoices.length === 0 && (
                  <div className="alert alert-info">
                    <span>ℹ</span> No unpaid invoices found for this customer.
                  </div>
                )}
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setShowModal(false)}>Cancel</button>
              <button className="btn btn-primary" onClick={generateStatement} disabled={saving || !form.customerId || selectedInvoices.length === 0}>
                {saving ? <span className="spinner" /> : '📋'} Generate Statement
              </button>
            </div>
          </div>
        </div>
      )}
    </AppShell>
  )
}

const thStyle: React.CSSProperties = {
  padding: '0.625rem 0.75rem', textAlign: 'left', fontSize: '0.6875rem',
  fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em',
  color: 'var(--text-muted)', background: 'var(--bg-elevated)', borderBottom: '1px solid var(--border)',
}
