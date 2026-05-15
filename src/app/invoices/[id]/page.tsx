'use client'
import { useEffect, useState } from 'react'
import { AppShell } from '@/components/AppShell'
import { useParams, useRouter } from 'next/navigation'

export default function InvoiceDetailPage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const [invoice, setInvoice] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [showPayModal, setShowPayModal] = useState(false)
  const [payMethod, setPayMethod] = useState('CASH')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    fetch(`/api/invoices/${id}`).then(r => r.json()).then(d => { setInvoice(d); setLoading(false) })
  }, [id])

  async function markPaid() {
    setSaving(true)
    const res = await fetch(`/api/invoices/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ paymentStatus: 'PAID', paymentMethod: payMethod }),
    })
    const data = await res.json()
    setInvoice(data); setShowPayModal(false); setSaving(false)
  }

  async function markUnpaid() {
    setSaving(true)
    const res = await fetch(`/api/invoices/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ paymentStatus: 'UNPAID', paymentMethod: null }),
    })
    const data = await res.json()
    setInvoice(data); setSaving(false)
  }

  function printInvoice() { window.print() }

  async function downloadPDF() {
    const { default: jsPDF } = await import('jspdf')
    const { default: autoTable } = await import('jspdf-autotable')
    const doc = new jsPDF()
    const inv = invoice

    doc.setFontSize(22); doc.setTextColor(21, 94, 150)
    doc.text('printax.lk', 14, 20)
    doc.setFontSize(10); doc.setTextColor(100, 100, 100)
    doc.text('Print Shop Management System', 14, 27)

    doc.setFontSize(18); doc.setTextColor(30, 30, 30)
    doc.text('INVOICE', 150, 22, { align: 'right' })

    doc.setFontSize(10); doc.setTextColor(80, 80, 80)
    doc.text(`Invoice #: ${inv.invoiceNumber}`, 150, 30, { align: 'right' })
    doc.text(`Date: ${new Date(inv.date).toLocaleDateString()}`, 150, 36, { align: 'right' })
    if (inv.dueDate) doc.text(`Due: ${new Date(inv.dueDate).toLocaleDateString()}`, 150, 42, { align: 'right' })

    if (inv.customer) {
      doc.setFontSize(10)
      doc.text('Bill To:', 14, 42)
      doc.setTextColor(30, 30, 30)
      doc.text(inv.customer.name, 14, 48)
      if (inv.customer.phone) doc.text(inv.customer.phone, 14, 54)
      if (inv.customer.email) doc.text(inv.customer.email, 14, 60)
    }

    const rows = inv.jobs.map((job: any) => [
      job.description,
      `${job.paperSize?.name || ''} ${job.printType} ${job.printMode}`,
      `${job.pages}p × ${job.copies}c`,
      job.pricingType.replace('_', ' '),
      `Rs. ${job.totalAmount.toLocaleString()}`,
    ])

    autoTable(doc, {
      startY: 70,
      head: [['Description', 'Spec', 'Qty', 'Type', 'Amount']],
      body: rows,
      styles: { fontSize: 9 },
      headStyles: { fillColor: [21, 94, 150] },
    })

    const finalY = (doc as any).lastAutoTable.finalY + 10
    doc.setFontSize(12); doc.setTextColor(30, 30, 30)
    doc.text(`Total: Rs. ${inv.totalAmount.toLocaleString()}`, 150, finalY, { align: 'right' })
    doc.setFontSize(10)
    doc.text(`Status: ${inv.paymentStatus}`, 150, finalY + 6, { align: 'right' })

    doc.save(`${inv.invoiceNumber}.pdf`)
  }

  if (loading) return <AppShell><div className="empty-state"><span className="spinner" style={{ width: 36, height: 36 }} /></div></AppShell>
  if (!invoice) return <AppShell><div className="empty-state"><p>Invoice not found</p></div></AppShell>

  const statusBadge = (s: string) => {
    const map: Record<string, string> = { PAID: 'badge-success', UNPAID: 'badge-warning', PARTIAL: 'badge-info' }
    return <span className={`badge ${map[s] || 'badge-muted'}`} style={{ fontSize: '0.875rem', padding: '0.375rem 0.875rem' }}>{s}</span>
  }

  const paymentLabel: Record<string, string> = { CASH: 'Cash', BANK_TRANSFER: 'Bank Transfer', CARD: 'Card', ONLINE: 'Online Transfer', OTHER: 'Other' }

  return (
    <AppShell>
      <style>{`@media print { .no-print { display: none !important; } .invoice-paper { box-shadow: none !important; margin: 0 !important; max-width: 100% !important; } }`}</style>

      <div className="page-header no-print">
        <div className="page-title-group">
          <h1 className="page-title">{invoice.invoiceNumber}</h1>
          <p className="page-subtitle">
            {new Date(invoice.date).toLocaleDateString('en-US', { weekday: 'short', year: 'numeric', month: 'long', day: 'numeric' })}
            {invoice.customer && ` · ${invoice.customer.name}`}
          </p>
        </div>
        <div className="page-actions">
          {invoice.paymentStatus !== 'PAID' && (
            <button className="btn btn-success" onClick={() => setShowPayModal(true)}>✓ Mark Paid</button>
          )}
          {invoice.paymentStatus === 'PAID' && (
            <button className="btn btn-secondary" onClick={markUnpaid} disabled={saving}>↩ Mark Unpaid</button>
          )}
          <button className="btn btn-secondary" onClick={printInvoice}>🖨 Print</button>
          <button className="btn btn-primary" onClick={downloadPDF}>⬇ Download PDF</button>
        </div>
      </div>

      {/* Invoice paper */}
      <div className="invoice-paper" style={{ margin: '0 auto' }}>
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '2rem' }}>
          <div>
            <img src="/logo.png" alt="printax.lk" style={{ height: '48px', marginBottom: '0.5rem', objectFit: 'contain' }} />
            <div style={{ color: '#666', fontSize: '0.875rem' }}>Print Shop Management System</div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: '1.5rem', fontWeight: 700, color: '#1a1a1a' }}>INVOICE</div>
            <div style={{ color: '#666', fontSize: '0.875rem', marginTop: '0.25rem' }}>
              <strong style={{ color: '#1a1a1a' }}>{invoice.invoiceNumber}</strong>
            </div>
          </div>
        </div>

        {/* Meta row */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '1.5rem', marginBottom: '2rem' }}>
          <div>
            <div style={{ fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: '#888', marginBottom: '0.25rem' }}>Bill To</div>
            {invoice.customer ? (
              <>
                <div style={{ fontWeight: 700, color: '#1a1a1a' }}>{invoice.customer.name}</div>
                {invoice.customer.phone && <div style={{ fontSize: '0.875rem', color: '#555' }}>{invoice.customer.phone}</div>}
                {invoice.customer.email && <div style={{ fontSize: '0.875rem', color: '#555' }}>{invoice.customer.email}</div>}
                {invoice.customer.address && <div style={{ fontSize: '0.875rem', color: '#555' }}>{invoice.customer.address}</div>}
              </>
            ) : <div style={{ color: '#555' }}>Walk-in Customer</div>}
          </div>
          <div>
            <div style={{ fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: '#888', marginBottom: '0.25rem' }}>Date</div>
            <div style={{ color: '#1a1a1a' }}>{new Date(invoice.date).toLocaleDateString()}</div>
            {invoice.dueDate && (
              <>
                <div style={{ fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: '#888', marginBottom: '0.25rem', marginTop: '0.75rem' }}>Due Date</div>
                <div style={{ color: '#1a1a1a' }}>{new Date(invoice.dueDate).toLocaleDateString()}</div>
              </>
            )}
          </div>
          <div>
            <div style={{ fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: '#888', marginBottom: '0.25rem' }}>Status</div>
            <div style={{
              display: 'inline-block', padding: '0.25rem 0.75rem',
              borderRadius: 999, fontSize: '0.75rem', fontWeight: 700,
              background: invoice.paymentStatus === 'PAID' ? '#d1fae5' : '#fef3c7',
              color: invoice.paymentStatus === 'PAID' ? '#065f46' : '#92400e',
            }}>{invoice.paymentStatus}</div>
            {invoice.paymentMethod && (
              <div style={{ fontSize: '0.8125rem', color: '#555', marginTop: '0.25rem' }}>{paymentLabel[invoice.paymentMethod] || invoice.paymentMethod}</div>
            )}
          </div>
        </div>

        {/* Jobs table */}
        <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '2rem' }}>
          <thead>
            <tr style={{ background: '#f3f4f6' }}>
              <th style={{ padding: '0.75rem 1rem', textAlign: 'left', fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: '#6b7280' }}>Description</th>
              <th style={{ padding: '0.75rem 1rem', textAlign: 'left', fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: '#6b7280' }}>Specification</th>
              <th style={{ padding: '0.75rem 1rem', textAlign: 'right', fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: '#6b7280' }}>Base</th>
              <th style={{ padding: '0.75rem 1rem', textAlign: 'right', fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: '#6b7280' }}>Extras</th>
              <th style={{ padding: '0.75rem 1rem', textAlign: 'right', fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: '#6b7280' }}>Total</th>
            </tr>
          </thead>
          <tbody>
            {invoice.jobs.map((job: any) => (
              <tr key={job.id} style={{ borderBottom: '1px solid #f3f4f6' }}>
                <td style={{ padding: '0.875rem 1rem', color: '#1a1a1a', fontWeight: 500 }}>{job.description}</td>
                <td style={{ padding: '0.875rem 1rem', color: '#6b7280', fontSize: '0.875rem' }}>
                  {job.paperSize?.name} · {job.printType === 'COLOR' ? 'Color' : 'B&W'} · {job.printMode === 'SINGLE' ? '1-Sided' : '2-Sided'}
                  <br/>{job.pages} pages × {job.copies} copies
                </td>
                <td style={{ padding: '0.875rem 1rem', textAlign: 'right', color: '#1a1a1a' }}>Rs. {job.baseAmount.toLocaleString()}</td>
                <td style={{ padding: '0.875rem 1rem', textAlign: 'right', color: '#6b7280' }}>
                  {job.additionalTotal > 0 ? `Rs. ${job.additionalTotal.toLocaleString()}` : '—'}
                </td>
                <td style={{ padding: '0.875rem 1rem', textAlign: 'right', fontWeight: 700, color: '#1a1a1a' }}>Rs. {job.totalAmount.toLocaleString()}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr style={{ background: '#f9fafb' }}>
              <td colSpan={4} style={{ padding: '1rem', textAlign: 'right', fontWeight: 700, fontSize: '1rem', color: '#1a1a1a' }}>TOTAL</td>
              <td style={{ padding: '1rem', textAlign: 'right', fontWeight: 800, fontSize: '1.125rem', color: '#132549' }}>Rs. {invoice.totalAmount.toLocaleString()}</td>
            </tr>
          </tfoot>
        </table>

        {invoice.notes && (
          <div style={{ padding: '1rem', background: '#f9fafb', borderRadius: 8, fontSize: '0.875rem', color: '#555' }}>
            <strong>Notes:</strong> {invoice.notes}
          </div>
        )}

        <div style={{ marginTop: '2.5rem', paddingTop: '1.5rem', borderTop: '1px solid #e5e7eb', display: 'flex', justifyContent: 'space-between', fontSize: '0.875rem', color: '#9ca3af' }}>
          <span>Thank you for your business!</span>
          <span>Generated by printax.lk</span>
        </div>
      </div>

      {/* Pay Modal */}
      {showPayModal && (
        <div className="modal-overlay" onClick={() => setShowPayModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Record Payment</h3>
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
                <span style={{ fontWeight: 700, color: 'var(--primary-light)' }}>Rs. {invoice.totalAmount.toLocaleString()}</span>
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
