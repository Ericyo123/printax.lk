import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { expenseSchema } from '@/lib/validations'

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const { searchParams } = new URL(req.url)
    const search = searchParams.get('search') || ''
    const category = searchParams.get('category') || ''
    const paymentMethod = searchParams.get('paymentMethod') || ''
    const startDate = searchParams.get('startDate')
    const endDate = searchParams.get('endDate')
    const month = searchParams.get('month')
    const year = searchParams.get('year')
    const page = parseInt(searchParams.get('page') || '1', 10)
    const limit = parseInt(searchParams.get('limit') || '50', 10)

    const where: any = {}

    if (category) where.category = category
    if (paymentMethod) where.paymentMethod = paymentMethod

    if (startDate && endDate) {
      where.date = {
        gte: new Date(startDate),
        lte: new Date(new Date(endDate).setHours(23, 59, 59, 999))
      }
    } else if (year && month) {
      const y = parseInt(year, 10)
      const m = parseInt(month, 10)
      where.date = {
        gte: new Date(y, m - 1, 1),
        lte: new Date(y, m, 0, 23, 59, 59, 999)
      }
    } else if (year) {
      const y = parseInt(year, 10)
      where.date = {
        gte: new Date(y, 0, 1),
        lte: new Date(y, 11, 31, 23, 59, 59, 999)
      }
    }

    if (search) {
      where.OR = [
        { expenseNumber: { contains: search, mode: 'insensitive' } },
        { title: { contains: search, mode: 'insensitive' } },
        { vendor: { contains: search, mode: 'insensitive' } },
        { reference: { contains: search, mode: 'insensitive' } },
        { notes: { contains: search, mode: 'insensitive' } },
        { category: { contains: search, mode: 'insensitive' } },
      ]
    }

    const [expenses, total, aggregate, categoriesGroup] = await Promise.all([
      prisma.expense.findMany({
        where,
        orderBy: { date: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.expense.count({ where }),
      prisma.expense.aggregate({
        where,
        _sum: { amount: true },
      }),
      prisma.expense.groupBy({
        by: ['category'],
        where,
        _sum: { amount: true },
        _count: true,
        orderBy: { _sum: { amount: 'desc' } }
      })
    ])

    const totalAmount = aggregate._sum.amount || 0
    const categoryBreakdown = categoriesGroup.map(g => ({
      category: g.category,
      amount: g._sum.amount || 0,
      count: g._count,
      percentage: totalAmount > 0 ? ((g._sum.amount || 0) / totalAmount) * 100 : 0
    }))

    return NextResponse.json({
      expenses,
      total,
      page,
      limit,
      totalAmount,
      categoryBreakdown
    })
  } catch (e: any) {
    console.error('Error fetching expenses:', e)
    return NextResponse.json({ error: e.message || 'Failed to fetch expenses' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const body = await req.json()
    const validatedData = expenseSchema.parse(body)
    const { title, category, amount, date, paymentMethod, reference, vendor, notes } = validatedData

    const currentYear = new Date().getFullYear()

    const result = await prisma.$transaction(async (tx) => {
      const lastExpense = await tx.expense.findFirst({
        where: { expenseNumber: { startsWith: `EXP-${currentYear}-` } },
        orderBy: { expenseNumber: 'desc' },
        select: { expenseNumber: true }
      })

      let nextNum = 1
      if (lastExpense) {
        const parts = lastExpense.expenseNumber.split('-')
        const lastNum = parseInt(parts[parts.length - 1], 10)
        nextNum = isNaN(lastNum) ? 1 : lastNum + 1
      }
      const expenseNumber = `EXP-${currentYear}-${String(nextNum).padStart(5, '0')}`

      return await tx.expense.create({
        data: {
          expenseNumber,
          title: title.trim(),
          category: category.trim(),
          amount,
          date: date ? new Date(date) : new Date(),
          paymentMethod: paymentMethod || 'CASH',
          reference: reference?.trim() || null,
          vendor: vendor?.trim() || null,
          notes: notes?.trim() || null,
        }
      })
    })

    return NextResponse.json({ expense: result })
  } catch (e: any) {
    console.error('Expense creation failed:', e)
    return NextResponse.json({ error: e.message || 'Failed to create expense' }, { status: 500 })
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

    await prisma.expense.deleteMany({ where: { id: { in: ids } } })
    return NextResponse.json({ success: true, count: ids.length })
  } catch (e: any) {
    console.error('Batch delete expenses error:', e)
    return NextResponse.json({ error: e.message || 'Failed to delete expenses' }, { status: 500 })
  }
}
