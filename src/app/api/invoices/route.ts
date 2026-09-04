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
    const search = searchParams.get('search') || ''
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '50')
    
    const where: any = {}
    if (customerId) where.customerId = customerId
    if (status) where.paymentStatus = status
    if (search) {
      where.OR = [
        { invoiceNumber: { contains: search, mode: 'insensitive' } },
        { customerName: { contains: search, mode: 'insensitive' } },
        { customer: { name: { contains: search, mode: 'insensitive' } } },
        { notes: { contains: search, mode: 'insensitive' } },
      ]
    }

    const [invoices, total] = await Promise.all([
      prisma.invoice.findMany({
        where,
        include: {
          customer: true,
          jobs: { select: { id: true, description: true, copies: true, totalAmount: true } },
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
      let resolvedPaperSizeId = job.paperSizeId
      const paperSizeExists = resolvedPaperSizeId 
        ? await prisma.paperSize.findUnique({ where: { id: resolvedPaperSizeId }, select: { id: true } })
        : null
      
      if (!paperSizeExists) {
        const firstPaperSize = await prisma.paperSize.findFirst({ select: { id: true } })
        if (firstPaperSize) {
          resolvedPaperSizeId = firstPaperSize.id
        }
      }

      let rule = null;
      if (job.pricingType !== 'MANUAL') {
        rule = await prisma.pricingRule.findUnique({
          where: { paperSizeId_printType: { paperSizeId: resolvedPaperSizeId, printType: job.printType } },
        })
        if (!rule) return NextResponse.json({ error: `Pricing rule not found for paper size: ${resolvedPaperSizeId}` }, { status: 400 })
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
        paperSizeId: resolvedPaperSizeId,
        baseAmount,
        additionalTotal,
        totalAmount: jobTotal,
      })
      totalJobsAmount += jobTotal
    }

    const finalInvoiceTotal = Math.max(0, totalJobsAmount - bodyDiscount)

    const result = await prisma.$transaction(async (tx) => {
      const currentYear = new Date().getFullYear()
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

      const createdInvoice = await tx.invoice.create({
        data: {
          invoiceNumber,
          customerId: customerId || null,
          customerName: customerId ? null : (body.customerName?.trim() || null),
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
      const existingInvoices = await tx.invoice.findMany({
        where: { id: { in: ids } },
        include: { jobs: { select: { id: true } } }
      })

      for (const inv of existingInvoices) {
        if (inv.customerId && inv.paymentStatus !== 'PAID') {
          await tx.customer.update({
            where: { id: inv.customerId },
            data: { outstandingBalance: { decrement: inv.totalAmount } }
          })
        }
      }

      const jobIds = existingInvoices.flatMap(inv => inv.jobs.map(j => j.id))
      if (jobIds.length > 0) {
        await tx.jobService.deleteMany({ where: { jobId: { in: jobIds } } })
        await tx.job.deleteMany({ where: { id: { in: jobIds } } })
      }

      await tx.invoice.deleteMany({ where: { id: { in: ids } } })
    })

    return NextResponse.json({ success: true, count: ids.length })
  } catch (e: any) {
    console.error('Batch delete invoices error:', e)
    return NextResponse.json({ error: e.message || 'Failed to delete invoices' }, { status: 500 })
  }
}
