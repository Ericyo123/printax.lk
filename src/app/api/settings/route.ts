import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET() {
  try {
    let settings = await prisma.settings.findUnique({
      where: { id: 'default' }
    })
    
    if (!settings) {
      settings = await prisma.settings.create({
        data: { id: 'default' }
      })
    }
    
    return NextResponse.json(settings)
  } catch (error) {
    return NextResponse.json({ error: 'Failed to fetch settings' }, { status: 500 })
  }
}

export async function POST(req: Request) {
  try {
    const data = await req.json()
    const settings = await prisma.settings.upsert({
      where: { id: 'default' },
      update: data,
      create: { ...data, id: 'default' }
    })
    return NextResponse.json(settings)
  } catch (error) {
    return NextResponse.json({ error: 'Failed to update settings' }, { status: 500 })
  }
}
