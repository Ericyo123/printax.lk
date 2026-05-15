const { PrismaClient } = require('@prisma/client')
const bcrypt = require('bcryptjs')
const prisma = new PrismaClient()

async function main() {
  const email = 'mohommadammar826@gmail.com'
  const newPassword = 'admin123'
  const hashedPassword = await bcrypt.hash(newPassword, 10)
  
  try {
    const user = await prisma.user.update({
      where: { email },
      data: { 
        password: hashedPassword,
        active: true 
      }
    })
    console.log(`Successfully reset password for ${email}`)
    console.log(`Hashed password: ${hashedPassword}`)
  } catch (error) {
    console.error('Error resetting password:', error)
  } finally {
    await prisma.$disconnect()
  }
}

main()
