import { PrismaClient } from '@prisma/client'
const prisma = new PrismaClient()

async function main() {
  console.log('Clearing JobServices...')
  await prisma.jobService.deleteMany()
  
  console.log('Clearing Jobs...')
  await prisma.job.deleteMany()
  
  console.log('Clearing Invoices...')
  await prisma.invoice.deleteMany()
  
  console.log('Clearing Statements...')
  await prisma.statement.deleteMany()
  
  console.log('Clearing Customers...')
  await prisma.customer.deleteMany()
  
  console.log('Clearing Non-Admin Users...')
  await prisma.user.deleteMany({
    where: {
      role: { not: 'ADMIN' }
    }
  })

  console.log('Database cleared successfully! Kept Admin users, Settings, PaperSizes, PricingRules, and AdditionalServices.')
}

main().catch(console.error).finally(() => prisma.$disconnect())
