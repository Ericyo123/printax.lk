import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'

const prisma = new PrismaClient()

async function main() {
  console.log('🌱 Seeding database...')

  // Admin user
  const hashedPassword = await bcrypt.hash('admin123', 10)
  await prisma.user.upsert({
    where: { email: 'mohommadammar826@gmail.com' },
    update: {},
    create: {
      name: 'Admin User',
      email: 'mohommadammar826@gmail.com',
      password: hashedPassword,
      role: 'ADMIN',
    },
  })

  // Staff user
  const staffPassword = await bcrypt.hash('staff123', 10)
  await prisma.user.upsert({
    where: { email: 'staff@printax.com' },
    update: {},
    create: {
      name: 'Staff User',
      email: 'staff@printax.com',
      password: staffPassword,
      role: 'STAFF',
    },
  })

  // Paper sizes
  const sizes = ['A4', 'A3', 'A5', 'Letter', 'Legal', 'A2', 'A1']
  const createdSizes: Record<string, string> = {}
  for (const name of sizes) {
    const ps = await prisma.paperSize.upsert({
      where: { name },
      update: {},
      create: { name },
    })
    createdSizes[name] = ps.id
  }

  // Pricing rules (per page costs)
  const pricingData = [
    { size: 'A4',     COLOR: { page: 15, copy: 15, book: 150 }, BW: { page: 5,  copy: 5,  book: 50  } },
    { size: 'A3',     COLOR: { page: 25, copy: 25, book: 250 }, BW: { page: 10, copy: 10, book: 100 } },
    { size: 'A5',     COLOR: { page: 10, copy: 10, book: 100 }, BW: { page: 3,  copy: 3,  book: 30  } },
    { size: 'Letter', COLOR: { page: 15, copy: 15, book: 150 }, BW: { page: 5,  copy: 5,  book: 50  } },
    { size: 'Legal',  COLOR: { page: 20, copy: 20, book: 200 }, BW: { page: 8,  copy: 8,  book: 80  } },
    { size: 'A2',     COLOR: { page: 50, copy: 50, book: 500 }, BW: { page: 20, copy: 20, book: 200 } },
    { size: 'A1',     COLOR: { page: 80, copy: 80, book: 800 }, BW: { page: 35, copy: 35, book: 350 } },
  ]

  for (const p of pricingData) {
    const sizeId = createdSizes[p.size]
    for (const [type, prices] of Object.entries({ COLOR: p.COLOR, BW: p.BW })) {
      await prisma.pricingRule.upsert({
        where: { paperSizeId_printType: { paperSizeId: sizeId, printType: type } },
        update: { pricePerPage: prices.page, pricePerCopy: prices.copy, pricePerBook: prices.book },
        create: {
          paperSizeId: sizeId,
          printType: type,
          pricePerPage: prices.page,
          pricePerCopy: prices.copy,
          pricePerBook: prices.book,
        },
      })
    }
  }

  // Additional services
  const services = [
    { name: 'Binding', price: 50 },
    { name: 'Lamination', price: 30 },
    { name: 'Scanning', price: 10 },
    { name: 'Cutting', price: 20 },
    { name: 'Stapling', price: 5 },
    { name: 'Folding', price: 10 },
    { name: 'Cover Page', price: 25 },
  ]
  for (const s of services) {
    await prisma.additionalService.upsert({
      where: { name: s.name },
      update: {},
      create: s,
    })
  }

  // Sample customers
  await prisma.customer.upsert({
    where: { id: 'sample-monthly-1' },
    update: {},
    create: {
      id: 'sample-monthly-1',
      name: 'ABC Corporation',
      phone: '0771234567',
      email: 'abc@corp.com',
      address: '123 Business Park',
      type: 'MONTHLY',
    },
  })
  await prisma.customer.upsert({
    where: { id: 'sample-monthly-2' },
    update: {},
    create: {
      id: 'sample-monthly-2',
      name: 'XYZ School',
      phone: '0779876543',
      email: 'xyz@school.com',
      address: '45 Education Lane',
      type: 'MONTHLY',
    },
  })

  console.log('✅ Seed complete!')
  console.log('   Admin: mohommadammar826@gmail.com / admin123')
  console.log('   Staff: staff@printax.com / staff123')
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
