'use client'
import { useEffect, useState } from 'react'
import { AppShell } from '@/components/AppShell'
import { Receipt, AlertCircle, FileSpreadsheet, MessageSquare, ArrowLeft, Check, Download } from 'lucide-react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { downloadStatementPDF, openStatementWhatsApp, MONTH_NAMES } from '@/lib/statementPdf'

export default function CustomerDetailPage() {
  const { id } = useParams<{ id: string }>()
  const [customer, setCustomer] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  async function fetchCustomer() {
    const r = await fetch(`/api/customers/${id}`)
    const d = await r.json()
    setCustomer(d)
    setLoading(false)
  }

  useEffect(() => {
    fetchCustomer()
  }, [id])

  async function settleCustomerBalance() {
    if (!window.confirm('Are you sure you want to mark all outstanding invoices for this customer as PAID?')) return
    const res = await fetch(`/api/customers/${id}/clear`, { method: 'POST' })
    if (res.ok) {
      fetchCustomer()
    } else {
      alert('Failed to settle balance.')
    }
  }

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
          <Link href="/customers" className="btn btn-secondary" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem' }}>
            <ArrowLeft size={16} /> Back
          </Link>
          <Link href={`/jobs/new?customerId=${customer.id}`} className="btn btn-primary">+ New Job</Link>
        </div>
      </div>

      <div className="grid-customer-detail">
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
            <div className="alert alert-danger mb-6" style={{ display: 'flex', alignItems: 'center', gap: '1rem', color: '#000', justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <AlertCircle size={18} color="var(--danger)" /> 
                <span style={{ fontWeight: 500 }}>
                  This customer has an outstanding balance of <strong>Rs. {customer.outstandingBalance.toLocaleString()}</strong>
                </span>
              </div>
              <button className="btn btn-success btn-sm" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }} onClick={settleCustomerBalance}>
                <Check size={14} /> Settle All
              </button>
            </div>
          )}
        </div>

        {/* Invoices and Statements Tabs */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          {/* Statement History */}
          <div className="card">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
              <h3 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <FileSpreadsheet size={20} color="var(--primary)" />
                Monthly Statements ({customer.statements?.length || 0})
              </h3>
              <Link href="/statements" className="btn btn-secondary btn-sm">
                + Manage Statements
              </Link>
            </div>
            
            {(!customer.statements || customer.statements.length === 0) ? (
              <div className="empty-state" style={{ padding: '2rem' }}>
                <div className="empty-state-icon"><FileSpreadsheet size={36} /></div>
                <p>No monthly statements generated for this customer yet</p>
                <Link href="/statements" className="btn btn-primary btn-sm" style={{ marginTop: '0.5rem' }}>
                  Generate First Statement
                </Link>
              </div>
            ) : (
              <div className="table-wrapper">
                <table>
                  <thead>
                    <tr>
                      <th>Statement #</th>
                      <th>Period</th>
                      <th>Invoices</th>
                      <th>Total</th>
                      <th>Status</th>
                      <th style={{ textAlign: 'right' }}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {customer.statements.map((stmt: any) => (
                      <tr key={stmt.id}>
                        <td style={{ fontWeight: 700, color: '#000' }}>{stmt.statementNo}</td>
                        <td style={{ color: 'var(--text-secondary)' }}>{MONTH_NAMES[stmt.month - 1]} {stmt.year}</td>
                        <td style={{ color: 'var(--text-secondary)' }}>{stmt.invoices?.length || 0}</td>
                        <td style={{ fontWeight: 700 }}>Rs. {stmt.totalAmount.toLocaleString()}</td>
                        <td>
                          <span className={`badge ${stmt.status === 'PAID' ? 'badge-success' : 'badge-warning'}`}>
                            {stmt.status}
                          </span>
                        </td>
                        <td style={{ textAlign: 'right' }}>
                          <div style={{ display: 'flex', gap: '0.35rem', justifyContent: 'flex-end' }}>
                            <button 
                              className="btn btn-secondary btn-sm" 
                              onClick={() => downloadStatementPDF({ ...stmt, customer })}
                              title="Download PDF"
                              style={{ display: 'inline-flex', alignItems: 'center', gap: '0.25rem' }}
                            >
                              <Download size={13} /> PDF
                            </button>
                            <button 
                              className="btn btn-sm" 
                              onClick={() => openStatementWhatsApp(stmt, customer.phone, customer.name)}
                              title="Send to Customer via WhatsApp"
                              style={{ background: '#25D366', color: '#fff', border: 'none', display: 'inline-flex', alignItems: 'center', gap: '0.25rem', padding: '0.35rem 0.6rem' }}
                            >
                              <MessageSquare size={14} /> Send WhatsApp
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
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
      </div>
    </AppShell>
  )
}
