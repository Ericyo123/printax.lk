import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { quotationSchema } from '@/lib/validations'

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  try {
    const { searchParams } = new URL(req.url)
    const search = searchParams.get('search') || ''
    const status = searchParams.get('status') || ''
    const customerId = searchParams.get('customerId') || ''
    const page = parseInt(searchParams.get('page') || '1', 10)
    const limit = parseInt(searchParams.get('limit') || '50', 10)

    const where: any = {}
    if (status) where.status = status
    if (customerId) where.customerId = customerId
    if (search) {
      where.OR = [
        { quotationNumber: { contains: search, mode: 'insensitive' } },
        { customerName: { contains: search, mode: 'insensitive' } },
        { notes: { contains: search, mode: 'insensitive' } },
        { customer: { name: { contains: search, mode: 'insensitive' } } },
      ]
    }

    const [quotations, total] = await Promise.all([
      prisma.quotation.findMany({
        where,
        include: {
          customer: true,
          items: { select: { id: true, description: true, copies: true, totalAmount: true } },
          invoices: { select: { id: true, invoiceNumber: true } }
        },
        orderBy: { date: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.quotation.count({ where }),
    ])

    return NextResponse.json({ quotations, total, page, limit })
  } catch (e: any) {
    console.error('Error fetching quotations:', e)
    return NextResponse.json({ error: 'Failed to fetch quotations' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const body = await req.json()
    const validatedData = quotationSchema.parse(body)
    const {
      customerId, customerName, customerPhone, customerEmail, customerAddress,
      validUntil, status, discount, notes, items
    } = validatedData

    // If registered customer, fill info from DB if missing
    let resolvedCustomerName = customerName
    let resolvedCustomerPhone = customerPhone
    let resolvedCustomerEmail = customerEmail
    let resolvedCustomerAddress = customerAddress

    if (customerId) {
      const cust = await prisma.customer.findUnique({ where: { id: customerId } })
      if (cust) {
        if (!resolvedCustomerName) resolvedCustomerName = cust.name
        if (!resolvedCustomerPhone) resolvedCustomerPhone = cust.phone
        if (!resolvedCustomerEmail) resolvedCustomerEmail = cust.email
        if (!resolvedCustomerAddress) resolvedCustomerAddress = cust.address
      }
    }

    const itemsTotal = items.reduce((sum, it) => sum + (it.totalAmount || 0), 0)
    const finalTotal = Math.max(0, itemsTotal - (discount || 0))

    const currentYear = new Date().getFullYear()

    const result = await prisma.$transaction(async (tx) => {
      const lastQuotation = await tx.quotation.findFirst({
        where: { quotationNumber: { startsWith: `QT-${currentYear}-` } },
        orderBy: { quotationNumber: 'desc' },
        select: { quotationNumber: true }
      })

      let nextNum = 1
      if (lastQuotation) {
        const parts = lastQuotation.quotationNumber.split('-')
        const lastNum = parseInt(parts[parts.length - 1], 10)
        nextNum = isNaN(lastNum) ? 1 : lastNum + 1
      }
      const quotationNumber = `QT-${currentYear}-${String(nextNum).padStart(5, '0')}`

      return await tx.quotation.create({
        data: {
          quotationNumber,
          customerId: customerId || null,
          customerName: resolvedCustomerName || null,
          customerPhone: resolvedCustomerPhone || null,
          customerEmail: resolvedCustomerEmail || null,
          customerAddress: resolvedCustomerAddress || null,
          validUntil: validUntil ? new Date(validUntil) : null,
          status: status || 'DRAFT',
          discount: discount || 0,
          totalAmount: finalTotal,
          notes: notes || null,
          items: {
            create: items.map(item => ({
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
          }
        },
        include: {
          customer: true,
          items: { include: { paperSize: true } }
        }
      })
    })

    return NextResponse.json({ quotation: result })
  } catch (e: any) {
    console.error('Failed to create quotation:', e)
    return NextResponse.json({ error: e.message || 'Failed to create quotation' }, { status: 500 })
  }
}

export async function DELETE(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  try {
    const body = await req.json()
    const ids: string[] = body.ids || []
    if (!Array.isArray(ids) || ids.length === 0) {
      return NextResponse.json({ error: 'No IDs provided' }, { status: 400 })
    }

    await prisma.$transaction(async (tx) => {
      await tx.invoice.updateMany({
        where: { quotationId: { in: ids } },
        data: { quotationId: null }
      })
      await tx.quotationItem.deleteMany({ where: { quotationId: { in: ids } } })
      await tx.quotation.deleteMany({ where: { id: { in: ids } } })
    })

    return NextResponse.json({ success: true, count: ids.length })
  } catch (e: any) {
    console.error('Batch delete quotations error:', e)
    return NextResponse.json({ error: e.message || 'Failed to delete quotations' }, { status: 500 })
  }
}
