import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET() {
  try {
    const [paperSizes, rules, services] = await Promise.all([
      prisma.paperSize.findMany({ orderBy: { name: 'asc' } }),
      prisma.pricingRule.findMany({ include: { paperSize: true } }),
      prisma.additionalService.findMany({ orderBy: { name: 'asc' } }),
    ])
    return NextResponse.json({ paperSizes, rules, services })
  } catch (e) {
    return NextResponse.json({ error: 'Failed' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { action, data } = body

    if (action === 'upsert_rule') {
      const rule = await prisma.pricingRule.upsert({
        where: { paperSizeId_printType: { paperSizeId: data.paperSizeId, printType: data.printType } },
        update: { pricePerPage: data.pricePerPage, pricePerCopy: data.pricePerCopy, pricePerBook: data.pricePerBook },
        create: data,
      })
      return NextResponse.json(rule)
    }

    if (action === 'add_paper_size') {
      const ps = await prisma.paperSize.create({ data: { name: data.name, description: data.description } })
      return NextResponse.json(ps)
    }

    if (action === 'update_service') {
      const svc = await prisma.additionalService.upsert({
        where: { name: data.name },
        update: { price: data.price, active: data.active },
        create: { name: data.name, price: data.price },
      })
      return NextResponse.json(svc)
    }

    if (action === 'add_service') {
      const svc = await prisma.additionalService.create({ data: { name: data.name, price: data.price } })
      return NextResponse.json(svc)
    }

    return NextResponse.json({ error: 'Unknown action' }, { status: 400 })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
