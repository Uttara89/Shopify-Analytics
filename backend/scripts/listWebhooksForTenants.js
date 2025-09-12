import fetch from 'node-fetch';
import crypto from 'crypto';
import { PrismaClient } from '@prisma/client';

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

async function listWebhooksForTenant(tenant, accessToken) {
  try {
    const res = await fetch(`https://${tenant.shopDomain}/admin/api/2023-10/webhooks.json`, {
      method: 'GET',
      headers: {
        'X-Shopify-Access-Token': accessToken,
        'Content-Type': 'application/json',
      },
    });
    const data = await res.json();
    return data.webhooks || [];
  } catch (err) {
    console.error(`Failed to list webhooks for ${tenant.shopDomain}:`, err.message);
    return null;
  }
}

async function main() {
  const baseUrlArg = process.argv[2] || process.env.BASE_WEBHOOK_URL || '';
  const allTenants = await prisma.tenant.findMany();
  if (!allTenants.length) {
    console.log('No tenants found.');
    process.exit(0);
  }

  for (const tenant of allTenants) {
    const accessToken = decryptAccessToken(tenant.accessTokenEnc);
    if (!accessToken) {
      console.log(`Skipping ${tenant.shopDomain}: no access token`);
      continue;
    }

    console.log(`
=== ${tenant.shopDomain} ===`);
    const webhooks = await listWebhooksForTenant(tenant, accessToken);
    if (webhooks === null) continue;
    if (!webhooks.length) {
      console.log('No webhooks found for this shop.');
      continue;
    }

    let foundCount = 0;
    for (const wh of webhooks) {
      const line = `id=${wh.id} topic=${wh.topic} address=${wh.address}`;
      console.log(line);
      if (baseUrlArg && wh.address && wh.address.startsWith(baseUrlArg)) foundCount++;
    }

    if (baseUrlArg) {
      if (foundCount > 0) {
        console.log(`Found ${foundCount} webhook(s) using base URL: ${baseUrlArg}`);
      } else {
        console.log(`No webhooks found using base URL: ${baseUrlArg}`);
      }
    }
  }

  await prisma.$disconnect();
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
