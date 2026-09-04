import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'

export async function GET(
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
        items: { include: { paperSize: true } },
        invoices: {
          select: {
            id: true,
            invoiceNumber: true,
            totalAmount: true,
            paymentStatus: true,
            date: true
          }
        }
      }
    })

    if (!quotation) {
      return NextResponse.json({ error: 'Quotation not found' }, { status: 404 })
    }

    return NextResponse.json(quotation)
  } catch (e: any) {
    return NextResponse.json({ error: e.message || 'Failed to fetch quotation' }, { status: 500 })
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const body = await req.json()
    const { status, validUntil, notes, discount, items, customerId, customerName, customerPhone, customerEmail, customerAddress } = body

    const existing = await prisma.quotation.findUnique({ where: { id: params.id } })
    if (!existing) {
      return NextResponse.json({ error: 'Quotation not found' }, { status: 404 })
    }

    const updated = await prisma.$transaction(async (tx) => {
      // If items are provided, replace them
      let finalTotal = existing.totalAmount
      if (items && Array.isArray(items)) {
        await tx.quotationItem.deleteMany({ where: { quotationId: params.id } })
        
        await tx.quotationItem.createMany({
          data: items.map((item: any) => ({
            quotationId: params.id,
            description: item.description,
            paperSizeId: item.paperSizeId || null,
            printType: item.printType || null,
            printMode: item.printMode || null,
            pages: item.pages || 1,
            copies: item.copies || 1,
            pricingType: item.pricingType || 'MANUAL',
            unitPrice: item.unitPrice || 0,
            baseAmount: item.baseAmount || 0,
            additionalTotal: item.additionalTotal || 0,
            discount: item.discount || 0,
            totalAmount: item.totalAmount || 0,
            notes: item.notes || null,
          }))
        })

        const itemsSum = items.reduce((s: number, it: any) => s + (it.totalAmount || 0), 0)
        const disc = typeof discount === 'number' ? discount : existing.discount
        finalTotal = Math.max(0, itemsSum - disc)
      } else if (typeof discount === 'number') {
        const currentItems = await tx.quotationItem.findMany({ where: { quotationId: params.id } })
        const itemsSum = currentItems.reduce((s, it) => s + it.totalAmount, 0)
        finalTotal = Math.max(0, itemsSum - discount)
      }

      return await tx.quotation.update({
        where: { id: params.id },
        data: {
          ...(status !== undefined && { status }),
          ...(validUntil !== undefined && { validUntil: validUntil ? new Date(validUntil) : null }),
          ...(notes !== undefined && { notes }),
          ...(discount !== undefined && { discount }),
          ...(customerId !== undefined && { customerId: customerId || null }),
          ...(customerName !== undefined && { customerName: customerName || null }),
          ...(customerPhone !== undefined && { customerPhone: customerPhone || null }),
          ...(customerEmail !== undefined && { customerEmail: customerEmail || null }),
          ...(customerAddress !== undefined && { customerAddress: customerAddress || null }),
          totalAmount: finalTotal
        },
        include: {
          customer: true,
          items: { include: { paperSize: true } },
          invoices: true
        }
      })
    })

    return NextResponse.json(updated)
  } catch (e: any) {
    return NextResponse.json({ error: e.message || 'Failed to update quotation' }, { status: 500 })
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    await prisma.$transaction(async (tx) => {
      await tx.invoice.updateMany({
        where: { quotationId: params.id },
        data: { quotationId: null }
      })
      await tx.quotationItem.deleteMany({ where: { quotationId: params.id } })
      await tx.quotation.delete({ where: { id: params.id } })
    })
    return NextResponse.json({ success: true })
  } catch (e: any) {
    return NextResponse.json({ error: e.message || 'Failed to delete quotation' }, { status: 500 })
  }
}
