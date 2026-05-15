import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import bcrypt from 'bcryptjs'

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const body = await req.json()
    const { name, active, role, password } = body
    const data: any = {}
    if (name !== undefined) data.name = name
    if (active !== undefined) data.active = active
    if (role !== undefined) data.role = role
    if (password) data.password = await bcrypt.hash(password, 10)
    const user = await prisma.user.update({
      where: { id: params.id },
      data,
      select: { id: true, name: true, email: true, role: true, active: true, createdAt: true },
    })
    return NextResponse.json(user)
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
