// Use global fetch (Node.js 18+)

async function fetchWithRetry(url, headers, maxAttempts = 3) {
  let attempt = 0;
  while (attempt < maxAttempts) {
    attempt++;
    try {
      const res = await fetch(url, { headers });
      if (res.status === 429) {
        // rate limited - backoff and retry
        const waitMs = 500 * attempt;
        await new Promise(r => setTimeout(r, waitMs));
        continue;
      }
      return res;
    } catch (err) {
      if (attempt >= maxAttempts) throw err;
      await new Promise(r => setTimeout(r, 200 * attempt));
    }
  }
}

function parseLinkHeader(linkHeader) {
  // Find rel="next" URL
  if (!linkHeader) return null;
  const match = linkHeader.match(/<([^>]+)>;\s*rel="next"/);
  return match ? match[1] : null;
}

async function shopifyFetchAll(shopDomain, accessToken, endpoint, itemsKey, extraQuery = '') {
  const headers = {
    'X-Shopify-Access-Token': accessToken,
    'Content-Type': 'application/json',
  };

  // Start with maximum allowed per-page
  let nextUrl = `https://${shopDomain}/admin/api/2023-10/${endpoint}?limit=250${extraQuery ? '&' + extraQuery : ''}`;
  const allItems = [];

  while (nextUrl) {
    const res = await fetchWithRetry(nextUrl, headers);
    if (!res.ok) {
      throw new Error(`Shopify API error: ${res.status} when fetching ${nextUrl}`);
    }
    const data = await res.json();
    const items = data[itemsKey] || [];
    allItems.push(...items);

    const link = res.headers.get('link');
    const next = parseLinkHeader(link);
    nextUrl = next;
    // small delay to be courteous
    if (nextUrl) await new Promise(r => setTimeout(r, 100));
  }

  return { [itemsKey]: allItems };
}

export async function fetchProducts(shopDomain, accessToken) {
  return shopifyFetchAll(shopDomain, accessToken, 'products.json', 'products');
}

export async function fetchCustomers(shopDomain, accessToken) {
  return shopifyFetchAll(shopDomain, accessToken, 'customers.json', 'customers');
}

export async function fetchOrders(shopDomain, accessToken) {
  return shopifyFetchAll(shopDomain, accessToken, 'orders.json', 'orders');
}

// convenience wrappers that accept sinceDate (ISO) to fetch incremental data
export async function fetchProductsSince(shopDomain, accessToken, sinceISO) {
  const q = sinceISO ? `created_at_min=${encodeURIComponent(sinceISO)}` : '';
  return shopifyFetchAll(shopDomain, accessToken, 'products.json', 'products', q);
}

export async function fetchCustomersSince(shopDomain, accessToken, sinceISO) {
  const q = sinceISO ? `created_at_min=${encodeURIComponent(sinceISO)}` : '';
  return shopifyFetchAll(shopDomain, accessToken, 'customers.json', 'customers', q);
}

export async function fetchOrdersSince(shopDomain, accessToken, sinceISO) {
  const q = sinceISO ? `created_at_min=${encodeURIComponent(sinceISO)}` : '';
  return shopifyFetchAll(shopDomain, accessToken, 'orders.json', 'orders', q);
}