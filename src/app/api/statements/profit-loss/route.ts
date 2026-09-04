import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'

const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
const FULL_MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
]

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const { searchParams } = new URL(req.url)
    const yearParam = searchParams.get('year')
    const monthParam = searchParams.get('month')
    const startDateParam = searchParams.get('startDate')
    const endDateParam = searchParams.get('endDate')

    const now = new Date()
    const currentYear = yearParam ? parseInt(yearParam, 10) : now.getFullYear()
    const month = monthParam ? parseInt(monthParam, 10) : null

    let rangeStart: Date
    let rangeEnd: Date
    let periodLabel: string

    if (startDateParam && endDateParam) {
      rangeStart = new Date(startDateParam)
      rangeStart.setHours(0, 0, 0, 0)
      rangeEnd = new Date(endDateParam)
      rangeEnd.setHours(23, 59, 59, 999)
      periodLabel = `${rangeStart.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })} - ${rangeEnd.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`
    } else if (month) {
      rangeStart = new Date(currentYear, month - 1, 1, 0, 0, 0, 0)
      rangeEnd = new Date(currentYear, month, 0, 23, 59, 59, 999)
      periodLabel = `${FULL_MONTH_NAMES[month - 1]} ${currentYear}`
    } else {
      rangeStart = new Date(currentYear, 0, 1, 0, 0, 0, 0)
      rangeEnd = new Date(currentYear, 11, 31, 23, 59, 59, 999)
      periodLabel = `Full Year ${currentYear}`
    }

    // Invoices in range
    const invoicesPromise = prisma.invoice.findMany({
      where: {
        date: { gte: rangeStart, lte: rangeEnd },
      },
      select: {
        id: true,
        invoiceNumber: true,
        date: true,
        totalAmount: true,
        paymentStatus: true,
        paymentMethod: true,
        customer: { select: { name: true, type: true } },
      },
      orderBy: { date: 'asc' }
    })

    // Expenses in range
    const expensesPromise = prisma.expense.findMany({
      where: {
        date: { gte: rangeStart, lte: rangeEnd },
      },
      orderBy: { date: 'desc' }
    })

    // Settings
    const settingsPromise = prisma.settings.findFirst()

    // Monthly trend (for current year)
    const yearStart = new Date(currentYear, 0, 1, 0, 0, 0, 0)
    const yearEnd = new Date(currentYear, 11, 31, 23, 59, 59, 999)

    const yearInvoicesPromise = prisma.invoice.findMany({
      where: { date: { gte: yearStart, lte: yearEnd } },
      select: { date: true, totalAmount: true, paymentStatus: true }
    })

    const yearExpensesPromise = prisma.expense.findMany({
      where: { date: { gte: yearStart, lte: yearEnd } },
      select: { date: true, amount: true }
    })

    const [invoices, expenses, settings, yearInvoices, yearExpenses] = await Promise.all([
      invoicesPromise,
      expensesPromise,
      settingsPromise,
      yearInvoicesPromise,
      yearExpensesPromise,
    ])

    // Calculations for the selected period
    const totalInvoicedRevenue = invoices.reduce((acc, inv) => acc + inv.totalAmount, 0)
    const paidRevenue = invoices
      .filter(inv => inv.paymentStatus === 'PAID')
      .reduce((acc, inv) => acc + inv.totalAmount, 0)
    const unpaidRevenue = invoices
      .filter(inv => inv.paymentStatus === 'UNPAID')
      .reduce((acc, inv) => acc + inv.totalAmount, 0)
    const invoiceCount = invoices.length
    const paidInvoiceCount = invoices.filter(inv => inv.paymentStatus === 'PAID').length

    const totalExpenses = expenses.reduce((acc, exp) => acc + exp.amount, 0)
    const expenseCount = expenses.length

    // Category breakdown
    const categoryMap: Record<string, { amount: number; count: number }> = {}
    for (const exp of expenses) {
      const cat = exp.category || 'Uncategorized'
      if (!categoryMap[cat]) categoryMap[cat] = { amount: 0, count: 0 }
      categoryMap[cat].amount += exp.amount
      categoryMap[cat].count++
    }

    const categoryBreakdown = Object.entries(categoryMap)
      .map(([cat, val]) => ({
        category: cat,
        amount: val.amount,
        count: val.count,
        percentage: totalExpenses > 0 ? (val.amount / totalExpenses) * 100 : 0
      }))
      .sort((a, b) => b.amount - a.amount)

    // Net Profit Calculations
    const netProfitAccrual = totalInvoicedRevenue - totalExpenses
    const netProfitCash = paidRevenue - totalExpenses
    const profitMarginAccrual = totalInvoicedRevenue > 0
      ? (netProfitAccrual / totalInvoicedRevenue) * 100
      : 0
    const profitMarginCash = paidRevenue > 0
      ? (netProfitCash / paidRevenue) * 100
      : 0

    // Monthly trends for the current year
    const monthlyTrend = MONTH_NAMES.map((m, i) => {
      const monthInvoices = yearInvoices.filter(inv => new Date(inv.date).getMonth() === i)
      const monthExpenses = yearExpenses.filter(exp => new Date(exp.date).getMonth() === i)

      const rev = monthInvoices.reduce((acc, inv) => acc + inv.totalAmount, 0)
      const paid = monthInvoices.filter(inv => inv.paymentStatus === 'PAID').reduce((acc, inv) => acc + inv.totalAmount, 0)
      const exp = monthExpenses.reduce((acc, exp) => acc + exp.amount, 0)
      const profit = rev - exp

      return {
        month: m,
        revenue: rev,
        paidRevenue: paid,
        expenses: exp,
        netProfit: profit
      }
    })

    return NextResponse.json({
      periodLabel,
      rangeStart: rangeStart.toISOString(),
      rangeEnd: rangeEnd.toISOString(),
      summary: {
        totalRevenue: totalInvoicedRevenue,
        paidRevenue,
        unpaidRevenue,
        invoiceCount,
        paidInvoiceCount,
        totalExpenses,
        expenseCount,
        netProfitAccrual,
        netProfitCash,
        profitMarginAccrual,
        profitMarginCash,
        isProfitable: netProfitAccrual >= 0,
      },
      categoryBreakdown,
      itemizedExpenses: expenses,
      monthlyTrend,
      settings: settings || {
        businessName: 'Printax Solutions',
        address: '132, Kolonnawa Road, Demetagoda, Sri Lanka',
        phone: '0727245518',
        email: 'mohommadammar826@gmail.com',
        currency: 'LKR',
      }
    })
  } catch (e: any) {
    console.error('Profit/Loss calculation failed:', e)
    return NextResponse.json({ error: e.message || 'Failed to generate Profit & Loss statement' }, { status: 500 })
  }
}
