
import { PrismaClient } from '@prisma/client';
import fetch from 'node-fetch';
import crypto from 'crypto';
const prisma = new PrismaClient();

export async function getTenants(req, res) {
  try {
    const tenants = await prisma.tenant.findMany();
    res.json(tenants);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}

export async function createTenant(req, res) {
  const { name, shopDomain, accessTokenEnc } = req.body;
  try {
    const tenant = await prisma.tenant.create({
      data: { name, shopDomain, accessTokenEnc }
    });

    // attempt to auto-register webhooks for this tenant if we have an access token and BASE_WEBHOOK_URL
    (async function tryRegister() {
      try {
        const baseUrl = process.env.BASE_WEBHOOK_URL;
        if (!baseUrl) return;
        if (!accessTokenEnc) return;
        const accessToken = decryptAccessToken(accessTokenEnc);
        if (!accessToken) return;
        const topics = [
          { topic: 'products/create', path: '/webhooks/products' },
          { topic: 'orders/create', path: '/webhooks/orders' },
          { topic: 'customers/create', path: '/webhooks/customers' },
        ];
        for (const t of topics) {
          const address = `${baseUrl}${t.path}`;
          try {
            const r = await fetch(`https://${shopDomain}/admin/api/2023-10/webhooks.json`, {
              method: 'POST',
              headers: { 'X-Shopify-Access-Token': accessToken, 'Content-Type': 'application/json' },
              body: JSON.stringify({ webhook: { topic: t.topic, address, format: 'json' } })
            });
            const j = await r.json();
            // ignore already registered error
            if (j && j.errors && j.errors.address) {
              const addrErr = Array.isArray(j.errors.address) ? j.errors.address.join('; ') : String(j.errors.address);
              if (addrErr.toLowerCase().includes('already been taken')) continue;
            }
          } catch (err) {
            // swallow registration errors — tenant creation should not fail because of webhook registration
            console.warn('webhook reg failed for', shopDomain, err.message);
          }
        }
      } catch (err) {
        // ignore
      }
    })();

    res.status(201).json(tenant);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}

export async function deleteTenant(req, res) {
  const { id } = req.params;
  try {
    await prisma.tenant.delete({ where: { id } });
    res.json({ ok: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}

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
