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

  // Derived
  const currentRule = pricingData?.rules.find(r => r.paperSizeId === paperSizeId && r.printType === printType)
  const baseAmount = currentRule
    ? calculateBaseAmount(currentRule, pricingType, pages, copies, printMode, manualPrice)
    : (pricingType === 'MANUAL' ? manualPrice : 0)
  const servicesTotal = (pricingData?.services || [])
    .filter(s => selectedServices[s.id])
    .reduce((acc, s) => acc + s.price, 0)
  const customTotal = customServices.reduce((acc, s) => acc + s.amount, 0)
  const total = Math.max(0, baseAmount + servicesTotal + customTotal - discount)

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

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!paperSizeId) return
    setLoading(true)
    const svcList = (pricingData?.services || [])
      .filter(s => selectedServices[s.id])
      .map(s => ({ serviceId: s.id, amount: s.price }))

    const body = {
      description, paperSizeId, printType, printMode, pages, copies, pricingType, notes,
      services: svcList, customServices,
      manualPrice: pricingType === 'MANUAL' ? manualPrice : undefined,
      customerId: customerId || undefined,
      createInvoice, discount,
      paymentMethod: (createInvoice && markPaid) ? paymentMethod : undefined,
      dueDate: (createInvoice && !markPaid) ? dueDate : undefined,
    }

    const res = await fetch('/api/jobs', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
    const data = await res.json()
    setLoading(false)
    if (res.ok && data.invoice) {
      router.push(`/invoices/${data.invoice.id}`)
    } else if (res.ok) {
      router.push('/invoices')
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
                  <input className="form-control" placeholder="e.g. Assignment printing, Report copies..." value={description} onChange={e => setDescription(e.target.value)} required />
                </div>
                <div className="form-row">
                  <div className="form-group">
                    <label className="form-label">Paper Size *</label>
                    <select className="form-control" value={paperSizeId} onChange={e => setPaperSizeId(e.target.value)} required>
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
                  <textarea className="form-control" placeholder="Additional notes..." value={notes} onChange={e => setNotes(e.target.value)} rows={2} />
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

            {/* Customer */}
            <div className="card">
              <h3 style={{ marginBottom: '1.25rem' }}>Customer</h3>
              <div className="form-group">
                <label className="form-label">Select Customer (optional for walk-in)</label>
                <select className="form-control" value={customerId} onChange={e => setCustomerId(e.target.value)}>
                  <option value="">Walk-in Customer</option>
                  <optgroup label="Monthly Customers">
                    {customers.filter(c => c.type === 'MONTHLY').map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </optgroup>
                  <optgroup label="Walk-in Customers">
                    {customers.filter(c => c.type === 'WALK_IN').map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </optgroup>
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
                <span>🧮</span> Price Calculator
              </h3>

              {currentRule && (
                <div style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)', marginBottom: '1rem', background: 'rgba(255,255,255,0.04)', borderRadius: 8, padding: '0.75rem' }}>
                  <div style={{ fontWeight: 600, marginBottom: '0.25rem', color: 'var(--text-primary)' }}>Rate Card</div>
                  <div>Per page: <strong style={{ color: 'var(--primary-light)' }}>Rs. {currentRule.pricePerPage}</strong></div>
                  <div>Per copy: <strong style={{ color: 'var(--primary-light)' }}>Rs. {currentRule.pricePerCopy}</strong></div>
                  <div>Per book: <strong style={{ color: 'var(--primary-light)' }}>Rs. {currentRule.pricePerBook}</strong></div>
                </div>
              )}

              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.625rem', marginBottom: '1.25rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.875rem' }}>
                  <span style={{ color: 'var(--text-secondary)' }}>
                    {printMode === 'DOUBLE' ? `${Math.ceil(pages/2)} eff. pages` : `${pages} pages`} × {copies} copies
                  </span>
                  <span style={{ fontWeight: 600 }}>Rs. {fmt(baseAmount)}</span>
                </div>
                {servicesTotal > 0 && (
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.875rem' }}>
                    <span style={{ color: 'var(--text-secondary)' }}>Services</span>
                    <span style={{ fontWeight: 600 }}>Rs. {fmt(servicesTotal)}</span>
                  </div>
                )}
                {customTotal > 0 && (
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.875rem' }}>
                    <span style={{ color: 'var(--text-secondary)' }}>Custom charges</span>
                    <span style={{ fontWeight: 600 }}>Rs. {fmt(customTotal)}</span>
                  </div>
                )}
                
                <div style={{ marginTop: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0.5rem', background: 'rgba(239, 68, 68, 0.05)', borderRadius: 8 }}>
                  <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--danger)' }}>DISCOUNT</span>
                  <input type="number" min={0} step="0.5" className="form-control" 
                    style={{ height: 32, padding: '0 0.5rem', textAlign: 'right', fontWeight: 700, color: 'var(--danger)' }}
                    value={discount || ''} onChange={e => setDiscount(+e.target.value)} placeholder="0.00" />
                </div>

                <hr className="divider" />
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontWeight: 700, fontSize: '1rem' }}>TOTAL</span>
                  <div className="price-display">
                    <span className="currency">Rs. </span>{fmt(total)}
                  </div>
                </div>
              </div>

              <button type="submit" className="btn btn-primary w-full btn-lg" disabled={loading || !paperSizeId || !description}
                style={{ justifyContent: 'center', marginBottom: '0.75rem' }}>
                {loading ? <span className="spinner" /> : '🖨'}
                {loading ? 'Saving…' : createInvoice ? 'Save & Generate Invoice' : 'Save Job'}
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
