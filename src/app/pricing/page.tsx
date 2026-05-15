'use client'
import { useEffect, useState } from 'react'
import { AppShell } from '@/components/AppShell'

export default function PricingPage() {
  const [data, setData] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState<'rules' | 'sizes' | 'services'>('rules')
  const [saving, setSaving] = useState(false)

  // New paper size
  const [newSize, setNewSize] = useState('')
  // New service
  const [newSvcName, setNewSvcName] = useState('')
  const [newSvcPrice, setNewSvcPrice] = useState<number>(0)

  function fetchData() {
    fetch('/api/pricing').then(r => r.json()).then(d => { setData(d); setLoading(false) })
  }

  useEffect(() => { fetchData() }, [])

  async function updateRule(paperSizeId: string, printType: string, field: string, value: number) {
    const existing = data.rules.find((r: any) => r.paperSizeId === paperSizeId && r.printType === printType)
    const payload = {
      action: 'upsert_rule',
      data: {
        paperSizeId, printType,
        pricePerPage: existing?.pricePerPage || 0,
        pricePerCopy: existing?.pricePerCopy || 0,
        pricePerBook: existing?.pricePerBook || 0,
        [field]: value,
      },
    }
    await fetch('/api/pricing', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) })
    fetchData()
  }

  async function addPaperSize() {
    if (!newSize.trim()) return
    setSaving(true)
    await fetch('/api/pricing', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'add_paper_size', data: { name: newSize } }) })
    setNewSize(''); setSaving(false); fetchData()
  }

  async function addService() {
    if (!newSvcName.trim()) return
    setSaving(true)
    await fetch('/api/pricing', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'add_service', data: { name: newSvcName, price: newSvcPrice } }) })
    setNewSvcName(''); setNewSvcPrice(0); setSaving(false); fetchData()
  }

  async function updateService(name: string, price: number, active: boolean) {
    await fetch('/api/pricing', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'update_service', data: { name, price, active } }) })
    fetchData()
  }

  function getRule(paperSizeId: string, printType: string) {
    return data?.rules.find((r: any) => r.paperSizeId === paperSizeId && r.printType === printType) || { pricePerPage: 0, pricePerCopy: 0, pricePerBook: 0 }
  }

  return (
    <AppShell>
      <div className="page-header">
        <div className="page-title-group">
          <h1 className="page-title">Pricing Management</h1>
          <p className="page-subtitle">Configure pricing rules for all paper sizes and print types</p>
        </div>
      </div>

      <div style={{ marginBottom: '1.5rem' }}>
        <div className="tabs">
          {[['rules', 'Pricing Rules'], ['sizes', 'Paper Sizes'], ['services', 'Additional Services']].map(([val, label]) => (
            <button key={val} className={`tab ${tab === val ? 'active' : ''}`} onClick={() => setTab(val as any)}>{label}</button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="empty-state"><span className="spinner" style={{ width: 36, height: 36 }} /></div>
      ) : (
        <>
          {/* Pricing Rules */}
          {tab === 'rules' && (
            <div>
              <div className="alert alert-info mb-4">
                <span>ℹ</span> All prices are in Sri Lankan Rupees (Rs.). Changes take effect immediately on new jobs.
              </div>
              {data?.paperSizes.map((ps: any) => (
                <div key={ps.id} className="card" style={{ marginBottom: '1rem' }}>
                  <h3 style={{ marginBottom: '1.25rem' }}>Paper Size: {ps.name}</h3>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                    {['COLOR', 'BW'].map(type => {
                      const rule = getRule(ps.id, type)
                      return (
                        <div key={type} style={{ background: 'var(--bg-elevated)', borderRadius: 8, padding: '1rem' }}>
                          <div style={{ fontWeight: 600, marginBottom: '0.875rem', color: type === 'COLOR' ? 'var(--accent)' : 'var(--text-secondary)' }}>
                            {type === 'COLOR' ? '🎨 Color' : '⬛ Black & White'}
                          </div>
                          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '0.75rem' }}>
                            {[['pricePerPage', 'Per Page'], ['pricePerCopy', 'Per Copy'], ['pricePerBook', 'Per Book']].map(([field, label]) => (
                              <div className="form-group" key={field}>
                                <label className="form-label" style={{ fontSize: '0.6875rem' }}>{label} (Rs.)</label>
                                <input type="number" min={0} step="0.01" className="form-control"
                                  style={{ fontSize: '0.875rem' }}
                                  defaultValue={(rule as any)[field]}
                                  onBlur={e => updateRule(ps.id, type, field, +e.target.value)} />
                              </div>
                            ))}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Paper Sizes */}
          {tab === 'sizes' && (
            <div className="card">
              <h3 style={{ marginBottom: '1.25rem' }}>Paper Sizes</h3>
              <div style={{ marginBottom: '1.25rem', display: 'flex', gap: '0.75rem' }}>
                <input className="form-control" placeholder="New paper size (e.g. Tabloid)" value={newSize} onChange={e => setNewSize(e.target.value)} style={{ flex: 1 }} />
                <button className="btn btn-primary" onClick={addPaperSize} disabled={saving}>Add Size</button>
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.625rem' }}>
                {data?.paperSizes.map((ps: any) => (
                  <div key={ps.id} className="tag" style={{ fontSize: '0.875rem', padding: '0.375rem 0.875rem' }}>
                    {ps.name}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Services */}
          {tab === 'services' && (
            <div className="card">
              <h3 style={{ marginBottom: '1.25rem' }}>Additional Services</h3>
              <div style={{ marginBottom: '1.5rem', display: 'flex', gap: '0.75rem' }}>
                <input className="form-control" placeholder="Service name" value={newSvcName} onChange={e => setNewSvcName(e.target.value)} style={{ flex: 2 }} />
                <input type="number" min={0} className="form-control" placeholder="Price" value={newSvcPrice || ''} onChange={e => setNewSvcPrice(+e.target.value)} style={{ flex: 1 }} />
                <button className="btn btn-primary" onClick={addService} disabled={saving}>Add</button>
              </div>
              <div className="table-wrapper">
                <table>
                  <thead><tr><th>Service</th><th>Price (Rs.)</th><th>Status</th><th>Actions</th></tr></thead>
                  <tbody>
                    {data?.services.map((s: any) => (
                      <tr key={s.id}>
                        <td style={{ fontWeight: 600 }}>{s.name}</td>
                        <td>
                          <input type="number" min={0} step="0.01"
                            defaultValue={s.price}
                            className="form-control"
                            style={{ width: 120 }}
                            onBlur={e => updateService(s.name, +e.target.value, s.active)} />
                        </td>
                        <td>
                          <span className={`badge ${s.active ? 'badge-success' : 'badge-muted'}`}>
                            {s.active ? 'Active' : 'Inactive'}
                          </span>
                        </td>
                        <td>
                          <button className="btn btn-ghost btn-sm"
                            onClick={() => updateService(s.name, s.price, !s.active)}>
                            {s.active ? 'Disable' : 'Enable'}
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}
    </AppShell>
  )
}
