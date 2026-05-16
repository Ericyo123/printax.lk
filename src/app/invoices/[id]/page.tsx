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
    try {
      const { default: jsPDF } = await import('jspdf')
      const { default: autoTable } = await import('jspdf-autotable')
      const doc = new jsPDF()
      const inv = invoice

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
              if (!ctx) return resolve('')
              ctx.drawImage(img, 0, 0)
              
              // Remove white background
              const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height)
              const data = imageData.data
              for (let i = 0; i < data.length; i += 4) {
                const r = data[i], g = data[i+1], b = data[i+2]
                if (r > 240 && g > 240 && b > 240) data[i+3] = 0
              }
              ctx.putImageData(imageData, 0, 0)
              resolve(canvas.toDataURL('image/png'))
            } catch (e) { resolve('') }
          }
          img.onerror = () => resolve('')
          img.src = url
        })
      }

      const logoBase64 = await getBase64('/logo.png')

      const settings = await fetch('/api/settings').then(res => res.json()).catch(() => ({}))
      
      const primaryColor = [21, 94, 160]
      const lightBlue = [240, 247, 255]
      const greyColor = [100, 100, 100]
      const darkText = [30, 30, 30]

      // Header
      doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2])
      doc.setFontSize(28); doc.setFont('helvetica', 'bold')
      doc.text('Invoice', 14, 25)

      // Logo on Top Right - STRETCHED VERTICALLY
      if (logoBase64) {
        doc.addImage(logoBase64, 'PNG', 150, 8, 45, 35)
      }

      // Invoice Details
      doc.setTextColor(darkText[0], darkText[1], darkText[2])
      doc.setFontSize(10); doc.setFont('helvetica', 'normal')
      
      let infoY = 40
      doc.text('Invoice No #', 14, infoY); doc.setFont('helvetica', 'bold'); doc.text(inv.invoiceNumber || '', 45, infoY)
      infoY += 6
      doc.setFont('helvetica', 'normal'); doc.text('Invoice Date', 14, infoY); doc.setFont('helvetica', 'bold'); doc.text(new Date(inv.date).toLocaleDateString(), 45, infoY)
      infoY += 6
      if (inv.dueDate) {
        doc.setFont('helvetica', 'normal'); doc.text('Due Date', 14, infoY); doc.setFont('helvetica', 'bold'); doc.text(new Date(inv.dueDate).toLocaleDateString(), 45, infoY)
      }

      // Address Boxes
      let boxY = 65
      // Billed By (Blue Theme)
      doc.setFillColor(lightBlue[0], lightBlue[1], lightBlue[2])
      doc.roundedRect(14, boxY, 90, 45, 3, 3, 'F')
      doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2])
      doc.setFontSize(14); doc.setFont('helvetica', 'bold')
      doc.text('Billed By', 18, boxY + 8)
      doc.setTextColor(darkText[0], darkText[1], darkText[2])
      doc.setFontSize(10); doc.setFont('helvetica', 'bold')
      doc.text(settings.businessName || 'Printax Solutions', 18, boxY + 15)
      doc.setFont('helvetica', 'normal')
      doc.text(settings.address || '132, Kolonnawa Road,\nDemetagoda,\nSri Lanka', 18, boxY + 22)

      // Billed To (Blue Theme)
      doc.setFillColor(lightBlue[0], lightBlue[1], lightBlue[2])
      doc.roundedRect(106, boxY, 90, 45, 3, 3, 'F')
      doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2])
      doc.setFontSize(14); doc.setFont('helvetica', 'bold')
      doc.text('Billed To', 110, boxY + 8)
      doc.setTextColor(darkText[0], darkText[1], darkText[2])
      doc.setFontSize(10); doc.setFont('helvetica', 'bold')
      doc.text(inv.customer?.name || 'Walk-in Customer', 110, boxY + 15)
      doc.setFont('helvetica', 'normal')
      if (inv.customer?.address) doc.text(inv.customer.address, 110, boxY + 22)
      doc.text('Sri Lanka', 110, boxY + (inv.customer?.address ? 32 : 22))

      const rows = (inv.jobs || []).map((job: any) => {
        const specs = `${job.paperSize?.name || ''}, ${job.printType || ''}, ${job.printMode || ''}`
        const services = (job.services || []).map((s: any) => s.customLabel || s.service?.name).join(', ')
        const description = `${job.description || ''}\n(${specs}${services ? ` + ${services}` : ''})`
        
        return [
          description,
          `${job.copies || 0}`,
          `Rs. ${((job.baseAmount + job.additionalTotal) / (job.copies || 1)).toLocaleString()}`,
          `Rs. ${(job.baseAmount + job.additionalTotal).toLocaleString()}`,
        ]
      })

      autoTable(doc, {
        startY: boxY + 55,
        head: [['Item Description', 'Quantity', 'Rate', 'Amount']],
        body: rows,
        theme: 'striped',
        headStyles: { fillColor: primaryColor, textColor: 255, fontStyle: 'bold' },
        styles: { fontSize: 9, cellPadding: 5 },
        columnStyles: {
          1: { halign: 'center' },
          2: { halign: 'right' },
          3: { halign: 'right', fontStyle: 'bold' },
        },
        margin: { left: 14, right: 14 },
      })

      let finalY = ((doc as any).lastAutoTable?.finalY || 180) + 15
      
      // Bank Details Box
      if (settings.bankName) {
        doc.setFillColor(lightBlue[0], lightBlue[1], lightBlue[2])
        doc.roundedRect(14, finalY - 5, 100, 50, 3, 3, 'F')
        doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2])
        doc.setFontSize(12); doc.setFont('helvetica', 'bold')
        doc.text('Bank Details', 18, finalY + 3)
        
        doc.setTextColor(darkText[0], darkText[1], darkText[2])
        doc.setFontSize(9); doc.setFont('helvetica', 'normal')
        let bankY = finalY + 10
        const details = [
          ['Account Name', settings.accountName],
          ['Account Number', settings.accountNumber],
          ['SWIFT Code', settings.swiftCode],
          ['Bank', settings.bankName],
          ['Branch', settings.branch]
        ].filter(d => d[1])
        
        details.forEach(([label, value]) => {
          doc.setFont('helvetica', 'bold'); doc.text(label, 18, bankY)
          doc.setFont('helvetica', 'normal'); doc.text(value, 55, bankY)
          bankY += 6
        })
      }

      // Summary
      doc.setTextColor(darkText[0], darkText[1], darkText[2])
      doc.setFontSize(10); doc.setFont('helvetica', 'normal')
      
      const totalDiscount = (inv.jobs || []).reduce((sum: number, job: any) => sum + (job.discount || 0), 0)
      const subtotal = (inv.totalAmount || 0) + totalDiscount

      doc.text('Subtotal:', 140, finalY)
      doc.text(`Rs. ${subtotal.toLocaleString()}`, 196, finalY, { align: 'right' })

      if (totalDiscount > 0) {
        finalY += 7
        doc.setTextColor(239, 68, 68)
        doc.text('Discount:', 140, finalY)
        doc.text(`- Rs. ${totalDiscount.toLocaleString()}`, 196, finalY, { align: 'right' })
      }

      finalY += 12
      doc.setDrawColor(primaryColor[0], primaryColor[1], primaryColor[2])
      doc.setLineWidth(0.5)
      doc.line(130, finalY - 5, 196, finalY - 5)
      
      doc.setFontSize(14); doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]); doc.setFont('helvetica', 'bold')
      doc.text('TOTAL:', 130, finalY + 2)
      doc.text(`Rs. ${(inv.totalAmount || 0).toLocaleString()}.00`, 196, finalY + 2, { align: 'right' })

      finalY += 8
      const statusColor = inv.paymentStatus === 'PAID' ? [16, 185, 129] : [245, 158, 11]
      doc.setFontSize(10); doc.setTextColor(statusColor[0], statusColor[1], statusColor[2])
      doc.text(inv.paymentStatus || '', 196, finalY + 2, { align: 'right' })

      // Footer
      doc.setFontSize(9); doc.setTextColor(greyColor[0], greyColor[1], greyColor[2]); doc.setFont('helvetica', 'normal')
      doc.text(`132, Kolonnawa Road Demetagoda  |  Phone: ${settings.phone || ''}  |  Email: ${settings.email || ''}`, 105, 285, { align: 'center' })

      doc.save(`${inv.invoiceNumber || 'invoice'}.pdf`)
    } catch (err) {
      console.error('PDF error:', err)
      alert('Failed to generate PDF. Please try again or use the Print button.')
    }
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
                  {job.discount > 0 && <div style={{ color: '#ef4444', fontWeight: 600 }}>Discount: -Rs. {job.discount.toLocaleString()}</div>}
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
            {invoice.jobs.some((j: any) => j.discount > 0) && (
              <tr style={{ background: '#fff' }}>
                <td colSpan={4} style={{ padding: '0.5rem 1rem', textAlign: 'right', color: '#ef4444', fontSize: '0.875rem', fontWeight: 600 }}>
                  TOTAL DISCOUNT
                </td>
                <td style={{ padding: '0.5rem 1rem', textAlign: 'right', color: '#ef4444', fontWeight: 700 }}>
                  -Rs. {invoice.jobs.reduce((s: number, j: any) => s + (j.discount || 0), 0).toLocaleString()}
                </td>
              </tr>
            )}
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
