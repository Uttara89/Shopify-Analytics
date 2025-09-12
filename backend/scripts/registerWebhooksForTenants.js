import fetch from 'node-fetch';
import crypto from 'crypto';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const dryRun = process.argv.includes('--dry-run');

// Topics to register
const webhooks = [
  { topic: 'products/create', path: '/webhooks/products' },
  { topic: 'orders/create', path: '/webhooks/orders' },
  { topic: 'customers/create', path: '/webhooks/customers' },
];

function decryptAccessToken(accessTokenEnc) {
  // If token is stored in plaintext (no ':' separator), return it directly.
  if (!accessTokenEnc) return null;
  if (!process.env.ENCRYPTION_KEY) {
    // No encryption key provided: assume token is plaintext
    return accessTokenEnc;
  }

  // Expected format (recommended): base64(iv):base64(ciphertext):base64(tag)
  if (!accessTokenEnc.includes(':')) {
    return accessTokenEnc; // unknown format - treat as plaintext
  }

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

async function registerWebhookForTenant(tenant, accessToken, baseUrl) {
  for (const { topic, path } of webhooks) {
    const address = `${baseUrl}${path}`;
    try {
      if (dryRun) {
        console.log(`[dry-run] ${tenant.shopDomain} - ${topic}: would POST to https://${tenant.shopDomain}/admin/api/2023-10/webhooks.json with address=${address}`);
        continue;
      }

      const res = await fetch(`https://${tenant.shopDomain}/admin/api/2023-10/webhooks.json`, {
        method: 'POST',
        headers: {
          'X-Shopify-Access-Token': accessToken,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ webhook: { topic, address, format: 'json' } }),
      });
      const data = await res.json();

      // Handle Shopify "already been taken" error as informational (webhook already exists)
      if (data && data.errors && data.errors.address) {
        const addrErr = Array.isArray(data.errors.address) ? data.errors.address.join('; ') : String(data.errors.address);
        if (addrErr.toLowerCase().includes('already been taken') || addrErr.toLowerCase().includes('for this topic has already been taken')) {
          console.log(`${tenant.shopDomain} - ${topic}: already registered at ${address}`);
          continue;
        }
      }

      console.log(`${tenant.shopDomain} - ${topic}:`, data);
    } catch (err) {
      console.error(`${tenant.shopDomain} - ${topic} registration failed:`, err.message);
    }
  }
}

async function main() {
  const baseUrl = process.env.BASE_WEBHOOK_URL; // e.g. https://abcd.ngrok.io
  if (!baseUrl) {
    console.error('Set BASE_WEBHOOK_URL environment variable (e.g., https://abcd.ngrok.io)');
    process.exit(1);
  }

  // Fetch all tenants and filter in JS to avoid Prisma null/NOT filter issues
  const allTenants = await prisma.tenant.findMany();
  const tenants = allTenants.filter(t => t.accessTokenEnc && t.accessTokenEnc.length > 0);
  console.log(`Found ${tenants.length} tenant(s) with access tokens (from ${allTenants.length} total tenants)`);
  if (!tenants.length) {
    console.log('No tenants with access tokens found.');
    process.exit(0);
  }

  for (const tenant of tenants) {
    const accessToken = decryptAccessToken(tenant.accessTokenEnc);
    if (!accessToken) {
      console.warn(`Skipping ${tenant.shopDomain}: no access token available`);
      continue;
    }
    console.log(`Registering webhooks for ${tenant.shopDomain} -> ${baseUrl}`);
    await registerWebhookForTenant(tenant, accessToken, baseUrl);
  }

  await prisma.$disconnect();
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
