import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getServerSession } from 'next-auth'
import { authOptions } from '../auth/[...nextauth]/route'
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
