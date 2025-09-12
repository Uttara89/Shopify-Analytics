import { PrismaClient } from '@prisma/client';
import crypto from 'crypto';

const prisma = new PrismaClient();

function decryptAccessToken(accessTokenEnc) {
  if (!accessTokenEnc) return null;
  if (!process.env.ENCRYPTION_KEY) return accessTokenEnc;
  if (!accessTokenEnc.includes(':')) return accessTokenEnc;
  try {
    const [ivB64, cipherB64, tagB64] = accessTokenEnc.split(':');
    const iv = Buffer.from(ivB64, 'base64');
    const cipher = Buffer.from(cipherB64, 'base64');
    const tag = Buffer.from(tagB64, 'base64');
    const key = Buffer.from(process.env.ENCRYPTION_KEY, 'base64');
    const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
    decipher.setAuthTag(tag);
    const decrypted = Buffer.concat([decipher.update(cipher), decipher.final()]);
    return decrypted.toString('utf8');
  } catch (err) {
    console.warn('Failed to decrypt access token, treating as raw token:', err.message);
    return accessTokenEnc;
  }
}

async function fetchShopifyCount(shopDomain, accessToken, endpoint) {
  try {
    const url = `https://${shopDomain}/admin/api/2023-10/${endpoint}`;
    const res = await fetch(url, { headers: { 'X-Shopify-Access-Token': accessToken, 'Content-Type': 'application/json' } });
    if (!res.ok) return { ok: false, status: res.status };
    const data = await res.json();
    // return count heuristically
    if (data.products) return { ok: true, count: data.products.length };
    if (data.customers) return { ok: true, count: data.customers.length };
    if (data.orders) return { ok: true, count: data.orders.length };
    return { ok: true, count: 0 };
  } catch (err) {
    return { ok: false, error: err.message };
  }
}

async function main() {
  const tenants = await prisma.tenant.findMany();
  for (const t of tenants) {
    console.log('\n===', t.shopDomain, '===');
    const accessToken = decryptAccessToken(t.accessTokenEnc);
    if (!accessToken) {
      console.log('No access token available for tenant');
      continue;
    }

    const [dbProducts, dbCustomers, dbOrders] = await Promise.all([
      prisma.product.count({ where: { tenantId: t.id } }),
      prisma.customer.count({ where: { tenantId: t.id } }),
      prisma.order.count({ where: { tenantId: t.id } }),
    ]);

    const shopProducts = await fetchShopifyCount(t.shopDomain, accessToken, 'products.json');
    const shopCustomers = await fetchShopifyCount(t.shopDomain, accessToken, 'customers.json');
    const shopOrders = await fetchShopifyCount(t.shopDomain, accessToken, 'orders.json');

    console.log(`DB counts -> products: ${dbProducts}, customers: ${dbCustomers}, orders: ${dbOrders}`);
    console.log('Shopify API -> products:', shopProducts.ok ? shopProducts.count : shopProducts, ', customers:', shopCustomers.ok ? shopCustomers.count : shopCustomers, ', orders:', shopOrders.ok ? shopOrders.count : shopOrders);

    // quick analysis
    if (shopProducts.ok && shopProducts.count > dbProducts) console.log('Note: more products on Shopify than in DB — backfill likely partial or paginated.');
    if (shopCustomers.ok && shopCustomers.count > dbCustomers) console.log('Note: more customers on Shopify than in DB — backfill likely partial or paginated.');
    if (shopOrders.ok && shopOrders.count > dbOrders) console.log('Note: more orders on Shopify than in DB — backfill likely partial or paginated.');
  }

  await prisma.$disconnect();
}

main().catch(err => { console.error(err); process.exit(1); });
