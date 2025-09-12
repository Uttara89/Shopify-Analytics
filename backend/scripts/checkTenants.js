import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  const tenants = await prisma.tenant.findMany();
  console.log(`Found ${tenants.length} tenants:`);
  for (const t of tenants) {
    console.log(`- id: ${t.id}, shopDomain: ${t.shopDomain}, accessTokenEnc: ${t.accessTokenEnc ? '[present]' : '[missing]'}, apiSecret: ${t.apiSecret ? '[present]' : '[missing]'}`);
  }
  await prisma.$disconnect();
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
