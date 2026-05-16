const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()

async function main() {
  const count = await prisma.invoice.count()
  console.log('Invoice count:', count)
  
  const invoices = await prisma.invoice.findMany({
    take: 5,
    orderBy: { createdAt: 'desc' }
  })
  console.log('Recent Invoices:', JSON.stringify(invoices, null, 2))
}

main().finally(() => prisma.$disconnect())
