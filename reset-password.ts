import { PrismaClient } from '@prisma/client'
import { hash } from 'bcryptjs'

const prisma = new PrismaClient()

async function main() {
  const email = process.argv[2]
  const newPassword = process.argv[3]

  if (!email || !newPassword) {
    console.error('Usage: npx tsx reset-password.ts <admin-email> <new-password>')
    console.error('Example: npx tsx reset-password.ts admin@printax.lk MyNewPassword123')
    process.exit(1)
  }

  const hashedPassword = await hash(newPassword, 12)

  try {
    const user = await prisma.user.update({
      where: { email },
      data: { password: hashedPassword }
    })
    console.log(`✅ Successfully reset password for user: ${user.email}`)
  } catch (error) {
    console.error(`❌ Failed to reset password. Are you sure a user with email "${email}" exists?`)
  }
}

main().catch(console.error).finally(() => prisma.$disconnect())
