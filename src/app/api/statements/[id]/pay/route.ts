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

    // Use a transaction to update the statement and all its invoices
    await prisma.$transaction(async (tx) => {
      // 1. Update the statement
      await tx.statement.update({
        where: { id: statementId },
        data: {
          status: 'PAID',
          paidAmount: statement.totalAmount
        }
      })

      // 2. Update all attached invoices
      const invoiceIds = statement.invoices.map(i => i.id)
      if (invoiceIds.length > 0) {
        await tx.invoice.updateMany({
          where: { id: { in: invoiceIds } },
          data: {
            paymentStatus: 'PAID'
          }
        })
      }
    })

    return NextResponse.json({ success: true })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
