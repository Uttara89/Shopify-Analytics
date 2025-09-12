import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  const tenants = await prisma.tenant.findMany({ select: { id: true, shopDomain: true } });
  for (const t of tenants) {
    console.log(`${t.id} - ${t.shopDomain}`);
  }
  await prisma.$disconnect();
}

main().catch(err => { console.error(err); process.exit(1); });
