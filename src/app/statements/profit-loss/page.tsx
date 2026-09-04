'use client'
import { useEffect, useState } from 'react'
import { AppShell } from '@/components/AppShell'
import Link from 'next/link'
import { 
  TrendingUp, TrendingDown, DollarSign, Calendar, FileSpreadsheet, 
  FileText, ArrowDownRight, ArrowUpRight, ChevronDown, ChevronRight, Layers, Percent, CheckCircle, AlertTriangle
} from 'lucide-react'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend } from 'recharts'

import { clientCache } from '@/lib/clientCache'

const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December']

export default function ProfitLossPage() {
  const now = new Date()
  const [selectedYear, setSelectedYear] = useState(now.getFullYear())
  const [selectedMonth, setSelectedMonth] = useState(now.getMonth() + 1)
  const [viewType, setViewType] = useState<'monthly' | 'yearly' | 'custom'>('monthly')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')

  const cacheKey = `pl_${viewType}_${selectedYear}_${selectedMonth}_${startDate}_${endDate}`
  const cachedData = clientCache.get(cacheKey)
  const [data, setData] = useState<any>(cachedData)
  const [loading, setLoading] = useState(!cachedData)
  const [expandedCategories, setExpandedCategories] = useState<Record<string, boolean>>({})

  function fetchData() {
    const cached = clientCache.get(cacheKey)
    if (!cached) setLoading(true)
    const params = new URLSearchParams()
    if (viewType === 'monthly') {
      params.set('year', String(selectedYear))
      params.set('month', String(selectedMonth))
    } else if (viewType === 'yearly') {
      params.set('year', String(selectedYear))
    } else if (viewType === 'custom' && startDate && endDate) {
      params.set('startDate', startDate)
      params.set('endDate', endDate)
    }

    fetch(`/api/statements/profit-loss?${params}`)
      .then(r => r.json())
      .then(d => {
        setData(d)
        clientCache.set(cacheKey, d)
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }

  useEffect(() => {
    fetchData()
  }, [selectedYear, selectedMonth, viewType, startDate, endDate])

  const toggleCategory = (cat: string) => {
    setExpandedCategories(prev => ({ ...prev, [cat]: !prev[cat] }))
  }

  const fmt = (n: number) => `Rs. ${(n || 0).toLocaleString('en-LK', { minimumFractionDigits: 2 })}`

  async function exportExcel() {
    if (!data) return
    const { utils, writeFile } = await import('xlsx')
    const wb = utils.book_new()

    // 1. Summary Sheet
    const summaryRows = [
      { 'Metric': 'Reporting Period', 'Value': data.periodLabel },
      { 'Metric': 'Total Invoiced Revenue', 'Value': data.summary.totalRevenue },
      { 'Metric': 'Realized Cash (Paid Invoices)', 'Value': data.summary.paidRevenue },
      { 'Metric': 'Accounts Receivable (Unpaid Invoices)', 'Value': data.summary.unpaidRevenue },
      { 'Metric': 'Total Operating Expenses', 'Value': data.summary.totalExpenses },
      { 'Metric': 'Net Profit (Accrual)', 'Value': data.summary.netProfitAccrual },
      { 'Metric': 'Net Profit (Cash Basis)', 'Value': data.summary.netProfitCash },
      { 'Metric': 'Operating Profit Margin (%)', 'Value': `${data.summary.profitMarginAccrual.toFixed(2)}%` },
    ]
    const wsSummary = utils.json_to_sheet(summaryRows)
    utils.book_append_sheet(wb, wsSummary, 'P&L Summary')

    // 2. Expenses Sheet
    const expenseRows = (data.itemizedExpenses || []).map((exp: any) => ({
      'Expense #': exp.expenseNumber,
      'Date': new Date(exp.date).toLocaleDateString('en-GB'),
      'Description': exp.title,
      'Category': exp.category,
      'Vendor / Payee': exp.vendor || '',
      'Payment Method': exp.paymentMethod || 'CASH',
      'Reference': exp.reference || '',
      'Amount (LKR)': exp.amount
    }))
    const wsExpenses = utils.json_to_sheet(expenseRows)
    utils.book_append_sheet(wb, wsExpenses, 'Itemized Expenses')

    writeFile(wb, `printax-profit-loss-${data.periodLabel.replace(/[^a-zA-Z0-9]/g, '_')}.xlsx`)
  }

  async function exportPDF() {
    if (!data) return
    try {
      const { default: jsPDF } = await import('jspdf')
      const { default: autoTable } = await import('jspdf-autotable')
      const doc = new jsPDF()

      // Logo helper
      const getBase64 = (url: string) => {
        return new Promise<{ url: string; width: number; height: number } | null>((resolve) => {
          const img = new Image()
          img.crossOrigin = 'Anonymous'
          img.onload = () => {
            try {
              const canvas = document.createElement('canvas')
              canvas.width = img.width
              canvas.height = img.height
              const ctx = canvas.getContext('2d')
              if (!ctx) return resolve(null)
              ctx.drawImage(img, 0, 0)
              resolve({ url: canvas.toDataURL('image/png'), width: img.width, height: img.height })
            } catch {
              resolve(null)
            }
          }
          img.onerror = () => resolve(null)
          img.src = url
        })
      }

      const logoData = await getBase64('/logo.png')
      const primaryColor = [21, 94, 150]
      const darkColor = [30, 30, 30]
      const greyColor = [100, 100, 100]

      // Header
      doc.setFontSize(22)
      doc.setFont('helvetica', 'bold')
      doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2])
      doc.text('STATEMENT OF PROFIT & LOSS', 14, 22)

      doc.setFontSize(10)
      doc.setFont('helvetica', 'normal')
      doc.setTextColor(greyColor[0], greyColor[1], greyColor[2])
      doc.text(`Period: ${data.periodLabel}  |  Generated on: ${new Date().toLocaleDateString('en-GB')}`, 14, 29)

      // Logo
      if (logoData) {
        const aspect = logoData.width / logoData.height
        let logoH = 20
        let logoW = logoH * aspect
        if (logoW > 50) logoW = 50
        doc.addImage(logoData.url, 'PNG', 196 - logoW, 12, logoW, logoH)
      }

      // Company Info Line
      doc.setFontSize(8.5)
      doc.text(`${data.settings.businessName} · ${data.settings.phone} · ${data.settings.email}`, 14, 35)

      // Executive Summary Boxes
      doc.setDrawColor(220, 225, 230)
      doc.setFillColor(248, 250, 252)
      doc.roundedRect(14, 40, 182, 22, 2, 2, 'FD')

      doc.setFontSize(8.5)
      doc.setFont('helvetica', 'bold')
      doc.setTextColor(greyColor[0], greyColor[1], greyColor[2])
      doc.text('TOTAL REVENUE', 20, 47)
      doc.text('TOTAL EXPENSES', 80, 47)
      doc.text('NET PROFIT / (LOSS)', 140, 47)

      doc.setFontSize(11)
      doc.setFont('helvetica', 'bold')
      doc.setTextColor(darkColor[0], darkColor[1], darkColor[2])
      doc.text(`Rs. ${data.summary.totalRevenue.toLocaleString('en-LK', { minimumFractionDigits: 2 })}`, 20, 56)

      doc.setTextColor(220, 38, 38)
      doc.text(`Rs. ${data.summary.totalExpenses.toLocaleString('en-LK', { minimumFractionDigits: 2 })}`, 80, 56)

      const isProf = data.summary.isProfitable
      doc.setTextColor(isProf ? 16 : 220, isProf ? 185 : 38, isProf ? 129 : 38)
      doc.text(`Rs. ${data.summary.netProfitAccrual.toLocaleString('en-LK', { minimumFractionDigits: 2 })} (${data.summary.profitMarginAccrual.toFixed(1)}%)`, 140, 56)

      // Formal Statement Table
      const statementRows = [
        ['1. REVENUE & INCOME', '', ''],
        ['   Gross Invoiced Sales', `${data.summary.invoiceCount} invoices`, `Rs. ${data.summary.totalRevenue.toLocaleString('en-LK', { minimumFractionDigits: 2 })}`],
        ['   - Realized Inflow (Paid Invoices)', `${data.summary.paidInvoiceCount} invoices`, `Rs. ${data.summary.paidRevenue.toLocaleString('en-LK', { minimumFractionDigits: 2 })}`],
        ['   - Accounts Receivable (Unpaid)', `${data.summary.invoiceCount - data.summary.paidInvoiceCount} invoices`, `Rs. ${data.summary.unpaidRevenue.toLocaleString('en-LK', { minimumFractionDigits: 2 })}`],
        ['TOTAL OPERATING REVENUE', '', `Rs. ${data.summary.totalRevenue.toLocaleString('en-LK', { minimumFractionDigits: 2 })}`],
        ['', '', ''],
        ['2. OPERATING EXPENSES', '', ''],
        ...data.categoryBreakdown.map((cat: any) => [
          `   ${cat.category}`,
          `${cat.count} items (${cat.percentage.toFixed(1)}%)`,
          `Rs. ${cat.amount.toLocaleString('en-LK', { minimumFractionDigits: 2 })}`
        ]),
        ['TOTAL OPERATING EXPENSES', `${data.summary.expenseCount} entries`, `Rs. ${data.summary.totalExpenses.toLocaleString('en-LK', { minimumFractionDigits: 2 })}`],
        ['', '', ''],
        ['NET PROFIT (ACCRUAL BASIS)', `Margin: ${data.summary.profitMarginAccrual.toFixed(1)}%`, `Rs. ${data.summary.netProfitAccrual.toLocaleString('en-LK', { minimumFractionDigits: 2 })}`],
        ['NET PROFIT (REALIZED CASH BASIS)', `Margin: ${data.summary.profitMarginCash.toFixed(1)}%`, `Rs. ${data.summary.netProfitCash.toLocaleString('en-LK', { minimumFractionDigits: 2 })}`],
      ]

      autoTable(doc, {
        startY: 68,
        head: [['Financial Line Item', 'Details / Share', 'Amount (LKR)']],
        body: statementRows,
        theme: 'plain',
        headStyles: { fillColor: [21, 94, 150], textColor: 255, fontStyle: 'bold' },
        styles: { fontSize: 9, cellPadding: 2.8 },
        columnStyles: {
          0: { cellWidth: 100 },
          1: { cellWidth: 42, halign: 'center' },
          2: { cellWidth: 40, halign: 'right' }
        },
        didParseCell: (hookData) => {
          const text = hookData.cell.raw as string
          if (text && (text.startsWith('TOTAL') || text.startsWith('NET PROFIT') || text.startsWith('1.') || text.startsWith('2.'))) {
            hookData.cell.styles.fontStyle = 'bold'
            if (text.startsWith('NET PROFIT')) {
              hookData.cell.styles.textColor = isProf ? [16, 140, 100] : [220, 38, 38]
              hookData.cell.styles.fontSize = 9.5
            }
          }
        }
      })

      const finalY = (doc as any).lastAutoTable.finalY + 18
      doc.setFontSize(8.5)
      doc.setFont('helvetica', 'normal')
      doc.setTextColor(greyColor[0], greyColor[1], greyColor[2])
      doc.line(14, finalY + 10, 70, finalY + 10)
      doc.text('Prepared By', 14, finalY + 15)

      doc.line(140, finalY + 10, 196, finalY + 10)
      doc.text('Authorized Signature', 140, finalY + 15)

      doc.save(`Profit-Loss-Statement-${data.periodLabel}.pdf`)
    } catch (e) {
      console.error('PDF error', e)
      alert('Failed to generate PDF')
    }
  }

  return (
    <AppShell>
      <div className="page-header">
        <div className="page-title-group">
          <h1 className="page-title">Profit & Loss Statement</h1>
          <p className="page-subtitle">
            Financial statement subtracting operating expenses from business revenue to show net profitability
          </p>
        </div>

        <div className="page-actions" style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
          <button className="btn btn-secondary" onClick={exportExcel} disabled={loading || !data} style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
            <FileSpreadsheet size={16} /> Export Excel
          </button>
          <button className="btn btn-primary" onClick={exportPDF} disabled={loading || !data} style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
            <FileText size={16} /> Download Statement PDF
          </button>
        </div>
      </div>

      {/* Period Filter Bar */}
      <div className="card" style={{ marginBottom: '1.5rem', padding: '1rem 1.25rem' }}>
        <div style={{ display: 'flex', gap: '1.25rem', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', flexWrap: 'wrap' }}>
            <span style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--text-secondary)' }}>View:</span>
            <div className="tabs">
              <button className={`tab ${viewType === 'monthly' ? 'active' : ''}`} onClick={() => setViewType('monthly')}>
                Monthly
              </button>
              <button className={`tab ${viewType === 'yearly' ? 'active' : ''}`} onClick={() => setViewType('yearly')}>
                Full Year
              </button>
              <button className={`tab ${viewType === 'custom' ? 'active' : ''}`} onClick={() => setViewType('custom')}>
                Custom Range
              </button>
            </div>
          </div>

          <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', flexWrap: 'wrap' }}>
            {viewType === 'monthly' && (
              <>
                <select
                  className="form-control"
                  style={{ width: '140px' }}
                  value={selectedMonth}
                  onChange={e => setSelectedMonth(Number(e.target.value))}
                >
                  {MONTHS.map((m, idx) => (
                    <option key={idx + 1} value={idx + 1}>{m}</option>
                  ))}
                </select>
                <select
                  className="form-control"
                  style={{ width: '100px' }}
                  value={selectedYear}
                  onChange={e => setSelectedYear(Number(e.target.value))}
                >
                  {[now.getFullYear() - 1, now.getFullYear(), now.getFullYear() + 1].map(y => (
                    <option key={y} value={y}>{y}</option>
                  ))}
                </select>
              </>
            )}

            {viewType === 'yearly' && (
              <select
                className="form-control"
                style={{ width: '120px' }}
                value={selectedYear}
                onChange={e => setSelectedYear(Number(e.target.value))}
              >
                {[now.getFullYear() - 1, now.getFullYear(), now.getFullYear() + 1].map(y => (
                  <option key={y} value={y}>{y}</option>
                ))}
              </select>
            )}

            {viewType === 'custom' && (
              <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                <input
                  type="date"
                  className="form-control"
                  style={{ width: '150px' }}
                  value={startDate}
                  onChange={e => setStartDate(e.target.value)}
                />
                <span style={{ color: 'var(--text-muted)' }}>to</span>
                <input
                  type="date"
                  className="form-control"
                  style={{ width: '150px' }}
                  value={endDate}
                  onChange={e => setEndDate(e.target.value)}
                />
              </div>
            )}
          </div>
        </div>
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: '4rem' }}><span className="spinner" /></div>
      ) : !data ? (
        <div className="card" style={{ textAlign: 'center', padding: '3rem' }}>
          <p>No financial data available for the selected period.</p>
        </div>
      ) : (
        <>
          {/* Executive KPI Cards */}
          <div className="stat-grid mb-6">
            <div className="stat-card">
              <div className="stat-icon" style={{ background: 'rgba(21,94,150,0.12)', color: 'var(--primary)' }}>
                <TrendingUp size={22} />
              </div>
              <div className="stat-label">Total Revenue (Invoiced)</div>
              <div className="stat-value">{fmt(data.summary.totalRevenue)}</div>
              <div className="stat-sub">
                Collected: <span style={{ color: 'var(--success)', fontWeight: 600 }}>{fmt(data.summary.paidRevenue)}</span>
              </div>
            </div>

            <div className="stat-card">
              <div className="stat-icon" style={{ background: 'rgba(239,68,68,0.12)', color: 'var(--danger)' }}>
                <TrendingDown size={22} />
              </div>
              <div className="stat-label">Total Operating Expenses</div>
              <div className="stat-value" style={{ color: 'var(--danger)' }}>{fmt(data.summary.totalExpenses)}</div>
              <div className="stat-sub">{data.summary.expenseCount} custom added expenses</div>
            </div>

            <div className="stat-card">
              <div
                className="stat-icon"
                style={{
                  background: data.summary.isProfitable ? 'rgba(16,185,129,0.12)' : 'rgba(239,68,68,0.12)',
                  color: data.summary.isProfitable ? 'var(--success)' : 'var(--danger)'
                }}
              >
                {data.summary.isProfitable ? <ArrowUpRight size={22} /> : <ArrowDownRight size={22} />}
              </div>
              <div className="stat-label">Net Profit (Revenue - Expenses)</div>
              <div
                className="stat-value"
                style={{ color: data.summary.isProfitable ? 'var(--success)' : 'var(--danger)' }}
              >
                {fmt(data.summary.netProfitAccrual)}
              </div>
              <div className="stat-sub">
                Realized Cash Profit: <strong>{fmt(data.summary.netProfitCash)}</strong>
              </div>
            </div>

            <div className="stat-card">
              <div className="stat-icon" style={{ background: 'rgba(245,158,11,0.12)', color: 'var(--accent)' }}>
                <Percent size={22} />
              </div>
              <div className="stat-label">Net Profit Margin</div>
              <div
                className="stat-value"
                style={{ color: data.summary.isProfitable ? 'var(--success)' : 'var(--danger)' }}
              >
                {data.summary.profitMarginAccrual.toFixed(1)}%
              </div>
              <div className="stat-sub">
                {data.summary.isProfitable ? 'Operating at a Profit' : 'Operating at a Net Loss'}
              </div>
            </div>
          </div>

          {/* Visual Trend Chart */}
          {data.monthlyTrend && data.monthlyTrend.length > 0 && (
            <div className="card mb-6">
              <h3 style={{ marginBottom: '1rem' }}>Annual Financial Performance ({selectedYear})</h3>
              <div style={{ width: '100%', height: 320 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={data.monthlyTrend} margin={{ top: 10, right: 10, left: 10, bottom: 20 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                    <XAxis dataKey="month" tick={{ fontSize: 12 }} />
                    <YAxis tick={{ fontSize: 12 }} tickFormatter={v => `Rs. ${(v / 1000).toFixed(0)}k`} />
                    <Tooltip
                      formatter={(val: any) => [`Rs. ${Number(val).toLocaleString('en-LK')}`, '']}
                      contentStyle={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: '8px', fontSize: '13px' }}
                    />
                    <Legend verticalAlign="top" height={36} />
                    <Bar dataKey="revenue" name="Invoiced Revenue" fill="#155e96" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="expenses" name="Operating Expenses" fill="#ef4444" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="netProfit" name="Net Profit" fill="#10b981" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}

          {/* Formal Accounting Income Statement */}
          <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
            <div style={{ padding: '1.25rem 1.5rem', borderBottom: '1px solid var(--border)', background: 'var(--bg-base)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <h3 style={{ fontSize: '1.15rem' }}>Income Statement (Profit & Loss)</h3>
                <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Period: {data.periodLabel}</span>
              </div>
              <span className={`badge ${data.summary.isProfitable ? 'badge-success' : 'badge-danger'}`} style={{ fontSize: '0.85rem', padding: '0.35rem 0.75rem' }}>
                {data.summary.isProfitable ? 'Profitable' : 'Loss'}
              </span>
            </div>

            <div style={{ padding: '1.5rem' }}>
              {/* 1. REVENUE SECTION */}
              <div style={{ marginBottom: '2rem' }}>
                <div style={{
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                  paddingBottom: '0.5rem', borderBottom: '2px solid var(--primary)', marginBottom: '0.75rem'
                }}>
                  <strong style={{ fontSize: '1.05rem', color: 'var(--primary)' }}>1. REVENUE & INFLOW</strong>
                  <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Amount (LKR)</span>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', fontSize: '0.95rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', padding: '0.35rem 0' }}>
                    <span>Gross Sales & Invoiced Work ({data.summary.invoiceCount} invoices)</span>
                    <span style={{ fontWeight: 600 }}>{fmt(data.summary.totalRevenue)}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', padding: '0.35rem 0', color: 'var(--text-secondary)', paddingLeft: '1.25rem' }}>
                    <span>- Realized Cash Collected (Paid invoices)</span>
                    <span style={{ color: 'var(--success)' }}>{fmt(data.summary.paidRevenue)}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', padding: '0.35rem 0', color: 'var(--text-secondary)', paddingLeft: '1.25rem' }}>
                    <span>- Accounts Receivable (Unpaid invoices)</span>
                    <span style={{ color: 'var(--accent)' }}>{fmt(data.summary.unpaidRevenue)}</span>
                  </div>

                  <div style={{
                    display: 'flex', justifyContent: 'space-between', borderTop: '1px solid var(--border)',
                    paddingTop: '0.6rem', marginTop: '0.25rem', fontWeight: 700, fontSize: '1.05rem'
                  }}>
                    <span>TOTAL OPERATING REVENUE</span>
                    <span style={{ color: 'var(--primary)' }}>{fmt(data.summary.totalRevenue)}</span>
                  </div>
                </div>
              </div>

              {/* 2. EXPENSES SECTION */}
              <div style={{ marginBottom: '2rem' }}>
                <div style={{
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                  paddingBottom: '0.5rem', borderBottom: '2px solid var(--danger)', marginBottom: '0.75rem'
                }}>
                  <strong style={{ fontSize: '1.05rem', color: 'var(--danger)' }}>2. OPERATING EXPENSES (CUSTOM ADDED)</strong>
                  <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Amount (LKR)</span>
                </div>

                {data.categoryBreakdown.length === 0 ? (
                  <div style={{ padding: '1rem', color: 'var(--text-muted)', textAlign: 'center' }}>
                    No expenses recorded in this period.
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', fontSize: '0.95rem' }}>
                    {data.categoryBreakdown.map((cat: any) => {
                      const isExpanded = !!expandedCategories[cat.category]
                      const catExpenses = (data.itemizedExpenses || []).filter((e: any) => e.category === cat.category)

                      return (
                        <div key={cat.category} style={{ borderBottom: '1px dashed var(--border)', paddingBottom: '0.4rem' }}>
                          <div
                            style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer', padding: '0.25rem 0' }}
                            onClick={() => toggleCategory(cat.category)}
                          >
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                              {isExpanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                              <span>{cat.category}</span>
                              <span className="badge badge-muted" style={{ fontSize: '0.75rem' }}>
                                {cat.count} items · {cat.percentage.toFixed(1)}%
                              </span>
                            </div>
                            <span style={{ fontWeight: 600 }}>{fmt(cat.amount)}</span>
                          </div>

                          {/* Expanded itemized list */}
                          {isExpanded && (
                            <div style={{ marginTop: '0.5rem', marginBottom: '0.5rem', paddingLeft: '1.75rem', background: 'var(--bg-base)', borderRadius: '6px', padding: '0.5rem 1rem' }}>
                              {catExpenses.map((e: any) => (
                                <div key={e.id} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', padding: '0.25rem 0' }}>
                                  <div>
                                    <span>{new Date(e.date).toLocaleDateString('en-GB')} — {e.title}</span>
                                    {e.vendor && <span style={{ color: 'var(--text-muted)' }}> ({e.vendor})</span>}
                                  </div>
                                  <span style={{ fontWeight: 500 }}>{fmt(e.amount)}</span>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      )
                    })}

                    <div style={{
                      display: 'flex', justifyContent: 'space-between', borderTop: '1px solid var(--border)',
                      paddingTop: '0.6rem', marginTop: '0.25rem', fontWeight: 700, fontSize: '1.05rem'
                    }}>
                      <span>TOTAL OPERATING EXPENSES</span>
                      <span style={{ color: 'var(--danger)' }}>{fmt(data.summary.totalExpenses)}</span>
                    </div>
                  </div>
                )}
              </div>

              {/* 3. NET PROFIT CALCULATION */}
              <div style={{
                background: data.summary.isProfitable ? 'rgba(16,185,129,0.06)' : 'rgba(239,68,68,0.06)',
                border: `2px solid ${data.summary.isProfitable ? 'var(--success)' : 'var(--danger)'}`,
                borderRadius: '12px',
                padding: '1.25rem 1.5rem'
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                  <div>
                    <h3 style={{
                      fontSize: '1.3rem',
                      color: data.summary.isProfitable ? 'var(--success)' : 'var(--danger)',
                      display: 'flex', alignItems: 'center', gap: '0.5rem'
                    }}>
                      {data.summary.isProfitable ? <CheckCircle size={22} /> : <AlertTriangle size={22} />}
                      NET PROFIT (REVENUE - EXPENSES)
                    </h3>
                    <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                      Accrual basis accounting for the period
                    </div>
                  </div>

                  <div style={{ textAlign: 'right' }}>
                    <div style={{
                      fontSize: '1.6rem',
                      fontWeight: 800,
                      color: data.summary.isProfitable ? 'var(--success)' : 'var(--danger)'
                    }}>
                      {fmt(data.summary.netProfitAccrual)}
                    </div>
                    <div style={{ fontSize: '0.85rem', fontWeight: 600 }}>
                      Margin: {data.summary.profitMarginAccrual.toFixed(1)}%
                    </div>
                  </div>
                </div>

                <div style={{
                  borderTop: '1px solid rgba(0,0,0,0.08)',
                  paddingTop: '0.75rem',
                  marginTop: '0.5rem',
                  display: 'flex',
                  justifyContent: 'space-between',
                  fontSize: '0.9rem',
                  color: 'var(--text-secondary)'
                }}>
                  <span>Realized Cash Profit (Actual Paid Inflow - Expenses):</span>
                  <strong>{fmt(data.summary.netProfitCash)}</strong>
                </div>
              </div>
            </div>
          </div>
        </>
      )}
    </AppShell>
  )
}
