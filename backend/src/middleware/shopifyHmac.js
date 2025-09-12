import crypto from 'crypto';
import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

export async function verifyShopifyHmac(req, res, next) {
  // Bypass HMAC check in development or if BYPASS_SHOPIFY_HMAC is true
  if (process.env.NODE_ENV === 'development' || process.env.BYPASS_SHOPIFY_HMAC === 'true') {
    return next();
  }

  const shopifyHmac = req.get('X-Shopify-Hmac-Sha256');
  const shopDomain = req.get('X-Shopify-Shop-Domain');
  if (!shopifyHmac || !shopDomain) {
    return res.status(401).send('Missing HMAC or shop domain');
  }

  // Find tenant by shopDomain
  const tenant = await prisma.tenant.findUnique({ where: { shopDomain } });
  // Use per-tenant apiSecret if present, else fallback to global env
  const secret = tenant?.apiSecret || process.env.SHOPIFY_WEBHOOK_SECRET;
  if (!secret) {
    return res.status(401).send('Missing webhook secret');
  }

  // Use raw request body buffer for HMAC verification
  const rawBody = req.rawBody || Buffer.from(JSON.stringify(req.body));
  const generatedHmac = crypto
    .createHmac('sha256', secret)
    .update(rawBody)
    .digest('base64');

  if (generatedHmac !== shopifyHmac) {
    return res.status(401).send('Invalid HMAC');
  }

  next();
}
