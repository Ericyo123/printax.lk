import { PrismaClient } from '@prisma/client'
const prisma = new PrismaClient()

async function main() {
  console.log('Clearing transactional data...')
  await prisma.jobService.deleteMany({})
  await prisma.job.deleteMany({})
  await prisma.invoice.deleteMany({})
  await prisma.statement.deleteMany({})
  await prisma.customer.deleteMany({})
  console.log('Database cleared.')
}

main()
  .catch(e => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
