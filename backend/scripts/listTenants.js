import { PrismaClient } from '@prisma/client';
import dotenv from 'dotenv';
dotenv.config();

const prisma = new PrismaClient();

async function main() {
  const tenants = await prisma.tenant.findMany({ orderBy: { createdAt: 'asc' } });
  console.log(`Found ${tenants.length} tenant(s):`);
  for (const t of tenants) {
    console.log(`- id=${t.id} name=${t.name} shopDomain=${t.shopDomain} accessTokenEnc=${t.accessTokenEnc ? 'YES' : 'NO'}`);
  }
}

main().catch(err => { console.error(err); process.exit(1); }).finally(() => prisma.$disconnect());
