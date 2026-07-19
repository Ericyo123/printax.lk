import { PrismaClient } from '@prisma/client'
const prisma = new PrismaClient()

async function check() {
  const sessions = await prisma.loginSession.findMany({
    orderBy: { createdAt: 'desc' },
    take: 10
  })
  console.log('SESSIONS:', sessions)
}
check().then(() => process.exit(0))
