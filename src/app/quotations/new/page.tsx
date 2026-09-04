'use client'
import { useEffect, useState } from 'react'
import { AppShell } from '@/components/AppShell'
import { useRouter } from 'next/navigation'
import { Plus, Trash2, ArrowLeft, Calendar, User, FileText, Download, Phone } from 'lucide-react'
import Link from 'next/link'
import { generateQuotationPDF } from '@/lib/generateQuotationPDF'
import { clientCache } from '@/lib/clientCache'

interface QuotationItemForm {
  description: string
  qty: number
  unitPrice: number
  totalAmount: number
}

export default function NewQuotationPage() {
  const router = useRouter()
  const cachedCusts = clientCache.get('customers_all')
  const [customers, setCustomers] = useState<any[]>(Array.isArray(cachedCusts) ? cachedCusts : [])

  // Simple Customer details: Name & Phone
  const [clientName, setClientName] = useState('')
  const [clientPhone, setClientPhone] = useState('')
  const [selectedCustomerId, setSelectedCustomerId] = useState<string | null>(null)
  const [showSuggestions, setShowSuggestions] = useState(false)

  const [validUntil, setValidUntil] = useState('')
  const [notes, setNotes] = useState('Payment terms: 50% advance upon confirmation. Validity: 14 days.')
  const [discount, setDiscount] = useState<number | ''>(0)
  const [saving, setSaving] = useState(false)

  // Simplified Quotation items: Description, Qty, Unit Rate, Total
  const [items, setItems] = useState<QuotationItemForm[]>([
    {
      description: '',
      qty: 1,
      unitPrice: 0,
      totalAmount: 0,
    }
  ])

  const CACHE_KEY = 'printax_new_quotation_cache'
  const [isLoaded, setIsLoaded] = useState(false)
  const [restoredDraft, setRestoredDraft] = useState(false)

  // Load in-progress draft from localStorage
  useEffect(() => {
    try {
      const cached = localStorage.getItem(CACHE_KEY)
      if (cached) {
        const data = JSON.parse(cached)
        const hasContent = (data.clientName && data.clientName.trim()) ||
          (data.items && data.items.some((i: any) => i.description && i.description.trim()))
        
        if (hasContent) {
          if (data.clientName) setClientName(data.clientName)
          if (data.clientPhone) setClientPhone(data.clientPhone)
          if (data.selectedCustomerId) setSelectedCustomerId(data.selectedCustomerId)
          if (data.validUntil) setValidUntil(data.validUntil)
          if (data.notes !== undefined) setNotes(data.notes)
          if (data.discount !== undefined) setDiscount(data.discount)
          if (Array.isArray(data.items) && data.items.length > 0) {
            setItems(data.items)
          }
          setRestoredDraft(true)
        } else {
          // If no active draft, load default quotation notes from Settings
          fetch('/api/settings')
            .then(r => r.json())
            .then(s => {
              if (s?.defaultQuotationNotes) {
                setNotes(s.defaultQuotationNotes)
              }
            })
            .catch(() => {})
        }
      } else {
        // If no cached draft at all, load default quotation notes from Settings
        fetch('/api/settings')
          .then(r => r.json())
          .then(s => {
            if (s?.defaultQuotationNotes) {
              setNotes(s.defaultQuotationNotes)
            }
          })
          .catch(() => {})
      }
    } catch (e) {
      console.error('Failed to load quotation cache', e)
    }
    setIsLoaded(true)
  }, [])

  // Auto-save form changes to localStorage
  useEffect(() => {
    if (!isLoaded) return
    const hasContent = clientName.trim() || clientPhone.trim() || items.some(i => i.description.trim() || i.unitPrice > 0)
    if (hasContent) {
      localStorage.setItem(CACHE_KEY, JSON.stringify({
        clientName,
        clientPhone,
        selectedCustomerId,
        validUntil,
        notes,
        discount,
        items,
        updatedAt: new Date().toISOString()
      }))
    }
  }, [clientName, clientPhone, selectedCustomerId, validUntil, notes, discount, items, isLoaded])

  function discardDraft() {
    if (!window.confirm('Are you sure you want to discard this draft quotation?')) return
    localStorage.removeItem(CACHE_KEY)
    setClientName('')
    setClientPhone('')
    setSelectedCustomerId(null)
    setValidUntil('')
    fetch('/api/settings')
      .then(r => r.json())
      .then(s => {
        setNotes(s?.defaultQuotationNotes || 'Payment terms: 50% advance upon confirmation. Validity: 14 days.')
      })
      .catch(() => {
        setNotes('Payment terms: 50% advance upon confirmation. Validity: 14 days.')
      })
    setDiscount(0)
    setItems([{ description: '', qty: 1, unitPrice: 0, totalAmount: 0 }])
    setRestoredDraft(false)
  }

  useEffect(() => {
    fetch('/api/customers')
      .then(r => r.json())
      .then(d => setCustomers(d || []))
      .catch(console.error)
  }, [])

  function updateItem(index: number, field: keyof QuotationItemForm, val: any) {
    setItems(prev => {
      const updated = [...prev]
      const current = { ...updated[index], [field]: val }

      if (field === 'qty' || field === 'unitPrice') {
        const q = field === 'qty' ? Number(val) : current.qty
        const u = field === 'unitPrice' ? Number(val) : current.unitPrice
        current.totalAmount = q * u
      } else if (field === 'totalAmount') {
        current.totalAmount = Number(val)
      }

      updated[index] = current
      return updated
    })
  }

  function addItem() {
    setItems(prev => [
      ...prev,
      {
        description: '',
        qty: 1,
        unitPrice: 0,
        totalAmount: 0,
      }
    ])
  }

  function removeItem(index: number) {
    if (items.length <= 1) return
    setItems(prev => prev.filter((_, i) => i !== index))
  }

  const subtotal = items.reduce((sum, item) => sum + (Number(item.totalAmount) || 0), 0)
  const validDiscount = typeof discount === 'number' ? discount : 0
  const finalTotal = Math.max(0, subtotal - validDiscount)

  async function handleSubmit(e?: React.FormEvent, isDraftOnly: boolean = false) {
    if (e) e.preventDefault()
    if (!clientName.trim()) {
      alert('Please enter client name')
      return
    }

    const invalidItem = items.find(i => !i.description.trim())
    if (invalidItem) {
      alert('Every quotation item must have a description')
      return
    }

    setSaving(true)
    const payload = {
      customerId: selectedCustomerId,
      customerName: clientName.trim(),
      customerPhone: clientPhone.trim() || null,
      validUntil: validUntil ? new Date(validUntil).toISOString() : null,
      status: 'DRAFT',
      discount: validDiscount,
      notes: notes.trim() || null,
      items: items.map(item => ({
        description: item.description.trim(),
        pages: 1,
        copies: Number(item.qty) || 1,
        pricingType: 'MANUAL',
        unitPrice: Number(item.unitPrice) || 0,
        baseAmount: Number(item.totalAmount) || 0,
        additionalTotal: 0,
        discount: 0,
        totalAmount: Number(item.totalAmount) || 0,
      }))
    }

    try {
      const res = await fetch('/api/quotations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      })
      const data = await res.json()

      if (res.ok && data.quotation) {
        // Clear local storage draft cache upon saving
        localStorage.removeItem(CACHE_KEY)

        if (!isDraftOnly) {
          // Auto download PDF
          try {
            await generateQuotationPDF(data.quotation)
          } catch (pdfErr) {
            console.error('Auto download PDF error', pdfErr)
          }
          setSaving(false)
          clientCache.invalidate('quotations_all')
          clientCache.invalidate('dashboard_data')
          router.push(`/quotations/${data.quotation.id}`)
        } else {
          setSaving(false)
          clientCache.invalidate('quotations_all')
          clientCache.invalidate('dashboard_data')
          router.push('/quotations?status=DRAFT')
        }
      } else {
        setSaving(false)
        alert(data.error || 'Failed to create quotation')
      }
    } catch {
      setSaving(false)
      alert('Network error submitting quotation')
    }
  }

  const fmt = (n: number) => `Rs. ${(n || 0).toLocaleString('en-LK', { minimumFractionDigits: 2 })}`

  const matchingCustomers = customers.filter(c => 
    c.name.toLowerCase().includes(clientName.toLowerCase()) ||
    (c.phone && c.phone.includes(clientName))
  )

  return (
    <AppShell>
      <div className="page-header">
        <div className="page-title-group">
          <Link href="/quotations" className="btn btn-secondary btn-sm" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem', marginBottom: '0.5rem' }}>
            <ArrowLeft size={16} /> Back to Quotations
          </Link>
          <h1 className="page-title">New Quotation</h1>
          <p className="page-subtitle">Quickly prepare and download an official quote for your client</p>
        </div>
      </div>

      {restoredDraft && (
        <div style={{
          background: '#fffbeb',
          border: '1px solid #fde68a',
          borderRadius: 'var(--radius)',
          padding: '0.85rem 1.25rem',
          marginBottom: '1.25rem',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '1rem',
          flexWrap: 'wrap'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <FileText size={18} color="#d97706" />
            <span style={{ color: '#92400e', fontSize: '0.875rem' }}>
              <strong>Resumed unsaved draft quotation.</strong> Any changes you make will continue saving automatically.
            </span>
          </div>
          <button
            type="button"
            onClick={discardDraft}
            className="btn btn-secondary btn-sm"
            style={{ color: '#b91c1c', borderColor: '#fca5a5', background: 'white' }}
          >
            Discard Draft
          </button>
        </div>
      )}

      <form onSubmit={handleSubmit}>
        <div className="grid-quotation-form">
          {/* Main Left Form */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
            {/* Customer Details: Client Name & Phone Number */}
            <div className="card">
              <h3 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem' }}>
                <User size={18} color="var(--primary)" /> Client Information
              </h3>

              <div className="quotation-client-grid">
                <div style={{ position: 'relative' }}>
                  <label className="form-label">Client Name *</label>
                  <input
                    className="form-control"
                    placeholder="Enter client or company name..."
                    value={clientName}
                    onChange={e => {
                      setClientName(e.target.value)
                      setSelectedCustomerId(null)
                      setShowSuggestions(true)
                    }}
                    onFocus={() => setShowSuggestions(true)}
                    required
                  />

                  {/* Customer Auto-Suggest Dropdown */}
                  {showSuggestions && clientName.trim().length > 0 && matchingCustomers.length > 0 && (
                    <div className="card" style={{
                      position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 50,
                      maxHeight: 180, overflowY: 'auto', padding: '0.4rem', marginTop: '0.25rem', boxShadow: '0 8px 20px rgba(0,0,0,0.12)'
                    }}>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', padding: '0.25rem 0.5rem' }}>
                        Matching existing customers:
                      </div>
                      {matchingCustomers.slice(0, 5).map(c => (
                        <div
                          key={c.id}
                          style={{ padding: '0.5rem 0.6rem', cursor: 'pointer', borderRadius: '6px' }}
                          className="hover:bg-slate-100"
                          onClick={() => {
                            setClientName(c.name)
                            if (c.phone) setClientPhone(c.phone)
                            setSelectedCustomerId(c.id)
                            setShowSuggestions(false)
                          }}
                        >
                          <div style={{ fontWeight: 600, fontSize: '0.9rem' }}>{c.name}</div>
                          {c.phone && <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{c.phone}</div>}
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div>
                  <label className="form-label">Phone Number</label>
                  <div style={{ position: 'relative' }}>
                    <input
                      className="form-control"
                      placeholder="e.g. 0771234567"
                      value={clientPhone}
                      onChange={e => setClientPhone(e.target.value)}
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Quotation Line Items Card */}
            <div className="card">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
                <h3 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <FileText size={18} color="var(--primary)" /> Quotation Items
                </h3>
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  onClick={addItem}
                  style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}
                >
                  <Plus size={16} /> Add Item
                </button>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                {items.map((item, idx) => (
                  <div
                    key={idx}
                    style={{
                      border: '1px solid var(--border)',
                      borderRadius: '10px',
                      padding: '1rem 1.25rem',
                      background: 'var(--bg-surface)'
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                      <span style={{ fontWeight: 600, fontSize: '0.85rem', color: 'var(--primary)' }}>
                        Item #{idx + 1}
                      </span>
                      {items.length > 1 && (
                        <button
                          type="button"
                          onClick={() => removeItem(idx)}
                          style={{ color: 'var(--danger)', background: 'transparent', border: 'none', cursor: 'pointer' }}
                        >
                          <Trash2 size={16} />
                        </button>
                      )}
                    </div>

                    <div className="quotation-item-grid">
                      <div className="quotation-item-desc">
                        <label className="form-label" style={{ fontSize: '0.8rem', marginBottom: '0.2rem' }}>Description *</label>
                        <input
                          className="form-control"
                          placeholder="e.g. Brochure Printing, Sticker Labels..."
                          value={item.description}
                          onChange={e => updateItem(idx, 'description', e.target.value)}
                          required
                        />
                      </div>
                      <div>
                        <label className="form-label" style={{ fontSize: '0.8rem', marginBottom: '0.2rem' }}>Qty</label>
                        <input
                          type="number"
                          min="1"
                          className="form-control"
                          value={item.qty}
                          onChange={e => updateItem(idx, 'qty', e.target.value)}
                          style={{ textAlign: 'center' }}
                        />
                      </div>
                      <div>
                        <label className="form-label" style={{ fontSize: '0.8rem', marginBottom: '0.2rem' }}>Unit Rate (Rs.)</label>
                        <input
                          type="number"
                          step="any"
                          min="0"
                          className="form-control"
                          placeholder="0.00"
                          value={item.unitPrice || ''}
                          onChange={e => updateItem(idx, 'unitPrice', e.target.value)}
                          style={{ textAlign: 'right' }}
                        />
                      </div>
                      <div>
                        <label className="form-label" style={{ fontSize: '0.8rem', marginBottom: '0.2rem' }}>Total (Rs.)</label>
                        <input
                          type="number"
                          step="any"
                          min="0"
                          className="form-control"
                          placeholder="0.00"
                          value={item.totalAmount || ''}
                          onChange={e => updateItem(idx, 'totalAmount', e.target.value)}
                          style={{ textAlign: 'right', fontWeight: 600 }}
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Terms & Conditions */}
            <div className="card">
              <label className="form-label" style={{ fontWeight: 600 }}>Quotation Terms & Conditions</label>
              <textarea
                className="form-control"
                rows={3}
                value={notes}
                onChange={e => setNotes(e.target.value)}
                placeholder="Include payment terms, turnaround time, validity period..."
              />
            </div>
          </div>

          {/* Right Summary Column */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
            <div className="card">
              <h3 style={{ marginBottom: '1.25rem' }}>Summary</h3>

              <div style={{ marginBottom: '1rem' }}>
                <label className="form-label" style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                  <Calendar size={14} /> Valid Until
                </label>
                <input
                  type="date"
                  className="form-control"
                  value={validUntil}
                  onChange={e => setValidUntil(e.target.value)}
                />
              </div>

              <div style={{ borderTop: '1px solid var(--border)', paddingTop: '1rem', marginTop: '1rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem', fontSize: '0.9rem' }}>
                  <span>Subtotal:</span>
                  <span>{fmt(subtotal)}</span>
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem', fontSize: '0.9rem' }}>
                  <span>Discount (Rs.):</span>
                  <input
                    type="number"
                    min="0"
                    step="any"
                    className="form-control"
                    style={{ width: '110px', textAlign: 'right', padding: '0.25rem 0.5rem' }}
                    value={discount}
                    onChange={e => setDiscount(e.target.value === '' ? '' : Number(e.target.value))}
                  />
                </div>

                <div style={{
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                  borderTop: '2px solid var(--border)', paddingTop: '0.75rem', marginTop: '0.5rem'
                }}>
                  <strong style={{ fontSize: '1.05rem' }}>Total Estimate:</strong>
                  <strong style={{ fontSize: '1.25rem', color: 'var(--primary)' }}>{fmt(finalTotal)}</strong>
                </div>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', marginTop: '1.5rem' }}>
                <button
                  type="submit"
                  disabled={saving}
                  className="btn btn-primary w-full"
                  style={{
                    padding: '0.8rem 1rem', fontSize: '0.95rem',
                    display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '0.5rem'
                  }}
                >
                  <Download size={18} />
                  {saving ? 'Saving & Generating PDF...' : 'Save & Download Quotation'}
                </button>

                <button
                  type="button"
                  disabled={saving}
                  onClick={() => handleSubmit(undefined, true)}
                  className="btn btn-secondary w-full"
                  style={{
                    padding: '0.65rem 1rem', fontSize: '0.9rem',
                    display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '0.5rem'
                  }}
                >
                  <FileText size={16} />
                  Save as Draft (No Download)
                </button>
              </div>
            </div>
          </div>
        </div>
      </form>
    </AppShell>
  )
}
