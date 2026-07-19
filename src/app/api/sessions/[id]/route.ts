import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'

export async function DELETE(req: Request, { params }: { params: { id: string } }) {
  try {
    const session = await getServerSession(authOptions)
    if (!session || session.user?.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = params
    await prisma.loginSession.delete({
      where: { id }
    })

    return NextResponse.json({ success: true, message: 'Session revoked successfully.' })
  } catch (error) {
    console.error('Failed to revoke session', error)
    return NextResponse.json({ error: 'Failed to revoke session' }, { status: 500 })
  }
}
