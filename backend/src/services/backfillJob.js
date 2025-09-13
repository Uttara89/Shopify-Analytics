import { PrismaClient } from '@prisma/client';
import crypto from 'crypto';
import path from 'path';
import fs from 'fs/promises';
import { fetchProductsSince, fetchCustomersSince, fetchOrdersSince } from './shopifyService.js';

// If a Prisma client is passed to processBackfillJob, use it; otherwise create one.
function getPrismaClient(external) {
  return external || new PrismaClient();
}

export async function processBackfillJob(jobId, externalPrisma) {
  const prisma = getPrismaClient(externalPrisma);
  console.log(new Date().toISOString(), 'backfillJob: starting job', jobId);
  const jobsDir = path.resolve(process.cwd(), 'jobs');
  const jobPath = path.join(jobsDir, `${jobId}.json`);
  const updateJob = async (patch) => {
    try {
      const raw = await fs.readFile(jobPath, 'utf8');
      const job = JSON.parse(raw);
      Object.assign(job, patch, { updatedAt: new Date().toISOString() });
      await fs.writeFile(jobPath, JSON.stringify(job, null, 2), 'utf8');
    } catch (e) {
      console.warn('Failed to update job file', e.message);
    }
  };

  await updateJob({ status: 'running', startedAt: new Date().toISOString() });
  console.log(new Date().toISOString(), 'backfillJob: marked running', jobId);

  try {
    const raw = await fs.readFile(jobPath, 'utf8');
    const job = JSON.parse(raw);
    const tenantId = job.tenantId;
    console.log(new Date().toISOString(), 'backfillJob: processing tenant', tenantId);
  const tenant = await prisma.tenant.findUnique({ where: { id: tenantId } });
    if (!tenant) {
      console.error(new Date().toISOString(), 'backfillJob: tenant not found for job', jobId, tenantId);
      await updateJob({ status: 'failed', error: 'tenant not found' });
      return;
    }
    // decrypt token helper (copied from controller)
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

    await updateJob({ message: 'Fetching tenant access token' });
    const accessToken = decryptAccessToken(tenant.accessTokenEnc);
    if (!accessToken) {
      await updateJob({ status: 'failed', error: 'No access token for tenant' });
      return;
    }

    const resources = ['products','customers','orders'];
    const states = {};
    for (const r of resources) {
      const s = await prisma.backfillState.findUnique({ where: { tenantId_resource: { tenantId, resource: r } } }).catch(() => null);
      states[r] = s;
    }

  await updateJob({ message: 'Fetching products' });
  const products = await fetchProductsSince(tenant.shopDomain, accessToken, states.products?.lastSuccessAt ? states.products.lastSuccessAt.toISOString().slice(0,19) : null);
  console.log(new Date().toISOString(), 'backfillJob:', jobId, 'fetched products count', products.products?.length || 0);
  await updateJob({ message: `Fetched ${products.products?.length || 0} products` });

    // Save products
    let lastProductAt = states.products?.lastSuccessAt || null;
    if (products.products?.length) {
      for (const p of products.products) {
        await prisma.product.upsert({
          where: { tenantId_shopProductId: { tenantId, shopProductId: BigInt(p.id) } },
          update: { title: p.title, status: p.status, updatedAt: new Date(p.updated_at) },
          create: { shopProductId: BigInt(p.id), tenantId, title: p.title, status: p.status, createdAt: new Date(p.created_at), updatedAt: new Date(p.updated_at) }
        });
        const t = new Date(p.updated_at || p.created_at);
        if (!lastProductAt || t > lastProductAt) lastProductAt = t;
      }
      await prisma.backfillState.upsert({ where: { tenantId_resource: { tenantId, resource: 'products' } }, update: { lastBackfillAt: new Date(), lastSuccessAt: lastProductAt, status: 'idle' }, create: { tenantId, resource: 'products', lastBackfillAt: new Date(), lastSuccessAt: lastProductAt, status: 'idle' } });
    }

  await updateJob({ message: 'Fetching customers' });
  const customers = await fetchCustomersSince(tenant.shopDomain, accessToken, states.customers?.lastSuccessAt ? states.customers.lastSuccessAt.toISOString().slice(0,19) : null);
  console.log(new Date().toISOString(), 'backfillJob:', jobId, 'fetched customers count', customers.customers?.length || 0);
  await updateJob({ message: `Fetched ${customers.customers?.length || 0} customers` });

    let lastCustomerAt = states.customers?.lastSuccessAt || null;
    if (customers.customers?.length) {
      for (const c of customers.customers) {
        await prisma.customer.upsert({ where: { tenantId_shopCustomerId: { tenantId, shopCustomerId: BigInt(c.id) } }, update: { email: c.email, firstName: c.first_name, lastName: c.last_name, totalSpent: c.total_spent ? Number(c.total_spent) : 0, updatedAt: new Date(c.updated_at) }, create: { shopCustomerId: BigInt(c.id), tenantId, email: c.email, firstName: c.first_name, lastName: c.last_name, totalSpent: c.total_spent ? Number(c.total_spent) : 0, createdAt: new Date(c.created_at), updatedAt: new Date(c.updated_at) } });
        const t = new Date(c.updated_at || c.created_at);
        if (!lastCustomerAt || t > lastCustomerAt) lastCustomerAt = t;
      }
      await prisma.backfillState.upsert({ where: { tenantId_resource: { tenantId, resource: 'customers' } }, update: { lastBackfillAt: new Date(), lastSuccessAt: lastCustomerAt, status: 'idle' }, create: { tenantId, resource: 'customers', lastBackfillAt: new Date(), lastSuccessAt: lastCustomerAt, status: 'idle' } });
    }

  await updateJob({ message: 'Fetching orders' });
  const orders = await fetchOrdersSince(tenant.shopDomain, accessToken, states.orders?.lastSuccessAt ? states.orders.lastSuccessAt.toISOString().slice(0,19) : null);
  console.log(new Date().toISOString(), 'backfillJob:', jobId, 'fetched orders count', orders.orders?.length || 0);
  await updateJob({ message: `Fetched ${orders.orders?.length || 0} orders` });

    let lastOrderAt = states.orders?.lastSuccessAt || null;
    if (orders.orders?.length) {
      for (const o of orders.orders) {
        await prisma.order.upsert({ where: { tenantId_shopOrderId: { tenantId, shopOrderId: BigInt(o.id) } }, update: { totalPrice: o.total_price ? Number(o.total_price) : 0, currency: o.currency, status: o.financial_status, processedAt: o.processed_at ? new Date(o.processed_at) : null, updatedAt: new Date(o.updated_at) }, create: { shopOrderId: BigInt(o.id), tenantId, totalPrice: o.total_price ? Number(o.total_price) : 0, currency: o.currency, status: o.financial_status, processedAt: o.processed_at ? new Date(o.processed_at) : null, createdAt: new Date(o.created_at), updatedAt: new Date(o.updated_at) } });
        const t = new Date(o.updated_at || o.created_at || o.processed_at);
        if (!lastOrderAt || t > lastOrderAt) lastOrderAt = t;
      }
      await prisma.backfillState.upsert({ where: { tenantId_resource: { tenantId, resource: 'orders' } }, update: { lastBackfillAt: new Date(), lastSuccessAt: lastOrderAt, status: 'idle' }, create: { tenantId, resource: 'orders', lastBackfillAt: new Date(), lastSuccessAt: lastOrderAt, status: 'idle' } });
    }

  await updateJob({ status: 'completed', message: 'Backfill completed', productsCount: products.products?.length || 0, customersCount: customers.customers?.length || 0, ordersCount: orders.orders?.length || 0 });
  console.log(new Date().toISOString(), 'backfillJob: completed job', jobId);
    // ensure statuses are idle
    try { for (const r of ['products','customers','orders']) await prisma.backfillState.update({ where: { tenantId_resource: { tenantId, resource: r } }, data: { status: 'idle' } }); } catch (e) {}
  } catch (error) {
    await updateJob({ status: 'failed', error: error.message });
    try { const raw = await fs.readFile(jobPath, 'utf8'); const job = JSON.parse(raw); const tenantId = job.tenantId; for (const r of ['products','customers','orders']) await prisma.backfillState.update({ where: { tenantId_resource: { tenantId, resource: r } }, data: { status: 'failed', notes: error.message } }); } catch (e) {}
  }
}

export default { processBackfillJob };
