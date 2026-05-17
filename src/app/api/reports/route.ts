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
    const { searchParams } = new URL(req.url)
    const type = searchParams.get('type') || 'daily'
    const year = parseInt(searchParams.get('year') || String(new Date().getFullYear()))
    const month = parseInt(searchParams.get('month') || String(new Date().getMonth() + 1))

    if (type === 'daily') {
      // Daily sales for a given month
      const start = new Date(year, month - 1, 1)
      const end = new Date(year, month, 0, 23, 59, 59)
      const invoices = await prisma.invoice.findMany({
        where: { date: { gte: start, lte: end } },
        select: { date: true, totalAmount: true, paymentStatus: true },
      })

      const dailyMap: Record<string, { revenue: number; paid: number; count: number }> = {}
      for (let d = 1; d <= end.getDate(); d++) {
        const key = String(d).padStart(2, '0')
        dailyMap[key] = { revenue: 0, paid: 0, count: 0 }
      }
      for (const inv of invoices) {
        const day = String(new Date(inv.date).getDate()).padStart(2, '0')
        if (dailyMap[day]) {
          dailyMap[day].revenue += inv.totalAmount
          dailyMap[day].count++
          if (inv.paymentStatus === 'PAID') dailyMap[day].paid += inv.totalAmount
        }
      }
      const data = Object.entries(dailyMap).map(([day, vals]) => ({ day, ...vals }))
      return NextResponse.json({ data })
    }

    if (type === 'monthly') {
      // Monthly totals for the year
      const start = new Date(year, 0, 1)
      const end = new Date(year, 11, 31, 23, 59, 59)
      const invoices = await prisma.invoice.findMany({
        where: { date: { gte: start, lte: end } },
        select: { date: true, totalAmount: true, paymentStatus: true },
      })
      const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']
      const monthly = months.map((m, i) => ({ month: m, revenue: 0, paid: 0, count: 0 }))
      for (const inv of invoices) {
        const mi = new Date(inv.date).getMonth()
        monthly[mi].revenue += inv.totalAmount
        monthly[mi].count++
        if (inv.paymentStatus === 'PAID') monthly[mi].paid += inv.totalAmount
      }
      return NextResponse.json({ data: monthly })
    }

    if (type === 'customer') {
      const customers = await prisma.customer.findMany({
        include: { invoices: { select: { totalAmount: true, paymentStatus: true } } },
        orderBy: { name: 'asc' },
      })
      const data = customers.map(c => ({
        name: c.name,
        totalRevenue: c.invoices.reduce((s, i) => s + i.totalAmount, 0),
        paidAmount: c.invoices.filter(i => i.paymentStatus === 'PAID').reduce((s, i) => s + i.totalAmount, 0),
        invoiceCount: c.invoices.length,
        outstanding: c.outstandingBalance,
      }))
      return NextResponse.json({ data })
    }

    if (type === 'summary') {
      const [totalInvoices, paidInvoices, unpaidInvoices, customers] = await Promise.all([
        prisma.invoice.aggregate({ _sum: { totalAmount: true }, _count: true }),
        prisma.invoice.aggregate({ where: { paymentStatus: 'PAID' }, _sum: { totalAmount: true }, _count: true }),
        prisma.invoice.aggregate({ where: { paymentStatus: 'UNPAID' }, _sum: { totalAmount: true }, _count: true }),
        prisma.customer.count(),
      ])
      return NextResponse.json({
        totalRevenue: totalInvoices._sum.totalAmount || 0,
        totalInvoices: totalInvoices._count,
        paidRevenue: paidInvoices._sum.totalAmount || 0,
        paidCount: paidInvoices._count,
        unpaidRevenue: unpaidInvoices._sum.totalAmount || 0,
        unpaidCount: unpaidInvoices._count,
        customerCount: customers,
      })
    }

    return NextResponse.json({ error: 'Unknown report type' }, { status: 400 })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
