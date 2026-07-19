import { PrismaClient } from '@prisma/client'

const regions = [
  'ap-southeast-1',
  'ap-south-1',
  'us-east-1',
  'us-east-2',
  'us-west-1',
  'us-west-2',
  'eu-central-1',
  'eu-west-1',
  'eu-west-2',
  'eu-west-3',
  'ca-central-1',
  'sa-east-1',
  'ap-southeast-2',
  'ap-northeast-1',
  'ap-northeast-2'
]

async function scan() {
  for (const region of regions) {
    const host = `aws-0-${region}.pooler.supabase.com`
    console.log(`Testing ${region}...`)
    const url = `postgresql://postgres.jkjyavypubqatqioavmg:ADGUrciuhNkNBx1K@${host}:5432/postgres`
    const prisma = new PrismaClient({
      datasources: {
        db: {
          url
        }
      }
    })
    try {
      await prisma.$connect()
      console.log(`\n🎉 SUCCESS! Region is: ${region}\n`)
      await prisma.$disconnect()
      process.exit(0)
    } catch (e: any) {
      if (e.message.includes('tenant/user') && e.message.includes('not found')) {
        // Tenant not found
      } else {
        console.log(`Error on ${region}:`, e.message)
      }
      await prisma.$disconnect()
    }
  }
  console.log('No region succeeded.')
  process.exit(1)
}

scan()
