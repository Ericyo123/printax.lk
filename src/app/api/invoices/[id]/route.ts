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

    const updated = await prisma.invoice.update({
      where: { id: params.id },
      data: {
        paymentStatus,
        paymentMethod: paymentMethod || existing.paymentMethod,
        paymentDate: paymentDate ? new Date(paymentDate) : (nowPaid ? new Date() : existing.paymentDate),
        notes: notes ?? existing.notes,
      },
      include: { customer: true, jobs: { include: { paperSize: true } } },
    })

    // Adjust customer outstanding balance
    if (existing.customerId && wasUnpaid && nowPaid) {
      await prisma.customer.update({
        where: { id: existing.customerId },
        data: { outstandingBalance: { decrement: existing.totalAmount } },
      })
    }

    return NextResponse.json(updated)
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  try {
    await prisma.job.updateMany({ where: { invoiceId: params.id }, data: { invoiceId: null } })
    await prisma.invoice.delete({ where: { id: params.id } })
    return NextResponse.json({ success: true })
  } catch (e) {
    return NextResponse.json({ error: 'Failed' }, { status: 500 })
  }
}
