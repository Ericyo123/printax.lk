import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const invoice = await prisma.invoice.findUnique({
      where: { id: params.id },
      include: {
        customer: true,
        jobs: { include: { paperSize: true, services: { include: { service: true } } } },
        statement: true,
      },
    })
    if (!invoice) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    return NextResponse.json(invoice)
  } catch (e) {
    return NextResponse.json({ error: 'Failed' }, { status: 500 })
  }
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const body = await req.json()
    const { paymentStatus, paymentMethod, paymentDate, notes } = body

    const existing = await prisma.invoice.findUnique({ where: { id: params.id }, include: { customer: true } })
    if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    const wasUnpaid = existing.paymentStatus === 'UNPAID' || existing.paymentStatus === 'PARTIAL'
    const nowPaid = paymentStatus === 'PAID'
    const wasPaid = existing.paymentStatus === 'PAID'
    const nowUnpaid = paymentStatus === 'UNPAID' || paymentStatus === 'PARTIAL'

    const updated = await prisma.$transaction(async (tx) => {
      const result = await tx.invoice.update({
        where: { id: params.id },
        data: {
          paymentStatus,
          paymentMethod: nowUnpaid ? null : (paymentMethod || existing.paymentMethod),
          paymentDate: nowUnpaid ? null : (paymentDate ? new Date(paymentDate) : (nowPaid ? new Date() : existing.paymentDate)),
          notes: notes ?? existing.notes,
        },
        include: { customer: true, jobs: { include: { paperSize: true } } },
      })

      // Adjust customer outstanding balance atomically
      if (existing.customerId) {
        if (wasUnpaid && nowPaid) {
          await tx.customer.update({
            where: { id: existing.customerId },
            data: { outstandingBalance: { decrement: existing.totalAmount } },
          })
        } else if (wasPaid && nowUnpaid) {
          await tx.customer.update({
            where: { id: existing.customerId },
            data: { outstandingBalance: { increment: existing.totalAmount } },
          })
        }
      }

      return result
    })

    return NextResponse.json(updated)
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const existing = await prisma.invoice.findUnique({
      where: { id: params.id },
      include: { jobs: { select: { id: true } } }
    })

    if (!existing) {
      return NextResponse.json({ error: 'Invoice not found' }, { status: 404 })
    }

    await prisma.$transaction(async (tx) => {
      // If invoice was unpaid and belongs to customer, decrement outstanding balance
      if (existing.customerId && existing.paymentStatus !== 'PAID') {
        await tx.customer.update({
          where: { id: existing.customerId },
          data: { outstandingBalance: { decrement: existing.totalAmount } },
        })
      }

      // Delete jobs associated with this invoice
      const jobIds = existing.jobs.map(j => j.id)
      if (jobIds.length > 0) {
        await tx.jobService.deleteMany({ where: { jobId: { in: jobIds } } })
        await tx.job.deleteMany({ where: { id: { in: jobIds } } })
      }

      // Delete the invoice itself
      await tx.invoice.delete({ where: { id: params.id } })
    })

    return NextResponse.json({ success: true })
  } catch (e: any) {
    console.error('Failed to delete invoice:', e)
    return NextResponse.json({ error: e.message || 'Failed to delete invoice' }, { status: 500 })
  }
}
