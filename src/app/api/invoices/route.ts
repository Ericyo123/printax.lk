import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { invoiceSchema } from '@/lib/validations'
import { calculateBaseAmount, calculateTotal } from '@/lib/pricing'

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  try {
    const { searchParams } = new URL(req.url)
    const customerId = searchParams.get('customerId')
    const status = searchParams.get('status')
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '50')
    
    const where: any = {}
    if (customerId) where.customerId = customerId
    if (status) where.paymentStatus = status

    const [invoices, total] = await Promise.all([
      prisma.invoice.findMany({
        where,
        include: {
          customer: true,
          jobs: { include: { paperSize: true, services: { include: { service: true } } } },
        },
        orderBy: { date: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.invoice.count({ where }),
    ])

    return NextResponse.json({ invoices, total, page, limit })
  } catch (e) {
    return NextResponse.json({ error: 'Failed to fetch invoices' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const body = await req.json()
    const validatedData = invoiceSchema.parse(body)
    const {
      customerId, dueDate, paymentMethod, paymentStatus, notes, jobs
    } = validatedData as any

    const bodyDiscount = typeof body.discount === 'number' ? body.discount : 0

    // Calculate rates for each job
    const preparedJobs: any[] = []
    let totalJobsAmount = 0

    for (const job of jobs) {
      let rule = null;
      if (job.pricingType !== 'MANUAL') {
        rule = await prisma.pricingRule.findUnique({
          where: { paperSizeId_printType: { paperSizeId: job.paperSizeId, printType: job.printType } },
        })
        if (!rule) return NextResponse.json({ error: `Pricing rule not found for paper size: ${job.paperSizeId}` }, { status: 400 })
      }

      const baseAmount = job.pricingType === 'MANUAL' 
        ? (job.manualPrice || 0)
        : calculateBaseAmount(rule!, job.pricingType, job.pages, job.copies, job.printMode, job.manualPrice)
      const serviceAmounts = (job.services || []).map((s: any) => s.amount)
      const customServiceAmounts = (job.customServices || []).map((s: any) => s.amount)
      
      const additionalAmounts = [...serviceAmounts, ...customServiceAmounts]
      const additionalTotal = additionalAmounts.reduce((a: number, b: number) => a + b, 0)
      const jobTotal = calculateTotal(baseAmount, additionalAmounts, job.discount || 0)

      preparedJobs.push({
        ...job,
        baseAmount,
        additionalTotal,
        totalAmount: jobTotal,
      })
      totalJobsAmount += jobTotal
    }

    const finalInvoiceTotal = Math.max(0, totalJobsAmount - bodyDiscount)

    const result = await prisma.$transaction(async (tx) => {
      const count = await tx.invoice.count()
      const invoiceNumber = `INV-${new Date().getFullYear()}-${String(count + 1).padStart(5, '0')}`

      const createdInvoice = await tx.invoice.create({
        data: {
          invoiceNumber,
          customerId: customerId || null,
          totalAmount: finalInvoiceTotal,
          dueDate: dueDate ? new Date(dueDate) : null,
          paymentMethod: paymentMethod || null,
          paymentStatus: paymentMethod ? 'PAID' : (paymentStatus || 'UNPAID'),
          paymentDate: paymentMethod ? new Date() : null,
          notes: notes || null,
          jobs: {
            create: preparedJobs.map(job => ({
              description: job.description,
              paperSizeId: job.paperSizeId,
              printType: job.printType,
              printMode: job.printMode,
              pages: job.pages,
              copies: job.copies,
              pricingType: job.pricingType,
              baseAmount: job.baseAmount,
              additionalTotal: job.additionalTotal,
              discount: job.discount || 0,
              totalAmount: job.totalAmount,
              notes: job.notes || null,
              services: {
                create: [
                  ...(job.services || []).map((s: any) => ({ serviceId: s.serviceId, amount: s.amount })),
                  ...(job.customServices || []).map((s: any) => ({ customLabel: s.label, amount: s.amount })),
                ]
              }
            }))
          }
        },
        include: {
          jobs: { include: { paperSize: true, services: { include: { service: true } } } },
          customer: true
        }
      })

      if (customerId && !paymentMethod) {
        const customer = await tx.customer.findUnique({ where: { id: customerId } })
        if (customer && customer.type === 'MONTHLY') {
          await tx.customer.update({
            where: { id: customerId },
            data: { outstandingBalance: { increment: finalInvoiceTotal } }
          })
        }
      }

      return createdInvoice
    }, {
      maxWait: 15000,
      timeout: 30000
    })

    return NextResponse.json({ invoice: result })
  } catch (e: any) {
    console.error('Invoice creation failed:', e)
    return NextResponse.json({ error: e.message || 'Failed to create invoice' }, { status: 500 })
  }
}
