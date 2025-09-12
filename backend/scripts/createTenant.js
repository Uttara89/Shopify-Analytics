import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

// Usage examples (PowerShell):
// $env:TENANT_NAME='My Store'; $env:SHOP_DOMAIN='mystore.myshopify.com'; $env:ACCESS_TOKEN='shpat_xxx'; node .\scripts\createTenant.js
// or with args: node .\scripts\createTenant.js "My Store" mystore.myshopify.com shpat_xxx

async function main() {
  const name = process.env.TENANT_NAME || process.argv[2];
  const shopDomain = process.env.SHOP_DOMAIN || process.argv[3];
  const accessTokenEnc = process.env.ACCESS_TOKEN || process.argv[4] || null;
  const apiSecret = process.env.API_SECRET || process.argv[5] || null;

  if (!name || !shopDomain) {
    console.error('Missing required fields. Provide TENANT_NAME and SHOP_DOMAIN (env) or pass as args.');
    process.exit(1);
  }

  const existing = await prisma.tenant.findUnique({ where: { shopDomain } });
  if (existing) {
    console.log('Tenant already exists:', existing.id);
    await prisma.$disconnect();
    process.exit(0);
  }

  const tenant = await prisma.tenant.create({
    data: {
      name,
      shopDomain,
      accessTokenEnc,
      apiSecret,
    },
  });

  console.log('Created tenant:', tenant.id, tenant.shopDomain);
  await prisma.$disconnect();
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
