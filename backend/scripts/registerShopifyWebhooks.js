import fetch from 'node-fetch';

const shopDomain = 'your-store.myshopify.com'; // Replace with your store domain
const accessToken = 'your_admin_api_access_token'; // Replace with your Admin API access token
const baseWebhookUrl = 'https://yourdomain.com/webhooks'; // Replace with your public endpoint (ngrok for local)

const webhooks = [
  { topic: 'products/create', address: `${baseWebhookUrl}/products` },
  { topic: 'orders/create', address: `${baseWebhookUrl}/orders` },
  { topic: 'customers/create', address: `${baseWebhookUrl}/customers` },
];

async function registerWebhook(topic, address) {
  const response = await fetch(`https://${shopDomain}/admin/api/2023-10/webhooks.json`, {
    method: 'POST',
    headers: {
      'X-Shopify-Access-Token': accessToken,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      webhook: {
        topic,
        address,
        format: 'json',
      },
    }),
  });
  const data = await response.json();
  console.log(`Webhook for ${topic}:`, data);
}

async function main() {
  for (const { topic, address } of webhooks) {
    await registerWebhook(topic, address);
  }
}

main();
