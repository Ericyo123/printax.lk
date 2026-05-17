'use client'
import { useEffect, useState } from 'react'
import { AppShell } from '@/components/AppShell'
import { useRouter } from 'next/navigation'
import { calculateBaseAmount } from '@/lib/pricing'

interface PaperSize { id: string; name: string }
interface PricingRule { paperSizeId: string; printType: string; pricePerPage: number; pricePerCopy: number; pricePerBook: number }
interface Service { id: string; name: string; price: number }
interface Customer { id: string; name: string; type: string }

export default function NewJobPage() {
  const router = useRouter()
  const [pricingData, setPricingData] = useState<{ paperSizes: PaperSize[]; rules: PricingRule[]; services: Service[] } | null>(null)
  const [customers, setCustomers] = useState<Customer[]>([])
  const [loading, setLoading] = useState(false)

  // Form state
  const [description, setDescription] = useState('')
  const [paperSizeId, setPaperSizeId] = useState('')
  const [printType, setPrintType] = useState<'COLOR' | 'BW'>('BW')
  const [printMode, setPrintMode] = useState<'SINGLE' | 'DOUBLE'>('SINGLE')
  const [pages, setPages] = useState(1)
  const [copies, setCopies] = useState(1)
  const [pricingType, setPricingType] = useState<'PER_PAGE' | 'PER_COPY' | 'PER_BOOK' | 'MANUAL'>('PER_PAGE')
  const [manualPrice, setManualPrice] = useState(0)
  const [selectedServices, setSelectedServices] = useState<Record<string, boolean>>({})
  const [customServices, setCustomServices] = useState<{ label: string; amount: number }[]>([])
  const [customLabel, setCustomLabel] = useState('')
  const [customAmount, setCustomAmount] = useState<number>(0)
  const [customerId, setCustomerId] = useState('')
  const [notes, setNotes] = useState('')
  const [createInvoice, setCreateInvoice] = useState(true)
  const [markPaid, setMarkPaid] = useState(false)
  const [paymentMethod, setPaymentMethod] = useState('')
  const [dueDate, setDueDate] = useState('')
  const [discount, setDiscount] = useState(0)

  // Consolidated Job Cart State
  const [jobsList, setJobsList] = useState<any[]>([])
  const [invoiceDiscount, setInvoiceDiscount] = useState(0)

  // Derived (Current active job form)
  const currentRule = pricingData?.rules.find(r => r.paperSizeId === paperSizeId && r.printType === printType)
  const baseAmount = currentRule
    ? calculateBaseAmount(currentRule, pricingType, pages, copies, printMode, manualPrice)
    : (pricingType === 'MANUAL' ? manualPrice : 0)
  const servicesTotal = (pricingData?.services || [])
    .filter(s => selectedServices[s.id])
    .reduce((acc, s) => acc + s.price, 0)
  const customTotal = customServices.reduce((acc, s) => acc + s.amount, 0)
  const total = Math.max(0, baseAmount + servicesTotal + customTotal - discount)

  // Derived (Consolidated invoice)
  const cartSubtotal = jobsList.reduce((acc, j) => acc + j.totalAmount, 0)
  const invoiceTotal = jobsList.length > 0 
    ? Math.max(0, cartSubtotal - invoiceDiscount)
    : Math.max(0, total - invoiceDiscount)

  const selectedCustomer = customers.find(c => c.id === customerId)
  const isMonthly = selectedCustomer?.type === 'MONTHLY'

  useEffect(() => {
    Promise.all([
      fetch('/api/pricing').then(r => r.json()),
      fetch('/api/customers').then(r => r.json()),
    ]).then(([pd, custs]) => {
      setPricingData(pd)
      setCustomers(custs)
      if (pd.paperSizes?.length) setPaperSizeId(pd.paperSizes[0].id)
    })
  }, [])

  function addCustomService() {
    if (!customLabel.trim() || customAmount <= 0) return
    setCustomServices(prev => [...prev, { label: customLabel, amount: customAmount }])
    setCustomLabel(''); setCustomAmount(0)
  }

  function addJobToInvoice() {
    if (!description.trim() || !paperSizeId) {
      alert('Please enter a description and select a paper size first.')
      return
    }

    const svcList = (pricingData?.services || [])
      .filter(s => selectedServices[s.id])
      .map(s => ({ serviceId: s.id, amount: s.price, name: s.name }))

    const newJobItem = {
      description,
      paperSizeId,
      paperSizeName: pricingData?.paperSizes.find(p => p.id === paperSizeId)?.name || '',
      printType,
      printMode,
      pages,
      copies,
      pricingType,
      manualPrice: pricingType === 'MANUAL' ? manualPrice : undefined,
      services: svcList,
      customServices: [...customServices],
      discount,
      baseAmount,
      additionalTotal: servicesTotal + customTotal,
      totalAmount: total,
      notes,
    }

    setJobsList(prev => [...prev, newJobItem])

    // Reset job details form
    setDescription('')
    setPages(1)
    setCopies(1)
    setNotes('')
    setDiscount(0)
    setSelectedServices({})
    setCustomServices([])
    setManualPrice(0)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()

    let finalJobs = [...jobsList]

    // If cart is empty, auto-add current form inputs if filled
    if (finalJobs.length === 0) {
      if (!description.trim() || !paperSizeId) {
        alert('Please complete the job details form or add at least one job to the invoice cart first.')
        return
      }
      
      const svcList = (pricingData?.services || [])
        .filter(s => selectedServices[s.id])
        .map(s => ({ serviceId: s.id, amount: s.price }))

      const currentJobItem = {
        description,
        paperSizeId,
        printType,
        printMode,
        pages,
        copies,
        pricingType,
        manualPrice: pricingType === 'MANUAL' ? manualPrice : undefined,
        services: svcList,
        customServices,
        discount,
        notes,
      }
      finalJobs.push(currentJobItem)
    } else {
      // If there are already items in the cart AND the active form has a description, auto-add it too!
      if (description.trim() && paperSizeId) {
        const svcList = (pricingData?.services || [])
          .filter(s => selectedServices[s.id])
          .map(s => ({ serviceId: s.id, amount: s.price }))

        const currentJobItem = {
          description,
          paperSizeId,
          printType,
          printMode,
          pages,
          copies,
          pricingType,
          manualPrice: pricingType === 'MANUAL' ? manualPrice : undefined,
          services: svcList,
          customServices,
          discount,
          notes,
        }
        finalJobs.push(currentJobItem)
      }
    }

    setLoading(true)

    // Build consolidated invoice payload
    const body = {
      customerId: customerId || undefined,
      dueDate: (createInvoice && !markPaid && dueDate) ? dueDate : undefined,
      paymentMethod: (createInvoice && markPaid) ? paymentMethod : undefined,
      paymentStatus: (createInvoice && markPaid) ? 'PAID' : 'UNPAID',
      notes: notes || undefined, // or overall invoice notes
      jobs: finalJobs.map(j => ({
        description: j.description,
        paperSizeId: j.paperSizeId,
        printType: j.printType,
        printMode: j.printMode,
        pages: j.pages,
        copies: j.copies,
        pricingType: j.pricingType,
        manualPrice: j.manualPrice,
        services: j.services.map((s: any) => ({ serviceId: s.serviceId, amount: s.amount })),
        customServices: j.customServices,
        discount: j.discount,
        notes: j.notes
      })),
      discount: invoiceDiscount,
    }

    try {
      const res = await fetch('/api/invoices', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      })
      const data = await res.json()
      setLoading(false)
      if (res.ok && data.invoice) {
        router.push(`/invoices/${data.invoice.id}`)
      } else {
        alert(data.error || 'Failed to create invoice. The database might be full or offline. Please contact support.')
      }
    } catch (err) {
      setLoading(false)
      alert('Network error occurred. Failed to submit invoice.')
    }
  }

  const fmt = (n: number) => n.toLocaleString('en-LK', { minimumFractionDigits: 2 })

  return (
    <AppShell>
      <div className="page-header">
        <div className="page-title-group">
          <h1 className="page-title">New Print Job</h1>
          <p className="page-subtitle">Enter job details and calculate price</p>
        </div>
      </div>

      <form onSubmit={handleSubmit}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 360px', gap: '1.5rem', alignItems: 'start' }}>
          {/* Left: Job Details */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
            {/* Job info */}
            <div className="card">
              <h3 style={{ marginBottom: '1.25rem' }}>Job Details</h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                <div className="form-group">
                  <label className="form-label">Description *</label>
                  <input className="form-control" placeholder="e.g. Assignment printing, Report copies..." value={description} onChange={e => setDescription(e.target.value)} />
                </div>
                <div className="form-row">
                  <div className="form-group">
                    <label className="form-label">Paper Size *</label>
                    <select className="form-control" value={paperSizeId} onChange={e => setPaperSizeId(e.target.value)}>
                      <option value="">Select size</option>
                      {pricingData?.paperSizes.map(ps => <option key={ps.id} value={ps.id}>{ps.name}</option>)}
                    </select>
                  </div>
                  <div className="form-group">
                    <label className="form-label">Print Type</label>
                    <div style={{ display: 'flex', gap: '0.5rem' }}>
                      {(['BW', 'COLOR'] as const).map(t => (
                        <button key={t} type="button"
                          onClick={() => setPrintType(t)}
                          className={`btn ${printType === t ? 'btn-primary' : 'btn-secondary'}`}
                          style={{ flex: 1, justifyContent: 'center' }}>
                          {t === 'BW' ? '⬛ B&W' : '🎨 Color'}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
                <div className="form-row">
                  <div className="form-group">
                    <label className="form-label">Print Mode</label>
                    <div style={{ display: 'flex', gap: '0.5rem' }}>
                      {(['SINGLE', 'DOUBLE'] as const).map(m => (
                        <button key={m} type="button" onClick={() => setPrintMode(m)}
                          className={`btn ${printMode === m ? 'btn-primary' : 'btn-secondary'}`} style={{ flex: 1, justifyContent: 'center' }}>
                          {m === 'SINGLE' ? '1-Sided' : '2-Sided'}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className="form-group">
                    <label className="form-label">Pricing Type</label>
                    <select className="form-control" value={pricingType} onChange={e => setPricingType(e.target.value as any)}>
                      <option value="PER_PAGE">Per Page</option>
                      <option value="PER_COPY">Per Copy</option>
                      <option value="PER_BOOK">Per Book</option>
                      <option value="MANUAL">Manual</option>
                    </select>
                  </div>
                </div>
                <div className="form-row">
                  <div className="form-group">
                    <label className="form-label">Pages</label>
                    <input type="number" min={1} className="form-control" value={pages} onChange={e => setPages(Math.max(1, +e.target.value))} />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Copies</label>
                    <input type="number" min={1} className="form-control" value={copies} onChange={e => setCopies(Math.max(1, +e.target.value))} />
                  </div>
                  {pricingType === 'MANUAL' && (
                    <div className="form-group">
                      <label className="form-label">Manual Price (Rs.)</label>
                      <input type="number" min={0} step="0.01" className="form-control" value={manualPrice} onChange={e => setManualPrice(+e.target.value)} />
                    </div>
                  )}
                </div>
                <div className="form-group">
                  <label className="form-label">Notes</label>
                  <textarea className="form-control" placeholder="Additional notes for this job..." value={notes} onChange={e => setNotes(e.target.value)} rows={2} />
                </div>
                <div style={{ marginTop: '0.5rem' }}>
                  <button type="button" className="btn btn-secondary w-full" onClick={addJobToInvoice} style={{ justifyContent: 'center', background: 'rgba(21, 94, 160, 0.1)', color: 'var(--primary-light)', border: '1px dashed var(--primary-light)', fontWeight: 600 }}>
                    ➕ Add Job to Invoice
                  </button>
                </div>
              </div>
            </div>

            {/* Additional services */}
            <div className="card">
              <h3 style={{ marginBottom: '1.25rem' }}>Additional Services</h3>
              {pricingData?.services && pricingData.services.length > 0 && (
                <div className="checkbox-list mb-4">
                  {pricingData.services.filter(s => s.price > 0).map(s => (
                    <label key={s.id} className="checkbox-item">
                      <input type="checkbox" checked={!!selectedServices[s.id]}
                        onChange={e => setSelectedServices(prev => ({ ...prev, [s.id]: e.target.checked }))} />
                      <span style={{ flex: 1, fontSize: '0.875rem' }}>{s.name}</span>
                      <span style={{ fontSize: '0.8125rem', color: 'var(--primary-light)', fontWeight: 600 }}>Rs. {s.price}</span>
                    </label>
                  ))}
                </div>
              )}

              <div style={{ borderTop: '1px solid var(--border)', paddingTop: '1rem' }}>
                <div style={{ fontSize: '0.8125rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '0.75rem' }}>Custom Charge</div>
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  <input className="form-control" placeholder="Label (e.g. Spiral binding)" value={customLabel} onChange={e => setCustomLabel(e.target.value)} style={{ flex: 2 }} />
                  <input type="number" min={0} step="0.01" className="form-control" placeholder="Amount" value={customAmount || ''} onChange={e => setCustomAmount(+e.target.value)} style={{ flex: 1 }} />
                  <button type="button" className="btn btn-secondary" onClick={addCustomService}>Add</button>
                </div>
                {customServices.length > 0 && (
                  <div style={{ marginTop: '0.75rem', display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                    {customServices.map((s, i) => (
                      <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.375rem 0.625rem', background: 'var(--bg-elevated)', borderRadius: 6, fontSize: '0.8125rem' }}>
                        <span>{s.label}</span>
                        <span style={{ color: 'var(--primary-light)', fontWeight: 600 }}>Rs. {s.amount}</span>
                        <button type="button" className="btn btn-ghost" style={{ padding: '0.125rem 0.375rem', fontSize: '0.75rem' }}
                          onClick={() => setCustomServices(prev => prev.filter((_, j) => j !== i))}>✕</button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Job Cart */}
            {jobsList.length > 0 && (
              <div className="card" style={{ borderColor: 'var(--primary)' }}>
                <h3 style={{ marginBottom: '1rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    🛒 Job Cart <span className="badge badge-info" style={{ fontSize: '0.75rem', padding: '0.125rem 0.5rem', borderRadius: 999 }}>{jobsList.length}</span>
                  </span>
                  <span style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--primary-light)' }}>
                    Subtotal: Rs. {fmt(cartSubtotal)}
                  </span>
                </h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                  {jobsList.map((job, index) => (
                    <div key={index} style={{ padding: '0.75rem', background: 'var(--bg-elevated)', borderRadius: 8, border: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div style={{ flex: 1, paddingRight: '1rem' }}>
                        <div style={{ fontWeight: 700, fontSize: '0.9rem', color: 'var(--text-primary)' }}>{job.description}</div>
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '0.25rem', lineHeight: '1.4' }}>
                          <span style={{ color: 'var(--primary-light)', fontWeight: 600 }}>{job.paperSizeName}</span> · {job.printType === 'COLOR' ? '🎨 Color' : '⬛ B&W'} · {job.printMode === 'SINGLE' ? '1-Sided' : '2-Sided'}
                          <br />
                          {job.pages} pages × {job.copies} copies
                          {job.services.length > 0 && (
                            <>
                              <br />
                              <span style={{ color: 'var(--text-muted)' }}>Services:</span> {job.services.map((s: any) => s.name).join(', ')}
                            </>
                          )}
                          {job.customServices.length > 0 && (
                            <>
                              <br />
                              <span style={{ color: 'var(--text-muted)' }}>Custom charges:</span> {job.customServices.map((s: any) => s.label).join(', ')}
                            </>
                          )}
                          {job.discount > 0 && (
                            <>
                              <br />
                              <span style={{ color: 'var(--danger)', fontWeight: 600 }}>Discount: -Rs. {job.discount}</span>
                            </>
                          )}
                        </div>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                        <span style={{ fontWeight: 700, fontSize: '0.9rem', color: 'var(--primary-light)' }}>Rs. {fmt(job.totalAmount)}</span>
                        <button type="button" className="btn btn-ghost" style={{ color: 'var(--danger)', padding: '0.25rem 0.5rem', minWidth: 'auto', fontSize: '1rem' }}
                          onClick={() => setJobsList(prev => prev.filter((_, i) => i !== index))} title="Remove from Invoice">
                          🗑️
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Customer */}
            <div className="card">
              <h3 style={{ marginBottom: '1.25rem' }}>Customer</h3>
              <div className="form-group">
                <label className="form-label">Select Customer (optional for walk-in)</label>
                <select className="form-control" value={customerId} onChange={e => setCustomerId(e.target.value)}>
                  <option value="">Walk-in Customer</option>
                  {customers.filter(c => c.type === 'MONTHLY').length > 0 && (
                    <optgroup label="Monthly Customers">
                      {customers.filter(c => c.type === 'MONTHLY').map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                    </optgroup>
                  )}
                  {customers.filter(c => c.type === 'WALK_IN').length > 0 && (
                    <optgroup label="Walk-in Customers">
                      {customers.filter(c => c.type === 'WALK_IN').map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                    </optgroup>
                  )}
                </select>
              </div>
              {isMonthly && (
                <div className="alert alert-info mt-2">
                  <span>ℹ</span> Monthly customer — invoice will be added to their account for end-of-month billing.
                </div>
              )}
            </div>

            {/* Invoice options */}
            <div className="card">
              <h3 style={{ marginBottom: '1.25rem' }}>Invoice Options</h3>
              <label className="checkbox-item" style={{ marginBottom: '0.75rem' }}>
                <input type="checkbox" checked={createInvoice} onChange={e => setCreateInvoice(e.target.checked)} />
                <span style={{ fontWeight: 600 }}>Generate Invoice</span>
              </label>
              {createInvoice && !isMonthly && (
                <div style={{ paddingLeft: '1.5rem', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                  <label className="checkbox-item">
                    <input type="checkbox" checked={markPaid} onChange={e => setMarkPaid(e.target.checked)} />
                    <span>Mark as Paid Immediately</span>
                  </label>
                  {markPaid && (
                    <div className="form-group">
                      <label className="form-label">Payment Method</label>
                      <select className="form-control" value={paymentMethod} onChange={e => setPaymentMethod(e.target.value)} required={markPaid}>
                        <option value="">Select method</option>
                        <option value="CASH">Cash</option>
                        <option value="BANK_TRANSFER">Bank Transfer</option>
                        <option value="CARD">Card</option>
                        <option value="ONLINE">Online Transfer</option>
                        <option value="OTHER">Other</option>
                      </select>
                    </div>
                  )}
                  {!markPaid && (
                    <div className="form-group">
                      <label className="form-label">Due Date (optional)</label>
                      <input type="date" className="form-control" value={dueDate} onChange={e => setDueDate(e.target.value)} />
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Right: Price calculator */}
          <div style={{ position: 'sticky', top: '80px' }}>
            <div className="calc-panel">
              <h3 style={{ marginBottom: '1.25rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <span>🧮</span> Invoice Summary
              </h3>

              {/* Cart Subtotal */}
              {jobsList.length > 0 && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginBottom: '1rem', background: 'rgba(255,255,255,0.02)', borderRadius: 8, padding: '0.75rem', border: '1px solid var(--border)' }}>
                  <div style={{ fontWeight: 700, fontSize: '0.85rem', color: 'var(--text-primary)' }}>Cart Subtotal ({jobsList.length} jobs)</div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.9rem', fontWeight: 600 }}>
                    <span style={{ color: 'var(--text-secondary)' }}>Items sum</span>
                    <span>Rs. {fmt(cartSubtotal)}</span>
                  </div>
                </div>
              )}

              {/* Active editing job */}
              {description.trim() && paperSizeId && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginBottom: '1rem', background: 'rgba(21, 94, 160, 0.05)', borderRadius: 8, padding: '0.75rem', border: '1px dashed var(--primary-light)' }}>
                  <div style={{ fontWeight: 700, fontSize: '0.85rem', color: 'var(--primary-light)', display: 'flex', justifyContent: 'space-between' }}>
                    <span>Active Item (Form)</span>
                    <span>Rs. {fmt(total)}</span>
                  </div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                    {description} ({printMode === 'DOUBLE' ? `${Math.ceil(pages/2)} eff. pgs` : `${pages} pgs`} × {copies} cpy)
                  </div>
                </div>
              )}

              {!description.trim() && jobsList.length === 0 && currentRule && (
                <div style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)', marginBottom: '1rem', background: 'rgba(255,255,255,0.04)', borderRadius: 8, padding: '0.75rem' }}>
                  <div style={{ fontWeight: 600, marginBottom: '0.25rem', color: 'var(--text-primary)' }}>Rate Card</div>
                  <div>Per page: <strong style={{ color: 'var(--primary-light)' }}>Rs. {currentRule.pricePerPage}</strong></div>
                  <div>Per copy: <strong style={{ color: 'var(--primary-light)' }}>Rs. {currentRule.pricePerCopy}</strong></div>
                  <div>Per book: <strong style={{ color: 'var(--primary-light)' }}>Rs. {currentRule.pricePerBook}</strong></div>
                </div>
              )}

              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.625rem', marginBottom: '1.25rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.875rem' }}>
                  <span style={{ color: 'var(--text-secondary)' }}>Invoice Subtotal</span>
                  <span style={{ fontWeight: 600 }}>Rs. {fmt(jobsList.length > 0 ? (cartSubtotal + (description.trim() ? total : 0)) : total)}</span>
                </div>

                <div style={{ marginTop: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0.5rem', background: 'rgba(239, 68, 68, 0.05)', borderRadius: 8 }}>
                  <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--danger)' }}>INVOICE DISCOUNT</span>
                  <input type="number" min={0} step="0.5" className="form-control" 
                    style={{ height: 32, padding: '0 0.5rem', textAlign: 'right', fontWeight: 700, color: 'var(--danger)' }}
                    value={invoiceDiscount || ''} onChange={e => setInvoiceDiscount(+e.target.value)} placeholder="0.00" />
                </div>

                <hr className="divider" />
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontWeight: 700, fontSize: '1rem' }}>GRAND TOTAL</span>
                  <div className="price-display">
                    <span className="currency">Rs. </span>{fmt(jobsList.length > 0 ? Math.max(0, cartSubtotal + (description.trim() ? total : 0) - invoiceDiscount) : invoiceTotal)}
                  </div>
                </div>
              </div>

              <button type="submit" className="btn btn-primary w-full btn-lg" disabled={loading || (jobsList.length === 0 && (!paperSizeId || !description.trim()))}
                style={{ justifyContent: 'center', marginBottom: '0.75rem' }}>
                {loading ? <span className="spinner" /> : '💾'}
                {loading ? 'Creating Invoice…' : 'Save & Generate Invoice'}
              </button>
              <button type="button" className="btn btn-secondary w-full" onClick={() => router.back()}>
                Cancel
              </button>
            </div>
          </div>
        </div>
      </form>
    </AppShell>
  )
}
