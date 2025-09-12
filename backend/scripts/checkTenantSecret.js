import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const shop = process.argv[2];
  const secretToCheck = process.argv[3] || process.env.SHOPIFY_WEBHOOK_SECRET;
  if (!shop) {
    console.error('Usage: node checkTenantSecret.js <shopDomain> [secret]');
    process.exit(2);
  }

  const tenant = await prisma.tenant.findUnique({ where: { shopDomain: shop } });
  if (!tenant) {
    console.error('Tenant not found for', shop);
    process.exit(1);
  }

  if (!tenant.apiSecret) {
    console.log(`Tenant ${shop} has no apiSecret set (middleware will fall back to global SHOPIFY_WEBHOOK_SECRET if present).`);
    if (secretToCheck) console.log('Provided secret was:', !!secretToCheck ? '[present]' : '[not provided]');
    await prisma.$disconnect();
    process.exit(0);
  }

  if (!secretToCheck) {
    console.log('No secret provided to compare. Tenant has an apiSecret set (not displayed).');
    await prisma.$disconnect();
    process.exit(0);
  }

  // Compare without printing secrets. We'll compute HMAC on an example payload with both secrets to compare behavior.
  const payload = JSON.stringify({ test: 'check', t: Date.now() });
  const crypto = await import('crypto');
  const tenantHmac = crypto.createHmac('sha256', tenant.apiSecret).update(payload).digest('base64');
  const providedHmac = crypto.createHmac('sha256', secretToCheck).update(payload).digest('base64');

  if (tenantHmac === providedHmac) {
    console.log('Provided secret MATCHES tenant apiSecret (HMACs equal for test payload).');
  } else {
    console.log('Provided secret DOES NOT match tenant apiSecret.');
  }

  await prisma.$disconnect();
}

main().catch(err => { console.error(err); process.exit(1); });
