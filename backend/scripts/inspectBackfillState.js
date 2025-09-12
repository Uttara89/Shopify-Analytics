import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const rows = await prisma.backfillState.findMany({ where: { tenantId: '6dd84760-e054-4cb0-8435-ac386a8ac26a' } });
  console.log(JSON.stringify(rows, null, 2));
  await prisma.$disconnect();
}

main().catch(err => { console.error(err); process.exit(1); });
