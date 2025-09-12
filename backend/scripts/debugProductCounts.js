import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  try {
    const tenants = await prisma.tenant.findMany({ select: { id: true, name: true, shopDomain: true } });
    console.log('TENANTS:', tenants.length);
    console.log(tenants);

    const tenantIds = tenants.map(t => t.id);
    const counts = await prisma.product.groupBy({ by: ['tenantId'], _count: { tenantId: true }, where: { tenantId: { in: tenantIds } } });
    console.log('COUNTS ROWS:', counts.length);
    console.log(counts.map(c => ({ tenantId: c.tenantId, count: c._count.tenantId })));

    const countMap = new Map(counts.map(c => [c.tenantId, c._count.tenantId]));
    const result = tenants.map(t => ({ tenantId: t.id, count: countMap.get(t.id) || 0, tenant: t }));
    console.log('RESULT LENGTH:', result.length);
    console.log(result);
  } catch (e) {
    console.error('ERR', e);
  } finally {
    await prisma.$disconnect();
  }
}

main();
