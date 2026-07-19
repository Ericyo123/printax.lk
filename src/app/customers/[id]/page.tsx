'use client'
import { useEffect, useState } from 'react'
import { AppShell } from '@/components/AppShell'
import { Receipt, AlertCircle } from 'lucide-react'
import { useParams } from 'next/navigation'
import Link from 'next/link'

export default function CustomerDetailPage() {
  const { id } = useParams<{ id: string }>()
  const [customer, setCustomer] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch(`/api/customers/${id}`).then(r => r.json()).then(d => { setCustomer(d); setLoading(false) })
  }, [id])

  if (loading) return <AppShell><div className="empty-state"><span className="spinner" style={{ width: 36, height: 36 }} /></div></AppShell>
  if (!customer) return <AppShell><div className="empty-state"><p>Customer not found</p></div></AppShell>

  const totalSpent = customer.invoices.reduce((s: number, i: any) => s + i.totalAmount, 0)
  const totalPaid = customer.invoices.filter((i: any) => i.paymentStatus === 'PAID').reduce((s: number, i: any) => s + i.totalAmount, 0)

  return (
    <AppShell>
      <div className="page-header">
        <div className="page-title-group">
          <h1 className="page-title">{customer.name}</h1>
          <p className="page-subtitle">
            <span className={`badge ${customer.type === 'MONTHLY' ? 'badge-purple' : 'badge-muted'}`}>
              {customer.type === 'MONTHLY' ? 'Monthly' : 'Walk-in'}
            </span>
          </p>
        </div>
        <div className="page-actions">
          <Link href="/customers" className="btn btn-secondary">← Back</Link>
          <Link href={`/jobs/new?customerId=${customer.id}`} className="btn btn-primary">+ New Job</Link>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '320px 1fr', gap: '1.5rem', alignItems: 'start' }}>
        {/* Profile */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <div className="card">
            <h3 style={{ marginBottom: '1rem' }}>Contact Info</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', fontSize: '0.875rem' }}>
              {customer.phone && <div style={{ display: 'flex', gap: '0.5rem' }}><span style={{ color: 'var(--text-muted)', width: 60 }}>Phone</span><span>{customer.phone}</span></div>}
              {customer.email && <div style={{ display: 'flex', gap: '0.5rem' }}><span style={{ color: 'var(--text-muted)', width: 60 }}>Email</span><span>{customer.email}</span></div>}
              {customer.address && <div style={{ display: 'flex', gap: '0.5rem' }}><span style={{ color: 'var(--text-muted)', width: 60 }}>Address</span><span>{customer.address}</span></div>}
              {customer.notes && <div style={{ display: 'flex', gap: '0.5rem' }}><span style={{ color: 'var(--text-muted)', width: 60 }}>Notes</span><span>{customer.notes}</span></div>}
            </div>
          </div>

          <div className="stat-card">
            <div className="stat-label">Total Invoices</div>
            <div className="stat-value">{customer.invoices.length}</div>
          </div>
          <div className="stat-card">
            <div className="stat-label">Total Spent</div>
            <div className="stat-value" style={{ fontSize: '1.25rem' }}>Rs. {totalSpent.toLocaleString()}</div>
          </div>
          <div className="stat-card">
            <div className="stat-label">Outstanding Balance</div>
            <div className="stat-value" style={{ fontSize: '1.25rem', color: customer.outstandingBalance > 0 ? 'var(--danger)' : 'var(--success)' }}>
              Rs. {customer.outstandingBalance.toLocaleString()}
            </div>
          </div>

          {customer.outstandingBalance > 0 && (
            <div className="alert alert-warning mb-6" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <AlertCircle size={18} /> This customer has an outstanding balance of Rs. {customer.outstandingBalance.toLocaleString()}
            </div>
          )}
        </div>

        {/* Invoice history */}
        <div className="card">
          <h3 style={{ marginBottom: '1.25rem' }}>Invoice History</h3>
          {customer.invoices.length === 0 ? (
            <div className="empty-state" style={{ padding: '2rem' }}>
              <div className="empty-state-icon"><Receipt size={40} /></div>
              <p>No invoices yet</p>
            </div>
          ) : (
            <div className="table-wrapper">
              <table>
                <thead>
                  <tr>
                    <th>Invoice #</th>
                    <th>Date</th>
                    <th>Jobs</th>
                    <th>Amount</th>
                    <th>Status</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {customer.invoices.map((inv: any) => (
                    <tr key={inv.id}>
                      <td style={{ fontWeight: 600, color: '#000' }}>{inv.invoiceNumber}</td>
                      <td style={{ color: 'var(--text-secondary)', fontSize: '0.8125rem' }}>{new Date(inv.date).toLocaleDateString()}</td>
                      <td style={{ color: 'var(--text-secondary)' }}>{inv.jobs?.length || 0}</td>
                      <td style={{ fontWeight: 700 }}>Rs. {inv.totalAmount.toLocaleString()}</td>
                      <td><span className={`badge ${inv.paymentStatus === 'PAID' ? 'badge-success' : 'badge-warning'}`}>{inv.paymentStatus}</span></td>
                      <td><Link href={`/invoices/${inv.id}`} className="btn btn-secondary btn-sm">View</Link></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </AppShell>
  )
}
