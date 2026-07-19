import { PrismaClient } from '@prisma/client'
const prisma = new PrismaClient()

async function test() {
  const user = await prisma.user.findFirst()
  console.log('User found:', user)

  try {
    const req = { headers: {} }
    const userAgent = req?.headers?.['user-agent'] || 'Unknown Device'
    let ipAddress = req?.headers?.['x-forwarded-for'] || req?.headers?.['x-real-ip'] || 'Unknown IP'
    if (Array.isArray(ipAddress)) ipAddress = ipAddress[0]
    if (typeof ipAddress === 'string' && ipAddress.includes(',')) ipAddress = ipAddress.split(',')[0]

    console.log('UA:', userAgent, 'IP:', ipAddress)

    const loginSession = await prisma.loginSession.create({
      data: {
        userId: user!.id,
        userAgent,
        ipAddress,
        expiresAt: new Date(Date.now() + 4 * 60 * 60 * 1000)
      }
    })
    console.log('Session created:', loginSession)
  } catch (e) {
    console.error('Error creating session:', e)
  }
}
test().then(() => process.exit(0))
