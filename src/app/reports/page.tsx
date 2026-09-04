'use client'
import { useEffect, useState } from 'react'
import { AppShell } from '@/components/AppShell'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, LineChart, Line } from 'recharts'
import { Users, FileSpreadsheet, FileText } from 'lucide-react'

const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']

export default function ReportsPage() {
  const { data: session } = useSession()
  const router = useRouter()
  const now = new Date()
  const [tab, setTab] = useState<'daily' | 'monthly' | 'customer'>('monthly')
  const [year, setYear] = useState(now.getFullYear())
  const [month, setMonth] = useState(now.getMonth() + 1)
  const [data, setData] = useState<any[]>([])
  const [summary, setSummary] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (session && session.user?.role !== 'ADMIN') {
      router.push('/jobs/new')
    }
  }, [session, router])

  useEffect(() => {
    if (!session || session.user?.role !== 'ADMIN') return
    setLoading(true)
    Promise.all([
      fetch(`/api/reports?type=${tab}&year=${year}&month=${month}`).then(r => r.json()),
      fetch('/api/reports?type=summary').then(r => r.json()),
    ]).then(([d, s]) => { setData(d.data || []); setSummary(s); setLoading(false) })
  }, [tab, year, month, session])

  async function exportExcel() {
    const { utils, writeFile } = await import('xlsx')
    const ws = utils.json_to_sheet(data)
    const wb = utils.book_new()
    utils.book_append_sheet(wb, ws, 'Report')
    writeFile(wb, `printax-${tab}-report-${year}.xlsx`)
  }

  async function exportPDF() {
    const { default: jsPDF } = await import('jspdf')
    const { default: autoTable } = await import('jspdf-autotable')
    const doc = new jsPDF()
    doc.setFontSize(18); doc.setTextColor(21, 94, 150)
    doc.text('printax.lk - Sales Report', 14, 20)
    doc.setFontSize(10); doc.setTextColor(100)
    doc.text(`Type: ${tab.toUpperCase()} · Period: ${MONTHS[month-1]} ${year}`, 14, 28)

    const cols: Record<string, string[]> = {
      daily: ['Day', 'Revenue', 'Paid', 'Invoice Count'],
      monthly: ['Month', 'Revenue', 'Paid', 'Invoice Count'],
      customer: ['Customer', 'Total Revenue', 'Paid', 'Outstanding', 'Invoices'],
    }
    const mapRow = (row: any) => {
      if (tab === 'daily') return [row.day, `Rs. ${row.revenue.toLocaleString()}`, `Rs. ${row.paid.toLocaleString()}`, row.count]
      if (tab === 'monthly') return [row.month, `Rs. ${row.revenue.toLocaleString()}`, `Rs. ${row.paid.toLocaleString()}`, row.count]
      return [row.name, `Rs. ${row.totalRevenue?.toLocaleString()}`, `Rs. ${row.paidAmount?.toLocaleString()}`, `Rs. ${row.outstanding?.toLocaleString()}`, row.invoiceCount]
    }
    autoTable(doc, {
      startY: 36,
      head: [cols[tab]],
      body: data.map(mapRow),
      styles: { fontSize: 9 },
      headStyles: { fillColor: [21, 94, 150] },
    })
    doc.save(`printax-${tab}-report.pdf`)
  }

  const fmt = (n: number) => `Rs. ${(n || 0).toLocaleString()}`
  const tooltipStyle = { background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '8px', fontSize: '13px', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)', color: '#0f172a' }

  return (
    <AppShell>
      <div className="page-header">
        <div className="page-title-group">
          <h1 className="page-title">Reports</h1>
          <p className="page-subtitle">Sales, revenue and customer analytics</p>
        </div>
        <div className="page-actions">
          <button className="btn btn-secondary" onClick={exportExcel} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}><FileSpreadsheet size={16} /> Export Excel</button>
          <button className="btn btn-secondary" onClick={exportPDF} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}><FileText size={16} /> Export PDF</button>
        </div>
      </div>

      {/* Summary */}
      {summary && (
        <div className="stat-grid mb-6">
          <div className="stat-card">
            <div className="stat-label">Total Revenue</div>
            <div className="stat-value" style={{ fontSize: '1.375rem' }}>{fmt(summary.totalRevenue)}</div>
            <div className="stat-sub">{summary.totalInvoices} invoices</div>
          </div>
          <div className="stat-card">
            <div className="stat-label">Collected</div>
            <div className="stat-value" style={{ fontSize: '1.375rem', color: 'var(--success)' }}>{fmt(summary.paidRevenue)}</div>
            <div className="stat-sub">{summary.paidCount} paid</div>
          </div>
          <div className="stat-card">
            <div className="stat-label">Outstanding</div>
            <div className="stat-value" style={{ fontSize: '1.375rem', color: 'var(--danger)' }}>{fmt(summary.unpaidRevenue)}</div>
            <div className="stat-sub">{summary.unpaidCount} unpaid</div>
          </div>
          <div className="stat-card">
            <div className="stat-label">Customers</div>
            <div className="stat-value" style={{ fontSize: '1.375rem' }}>{summary.customerCount}</div>
          </div>
        </div>
      )}

      {/* Controls */}
      <div style={{ display: 'flex', gap: '0.75rem', marginBottom: '1.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
        <div className="tabs">
          {(['monthly', 'daily', 'customer'] as const).map(t => (
            <button key={t} className={`tab ${tab === t ? 'active' : ''}`} onClick={() => setTab(t)}>
              {t.charAt(0).toUpperCase() + t.slice(1)}
            </button>
          ))}
        </div>
        {tab !== 'customer' && (
          <>
            <select className="form-control" style={{ width: 'auto' }} value={year} onChange={e => setYear(+e.target.value)}>
              {[2024, 2025, 2026, 2027].map(y => <option key={y} value={y}>{y}</option>)}
            </select>
            {tab === 'daily' && (
              <select className="form-control" style={{ width: 'auto' }} value={month} onChange={e => setMonth(+e.target.value)}>
                {MONTHS.map((m, i) => <option key={i} value={i + 1}>{m}</option>)}
              </select>
            )}
          </>
        )}
      </div>

      {/* Chart */}
      <div className="card" style={{ marginBottom: '1.5rem' }}>
        <h3 style={{ marginBottom: '1.5rem' }}>
          {tab === 'monthly' ? `Monthly Revenue - ${year}` : tab === 'daily' ? `Daily Revenue - ${MONTHS[month-1]} ${year}` : 'Customer Revenue'}
        </h3>
        {loading ? (
          <div style={{ height: 300, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <span className="spinner" style={{ width: 32, height: 32 }} />
          </div>
        ) : tab === 'customer' ? (
          data.length === 0 ? (
            <div style={{ height: 300, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)' }}>
              <div style={{ marginBottom: '1rem', opacity: 0.4 }}><Users size={40} /></div>
              <p>No customer data found.</p>
              <p style={{ fontSize: '0.875rem' }}>Create customers and assign invoices to them to see analytics here.</p>
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={data.slice(0, 15)} layout="vertical" margin={{ left: 100 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" horizontal={false} />
                <XAxis type="number" tick={{ fill: '#475569', fontSize: 11 }} axisLine={false} tickLine={false} tickFormatter={v => `${v}`} />
                <YAxis type="category" dataKey="name" tick={{ fill: '#94a3b8', fontSize: 11 }} axisLine={false} tickLine={false} />
                <Tooltip contentStyle={tooltipStyle} formatter={(v: any) => [`Rs. ${(v || 0).toLocaleString()}`, '']} />
                <Bar dataKey="totalRevenue" fill="#155e96" radius={[0, 4, 4, 0]} name="Total Revenue" />
                <Bar dataKey="paidAmount" fill="#10b981" radius={[0, 4, 4, 0]} name="Paid" />
              </BarChart>
            </ResponsiveContainer>
          )
        ) : (
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={data} margin={{ top: 0, right: 0, left: 0, bottom: 0 }}>
              <XAxis dataKey={tab === 'daily' ? 'day' : 'month'} tick={{ fill: '#64748b', fontSize: 11 }} axisLine={false} tickLine={false} interval={tab === 'daily' ? 1 : 0} />
              <YAxis 
                tick={{ fill: '#64748b', fontSize: 11 }} 
                axisLine={false} 
                tickLine={false} 
                tickFormatter={v => v >= 1000000 ? `${(v/1000000).toFixed(1)}M` : v >= 1000 ? `${(v/1000).toFixed(0)}k` : `${v}`} 
              />
              <Tooltip contentStyle={tooltipStyle} formatter={(v: any, name: any) => [`Rs. ${(v || 0).toLocaleString()}`, name === 'revenue' ? 'Revenue' : 'Paid']} />
              <Bar dataKey="revenue" fill="#155e96" radius={[4, 4, 0, 0]} name="revenue" />
              <Bar dataKey="paid" fill="#10b981" radius={[4, 4, 0, 0]} name="paid" />
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>

      {/* Data table */}
      <div className="table-wrapper">
        <table>
          <thead>
            <tr>
              {tab === 'customer'
                ? ['Customer', 'Total Revenue', 'Paid', 'Outstanding', 'Invoices'].map(h => <th key={h}>{h}</th>)
                : [tab === 'daily' ? 'Day' : 'Month', 'Revenue', 'Paid', 'Invoices'].map(h => <th key={h}>{h}</th>)
              }
            </tr>
          </thead>
          <tbody>
            {data.length === 0 ? (
              <tr>
                <td colSpan={5} style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted)' }}>
                  No data available to display.
                </td>
              </tr>
            ) : data.map((row: any, i: number) => (
              <tr key={i}>
                {tab === 'customer' ? (
                  <>
                    <td style={{ fontWeight: 600 }}>{row.name}</td>
                    <td style={{ fontWeight: 700 }}>Rs. {row.totalRevenue?.toLocaleString()}</td>
                    <td style={{ color: 'var(--success)' }}>Rs. {row.paidAmount?.toLocaleString()}</td>
                    <td style={{ color: row.outstanding > 0 ? 'var(--danger)' : 'var(--text-secondary)' }}>Rs. {row.outstanding?.toLocaleString()}</td>
                    <td style={{ color: 'var(--text-secondary)' }}>{row.invoiceCount}</td>
                  </>
                ) : (
                  <>
                    <td style={{ fontWeight: 600 }}>{tab === 'daily' ? row.day : row.month}</td>
                    <td style={{ fontWeight: 700 }}>Rs. {row.revenue?.toLocaleString()}</td>
                    <td style={{ color: 'var(--success)' }}>Rs. {row.paid?.toLocaleString()}</td>
                    <td style={{ color: 'var(--text-secondary)' }}>{row.count}</td>
                  </>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </AppShell>
  )
}
