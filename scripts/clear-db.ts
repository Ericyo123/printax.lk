import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  console.log('🧹 Clearing database tables (keeping User table)...')

  try {
    // Delete in correct order to respect foreign key constraints
    console.log('Deleting JobServices...')
    await prisma.jobService.deleteMany()

    console.log('Deleting Jobs...')
    await prisma.job.deleteMany()

    console.log('Deleting Invoices...')
    await prisma.invoice.deleteMany()

    console.log('Deleting Statements...')
    await prisma.statement.deleteMany()

    console.log('Deleting Customers...')
    await prisma.customer.deleteMany()

    console.log('Deleting PricingRules...')
    await prisma.pricingRule.deleteMany()

    console.log('Deleting PaperSizes...')
    await prisma.paperSize.deleteMany()

    console.log('Deleting AdditionalServices...')
    await prisma.additionalService.deleteMany()

    console.log('Deleting Settings...')
    await prisma.settings.deleteMany()

    console.log('✅ Database cleared successfully!')
  } catch (error) {
    console.error('❌ Error clearing database:', error)
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
