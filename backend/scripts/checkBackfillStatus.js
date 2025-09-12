import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  const arg = process.argv[2];
  if (!arg) {
    console.error('Usage: node checkBackfillStatus.js <shopDomain|tenantId>');
    process.exit(2);
  }

  // try tenantId first, then shopDomain
  let tenant = null;
  if (arg.includes('-')) {
    tenant = await prisma.tenant.findUnique({ where: { id: arg } });
  }
  if (!tenant) {
    tenant = await prisma.tenant.findUnique({ where: { shopDomain: arg } });
  }
  if (!tenant) {
    console.error('Tenant not found for', arg);
    await prisma.$disconnect();
    process.exit(1);
  }

  const tenantId = tenant.id;
  const [productsCount, customersCount, ordersCount, webhookLogsCount] = await Promise.all([
    prisma.product.count({ where: { tenantId } }),
    prisma.customer.count({ where: { tenantId } }),
    prisma.order.count({ where: { tenantId } }),
    prisma.webhookLog.count({ where: { tenantId } }),
  ]);

  console.log(`Tenant: ${tenant.shopDomain} (${tenantId})`);
  console.log(`Products:  ${productsCount}`);
  console.log(`Customers: ${customersCount}`);
  console.log(`Orders:    ${ordersCount}`);
  console.log(`WebhookLog entries: ${webhookLogsCount}`);

  await prisma.$disconnect();
}

main().catch(err => { console.error(err); process.exit(1); });
