const { PrismaClient } = require('@prisma/client')
const bcrypt = require('bcryptjs')
const prisma = new PrismaClient()

async function main() {
  const email = 'mohommadammar826@gmail.com'
  const passwordToTest = 'admin123'
  
  try {
    const user = await prisma.user.findUnique({ where: { email } })
    if (!user) {
      console.log('User not found')
      return
    }
    
    const isValid = await bcrypt.compare(passwordToTest, user.password)
    console.log(`Testing password for ${email}:`)
    console.log(`Password matches: ${isValid}`)
    
    // Also check if active
    console.log(`User active: ${user.active}`)
  } catch (error) {
    console.error('Error:', error)
  } finally {
    await prisma.$disconnect()
  }
}

main()
