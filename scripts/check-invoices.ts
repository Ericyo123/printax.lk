import { PrismaClient } from '@prisma/client'
const prisma = new PrismaClient()

async function check() {
  const invoices = await prisma.invoice.findMany()
  console.log('INVOICES IN DB:', invoices.map(i => ({ id: i.id, invoiceNumber: i.invoiceNumber })))
}
check().then(() => process.exit(0))
