import crypto from 'crypto';
import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

export async function verifyShopifyHmacMultiTenant(req, res, next) {
  // Bypass HMAC check in development or if BYPASS_SHOPIFY_HMAC is true
  if (process.env.NODE_ENV === 'development' || process.env.BYPASS_SHOPIFY_HMAC === 'true') {
    return next();
  }

  const shopifyHmac = req.get('X-Shopify-Hmac-Sha256');
  const { tenantId } = req.query;
  if (!shopifyHmac || !tenantId) {
    return res.status(401).send('Missing HMAC or tenantId');
  }

  // Look up the tenant's client secret
  const tenant = await prisma.tenant.findUnique({ where: { id: tenantId } });
  if (!tenant || !tenant.apiSecret) {
    return res.status(401).send('Missing tenant or tenant secret');
  }
  const secret = tenant.apiSecret;

  const rawBody = req.rawBody || JSON.stringify(req.body);
  const generatedHmac = crypto
    .createHmac('sha256', secret)
    .update(rawBody, 'utf8')
    .digest('base64');

  if (generatedHmac !== shopifyHmac) {
    return res.status(401).send('Invalid HMAC');
  }

  next();
}
