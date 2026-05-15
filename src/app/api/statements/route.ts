import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getServerSession } from 'next-auth'
import { authOptions } from '../auth/[...nextauth]/route'
import { statementSchema } from '@/lib/validations'

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  try {
    const { searchParams } = new URL(req.url)
    const customerId = searchParams.get('customerId')
    const where: any = {}
    if (customerId) where.customerId = customerId

    const statements = await prisma.statement.findMany({
      where,
      include: {
        invoices: { include: { jobs: { include: { paperSize: true } } } },
      },
      orderBy: [{ year: 'desc' }, { month: 'desc' }],
    })
    // Attach customer info
    const withCustomer = await Promise.all(
      statements.map(async (s) => {
        const customer = await prisma.customer.findUnique({ where: { id: s.customerId } })
        return { ...s, customer }
      })
    )
    return NextResponse.json(withCustomer)
  } catch (e) {
    return NextResponse.json({ error: 'Failed' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  try {
    const body = await req.json()
    const validatedData = statementSchema.parse(body)
    const { customerId, month, year, invoiceIds, dueDate } = validatedData

    // Check for existing statement
    const existing = await prisma.statement.findFirst({ where: { customerId, month, year } })
    if (existing) return NextResponse.json({ error: 'Statement already exists for this period' }, { status: 400 })

    const invoices = await prisma.invoice.findMany({ where: { id: { in: invoiceIds } } })
    const totalAmount = invoices.reduce((s, i) => s + i.totalAmount, 0)

    const count = await prisma.statement.count()
    const statementNo = `STMT-${year}-${String(month).padStart(2, '0')}-${String(count + 1).padStart(4, '0')}`

    const statement = await prisma.statement.create({
      data: {
        statementNo,
        customerId,
        month,
        year,
        totalAmount,
        dueDate: dueDate ? new Date(dueDate) : null,
        invoices: { connect: invoiceIds.map((id: string) => ({ id })) },
      },
      include: {
        invoices: { include: { jobs: { include: { paperSize: true } } } },
      },
    })

    const customer = await prisma.customer.findUnique({ where: { id: customerId } })
    return NextResponse.json({ ...statement, customer })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
