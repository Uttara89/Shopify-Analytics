
import { PrismaClient } from '@prisma/client';
import crypto from 'crypto';
const prisma = new PrismaClient();


export const handleProductWebhook = async (req, res) => {
  try {
    const shopDomain = req.get('X-Shopify-Shop-Domain');
    const deliveryId = req.get('X-Shopify-Delivery-Id');
  const raw = req.rawBody || Buffer.from(JSON.stringify(req.body));
  const payloadHash = crypto.createHash('sha256').update(raw).digest('hex');
    const p = req.body;
    if (!shopDomain || !p?.id) return res.status(400).json({ error: 'Missing shopDomain or product id' });
    const tenant = await prisma.tenant.findUnique({ where: { shopDomain } });
    if (!tenant) return res.status(404).json({ error: 'Tenant not found' });

    // idempotency: check if we already processed this deliveryId or payloadHash
    const existing = await prisma.webhookLog.findFirst({ where: { OR: [{ deliveryId }, { payloadHash }] } });
    if (existing) {
      return res.status(200).json({ ok: true, note: 'duplicate' });
    }

    // create initial log
    const log = await prisma.webhookLog.create({ data: { tenantId: tenant.id, topic: 'products/create', deliveryId, payloadHash, status: 'processing' } });

    await prisma.product.upsert({
      where: { tenantId_shopProductId: { tenantId: tenant.id, shopProductId: BigInt(p.id) } },
      update: {
        title: p.title,
        status: p.status,
        updatedAt: new Date(p.updated_at),
      },
      create: {
        shopProductId: BigInt(p.id),
        tenantId: tenant.id,
        title: p.title,
        status: p.status,
        createdAt: new Date(p.created_at),
        updatedAt: new Date(p.updated_at),
      },
    });

    await prisma.webhookLog.update({ where: { id: log.id }, data: { status: 'ok' } });
    res.status(200).json({ ok: true });
  } catch (error) {
    // log failure if possible
    try { await prisma.webhookLog.create({ data: { topic: 'products/create', status: 'error', reason: error.message } }); } catch (e) {}
    res.status(500).json({ error: error.message });
  }
};



export const handleOrderWebhook = async (req, res) => {
  try {
    const shopDomain = req.get('X-Shopify-Shop-Domain');
    const deliveryId = req.get('X-Shopify-Delivery-Id');
  const raw = req.rawBody || Buffer.from(JSON.stringify(req.body));
  const payloadHash = crypto.createHash('sha256').update(raw).digest('hex');
    const o = req.body;
    if (!shopDomain || !o?.id) return res.status(400).json({ error: 'Missing shopDomain or order id' });
    const tenant = await prisma.tenant.findUnique({ where: { shopDomain } });
    if (!tenant) return res.status(404).json({ error: 'Tenant not found' });

    const existing = await prisma.webhookLog.findFirst({ where: { OR: [{ deliveryId }, { payloadHash }] } });
    if (existing) {
      return res.status(200).json({ ok: true, note: 'duplicate' });
    }

    const log = await prisma.webhookLog.create({ data: { tenantId: tenant.id, topic: 'orders/create', deliveryId, payloadHash, status: 'processing' } });

    await prisma.order.upsert({
      where: { tenantId_shopOrderId: { tenantId: tenant.id, shopOrderId: BigInt(o.id) } },
      update: {
        totalPrice: o.total_price ? Number(o.total_price) : 0,
        currency: o.currency,
        status: o.financial_status,
        processedAt: o.processed_at ? new Date(o.processed_at) : null,
        updatedAt: new Date(o.updated_at),
      },
      create: {
        shopOrderId: BigInt(o.id),
        tenantId: tenant.id,
        totalPrice: o.total_price ? Number(o.total_price) : 0,
        currency: o.currency,
        status: o.financial_status,
        processedAt: o.processed_at ? new Date(o.processed_at) : null,
        createdAt: new Date(o.created_at),
        updatedAt: new Date(o.updated_at),
      },
    });

    await prisma.webhookLog.update({ where: { id: log.id }, data: { status: 'ok' } });
    res.status(200).json({ ok: true });
  } catch (error) {
    try { await prisma.webhookLog.create({ data: { topic: 'orders/create', status: 'error', reason: error.message } }); } catch (e) {}
    res.status(500).json({ error: error.message });
  }
};



export const handleCustomerWebhook = async (req, res) => {
  try {
    const shopDomain = req.get('X-Shopify-Shop-Domain');
    const deliveryId = req.get('X-Shopify-Delivery-Id');
  const raw = req.rawBody || Buffer.from(JSON.stringify(req.body));
  const payloadHash = crypto.createHash('sha256').update(raw).digest('hex');
    const c = req.body;
    if (!shopDomain || !c?.id) return res.status(400).json({ error: 'Missing shopDomain or customer id' });
    const tenant = await prisma.tenant.findUnique({ where: { shopDomain } });
    if (!tenant) return res.status(404).json({ error: 'Tenant not found' });

    const existing = await prisma.webhookLog.findFirst({ where: { OR: [{ deliveryId }, { payloadHash }] } });
    if (existing) {
      return res.status(200).json({ ok: true, note: 'duplicate' });
    }

    const log = await prisma.webhookLog.create({ data: { tenantId: tenant.id, topic: 'customers/create', deliveryId, payloadHash, status: 'processing' } });

    await prisma.customer.upsert({
      where: { tenantId_shopCustomerId: { tenantId: tenant.id, shopCustomerId: BigInt(c.id) } },
      update: {
        email: c.email,
        firstName: c.first_name,
        lastName: c.last_name,
        totalSpent: c.total_spent ? Number(c.total_spent) : 0,
        updatedAt: new Date(c.updated_at),
      },
      create: {
        shopCustomerId: BigInt(c.id),
        tenantId: tenant.id,
        email: c.email,
        firstName: c.first_name,
        lastName: c.last_name,
        totalSpent: c.total_spent ? Number(c.total_spent) : 0,
        createdAt: new Date(c.created_at),
        updatedAt: new Date(c.updated_at),
      },
    });

    await prisma.webhookLog.update({ where: { id: log.id }, data: { status: 'ok' } });
    res.status(200).json({ ok: true });
  } catch (error) {
    try { await prisma.webhookLog.create({ data: { topic: 'customers/create', status: 'error', reason: error.message } }); } catch (e) {}
    res.status(500).json({ error: error.message });
  }
};
