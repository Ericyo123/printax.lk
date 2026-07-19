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
    
    // 1. Fetch Summary Data
    const invoices = await prisma.invoice.findMany({
      select: { totalAmount: true, paymentStatus: true }
    })
    const summary = {
      totalRevenue: 0, totalInvoices: invoices.length,
      paidRevenue: 0, paidCount: 0,
      unpaidRevenue: 0, unpaidCount: 0,
      customerCount: await prisma.customer.count()
    }
    for (const inv of invoices) {
      summary.totalRevenue += inv.totalAmount
      if (inv.paymentStatus === 'PAID') {
        summary.paidRevenue += inv.totalAmount
        summary.paidCount++
      } else {
        summary.unpaidRevenue += inv.totalAmount
        summary.unpaidCount++
      }
    }

    // 2. Fetch Daily Chart Data
    const start = new Date(year, month - 1, 1)
    const end = new Date(year, month, 0, 23, 59, 59)
    const dailyInvoices = await prisma.invoice.findMany({
      where: { date: { gte: start, lte: end } },
      select: { date: true, totalAmount: true, paymentStatus: true },
    })

    const dailyMap: Record<string, { revenue: number; paid: number; count: number }> = {}
    for (let d = 1; d <= end.getDate(); d++) {
      const key = String(d).padStart(2, '0')
      dailyMap[key] = { revenue: 0, paid: 0, count: 0 }
    }
    for (const inv of dailyInvoices) {
      const day = String(new Date(inv.date).getDate()).padStart(2, '0')
      if (dailyMap[day]) {
        dailyMap[day].revenue += inv.totalAmount
        dailyMap[day].count++
        if (inv.paymentStatus === 'PAID') dailyMap[day].paid += inv.totalAmount
      }
    }
    const chartData = Object.entries(dailyMap).map(([day, vals]) => ({ day, ...vals }))

    // 3. Fetch Recent Invoices
    const recentInvoices = await prisma.invoice.findMany({
      take: 6,
      orderBy: { createdAt: 'desc' },
      include: { customer: { select: { name: true, id: true } } }
    })

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
