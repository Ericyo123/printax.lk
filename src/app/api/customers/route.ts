import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET(req: NextRequest) {
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
  try {
    const body = await req.json()
    const customer = await prisma.customer.create({ data: body })
    return NextResponse.json(customer)
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
