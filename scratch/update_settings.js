const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  await prisma.settings.upsert({
    where: { id: 'default' },
    update: {
      bankName: 'COMMERCIAL BANK',
      accountName: 'MJAAM AMMAR',
      accountNumber: '8017227052',
      swiftCode: '',
      branch: 'RAJAGIRIYA',
    },
    create: {
      id: 'default',
      bankName: 'COMMERCIAL BANK',
      accountName: 'MJAAM AMMAR',
      accountNumber: '8017227052',
      swiftCode: '',
      branch: 'RAJAGIRIYA',
    }
  });
  console.log('Settings updated');
}

main().catch(console.error).finally(() => prisma.$disconnect());
