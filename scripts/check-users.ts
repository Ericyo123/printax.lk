import { PrismaClient } from '@prisma/client'
const prisma = new PrismaClient()

async function check() {
  const users = await prisma.user.findMany()
  console.log('USERS:', users.map(u => ({ id: u.id, email: u.email, active: u.active })))
}
check().then(() => process.exit(0))
