'use client'
import { useEffect, useState } from 'react'
import { useSession } from 'next-auth/react'
import { AppShell } from '@/components/AppShell'
import Link from 'next/link'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts'
import { Banknote, CheckCircle, Clock, Users, Receipt, Printer, FileText, BarChart3 } from 'lucide-react'

interface Summary {
  totalRevenue: number; totalInvoices: number
  paidRevenue: number; paidCount: number
  unpaidRevenue: number; unpaidCount: number
  customerCount: number
}

export default function DashboardPage() {
  const { data: session } = useSession()
  const [summary, setSummary] = useState<Summary | null>(null)
  const [chartData, setChartData] = useState<any[]>([])
  const [recentInvoices, setRecentInvoices] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const now = new Date()

  useEffect(() => {
    fetch('/api/dashboard')
      .then(r => r.json())
      .then(data => {
        setSummary(data.summary)
        setChartData(data.chartData || [])
        setRecentInvoices(data.recentInvoices || [])
        setLoading(false)
      })
      .catch(e => {
        console.error(e)
        setLoading(false)
      })
  }, [])

  const fmt = (n: number) => `Rs. ${n.toLocaleString('en-LK', { minimumFractionDigits: 2 })}`

  return (
    <AppShell>
      <div className="page-header">
        <div className="page-title-group">
          <h1 className="page-title">Dashboard</h1>
          <p className="page-subtitle">Welcome back, {session?.user?.name || 'User'}! Here's what's happening today.</p>
        </div>
        <div className="page-actions">
          <Link href="/jobs/new" className="btn btn-primary">+ New Job</Link>
          <Link href="/reports" className="btn btn-secondary">View Reports</Link>
        </div>
      </div>

      {/* Stat cards */}
      {loading ? (
        <div style={{ display: 'flex', gap: '1.25rem' }}>
          {[...Array(4)].map((_, i) => (
            <div key={i} className="stat-card" style={{ flex: 1, height: 120, animation: 'pulse 1.5s infinite' }} />
          ))}
        </div>
      ) : (
        <div className="stat-grid mb-6">
          <div className="stat-card">
            <div className="stat-icon" style={{ background: 'rgba(124,58,237,0.15)', color: '#000' }}><Banknote size={22} /></div>
            <div className="stat-label">Total Revenue</div>
            <div className="stat-value">{fmt(summary?.totalRevenue || 0)}</div>
            <div className="stat-sub">{summary?.totalInvoices || 0} invoices</div>
          </div>
          <div className="stat-card">
            <div className="stat-icon" style={{ background: 'rgba(16,185,129,0.15)', color: 'var(--success)' }}><CheckCircle size={22} /></div>
            <div className="stat-label">Paid</div>
            <div className="stat-value">{fmt(summary?.paidRevenue || 0)}</div>
            <div className="stat-sub">{summary?.paidCount || 0} invoices paid</div>
          </div>
          <div className="stat-card">
            <div className="stat-icon" style={{ background: 'rgba(239,68,68,0.15)', color: 'var(--danger)' }}><Clock size={22} /></div>
            <div className="stat-label">Outstanding</div>
            <div className="stat-value">{fmt(summary?.unpaidRevenue || 0)}</div>
            <div className="stat-sub">{summary?.unpaidCount || 0} unpaid</div>
          </div>
          <div className="stat-card">
            <div className="stat-icon" style={{ background: 'rgba(59,130,246,0.15)', color: 'var(--info)' }}><Users size={22} /></div>
            <div className="stat-label">Customers</div>
            <div className="stat-value">{summary?.customerCount || 0}</div>
            <div className="stat-sub">registered customers</div>
          </div>
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 380px', gap: '1.5rem' }}>
        {/* Chart */}
        <div className="card">
          <h3 style={{ marginBottom: '1.5rem' }}>Daily Sales - {now.toLocaleString('default', { month: 'long', year: 'numeric' })}</h3>
          {loading ? (
            <div style={{ height: 260, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <span className="spinner" style={{ width: 32, height: 32 }} />
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={chartData} margin={{ top: 0, right: 0, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                <XAxis dataKey="day" tick={{ fill: '#475569', fontSize: 11 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: '#475569', fontSize: 11 }} axisLine={false} tickLine={false} tickFormatter={v => `${v}`} />
                <Tooltip
                  cursor={{ fill: 'rgba(0,0,0,0.03)' }}
                  contentStyle={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '8px', fontSize: '13px', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)' }}
                  itemStyle={{ color: '#0f172a', fontWeight: 600 }}
                  formatter={(v: any) => [`Rs. ${(v || 0).toLocaleString('en-LK', { minimumFractionDigits: 2 })}`, 'Daily Revenue']}
                  labelStyle={{ color: '#64748b', marginBottom: '4px', fontWeight: 500 }}
                />
                <Bar dataKey="revenue" fill="#7c3aed" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* Recent invoices */}
        <div className="card">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem' }}>
            <h3>Recent Invoices</h3>
            <Link href="/invoices" className="btn btn-ghost btn-sm">View all</Link>
          </div>
          {loading ? <div className="empty-state"><span className="spinner" /></div> : (
            recentInvoices.length === 0 ? (
              <div className="empty-state" style={{ padding: '2rem' }}>
                <div className="empty-state-icon"><Receipt size={40} /></div>
                <p>No invoices yet</p>
                <Link href="/jobs/new" className="btn btn-primary btn-sm">Create first job</Link>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                {recentInvoices.map((inv: any) => (
                  <Link key={inv.id} href={`/invoices/${inv.id}`} style={{ textDecoration: 'none' }}>
                    <div style={{
                      padding: '0.75rem', borderRadius: 'var(--radius-sm)',
                      background: 'var(--bg-elevated)', border: '1px solid var(--border)',
                      display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                      transition: 'all 0.2s', cursor: 'pointer',
                    }}>
                      <div>
                        <div style={{ fontSize: '0.8125rem', fontWeight: 600, color: 'var(--text-primary)' }}>{inv.invoiceNumber}</div>
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                          {inv.customer?.name || 'Walk-in'} · {new Date(inv.date).toLocaleDateString()}
                        </div>
                      </div>
                      <div style={{ textAlign: 'right' }}>
                        <div style={{ fontSize: '0.875rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                          Rs. {inv.totalAmount.toLocaleString()}
                        </div>
                        <span className={`badge ${inv.paymentStatus === 'PAID' ? 'badge-success' : 'badge-warning'}`}>
                          {inv.paymentStatus}
                        </span>
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            )
          )}
        </div>
      </div>

      {/* Quick actions */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem', marginTop: '1.5rem' }}>
        {[
          { href: '/jobs/new', icon: <Printer size={24} />, label: 'New Print Job', desc: 'Enter a new job' },
          { href: '/customers', icon: <Users size={24} />, label: 'Customers', desc: 'Manage accounts' },
          { href: '/statements', icon: <FileText size={24} />, label: 'Statements', desc: 'Monthly billing' },
          { href: '/reports', icon: <BarChart3 size={24} />, label: 'Reports', desc: 'Sales analytics' },
        ].map(qa => (
          <Link key={qa.href} href={qa.href} style={{ textDecoration: 'none' }}>
            <div className="card" style={{ display: 'flex', alignItems: 'center', gap: '1rem', cursor: 'pointer', transition: 'all 0.2s', color: '#000' }}>
              <div style={{ width: 44, height: 44, borderRadius: 10, background: '#f1f5f9', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.25rem', flexShrink: 0, color: '#000' }}>
                {qa.icon}
              </div>
              <div>
                <div style={{ fontWeight: 600, fontSize: '0.9375rem', color: '#000' }}>{qa.label}</div>
                <div style={{ fontSize: '0.8125rem', color: '#000' }}>{qa.desc}</div>
              </div>
            </div>
          </Link>
        ))}
      </div>
    </AppShell>
  )
}
