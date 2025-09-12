import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  try {
    const rows = await prisma.backfillState.findMany({ where: { tenantId: 'cddaaeab-60e5-44bd-b331-88e02d87efaf' } });
    console.log('BACKFILL STATE', JSON.stringify(rows, null, 2));
  } catch (e) {
    console.error('ERR', e);
  } finally {
    await prisma.$disconnect();
  }
}

main();
