import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getServerSession } from 'next-auth'

export async function POST(req: Request, { params }: { params: { id: string } }) {
  try {
    const { id } = params
    
    // Find all unpaid or partial invoices for this customer
    const unpaidInvoices = await prisma.invoice.findMany({
      where: {
        customerId: id,
        paymentStatus: { in: ['UNPAID', 'PARTIAL'] }
      }
    })

    if (unpaidInvoices.length === 0) {
      return NextResponse.json({ success: true, message: 'No outstanding balance.' })
    }

    // Update all to PAID
    await prisma.$transaction(
      unpaidInvoices.map(inv => 
        prisma.invoice.update({
          where: { id: inv.id },
          data: { paymentStatus: 'PAID', paymentMethod: 'CASH', paymentDate: new Date() }
        })
      )
    )

    // Recalculate customer's outstanding balance
    const updatedInvoices = await prisma.invoice.findMany({
      where: { customerId: id, paymentStatus: { in: ['UNPAID', 'PARTIAL'] } }
    })
    
    const outstanding = updatedInvoices.reduce((sum, i) => sum + (i.totalAmount || 0), 0)
    
    await prisma.customer.update({
      where: { id },
      data: { outstandingBalance: outstanding }
    })

    return NextResponse.json({ success: true, outstandingBalance: outstanding })

  } catch (error) {
    console.error('Failed to clear outstanding balance:', error)
    return NextResponse.json({ error: 'Failed to clear outstanding balance' }, { status: 500 })
  }
}
