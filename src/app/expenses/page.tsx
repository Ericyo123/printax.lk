'use client'
import { useEffect, useState } from 'react'
import { AppShell } from '@/components/AppShell'
import { Pagination } from '@/components/Pagination'
import { 
  Plus, Search, TrendingDown, Calendar, DollarSign, Tag, Filter, 
  FileSpreadsheet, FileText, Trash2, Edit3, X, Check, ArrowUpDown, Building, CreditCard
} from 'lucide-react'

const DEFAULT_CATEGORIES = [
  'Paper & Substrates',
  'Ink, Toner & Cartridges',
  'Machine Maintenance & Repairs',
  'Rent & Facility',
  'Electricity & Utilities',
  'Staff Wages & Commission',
  'Delivery, Fuel & Logistics',
  'Office & Admin Supplies',
  'Marketing & Advertising',
  'Miscellaneous'
]

interface ExpenseItem {
  id: string
  expenseNumber: string
  title: string
  category: string
  amount: number
  date: string
  paymentMethod: string | null
  reference: string | null
  vendor: string | null
  notes: string | null
}

import { clientCache } from '@/lib/clientCache'

export default function ExpensesPage() {
  const cachedData = clientCache.get('expenses_all')
  const [expenses, setExpenses] = useState<ExpenseItem[]>(cachedData?.expenses || [])
  const [total, setTotal] = useState(cachedData?.total || 0)
  const [totalAmount, setTotalAmount] = useState(cachedData?.totalAmount || 0)
  const [categoryBreakdown, setCategoryBreakdown] = useState<any[]>(cachedData?.categoryBreakdown || [])
  const [loading, setLoading] = useState(!cachedData)

  // Multi-select state
  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const [deletingBatch, setDeletingBatch] = useState(false)

  // Filters
  const [search, setSearch] = useState('')
  const [categoryFilter, setCategoryFilter] = useState('')
  const [paymentMethodFilter, setPaymentMethodFilter] = useState('')
  const [period, setPeriod] = useState<'this-month' | 'last-month' | 'this-year' | 'all' | 'custom'>('this-month')
  const [customStart, setCustomStart] = useState('')
  const [customEnd, setCustomEnd] = useState('')

  // Pagination
  const [currentPage, setCurrentPage] = useState(1)
  const itemsPerPage = 12

  // Modal State
  const [showModal, setShowModal] = useState(false)
  const [editingExpense, setEditingExpense] = useState<ExpenseItem | null>(null)
  const [saving, setSaving] = useState(false)

  // Form fields
  const [formTitle, setFormTitle] = useState('')
  const [formCategory, setFormCategory] = useState(DEFAULT_CATEGORIES[0])
  const [formCustomCategory, setFormCustomCategory] = useState('')
  const [formAmount, setFormAmount] = useState<number | ''>('')
  const [formDate, setFormDate] = useState(new Date().toISOString().split('T')[0])
  const [formPaymentMethod, setFormPaymentMethod] = useState('CASH')
  const [formVendor, setFormVendor] = useState('')
  const [formNotes, setFormNotes] = useState('')

  function getDateBounds() {
    const now = new Date()
    const y = now.getFullYear()
    const m = now.getMonth()

    if (period === 'this-month') {
      const start = new Date(y, m, 1).toISOString().split('T')[0]
      const end = new Date(y, m + 1, 0).toISOString().split('T')[0]
      return { startDate: start, endDate: end }
    }
    if (period === 'last-month') {
      const start = new Date(y, m - 1, 1).toISOString().split('T')[0]
      const end = new Date(y, m, 0).toISOString().split('T')[0]
      return { startDate: start, endDate: end }
    }
    if (period === 'this-year') {
      const start = new Date(y, 0, 1).toISOString().split('T')[0]
      const end = new Date(y, 11, 31).toISOString().split('T')[0]
      return { startDate: start, endDate: end }
    }
    if (period === 'custom' && customStart && customEnd) {
      return { startDate: customStart, endDate: customEnd }
    }
    return {}
  }

  function fetchExpenses() {
    const cached = clientCache.get('expenses_all')
    if (!cached) setLoading(true)
    const bounds = getDateBounds()
    const params = new URLSearchParams({ limit: '1000' })
    if (search) params.set('search', search)
    if (categoryFilter) params.set('category', categoryFilter)
    if (paymentMethodFilter) params.set('paymentMethod', paymentMethodFilter)
    if (bounds.startDate && bounds.endDate) {
      params.set('startDate', bounds.startDate)
      params.set('endDate', bounds.endDate)
    }

    fetch(`/api/expenses?${params}`)
      .then(r => r.json())
      .then(d => {
        const expList = d.expenses || []
        setExpenses(expList)
        setTotal(d.total || 0)
        setTotalAmount(d.totalAmount || 0)
        setCategoryBreakdown(d.categoryBreakdown || [])
        if (!categoryFilter && !paymentMethodFilter && !search && period === 'this-month') {
          clientCache.set('expenses_all', d)
        }
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }

  useEffect(() => {
    fetchExpenses()
  }, [categoryFilter, paymentMethodFilter, period, customStart, customEnd])

  const filtered = expenses.filter(exp => {
    if (!search) return true
    const term = search.toLowerCase()
    return (
      exp.title.toLowerCase().includes(term) ||
      exp.expenseNumber.toLowerCase().includes(term) ||
      (exp.vendor && exp.vendor.toLowerCase().includes(term)) ||
      (exp.notes && exp.notes.toLowerCase().includes(term))
    )
  })

  const paginated = filtered.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage)

  const isAllSelected = paginated.length > 0 && paginated.every(e => selectedIds.includes(e.id))

  function toggleSelectAll() {
    if (isAllSelected) {
      setSelectedIds(prev => prev.filter(id => !paginated.some(e => e.id === id)))
    } else {
      const newIds = paginated.map(e => e.id)
      setSelectedIds(prev => Array.from(new Set([...prev, ...newIds])))
    }
  }

  function toggleSelect(id: string) {
    setSelectedIds(prev => prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id])
  }

  async function handleBatchDelete() {
    if (selectedIds.length === 0) return
    if (!window.confirm(`Permanently delete ${selectedIds.length} selected expense record(s)? This cannot be undone.`)) return
    setDeletingBatch(true)
    try {
      const res = await fetch('/api/expenses', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids: selectedIds })
      })
      setDeletingBatch(false)
      if (res.ok) {
        const remaining = expenses.filter(exp => !selectedIds.includes(exp.id))
        setExpenses(remaining)
        setTotal(remaining.length)
        clientCache.invalidate('expenses_all')
        clientCache.invalidate('dashboard_data')
        setSelectedIds([])
        fetchExpenses()
      } else {
        const data = await res.json()
        alert(data.error || 'Failed to delete selected expenses')
      }
    } catch {
      setDeletingBatch(false)
      alert('Error deleting expenses')
    }
  }

  function openCreateModal() {
    setEditingExpense(null)
    setFormTitle('')
    setFormCategory(DEFAULT_CATEGORIES[0])
    setFormCustomCategory('')
    setFormAmount('')
    setFormDate(new Date().toISOString().split('T')[0])
    setFormPaymentMethod('CASH')
    setFormVendor('')
    setFormNotes('')
    setShowModal(true)
  }

  function openEditModal(exp: ExpenseItem) {
    setEditingExpense(exp)
    setFormTitle(exp.title)
    if (DEFAULT_CATEGORIES.includes(exp.category)) {
      setFormCategory(exp.category)
      setFormCustomCategory('')
    } else {
      setFormCategory('CUSTOM')
      setFormCustomCategory(exp.category)
    }
    setFormAmount(exp.amount)
    setFormDate(new Date(exp.date).toISOString().split('T')[0])
    setFormPaymentMethod(exp.paymentMethod || 'CASH')
    setFormVendor(exp.vendor || '')
    setFormNotes(exp.notes || '')
    setShowModal(true)
  }

  async function handleSaveExpense(e: React.FormEvent) {
    e.preventDefault()
    if (!formTitle.trim()) return alert('Please enter expense title')
    if (formAmount === '' || Number(formAmount) <= 0) return alert('Please enter a valid expense amount')

    const resolvedCategory = formCategory === 'CUSTOM' ? formCustomCategory.trim() : formCategory
    if (!resolvedCategory) return alert('Please enter or select a category')

    setSaving(true)
    const payload = {
      title: formTitle.trim(),
      category: resolvedCategory,
      amount: Number(formAmount),
      date: formDate ? new Date(formDate).toISOString() : new Date().toISOString(),
      paymentMethod: formPaymentMethod,
      vendor: formVendor.trim() || null,
      reference: null,
      notes: formNotes.trim() || null,
    }

    try {
      const url = editingExpense ? `/api/expenses/${editingExpense.id}` : '/api/expenses'
      const method = editingExpense ? 'PATCH' : 'POST'

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      })
      const data = await res.json()
      setSaving(false)

      if (res.ok) {
        setShowModal(false)
        clientCache.invalidate('expenses_all')
        clientCache.invalidate('dashboard_data')
        fetchExpenses()
      } else {
        alert(data.error || 'Failed to save expense')
      }
    } catch {
      setSaving(false)
      alert('Network error while saving expense')
    }
  }

  async function handleDeleteExpense(id: string, e: React.MouseEvent) {
    e.stopPropagation()
    if (!window.confirm('Are you sure you want to delete this expense record?')) return
    try {
      const res = await fetch(`/api/expenses/${id}`, { method: 'DELETE' })
      if (res.ok) {
        clientCache.invalidate('expenses_all')
        clientCache.invalidate('dashboard_data')
        fetchExpenses()
      } else {
        alert('Failed to delete expense')
      }
    } catch {
      alert('Error deleting expense')
    }
  }

  async function exportExcel() {
    const { utils, writeFile } = await import('xlsx')
    const rows = filtered.map(exp => ({
      'Expense #': exp.expenseNumber,
      'Date': new Date(exp.date).toLocaleDateString('en-GB'),
      'Title / Description': exp.title,
      'Category': exp.category,
      'Amount (LKR)': exp.amount,
      'Payment Method': exp.paymentMethod || 'CASH',
      'Vendor / Payee': exp.vendor || '',
      'Notes': exp.notes || ''
    }))
    const ws = utils.json_to_sheet(rows)
    const wb = utils.book_new()
    utils.book_append_sheet(wb, ws, 'Expenses')
    writeFile(wb, `printax-expenses-${period}.xlsx`)
  }

  async function exportPDF() {
    const { default: jsPDF } = await import('jspdf')
    const { default: autoTable } = await import('jspdf-autotable')
    const doc = new jsPDF()

    doc.setFontSize(20)
    doc.setTextColor(21, 94, 150)
    doc.setFont('helvetica', 'bold')
    doc.text('Expense Statement', 14, 20)

    doc.setFontSize(10)
    doc.setFont('helvetica', 'normal')
    doc.setTextColor(100)
    doc.text(`Period: ${period.toUpperCase()}  |  Total Expenses: Rs. ${totalAmount.toLocaleString('en-LK', { minimumFractionDigits: 2 })}`, 14, 28)

    const tableRows = filtered.map((exp, idx) => [
      idx + 1,
      exp.expenseNumber,
      new Date(exp.date).toLocaleDateString('en-GB'),
      exp.title,
      exp.category,
      exp.paymentMethod || 'CASH',
      exp.vendor || '-',
      exp.amount.toLocaleString('en-LK', { minimumFractionDigits: 2 })
    ])

    autoTable(doc, {
      startY: 35,
      head: [['#', 'Expense #', 'Date', 'Description', 'Category', 'Method', 'Vendor', 'Amount (Rs.)']],
      body: tableRows,
      theme: 'striped',
      headStyles: { fillColor: [21, 94, 150] },
      styles: { fontSize: 8.5 }
    })

    doc.save(`printax-expenses-${period}.pdf`)
  }

  const fmt = (n: number) => `Rs. ${(n || 0).toLocaleString('en-LK', { minimumFractionDigits: 2 })}`
  const topCategory = categoryBreakdown.length > 0 ? categoryBreakdown[0] : null

  return (
    <AppShell>
      <div className="page-header">
        <div className="page-title-group">
          <h1 className="page-title">Expenses</h1>
          <p className="page-subtitle">Track, categorize, and control your business expenditures</p>
        </div>
        <div className="page-actions" style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
          <button className="btn btn-secondary" onClick={exportExcel} style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
            <FileSpreadsheet size={16} /> Export Excel
          </button>
          <button className="btn btn-secondary" onClick={exportPDF} style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
            <FileText size={16} /> Export PDF
          </button>
          <button className="btn btn-primary" onClick={openCreateModal} style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
            <Plus size={18} /> Add Custom Expense
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="stat-grid mb-6">
        <div className="stat-card">
          <div className="stat-icon" style={{ background: 'rgba(239,68,68,0.12)', color: 'var(--danger)' }}>
            <TrendingDown size={22} />
          </div>
          <div className="stat-label">Total Expenses ({period.replace('-', ' ')})</div>
          <div className="stat-value" style={{ color: 'var(--danger)' }}>{fmt(totalAmount)}</div>
          <div className="stat-sub">{total} recorded expense items</div>
        </div>

        <div className="stat-card">
          <div className="stat-icon" style={{ background: 'rgba(59,130,246,0.12)', color: 'var(--info)' }}>
            <Tag size={22} />
          </div>
          <div className="stat-label">Top Expense Category</div>
          <div className="stat-value" style={{ fontSize: '1.25rem' }}>{topCategory?.category || 'None'}</div>
          <div className="stat-sub">
            {topCategory ? `${fmt(topCategory.amount)} (${topCategory.percentage.toFixed(1)}%)` : 'No expenses'}
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon" style={{ background: 'rgba(16,185,129,0.12)', color: 'var(--success)' }}>
            <DollarSign size={22} />
          </div>
          <div className="stat-label">Average Expense Entry</div>
          <div className="stat-value">{fmt(total > 0 ? totalAmount / total : 0)}</div>
          <div className="stat-sub">Across {total} transactions</div>
        </div>
      </div>

      {/* Filters Bar */}
      <div style={{ display: 'flex', gap: '0.75rem', marginBottom: '1.5rem', flexWrap: 'wrap', alignItems: 'center' }}>
        <div className="search-bar" style={{ flex: '1 1 260px' }}>
          <Search size={18} color="var(--text-muted)" />
          <input
            placeholder="Search by title, payee, receipt #..."
            value={search}
            onChange={e => { setSearch(e.target.value); setCurrentPage(1) }}
          />
        </div>

        {/* Period Selector Tabs */}
        <div className="tabs">
          {[
            { id: 'this-month', label: 'This Month' },
            { id: 'last-month', label: 'Last Month' },
            { id: 'this-year', label: 'This Year' },
            { id: 'all', label: 'All Time' },
            { id: 'custom', label: 'Custom Range' },
          ].map(p => (
            <button
              key={p.id}
              className={`tab ${period === p.id ? 'active' : ''}`}
              onClick={() => { setPeriod(p.id as any); setCurrentPage(1) }}
            >
              {p.label}
            </button>
          ))}
        </div>

        {/* Category Filter */}
        <select
          className="form-control"
          style={{ width: '180px' }}
          value={categoryFilter}
          onChange={e => { setCategoryFilter(e.target.value); setCurrentPage(1) }}
        >
          <option value="">All Categories</option>
          {DEFAULT_CATEGORIES.map(cat => (
            <option key={cat} value={cat}>{cat}</option>
          ))}
        </select>

        {/* Payment Method Filter */}
        <select
          className="form-control"
          style={{ width: '150px' }}
          value={paymentMethodFilter}
          onChange={e => { setPaymentMethodFilter(e.target.value); setCurrentPage(1) }}
        >
          <option value="">All Methods</option>
          <option value="CASH">Cash</option>
          <option value="BANK_TRANSFER">Bank Transfer</option>
          <option value="CARD">Card</option>
          <option value="CHEQUE">Cheque</option>
        </select>
      </div>

      {/* Custom Date Pickers if selected */}
      {period === 'custom' && (
        <div style={{ display: 'flex', gap: '1rem', alignItems: 'center', marginBottom: '1.25rem', background: 'var(--bg-surface)', padding: '0.75rem 1rem', borderRadius: '8px', border: '1px solid var(--border)' }}>
          <span style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-secondary)' }}>Date Range:</span>
          <input
            type="date"
            className="form-control"
            style={{ width: '160px' }}
            value={customStart}
            onChange={e => setCustomStart(e.target.value)}
          />
          <span>to</span>
          <input
            type="date"
            className="form-control"
            style={{ width: '160px' }}
            value={customEnd}
            onChange={e => setCustomEnd(e.target.value)}
          />
        </div>
      )}

      {/* Expenses Table */}
      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        <div className="table-wrapper" style={{ margin: 0, border: 'none', borderRadius: 0 }}>
          <table>
            <thead>
              <tr>
                <th style={{ width: '40px', textAlign: 'center' }}>
                  <input
                    type="checkbox"
                    checked={isAllSelected}
                    onChange={toggleSelectAll}
                    style={{ width: '16px', height: '16px', cursor: 'pointer' }}
                  />
                </th>
                <th>Expense #</th>
                <th>Date</th>
                <th>Description</th>
                <th>Category</th>
                <th>Amount</th>
                <th>Method</th>
                <th>Payee / Vendor</th>
                <th style={{ textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading && expenses.length === 0 ? (
                <tr>
                  <td colSpan={9} style={{ textAlign: 'center', padding: '3rem' }}>
                    <span className="spinner" />
                  </td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={9}>
                    <div className="empty-state">
                      <div className="empty-state-icon"><TrendingDown size={40} /></div>
                      <p>No expenses found for this selection</p>
                      <button onClick={openCreateModal} className="btn btn-primary btn-sm">Add First Expense</button>
                    </div>
                  </td>
                </tr>
              ) : (
                paginated.map(exp => {
                  const isSelected = selectedIds.includes(exp.id)
                  return (
                    <tr key={exp.id} style={{ background: isSelected ? 'var(--primary-subtle, #f0f7ff)' : undefined }}>
                      <td style={{ textAlign: 'center' }} onClick={e => e.stopPropagation()}>
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => toggleSelect(exp.id)}
                          style={{ width: '16px', height: '16px', cursor: 'pointer' }}
                        />
                      </td>
                      <td>
                        <span style={{ fontWeight: 600, color: 'var(--primary)' }}>
                          {exp.expenseNumber}
                        </span>
                      </td>
                      <td>{new Date(exp.date).toLocaleDateString('en-GB')}</td>
                      <td>
                        <div style={{ fontWeight: 600 }}>{exp.title}</div>
                        {exp.notes && (
                          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{exp.notes}</div>
                        )}
                      </td>
                      <td>
                        <span className="badge badge-muted" style={{ fontWeight: 500 }}>
                          {exp.category}
                        </span>
                      </td>
                      <td>
                        <strong style={{ color: 'var(--danger)', fontSize: '0.95rem' }}>
                          {fmt(exp.amount)}
                        </strong>
                      </td>
                      <td>
                        <span style={{ fontSize: '0.85rem' }}>{exp.paymentMethod || 'CASH'}</span>
                      </td>
                      <td>{exp.vendor || <span style={{ color: 'var(--text-muted)' }}>—</span>}</td>
                      <td style={{ textAlign: 'right' }}>
                        <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end', alignItems: 'center' }}>
                          <button
                            className="btn btn-secondary btn-sm"
                            onClick={() => openEditModal(exp)}
                            title="Edit Expense"
                            style={{ padding: '0.35rem 0.6rem' }}
                          >
                            <Edit3 size={15} />
                          </button>
                          <button
                            className="btn btn-sm"
                            onClick={(e) => handleDeleteExpense(exp.id, e)}
                            title="Delete Expense"
                            style={{ color: 'var(--danger)', background: 'transparent', border: '1px solid var(--border)', padding: '0.35rem 0.6rem' }}
                          >
                            <Trash2 size={15} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div style={{ marginTop: '1.5rem' }}>
        <Pagination
          currentPage={currentPage}
          totalItems={filtered.length}
          itemsPerPage={itemsPerPage}
          onPageChange={setCurrentPage}
        />
      </div>

      {/* Add / Edit Custom Expense Modal */}
      {showModal && (
        <div className="modal-overlay" style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(0,0,0,0.5)', zIndex: 1000, display: 'flex',
          alignItems: 'center', justifyContent: 'center', padding: '1rem'
        }}>
          <div className="card" style={{ width: '100%', maxWidth: '580px', maxHeight: '90vh', overflowY: 'auto', padding: '1.75rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
              <h3 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <TrendingDown size={20} color="var(--danger)" />
                {editingExpense ? 'Edit Expense Record' : 'Add Custom Expense'}
              </h3>
              <button
                onClick={() => setShowModal(false)}
                style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}
              >
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleSaveExpense}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                <div>
                  <label className="form-label">Expense Title / Description *</label>
                  <input
                    className="form-control"
                    placeholder="e.g. 80gsm A4 Paper Stock Refill"
                    value={formTitle}
                    onChange={e => setFormTitle(e.target.value)}
                    required
                  />
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                  <div>
                    <label className="form-label">Amount (Rs.) *</label>
                    <input
                      type="number"
                      step="any"
                      min="0.01"
                      className="form-control"
                      placeholder="0.00"
                      value={formAmount}
                      onChange={e => setFormAmount(e.target.value === '' ? '' : Number(e.target.value))}
                      required
                    />
                  </div>
                  <div>
                    <label className="form-label">Expense Date *</label>
                    <input
                      type="date"
                      className="form-control"
                      value={formDate}
                      onChange={e => setFormDate(e.target.value)}
                      required
                    />
                  </div>
                </div>

                {/* Category Selection & Custom Category */}
                <div>
                  <label className="form-label">Expense Category *</label>
                  <select
                    className="form-control"
                    value={formCategory}
                    onChange={e => setFormCategory(e.target.value)}
                  >
                    <option value="CUSTOM">+ Custom Category (Type your own)</option>
                    {DEFAULT_CATEGORIES.map(cat => (
                      <option key={cat} value={cat}>{cat}</option>
                    ))}
                  </select>

                  {formCategory === 'CUSTOM' && (
                    <div style={{ marginTop: '0.5rem' }}>
                      <input
                        className="form-control"
                        placeholder="Enter custom category name..."
                        value={formCustomCategory}
                        onChange={e => setFormCustomCategory(e.target.value)}
                        required
                        autoFocus
                      />
                    </div>
                  )}
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                  <div>
                    <label className="form-label">Payment Method</label>
                    <select
                      className="form-control"
                      value={formPaymentMethod}
                      onChange={e => setFormPaymentMethod(e.target.value)}
                    >
                      <option value="CASH">Cash</option>
                      <option value="BANK_TRANSFER">Bank Transfer</option>
                      <option value="CARD">Debit / Credit Card</option>
                      <option value="CHEQUE">Cheque</option>
                    </select>
                  </div>
                  <div>
                    <label className="form-label">Payee / Vendor / Supplier</label>
                    <input
                      className="form-control"
                      placeholder="e.g. Paper World Ltd"
                      value={formVendor}
                      onChange={e => setFormVendor(e.target.value)}
                    />
                  </div>
                </div>

                <div>
                  <label className="form-label">Notes / Details</label>
                  <textarea
                    className="form-control"
                    rows={2}
                    placeholder="Additional context about this expenditure..."
                    value={formNotes}
                    onChange={e => setFormNotes(e.target.value)}
                  />
                </div>

                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '0.75rem' }}>
                  <button
                    type="button"
                    className="btn btn-secondary"
                    onClick={() => setShowModal(false)}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="btn btn-primary"
                    disabled={saving}
                  >
                    {saving ? 'Saving...' : editingExpense ? 'Update Expense' : 'Save Expense'}
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Floating Batch Actions Bar */}
      {selectedIds.length > 0 && (
        <div style={{
          position: 'fixed',
          bottom: '2rem',
          left: '50%',
          transform: 'translateX(-50%)',
          background: '#1e293b',
          color: '#fff',
          padding: '0.75rem 1.5rem',
          borderRadius: '50px',
          boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.3), 0 8px 10px -6px rgba(0, 0, 0, 0.3)',
          zIndex: 999,
          display: 'flex',
          alignItems: 'center',
          gap: '1.25rem',
          animation: 'fadeIn 0.2s ease-in-out'
        }}>
          <span style={{ fontSize: '0.875rem', fontWeight: 600 }}>
            {selectedIds.length} expense{selectedIds.length === 1 ? '' : 's'} selected
          </span>
          <button
            onClick={handleBatchDelete}
            disabled={deletingBatch}
            className="btn btn-sm"
            style={{
              background: '#ef4444',
              color: '#fff',
              border: 'none',
              padding: '0.45rem 1rem',
              borderRadius: '25px',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.4rem',
              fontWeight: 600,
              cursor: 'pointer'
            }}
          >
            <Trash2 size={15} />
            {deletingBatch ? 'Deleting...' : `Delete Selected (${selectedIds.length})`}
          </button>
          <button
            onClick={() => setSelectedIds([])}
            style={{
              background: 'transparent',
              color: '#94a3b8',
              border: 'none',
              fontSize: '0.8125rem',
              cursor: 'pointer',
              padding: '0.2rem 0.4rem',
              textDecoration: 'underline'
            }}
          >
            Deselect
          </button>
        </div>
      )}
    </AppShell>
  )
}
