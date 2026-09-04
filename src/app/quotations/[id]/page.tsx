'use client'
import { useEffect, useState } from 'react'
import { AppShell } from '@/components/AppShell'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, Printer, Download, ArrowRightCircle, CheckCircle, Clock, Trash2, Edit3, User, Calendar, FileText } from 'lucide-react'

import { clientCache } from '@/lib/clientCache'

export default function QuotationDetailPage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const [quotation, setQuotation] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [updating, setUpdating] = useState(false)
  const [converting, setConverting] = useState(false)

  function fetchQuotation() {
    fetch(`/api/quotations/${id}`)
      .then(r => r.json())
      .then(d => { setQuotation(d); setLoading(false) })
      .catch(console.error)
  }

  useEffect(() => {
    fetchQuotation()
  }, [id])

  async function updateStatus(newStatus: string) {
    if (!window.confirm(`Update quotation status to ${newStatus}?`)) return
    setUpdating(true)
    const res = await fetch(`/api/quotations/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: newStatus }),
    })
    const data = await res.json()
    setUpdating(false)
    if (res.ok) {
      setQuotation(data)
      clientCache.invalidate('quotations_all')
      clientCache.invalidate('dashboard_data')
    } else {
      alert('Failed to update status')
    }
  }

  async function convertToInvoice() {
    if (!window.confirm('Are you sure you want to convert this quotation to an active invoice?')) return
    setConverting(true)
    try {
      const res = await fetch(`/api/quotations/${id}/convert`, { method: 'POST' })
      const data = await res.json()
      setConverting(false)
      if (res.ok && data.invoice) {
        clientCache.invalidate('quotations_all')
        clientCache.invalidate('invoices_all')
        clientCache.invalidate('dashboard_data')
        router.push(`/invoices/${data.invoice.id}`)
      } else {
        alert(data.error || 'Failed to convert quotation')
      }
    } catch {
      setConverting(false)
      alert('Network error while converting quotation')
    }
  }

  function printQuotation() {
    window.print()
  }

  async function downloadPDF() {
    try {
      const { generateQuotationPDF } = await import('@/lib/generateQuotationPDF')
      await generateQuotationPDF(quotation)
    } catch (e) {
      console.error('PDF export error', e)
      alert('Failed to generate PDF')
    }
  }

  if (loading) {
    return (
      <AppShell>
        <div style={{ textAlign: 'center', padding: '4rem' }}><span className="spinner" /></div>
      </AppShell>
    )
  }

  if (!quotation) {
    return (
      <AppShell>
        <div className="card" style={{ textAlign: 'center', padding: '3rem' }}>
          <h3>Quotation Not Found</h3>
          <Link href="/quotations" className="btn btn-primary" style={{ marginTop: '1rem' }}>Back to Quotations</Link>
        </div>
      </AppShell>
    )
  }

  const fmt = (n: number) => `Rs. ${(n || 0).toLocaleString('en-LK', { minimumFractionDigits: 2 })}`
  const customerDisplay = quotation.customer?.name || quotation.customerName || 'Walk-in Customer'
  const subtotal = quotation.items.reduce((s: number, i: any) => s + i.totalAmount, 0)

  return (
    <AppShell>
      <div className="page-header">
        <div className="page-title-group">
          <Link href="/quotations" className="btn btn-secondary btn-sm" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem', marginBottom: '0.5rem' }}>
            <ArrowLeft size={16} /> Back to Quotations
          </Link>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <h1 className="page-title">{quotation.quotationNumber}</h1>
            <span className={`badge ${quotation.status === 'ACCEPTED' ? 'badge-success' : quotation.status === 'CONVERTED' ? 'badge-purple' : 'badge-warning'}`}>
              {quotation.status}
            </span>
          </div>
          <p className="page-subtitle">Created on {new Date(quotation.date).toLocaleDateString('en-GB')}</p>
        </div>

        <div className="page-actions" style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
          <button className="btn btn-secondary" onClick={printQuotation} style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
            <Printer size={16} /> Print
          </button>
          <button className="btn btn-secondary" onClick={downloadPDF} style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
            <Download size={16} /> Download PDF
          </button>

          {quotation.status !== 'CONVERTED' ? (
            <button
              className="btn btn-primary"
              onClick={convertToInvoice}
              disabled={converting}
              style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}
            >
              <ArrowRightCircle size={16} />
              {converting ? 'Converting...' : 'Convert to Invoice'}
            </button>
          ) : (
            quotation.invoices?.[0] && (
              <Link href={`/invoices/${quotation.invoices[0].id}`} className="btn btn-primary" style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                <CheckCircle size={16} /> View Converted Invoice ({quotation.invoices[0].invoiceNumber})
              </Link>
            )
          )}
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) 300px', gap: '1.5rem', alignItems: 'start' }}>
        {/* Main Left Details */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          {/* Client Overview Card */}
          <div className="card">
            <h3 style={{ marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <User size={18} color="var(--primary)" /> Client Information
            </h3>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem' }}>
              <div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Client Name</div>
                <div style={{ fontWeight: 600, fontSize: '1.05rem' }}>{customerDisplay}</div>
              </div>
              <div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Phone Number</div>
                <div style={{ fontWeight: 500, fontSize: '1rem' }}>{quotation.customerPhone || quotation.customer?.phone || '—'}</div>
              </div>
            </div>
          </div>

          {/* Line Items Table */}
          <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
            <div style={{ padding: '1.25rem 1.25rem 0.5rem 1.25rem' }}>
              <h3>Quotation Items</h3>
            </div>
            <div className="table-wrapper" style={{ margin: 0, border: 'none', borderRadius: 0 }}>
              <table>
                <thead>
                  <tr>
                    <th>#</th>
                    <th>Description</th>
                    <th style={{ textAlign: 'center' }}>Qty</th>
                    <th style={{ textAlign: 'right' }}>Unit Rate (Rs.)</th>
                    <th style={{ textAlign: 'right' }}>Total (Rs.)</th>
                  </tr>
                </thead>
                <tbody>
                  {quotation.items.map((item: any, i: number) => (
                    <tr key={item.id || i}>
                      <td>{i + 1}</td>
                      <td>
                        <strong style={{ display: 'block' }}>{item.description}</strong>
                        {item.notes && <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{item.notes}</span>}
                      </td>
                      <td style={{ textAlign: 'center' }}>{item.copies || 1}</td>
                      <td style={{ textAlign: 'right' }}>{item.unitPrice > 0 ? fmt(item.unitPrice) : '—'}</td>
                      <td style={{ textAlign: 'right', fontWeight: 600 }}>{fmt(item.totalAmount)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Calculations Footer */}
            <div style={{ padding: '1.25rem', borderTop: '1px solid var(--border)', background: 'var(--bg-base)' }}>
              <div style={{ maxWidth: '320px', marginLeft: 'auto', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.9rem' }}>
                  <span>Subtotal:</span>
                  <span>{fmt(subtotal)}</span>
                </div>
                {quotation.discount > 0 && (
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.9rem', color: 'var(--danger)' }}>
                    <span>Discount:</span>
                    <span>- {fmt(quotation.discount)}</span>
                  </div>
                )}
                <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '2px solid var(--border)', paddingTop: '0.5rem', fontWeight: 700, fontSize: '1.15rem' }}>
                  <span>Total Estimate:</span>
                  <span style={{ color: 'var(--primary)' }}>{fmt(quotation.totalAmount)}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Notes and Terms */}
          {quotation.notes && (
            <div className="card">
              <h4 style={{ marginBottom: '0.5rem' }}>Terms & Client Notes</h4>
              <p style={{ whiteSpace: 'pre-wrap', color: 'var(--text-secondary)' }}>{quotation.notes}</p>
            </div>
          )}
        </div>

        {/* Sidebar Actions Right */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          {/* Status Control Card */}
          <div className="card">
            <h4 style={{ marginBottom: '0.75rem' }}>Quotation Status</h4>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              {['DRAFT', 'SENT', 'ACCEPTED', 'REJECTED'].map(st => (
                <button
                  key={st}
                  disabled={updating || quotation.status === 'CONVERTED'}
                  onClick={() => updateStatus(st)}
                  className={`btn btn-sm ${quotation.status === st ? 'btn-primary' : 'btn-secondary'}`}
                  style={{ width: '100%', justifyContent: 'center' }}
                >
                  Mark as {st}
                </button>
              ))}
            </div>
          </div>

          {/* Validity Card */}
          <div className="card">
            <h4 style={{ marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
              <Calendar size={15} /> Validity Period
            </h4>
            <div style={{ fontSize: '0.9rem' }}>
              {quotation.validUntil ? (
                <>Valid until <strong>{new Date(quotation.validUntil).toLocaleDateString('en-GB')}</strong></>
              ) : (
                <span style={{ color: 'var(--text-muted)' }}>No expiration date set</span>
              )}
            </div>
          </div>
        </div>
      </div>
    </AppShell>
  )
}
