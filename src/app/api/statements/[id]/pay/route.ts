import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const statementId = params.id
    
    const statement = await prisma.statement.findUnique({
      where: { id: statementId },
      include: { invoices: true }
    })

    if (!statement) {
      return NextResponse.json({ error: 'Statement not found' }, { status: 404 })
    }

    if (statement.status === 'PAID') {
      return NextResponse.json({ error: 'Statement is already paid' }, { status: 400 })
    }

    // Use a transaction to update the statement, customer balance, and all its invoices
    await prisma.$transaction(async (tx) => {
      // 1. Update the statement
      await tx.statement.update({
        where: { id: statementId },
        data: {
          status: 'PAID',
          paidAmount: statement.totalAmount
        }
      })

      // 2. Calculate unpaid total and update attached invoices
      const unpaidInvoices = statement.invoices.filter(i => i.paymentStatus !== 'PAID')
      const unpaidTotal = unpaidInvoices.reduce((sum, i) => sum + i.totalAmount, 0)
      const invoiceIds = statement.invoices.map(i => i.id)

      if (invoiceIds.length > 0) {
        await tx.invoice.updateMany({
          where: { id: { in: invoiceIds } },
          data: {
            paymentStatus: 'PAID',
            paymentDate: new Date(),
            paymentMethod: 'BANK_TRANSFER'
          }
        })
      }

      // 3. Decrement customer outstanding balance
      if (statement.customerId && unpaidTotal > 0) {
        await tx.customer.update({
          where: { id: statement.customerId },
          data: {
            outstandingBalance: { decrement: unpaidTotal }
          }
        })
      }
    })

    return NextResponse.json({ success: true })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
