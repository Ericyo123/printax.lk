'use client'

import { useState, useEffect } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'

import { ArrowLeft, Building2, Landmark } from 'lucide-react'

export default function SettingsPage() {
  const [settings, setSettings] = useState<any>({
    businessName: '',
    address: '',
    phone: '',
    email: '',
    bankName: '',
    accountName: '',
    accountNumber: '',
    swiftCode: '',
    branch: '',
    currency: 'LKR'
  })
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const { data: session } = useSession()
  const router = useRouter()

  useEffect(() => {
    if (session && session.user?.role !== 'ADMIN') {
      router.push('/dashboard')
      return
    }
    fetchSettings()
  }, [session, router])

  const fetchSettings = async () => {
    try {
      const res = await fetch('/api/settings')
      const data = await res.json()
      if (data && !data.error) setSettings(data)
    } catch (error) {
      console.error('Failed to fetch settings:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleSave = async () => {
    setSaving(true)
    try {
      const res = await fetch('/api/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(settings)
      })
      if (res.ok) {
        alert('Settings saved successfully!')
      }
    } catch (error) {
      alert('Failed to save settings.')
    } finally {
      setSaving(false)
    }
  }

  if (loading) return <div className="p-8">Loading settings...</div>

  return (
    <div style={{ maxWidth: '1000px', margin: '0 auto', padding: '2rem' }}>
      <button 
        onClick={() => router.back()} 
        className="btn btn-ghost" 
        style={{ marginBottom: '1rem', padding: '0.5rem', display: 'inline-flex', alignItems: 'center', gap: '0.5rem' }}
      >
        <ArrowLeft size={16} /> Back
      </button>
      
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
        <h1 style={{ fontSize: '2rem', fontWeight: 700, color: 'var(--text-primary)' }}>System Settings</h1>
        <button 
          onClick={handleSave} 
          className="btn btn-primary"
          disabled={saving}
          style={{ padding: '0.75rem 2rem' }}
        >
          {saving ? 'Saving...' : 'Save All Changes'}
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Business Info */}
        <div className="card" style={{ padding: '1.5rem' }}>
          <h2 style={{ fontSize: '1.25rem', fontWeight: 600, marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Building2 size={20} className="text-primary-light" /> Business Information
          </h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <div className="form-group">
              <label className="form-label">Business Name</label>
              <input 
                className="form-control"
                value={settings.businessName} 
                onChange={(e) => setSettings({ ...settings, businessName: e.target.value })} 
                placeholder="e.g. Printax Solutions"
              />
            </div>
            <div className="form-group">
              <label className="form-label">Full Address</label>
              <textarea 
                className="form-control"
                rows={3}
                value={settings.address} 
                onChange={(e) => setSettings({ ...settings, address: e.target.value })} 
                placeholder="132, Kolonnawa Road, Demetagoda, Sri Lanka"
                style={{ resize: 'vertical' }}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="form-group">
                <label className="form-label">Contact Phone</label>
                <input 
                  className="form-control"
                  value={settings.phone} 
                  onChange={(e) => setSettings({ ...settings, phone: e.target.value })} 
                />
              </div>
              <div className="form-group">
                <label className="form-label">Business Email</label>
                <input 
                  className="form-control"
                  value={settings.email} 
                  onChange={(e) => setSettings({ ...settings, email: e.target.value })} 
                />
              </div>
            </div>
          </div>
        </div>

        {/* Bank Details */}
        <div className="card" style={{ padding: '1.5rem' }}>
          <h2 style={{ fontSize: '1.25rem', fontWeight: 600, marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Landmark size={20} className="text-primary-light" /> Bank Details (For Invoices)
          </h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <div className="form-group">
              <label className="form-label">Bank Name</label>
              <input 
                className="form-control"
                value={settings.bankName} 
                onChange={(e) => setSettings({ ...settings, bankName: e.target.value })} 
                placeholder="e.g. HNB, BOC, Sampath"
              />
            </div>
            <div className="form-group">
              <label className="form-label">Account Name</label>
              <input 
                className="form-control"
                value={settings.accountName} 
                onChange={(e) => setSettings({ ...settings, accountName: e.target.value })} 
              />
            </div>
            <div className="form-group">
              <label className="form-label">Account Number</label>
              <input 
                className="form-control"
                value={settings.accountNumber} 
                onChange={(e) => setSettings({ ...settings, accountNumber: e.target.value })} 
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="form-group">
                <label className="form-label">SWIFT / BIC Code</label>
                <input 
                  className="form-control"
                  value={settings.swiftCode} 
                  onChange={(e) => setSettings({ ...settings, swiftCode: e.target.value })} 
                />
              </div>
              <div className="form-group">
                <label className="form-label">Branch Name</label>
                <input 
                  className="form-control"
                  value={settings.branch} 
                  onChange={(e) => setSettings({ ...settings, branch: e.target.value })} 
                />
              </div>
            </div>
          </div>
        </div>
      </div>
      
      <div style={{ marginTop: '2rem', padding: '1rem', background: 'var(--bg-elevated)', borderRadius: '8px', border: '1px solid var(--border)', fontSize: '0.875rem', color: 'var(--text-secondary)' }}>
        <strong style={{ color: 'var(--text-primary)' }}>Note:</strong> These details will be automatically included in all generated Invoices and Monthly Statements.
      </div>
    </div>
  )
}
