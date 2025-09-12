import fetch from 'node-fetch';
import crypto from 'crypto';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const shop = process.argv[2] || process.env.SHOP_DOMAIN;
  const url = process.argv[3] || process.env.WEBHOOK_URL || `https://${shop}/webhooks/products`;
  if (!shop) {
    console.error('Usage: node sendSignedWebhookWithTenantSecret.js <shopDomain> [webhookUrl]');
    process.exit(2);
  }

  const tenant = await prisma.tenant.findUnique({ where: { shopDomain: shop } });
  if (!tenant) {
    console.error('Tenant not found for', shop);
    await prisma.$disconnect();
    process.exit(1);
  }

  const secret = tenant.apiSecret || process.env.SHOPIFY_WEBHOOK_SECRET;
  if (!secret) {
    console.error('No secret available for tenant and no SHOPIFY_WEBHOOK_SECRET set.');
    await prisma.$disconnect();
    process.exit(1);
  }

  const payload = JSON.stringify({ id: Math.floor(Math.random() * 1e9), title: 'Signed test product', created_at: new Date().toISOString(), updated_at: new Date().toISOString() });
  const hmac = crypto.createHmac('sha256', secret).update(payload).digest('base64');

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Shopify-Hmac-Sha256': hmac,
        'X-Shopify-Shop-Domain': shop,
        'X-Shopify-Delivery-Id': `delivery-${Date.now()}`
      },
      body: payload
    });
    const text = await res.text();
    console.log('->', res.status, text);
  } catch (err) {
    console.error(err);
  }

  await prisma.$disconnect();
}

main().catch(err => { console.error(err); process.exit(1); });
