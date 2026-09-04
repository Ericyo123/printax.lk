import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const quotation = await prisma.quotation.findUnique({
      where: { id: params.id },
      include: {
        customer: true,
        items: true,
      }
    })

    if (!quotation) {
      return NextResponse.json({ error: 'Quotation not found' }, { status: 404 })
    }

    if (quotation.items.length === 0) {
      return NextResponse.json({ error: 'Quotation has no items to convert' }, { status: 400 })
    }

    // Ensure fallback paper size if needed
    const defaultPaperSize = await prisma.paperSize.findFirst()
    if (!defaultPaperSize) {
      return NextResponse.json({ error: 'No paper size configured in the system' }, { status: 400 })
    }

    const currentYear = new Date().getFullYear()

    const result = await prisma.$transaction(async (tx) => {
      // 1. Generate Invoice Number
      const lastInvoice = await tx.invoice.findFirst({
        where: { invoiceNumber: { startsWith: `INV-${currentYear}-` } },
        orderBy: { invoiceNumber: 'desc' },
        select: { invoiceNumber: true }
      })
      let nextNum = 1
      if (lastInvoice) {
        const parts = lastInvoice.invoiceNumber.split('-')
        const lastNum = parseInt(parts[parts.length - 1], 10)
        nextNum = isNaN(lastNum) ? 1 : lastNum + 1
      }
      const invoiceNumber = `INV-${currentYear}-${String(nextNum).padStart(5, '0')}`

      // 2. Create Invoice with Jobs
      const invoice = await tx.invoice.create({
        data: {
          invoiceNumber,
          customerId: quotation.customerId || null,
          totalAmount: quotation.totalAmount,
          paymentStatus: 'UNPAID',
          quotationId: quotation.id,
          notes: quotation.notes ? `Converted from Quotation ${quotation.quotationNumber}. ${quotation.notes}` : `Converted from Quotation ${quotation.quotationNumber}`,
          jobs: {
            create: quotation.items.map(item => ({
              description: item.description,
              paperSizeId: item.paperSizeId || defaultPaperSize.id,
              printType: item.printType || 'BW',
              printMode: item.printMode || 'SINGLE',
              pages: item.pages || 1,
              copies: item.copies || 1,
              pricingType: item.pricingType || 'MANUAL',
              baseAmount: item.baseAmount || 0,
              additionalTotal: item.additionalTotal || 0,
              discount: item.discount || 0,
              totalAmount: item.totalAmount || 0,
              notes: item.notes || null,
            }))
          }
        },
        include: {
          jobs: true,
          customer: true,
        }
      })

      // 3. Mark Quotation as CONVERTED
      await tx.quotation.update({
        where: { id: quotation.id },
        data: { status: 'CONVERTED' }
      })

      // 4. Update customer balance if monthly
      if (quotation.customerId) {
        const customer = await tx.customer.findUnique({ where: { id: quotation.customerId } })
        if (customer && customer.type === 'MONTHLY') {
          await tx.customer.update({
            where: { id: quotation.customerId },
            data: { outstandingBalance: { increment: quotation.totalAmount } }
          })
        }
      }

      return invoice
    }, {
      maxWait: 15000,
      timeout: 30000
    })

    return NextResponse.json({ success: true, invoice: result })
  } catch (e: any) {
    console.error('Conversion failed:', e)
    return NextResponse.json({ error: e.message || 'Failed to convert quotation to invoice' }, { status: 500 })
  }
}
