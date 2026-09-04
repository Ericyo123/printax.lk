import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { expenseSchema } from '@/lib/validations'

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const expense = await prisma.expense.findUnique({ where: { id: params.id } })
    if (!expense) return NextResponse.json({ error: 'Expense not found' }, { status: 404 })
    return NextResponse.json(expense)
  } catch (e: any) {
    return NextResponse.json({ error: e.message || 'Failed to fetch expense' }, { status: 500 })
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const body = await req.json()
    const validatedData = expenseSchema.partial().parse(body)

    const updated = await prisma.expense.update({
      where: { id: params.id },
      data: {
        ...(validatedData.title !== undefined && { title: validatedData.title.trim() }),
        ...(validatedData.category !== undefined && { category: validatedData.category.trim() }),
        ...(validatedData.amount !== undefined && { amount: validatedData.amount }),
        ...(validatedData.date !== undefined && { date: validatedData.date ? new Date(validatedData.date) : new Date() }),
        ...(validatedData.paymentMethod !== undefined && { paymentMethod: validatedData.paymentMethod }),
        ...(validatedData.reference !== undefined && { reference: validatedData.reference?.trim() || null }),
        ...(validatedData.vendor !== undefined && { vendor: validatedData.vendor?.trim() || null }),
        ...(validatedData.notes !== undefined && { notes: validatedData.notes?.trim() || null }),
      }
    })

    return NextResponse.json(updated)
  } catch (e: any) {
    return NextResponse.json({ error: e.message || 'Failed to update expense' }, { status: 500 })
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    await prisma.expense.delete({ where: { id: params.id } })
    return NextResponse.json({ success: true })
  } catch (e: any) {
    return NextResponse.json({ error: e.message || 'Failed to delete expense' }, { status: 500 })
  }
}
