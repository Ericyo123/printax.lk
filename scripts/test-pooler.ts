import { PrismaClient } from '@prisma/client'

const testUrl = "postgresql://postgres.jkjyavypubqatqioavmg:ADGUrciuhNkNBx1K@aws-1-ap-south-1.pooler.supabase.com:6543/postgres?pgbouncer=true&connection_limit=1"

const prisma = new PrismaClient({
  datasources: {
    db: {
      url: testUrl
    }
  }
})

async function check() {
  const users = await prisma.user.findMany()
  console.log('POOLER USERS:', users.map(u => u.email))
}
check()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error('POOLER ERROR:', e)
    process.exit(1)
  })
