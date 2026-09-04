import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session || session.user?.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  try {
    const now = new Date()
    const year = now.getFullYear()
    const month = now.getMonth() + 1
    
    const start = new Date(year, month - 1, 1)
    const end = new Date(year, month, 0, 23, 59, 59)

    // 1. Fetch ALL data in a SINGLE concurrent batch (eliminates 4 sequential roundtrips)
    const [
      invoices, 
      expenses, 
      customerCount,
      pendingQuotesCount, 
      thisMonthExpensesAgg,
      recentInvoices
    ] = await Promise.all([
      prisma.invoice.findMany({ select: { id: true, invoiceNumber: true, totalAmount: true, paymentStatus: true, date: true } }),
      prisma.expense.aggregate({ _sum: { amount: true }, _count: true }),
      prisma.customer.count(),
      prisma.quotation.count({ where: { status: { in: ['DRAFT', 'SENT'] } } }),
      prisma.expense.aggregate({
        where: {
          date: {
            gte: start,
            lte: end
          }
        },
        _sum: { amount: true }
      }),
      prisma.invoice.findMany({
        take: 6,
        orderBy: { createdAt: 'desc' },
        include: { customer: { select: { name: true, id: true } } }
      })
    ])

    const totalExpenses = expenses._sum.amount || 0
    const thisMonthExpenses = thisMonthExpensesAgg._sum.amount || 0

    const summary = {
      totalRevenue: 0, 
      totalInvoices: invoices.length,
      paidRevenue: 0, 
      paidCount: 0,
      unpaidRevenue: 0, 
      unpaidCount: 0,
      customerCount,
      totalExpenses,
      thisMonthExpenses,
      netProfit: 0,
      pendingQuotesCount
    }

    const startTimestamp = start.getTime()
    const endTimestamp = end.getTime()

    // Single pass over invoices: calculate summary + filter this month's daily invoices
    const thisMonthInvoices: typeof invoices = []
    for (const inv of invoices) {
      summary.totalRevenue += inv.totalAmount
      if (inv.paymentStatus === 'PAID') {
        summary.paidRevenue += inv.totalAmount
        summary.paidCount++
      } else {
        summary.unpaidRevenue += inv.totalAmount
        summary.unpaidCount++
      }

      const invTime = new Date(inv.date).getTime()
      if (invTime >= startTimestamp && invTime <= endTimestamp) {
        thisMonthInvoices.push(inv)
      }
    }
    summary.netProfit = summary.totalRevenue - totalExpenses

    // 2. Build Daily Chart Data in strictly sequential chronological order
    const daysCount = end.getDate()
    const chartData = []
    for (let d = 1; d <= daysCount; d++) {
      const dayStr = String(d).padStart(2, '0')
      let revenue = 0
      let paid = 0
      let count = 0

      for (const inv of thisMonthInvoices) {
        if (new Date(inv.date).getDate() === d) {
          revenue += inv.totalAmount
          count++
          if (inv.paymentStatus === 'PAID') {
            paid += inv.totalAmount
          }
        }
      }

      chartData.push({
        day: dayStr,
        dayNum: d,
        revenue,
        paid,
        count
      })
    }

    return NextResponse.json({
      summary,
      chartData,
      recentInvoices
    })
  } catch (error: any) {
    console.error('Dashboard Fetch Error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
