'use client'
import { useEffect, useState } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { AppShell } from '@/components/AppShell'
import Link from 'next/link'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts'
import { Banknote, CheckCircle, Clock, Users, Receipt, Printer, FileText, BarChart3, TrendingDown, TrendingUp } from 'lucide-react'

import { clientCache } from '@/lib/clientCache'

interface Summary {
  totalRevenue: number; totalInvoices: number
  paidRevenue: number; paidCount: number
  unpaidRevenue: number; unpaidCount: number
  customerCount: number
  totalExpenses?: number
  thisMonthExpenses?: number
  netProfit?: number
  pendingQuotesCount?: number
}

export default function DashboardPage() {
  const { data: session } = useSession()
  const router = useRouter()
  
  const initialCache = clientCache.get('dashboard_data')
  const [summary, setSummary] = useState<Summary | null>(initialCache?.summary || null)
  const [chartData, setChartData] = useState<any[]>(initialCache?.chartData || [])
  const [recentInvoices, setRecentInvoices] = useState<any[]>(initialCache?.recentInvoices || [])
  const [loading, setLoading] = useState(!initialCache)
  const now = new Date()

  useEffect(() => {
    if (session && session.user?.role !== 'ADMIN') {
      router.push('/jobs/new')
    }
  }, [session, router])

  useEffect(() => {
    if (!session || session.user?.role !== 'ADMIN') return

    clientCache.fetchWithCache('dashboard_data', '/api/dashboard', { maxAgeMs: 30_000 })
      .then(dash => {
        if (dash && dash.summary) {
          setSummary(dash.summary)
          setChartData(dash.chartData || [])
          setRecentInvoices(dash.recentInvoices || [])
        }
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }, [session])

  const fmt = (n: number) => `Rs. ${n.toLocaleString('en-LK', { minimumFractionDigits: 2 })}`
  const isProfitable = (summary?.netProfit || 0) >= 0

  const thisMonthSales = chartData.reduce((s, d) => s + (d.revenue || 0), 0)
  const activeDaysCount = chartData.filter(d => (d.revenue || 0) > 0).length
  const dailyAvg = chartData.length > 0 ? thisMonthSales / chartData.length : 0
  const peakDay = chartData.reduce((max, d) => ((d.revenue || 0) > (max?.revenue || 0) ? d : max), null as any)

  return (
    <AppShell>
      <div className="page-header">
        <div className="page-title-group">
          <h1 className="page-title">Dashboard</h1>
          <p className="page-subtitle">Welcome back, {session?.user?.name || 'User'}! Business performance overview.</p>
        </div>
        <div className="page-actions" style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
          <Link href="/jobs/new" className="btn btn-primary">+ New Job</Link>
          <Link href="/quotations/new" className="btn btn-secondary">+ Quotation</Link>
          <Link href="/expenses" className="btn btn-secondary">+ Expense</Link>
          <Link href="/statements/profit-loss" className="btn btn-secondary">P&L Statement</Link>
        </div>
      </div>

      {/* Stat cards - Balanced 3x2 Grid */}
      {loading ? (
        <div className="dashboard-stat-grid mb-6">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="stat-card" style={{ height: 120, animation: 'pulse 1.5s infinite' }} />
          ))}
        </div>
      ) : (
        <div className="dashboard-stat-grid mb-6">
          <div className="stat-card">
            <div className="stat-icon" style={{ background: 'rgba(21,94,150,0.15)', color: 'var(--primary)' }}><Banknote size={20} /></div>
            <div className="stat-label">Total Revenue</div>
            <div className="stat-value">{fmt(summary?.totalRevenue || 0)}</div>
            <div className="stat-sub">{summary?.totalInvoices || 0} invoices</div>
          </div>

          <div className="stat-card">
            <div className="stat-icon" style={{ background: 'rgba(239,68,68,0.15)', color: 'var(--danger)' }}>
              <TrendingDown size={20} />
            </div>
            <div className="stat-label">Total Expenses</div>
            <div className="stat-value" style={{ color: 'var(--danger)' }}>{fmt(summary?.totalExpenses || 0)}</div>
            <div className="stat-sub">This month: {fmt(summary?.thisMonthExpenses || 0)}</div>
          </div>

          <div className="stat-card">
            <div className="stat-icon" style={{
              background: isProfitable ? 'rgba(16,185,129,0.15)' : 'rgba(239,68,68,0.15)',
              color: isProfitable ? 'var(--success)' : 'var(--danger)'
            }}>
              <TrendingUp size={20} />
            </div>
            <div className="stat-label">Net Profit</div>
            <div className="stat-value" style={{ color: isProfitable ? 'var(--success)' : 'var(--danger)' }}>
              {fmt(summary?.netProfit || 0)}
            </div>
            <div className="stat-sub">{isProfitable ? 'Profitable overall' : 'Operating loss'}</div>
          </div>

          <div className="stat-card">
            <div className="stat-icon" style={{ background: 'rgba(16,185,129,0.15)', color: 'var(--success)' }}><CheckCircle size={20} /></div>
            <div className="stat-label">Paid (Collected)</div>
            <div className="stat-value" style={{ color: 'var(--success)' }}>{fmt(summary?.paidRevenue || 0)}</div>
            <div className="stat-sub">{summary?.paidCount || 0} invoices settled</div>
          </div>

          <div className="stat-card">
            <div className="stat-icon" style={{ background: 'rgba(245,158,11,0.15)', color: 'var(--accent)' }}><Clock size={20} /></div>
            <div className="stat-label">Outstanding Receivables</div>
            <div className="stat-value">{fmt(summary?.unpaidRevenue || 0)}</div>
            <div className="stat-sub">{summary?.unpaidCount || 0} invoices unpaid</div>
          </div>

          <div className="stat-card">
            <div className="stat-icon" style={{ background: 'rgba(59,130,246,0.15)', color: 'var(--info)' }}><Users size={20} /></div>
            <div className="stat-label">Customers / Quotes</div>
            <div className="stat-value">{summary?.customerCount || 0}</div>
            <div className="stat-sub">{summary?.pendingQuotesCount || 0} pending quotations</div>
          </div>
        </div>
      )}

      <div className="grid-dashboard">
        {/* Chart */}
        <div className="card" style={{ display: 'flex', flexDirection: 'column' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', flexWrap: 'wrap', gap: '0.5rem' }}>
            <h3 style={{ margin: 0 }}>Daily Sales - {now.toLocaleString('default', { month: 'long', year: 'numeric' })}</h3>
            <span style={{ fontSize: '0.8125rem', color: 'var(--text-muted)' }}>
              Total: <strong style={{ color: 'var(--primary)', fontWeight: 700 }}>{fmt(thisMonthSales)}</strong>
            </span>
          </div>
          {loading ? (
            <div style={{ height: 320, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <span className="spinner" style={{ width: 32, height: 32 }} />
            </div>
          ) : (
            <>
              <div style={{ width: '100%', height: 300 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={chartData} margin={{ top: 10, right: 10, left: 5, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                    <XAxis 
                      dataKey="day" 
                      tick={{ fill: '#64748b', fontSize: 11, fontWeight: 500 }} 
                      axisLine={{ stroke: '#e2e8f0' }} 
                      tickLine={false}
                      interval={chartData.length > 15 ? 1 : 0}
                    />
                    <YAxis 
                      width={55}
                      tick={{ fill: '#64748b', fontSize: 11, fontWeight: 500 }} 
                      axisLine={false} 
                      tickLine={false} 
                      tickFormatter={v => {
                        if (v === 0) return '0'
                        if (v >= 1000000) return `${(v / 1000000).toFixed(1)}M`
                        if (v >= 1000) return `${(v / 1000).toFixed(0)}k`
                        return `${v}`
                      }} 
                    />
                    <Tooltip
                      cursor={{ fill: 'rgba(21, 94, 150, 0.06)' }}
                      contentStyle={{ 
                        background: '#ffffff', 
                        border: '1px solid #cbd5e1', 
                        borderRadius: '8px', 
                        fontSize: '13px', 
                        boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1)' 
                      }}
                      itemStyle={{ color: '#0f172a', fontWeight: 700 }}
                      labelFormatter={(day) => `${day} ${now.toLocaleString('default', { month: 'long', year: 'numeric' })}`}
                      formatter={(v: any) => [`Rs. ${(v || 0).toLocaleString('en-LK', { minimumFractionDigits: 2 })}`, 'Revenue']}
                    />
                    <Bar dataKey="revenue" fill="#155e96" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>

              {/* Monthly Overview Badges */}
              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))',
                gap: '0.75rem',
                marginTop: '0.75rem',
                paddingTop: '0.75rem',
                borderTop: '1px solid var(--border)'
              }}>
                <div style={{ background: 'var(--bg-elevated)', padding: '0.625rem 0.75rem', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)' }}>
                  <div style={{ fontSize: '0.6875rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 600 }}>This Month</div>
                  <div style={{ fontSize: '0.9375rem', fontWeight: 700, color: 'var(--primary)', marginTop: '0.125rem' }}>{fmt(thisMonthSales)}</div>
                </div>
                <div style={{ background: 'var(--bg-elevated)', padding: '0.625rem 0.75rem', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)' }}>
                  <div style={{ fontSize: '0.6875rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 600 }}>Daily Average</div>
                  <div style={{ fontSize: '0.9375rem', fontWeight: 700, marginTop: '0.125rem' }}>{fmt(dailyAvg)}</div>
                </div>
                <div style={{ background: 'var(--bg-elevated)', padding: '0.625rem 0.75rem', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)' }}>
                  <div style={{ fontSize: '0.6875rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 600 }}>Peak Day</div>
                  <div style={{ fontSize: '0.875rem', fontWeight: 700, color: 'var(--text-primary)', marginTop: '0.125rem' }}>
                    {peakDay && peakDay.revenue > 0 ? `Day ${peakDay.day} (${fmt(peakDay.revenue)})` : 'None'}
                  </div>
                </div>
                <div style={{ background: 'var(--bg-elevated)', padding: '0.625rem 0.75rem', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)' }}>
                  <div style={{ fontSize: '0.6875rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 600 }}>Sales Days</div>
                  <div style={{ fontSize: '0.9375rem', fontWeight: 700, color: 'var(--success)', marginTop: '0.125rem' }}>
                    {activeDaysCount} / {chartData.length} days
                  </div>
                </div>
              </div>
            </>
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
