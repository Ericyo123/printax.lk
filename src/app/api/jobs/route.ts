import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { calculateBaseAmount, calculateTotal } from '@/lib/pricing'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { createJobSchema } from '@/lib/validations'

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  try {
    const { searchParams } = new URL(req.url)
    const invoiceId = searchParams.get('invoiceId')
    const where = invoiceId ? { invoiceId } : {}
    const jobs = await prisma.job.findMany({
      where,
      include: { paperSize: true, services: { include: { service: true } }, invoice: true },
      orderBy: { date: 'desc' },
    })
    return NextResponse.json(jobs)
  } catch (e) {
    return NextResponse.json({ error: 'Failed to fetch jobs' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  try {
    const body = await req.json()
    const validatedData = createJobSchema.parse(body)
    const {
      description, paperSizeId, printType, printMode,
      pages, copies, pricingType, notes,
      services = [], customServices = [], manualPrice,
      customerId, createInvoice, dueDate, paymentMethod, discount = 0,
    } = validatedData as any

    // Resolve paperSizeId dynamically to avoid foreign key violations
    let resolvedPaperSizeId = paperSizeId
    const paperSizeExists = resolvedPaperSizeId 
      ? await prisma.paperSize.findUnique({ where: { id: resolvedPaperSizeId }, select: { id: true } })
      : null
    
    if (!paperSizeExists) {
      const firstPaperSize = await prisma.paperSize.findFirst({ select: { id: true } })
      if (firstPaperSize) {
        resolvedPaperSizeId = firstPaperSize.id
      }
    }

    // Get pricing rule
    const rule = await prisma.pricingRule.findUnique({
      where: { paperSizeId_printType: { paperSizeId: resolvedPaperSizeId, printType } },
    })
    if (!rule) return NextResponse.json({ error: 'Pricing rule not found' }, { status: 400 })

    const baseAmount = calculateBaseAmount(rule, pricingType, pages, copies, printMode, manualPrice)
    const additionalAmounts = [
      ...services.map((s: any) => s.amount),
      ...customServices.map((s: any) => s.amount),
    ]
    const additionalTotal = additionalAmounts.reduce((a: number, b: number) => a + b, 0)
    const totalAmount = calculateTotal(baseAmount, additionalAmounts, discount)

    // Build invoice number if needed
    let invoice = null
    if (createInvoice) {
      const currentYear = new Date().getFullYear()
      const lastInvoice = await prisma.invoice.findFirst({
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
      invoice = await prisma.invoice.create({
        data: {
          invoiceNumber,
          customerId: customerId || null,
          totalAmount,
          dueDate: dueDate ? new Date(dueDate) : null,
          paymentMethod: paymentMethod || null,
          paymentStatus: paymentMethod ? 'PAID' : 'UNPAID',
          paymentDate: paymentMethod ? new Date() : null,
        },
      })
      // Update customer balance if monthly
      if (customerId && !paymentMethod) {
        await prisma.customer.update({
          where: { id: customerId },
          data: { outstandingBalance: { increment: totalAmount } },
        })
      }
    }

    const job = await prisma.job.create({
      data: {
        description, paperSizeId: resolvedPaperSizeId, printType, printMode,
        pages, copies, pricingType,
        baseAmount, additionalTotal, discount, totalAmount, notes,
        invoiceId: invoice?.id || null,
        services: {
          create: [
            ...services.map((s: any) => ({ serviceId: s.serviceId, amount: s.amount })),
            ...customServices.map((s: any) => ({ customLabel: s.label, amount: s.amount })),
          ],
        },
      },
      include: { paperSize: true, services: { include: { service: true } }, invoice: true },
    })

    return NextResponse.json({ job, invoice })
  } catch (e: any) {
    console.error(e)
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
