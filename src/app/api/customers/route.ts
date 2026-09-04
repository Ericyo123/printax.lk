import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { customerSchema } from '@/lib/validations'

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  try {
    const { searchParams } = new URL(req.url)
    const type = searchParams.get('type')
    const customers = await prisma.customer.findMany({
      where: type ? { type } : undefined,
      orderBy: { name: 'asc' },
      include: { _count: { select: { invoices: true } } },
    })
    return NextResponse.json(customers)
  } catch (e) {
    return NextResponse.json({ error: 'Failed' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  try {
    const body = await req.json()
    const validatedData = customerSchema.parse(body)
    const customer = await prisma.customer.create({ data: validatedData })
    return NextResponse.json(customer)
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
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
        where: { customerId: { in: ids } },
        data: { customerId: null }
      })
      await tx.quotation.updateMany({
        where: { customerId: { in: ids } },
        data: { customerId: null }
      })
      await tx.customer.deleteMany({ where: { id: { in: ids } } })
    })

    return NextResponse.json({ success: true, count: ids.length })
  } catch (e: any) {
    console.error('Batch delete customers error:', e)
    return NextResponse.json({ error: e.message || 'Failed to delete customers' }, { status: 500 })
  }
}
