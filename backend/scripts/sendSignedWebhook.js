import fetch from 'node-fetch';
import crypto from 'crypto';

const url = process.argv[2] || process.env.WEBHOOK_URL || 'https://d233c1316ea5.ngrok-free.app/webhooks/products';
const secret = process.env.SHOPIFY_WEBHOOK_SECRET || '6d91c271a59e932e830451091e61ce10';
const shopDomain = process.env.SHOP_DOMAIN || 'xenoteststore2.myshopify.com';

const payload = JSON.stringify({
  id: Math.floor(Math.random() * 1e9),
  title: 'Signed test product',
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString()
});

const hmac = crypto.createHmac('sha256', secret).update(payload).digest('base64');

(async () => {
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Shopify-Hmac-Sha256': hmac,
        'X-Shopify-Shop-Domain': shopDomain,
        // include a delivery id to mimic Shopify header
        'X-Shopify-Delivery-Id': `delivery-${Date.now()}`
      },
      body: payload
    });
    const text = await res.text();
    console.log('->', res.status, text);
  } catch (err) {
    console.error(err);
  }
})();
