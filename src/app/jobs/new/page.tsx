'use client'
import { useEffect, useState } from 'react'
import { AppShell } from '@/components/AppShell'
import { useRouter } from 'next/navigation'
import { Plus, ShoppingCart, Pencil, Trash2, Info, Calculator, Save } from 'lucide-react'

interface PaperSize { id: string; name: string }
interface Customer { id: string; name: string; type: string }

export default function NewJobPage() {
  const router = useRouter()
  const [paperSizes, setPaperSizes] = useState<PaperSize[]>([])
  const [customers, setCustomers] = useState<Customer[]>([])
  const [customerSearch, setCustomerSearch] = useState('')
  const [loading, setLoading] = useState(false)

  // Form state
  const [description, setDescription] = useState('')
  const [quantity, setQuantity] = useState<number | ''>(1)
  const [amount, setAmount] = useState<number | ''>('')
  const [customerId, setCustomerId] = useState('')
  
  // Consolidated Job Cart State
  const [jobsList, setJobsList] = useState<any[]>([])
  const [invoiceDiscount, setInvoiceDiscount] = useState(0)

  // Derived
  const validQty = typeof quantity === 'number' ? quantity : 1
  const validAmount = typeof amount === 'number' ? amount : 0
  const total = validQty * validAmount
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
      setPaperSizes(pd.paperSizes || [])
      setCustomers(custs)
    })
  }, [])

  function editJob(index: number) {
    const job = jobsList[index]
    setDescription(job.description)
    setQuantity(job.copies)
    setAmount(job.baseAmount)
    setJobsList(prev => prev.filter((_, i) => i !== index))
  }

  function addJobToInvoice() {
    if (!description.trim() || !validQty || validQty <= 0) {
      alert('Please enter a description and quantity.')
      return
    }

    const newJobItem = {
      description,
      // Dummy values to satisfy backend / DB schema
      paperSizeId: paperSizes[0]?.id || 'dummy-size',
      printType: 'BW',
      printMode: 'SINGLE',
      pages: 1,
      copies: validQty, // quantity mapped to copies
      pricingType: 'MANUAL',
      manualPrice: total, // qty * unit price
      services: [],
      customServices: [],
      discount: 0,
      baseAmount: total, // used for total base price
      additionalTotal: 0,
      totalAmount: total, // qty * unit price
      notes: '',
    }

    setJobsList(prev => [...prev, newJobItem])

    // Reset form
    setDescription('')
    setQuantity(1)
    setAmount('')
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()

    let finalJobs = [...jobsList]

    // If cart is empty, auto-add current form inputs if filled
    if (finalJobs.length === 0) {
      if (!description.trim()) {
        alert('Please enter at least one item.')
        return
      }
      
      finalJobs.push({
        description,
        paperSizeId: paperSizes[0]?.id || 'dummy-size',
        printType: 'BW',
        printMode: 'SINGLE',
        pages: 1,
        copies: validQty,
        pricingType: 'MANUAL',
        manualPrice: total,
        services: [],
        customServices: [],
        discount: 0,
        baseAmount: total,
        additionalTotal: 0,
        totalAmount: total,
        notes: '',
      })
    } else {
      if (description.trim()) {
        finalJobs.push({
          description,
          paperSizeId: paperSizes[0]?.id || 'dummy-size',
          printType: 'BW',
          printMode: 'SINGLE',
          pages: 1,
          copies: validQty,
          pricingType: 'MANUAL',
          manualPrice: total,
          services: [],
          customServices: [],
          discount: 0,
          baseAmount: total,
          additionalTotal: 0,
          totalAmount: total,
          notes: '',
        })
      }
    }

    setLoading(true)

    const body = {
      customerId: customerId || undefined,
      paymentStatus: 'UNPAID',
      notes: undefined,
      jobs: finalJobs.map(j => ({
        description: j.description,
        paperSizeId: j.paperSizeId,
        printType: j.printType,
        printMode: j.printMode,
        pages: j.pages,
        copies: j.copies,
        pricingType: j.pricingType,
        manualPrice: j.manualPrice,
        services: [],
        customServices: [],
        discount: 0,
        notes: ''
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
        alert(data.error || 'Failed to create invoice. Please try again.')
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
          <h1 className="page-title">New Invoice</h1>
          <p className="page-subtitle">Quickly create a new invoice</p>
        </div>
      </div>

      <form onSubmit={handleSubmit}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 360px', gap: '1.5rem', alignItems: 'start' }}>
          {/* Left: Job Details */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
            
            {/* Quick Add Item */}
            <div className="card">
              <h3 style={{ marginBottom: '1.25rem' }}>Add Item</h3>
              <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'flex-end' }}>
                <div className="form-group" style={{ flex: 3, marginBottom: 0 }}>
                  <label className="form-label">Description *</label>
                  <input className="form-control" placeholder="e.g. Spiral Binding" value={description} onChange={e => setDescription(e.target.value)} />
                </div>
                <div className="form-group" style={{ flex: 1, marginBottom: 0 }}>
                  <label className="form-label">Quantity *</label>
                  <input type="number" min={1} className="form-control" value={quantity} onChange={e => setQuantity(e.target.value === '' ? '' : Math.max(1, +e.target.value))} />
                </div>
                <div className="form-group" style={{ flex: 1.5, marginBottom: 0 }}>
                  <label className="form-label">Unit Price (Rs.) *</label>
                  <input type="number" min={0} step="0.01" className="form-control" value={amount} onChange={e => setAmount(e.target.value === '' ? '' : +e.target.value)} />
                </div>
                <button type="button" className="btn btn-secondary" onClick={addJobToInvoice} style={{ height: '38px' }}>
                  <Plus size={16} /> Add
                </button>
              </div>

              {/* Items List */}
              {jobsList.length > 0 && (
                <div style={{ marginTop: '1.5rem', borderTop: '1px solid var(--border)', paddingTop: '1rem' }}>
                  <div style={{ fontWeight: 600, fontSize: '0.875rem', color: 'var(--text-secondary)', marginBottom: '0.75rem' }}>
                    Added Items
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                    {jobsList.map((job, index) => (
                      <div key={index} style={{ display: 'flex', alignItems: 'center', padding: '0.5rem 0', borderBottom: index < jobsList.length - 1 ? '1px dashed var(--border)' : 'none' }}>
                        <div style={{ width: '28px', fontWeight: 700, color: 'var(--text-muted)', fontSize: '0.875rem' }}>{index + 1}.</div>
                        <div style={{ flex: 1, fontWeight: 500, fontSize: '0.9rem' }}>{job.description}</div>
                        <div style={{ width: '60px', textAlign: 'right', fontSize: '0.875rem', color: 'var(--text-secondary)' }}>{job.copies} ×</div>
                        <div style={{ width: '90px', textAlign: 'right', fontSize: '0.875rem', color: 'var(--text-secondary)' }}>Rs. {fmt(job.baseAmount)}</div>
                        <div style={{ width: '100px', textAlign: 'right', fontWeight: 600, color: 'var(--primary-light)', fontSize: '0.9rem' }}>Rs. {fmt(job.totalAmount)}</div>
                        <div style={{ display: 'flex', gap: '0.25rem', marginLeft: '1rem' }}>
                          <button type="button" className="btn btn-ghost" style={{ padding: '0.25rem', fontSize: '1rem' }}
                            onClick={() => editJob(index)} title="Edit">
                            <Pencil size={16} />
                          </button>
                          <button type="button" className="btn btn-ghost" style={{ padding: '0.25rem', fontSize: '1rem', color: 'var(--danger)' }}
                            onClick={() => setJobsList(prev => prev.filter((_, i) => i !== index))} title="Remove">
                            <Trash2 size={16} />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Customer */}
            <div className="card">
              <h3 style={{ marginBottom: '1.25rem' }}>Customer</h3>
              <div className="form-group">
                <label className="form-label">Select Customer (optional for walk-in)</label>
                <input 
                  type="text" 
                  className="form-control mb-2" 
                  placeholder="Search customer by name..." 
                  value={customerSearch} 
                  onChange={e => setCustomerSearch(e.target.value)} 
                />
                <select className="form-control" value={customerId} onChange={e => setCustomerId(e.target.value)}>
                  <option value="">Walk-in Customer</option>
                  {customers.filter(c => c.name.toLowerCase().includes(customerSearch.toLowerCase()) && c.type === 'MONTHLY').length > 0 && (
                    <optgroup label="Monthly Customers">
                      {customers.filter(c => c.name.toLowerCase().includes(customerSearch.toLowerCase()) && c.type === 'MONTHLY').map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                    </optgroup>
                  )}
                </select>
              </div>
              {isMonthly && (
                <div className="alert alert-info mt-2">
                  <Info size={16} /> Monthly customer — invoice will be added to their account for end-of-month billing.
                </div>
              )}
            </div>

          </div>

          {/* Right: Summary */}
          <div style={{ position: 'sticky', top: '80px' }}>
            <div className="calc-panel">
              <h3 style={{ marginBottom: '1.25rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <Calculator size={20} /> Invoice Summary
              </h3>

              {/* Active editing item */}
              {description.trim() && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginBottom: '1rem', background: 'rgba(21, 94, 160, 0.05)', borderRadius: 8, padding: '0.75rem', border: '1px dashed var(--primary-light)' }}>
                  <div style={{ fontWeight: 700, fontSize: '0.85rem', color: 'var(--primary-light)', display: 'flex', justifyContent: 'space-between' }}>
                    <span>Draft Item</span>
                    <span>Rs. {fmt(total)}</span>
                  </div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                    {description} ({validQty} qty × Rs. {fmt(validAmount)})
                  </div>
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

              <button type="submit" className="btn btn-primary w-full btn-lg" disabled={loading || (jobsList.length === 0 && !description.trim())}
                style={{ justifyContent: 'center', marginBottom: '0.75rem' }}>
                {loading ? <span className="spinner" /> : <Save size={18} />}
                {loading ? 'Creating Invoice…' : 'Generate Invoice'}
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
