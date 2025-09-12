
import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

function parseDate(s) {
  if (!s) return null;
  const d = new Date(s);
  return isNaN(d.getTime()) ? null : d;
}

export async function getOverview(req, res) {
  const { tenantId } = req.query;
  if (!tenantId) return res.status(400).json({ error: 'tenantId required' });

  try {
    const [totalCustomers, totalOrders, revenueAgg] = await Promise.all([
      prisma.customer.count({ where: { tenantId } }),
      prisma.order.count({ where: { tenantId } }),
      prisma.order.aggregate({ where: { tenantId }, _sum: { totalPrice: true } }),
    ]);

    const totalRevenue = revenueAgg._sum?.totalPrice ? Number(revenueAgg._sum.totalPrice) : 0;

    // If customer relations aren't populated on orders, also derive a distinct customer count from orders
    try {
      const orderCustomerRows = await prisma.order.findMany({ where: { tenantId, customerId: { not: null } }, select: { customerId: true } });
      const distinctCustomerIds = new Set(orderCustomerRows.map(r => r.customerId));
      const derivedCustomerCount = distinctCustomerIds.size;
      // prefer the larger number (accounts for orders linking customers even if customer table missing entries)
      const finalCustomerCount = Math.max(totalCustomers, derivedCustomerCount);

      res.json({ tenantId, totalCustomers: finalCustomerCount, totalOrders, totalRevenue });
    } catch (err) {
      // If anything goes wrong with derived count, return the original customer count
      res.json({ tenantId, totalCustomers, totalOrders, totalRevenue });
    }
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

// GET /metrics/orders-by-date?tenantId=...&startDate=2025-09-01&endDate=2025-09-10&groupBy=day
export async function getOrdersByDate(req, res) {
  const { tenantId, startDate, endDate, groupBy = 'day', dateField = 'createdAt' } = req.query;
  if (!tenantId) return res.status(400).json({ error: 'tenantId required' });
  const start = parseDate(startDate) || new Date(0);
  const end = parseDate(endDate) || new Date();

  // validate dateField
  const allowedDateFields = new Set(['createdAt', 'processedAt']);
  const field = allowedDateFields.has(dateField) ? dateField : 'createdAt';

  try {
    const whereClause = { tenantId };
    whereClause[field] = { gte: start, lte: end };

    const orders = await prisma.order.findMany({
      where: whereClause,
      select: { [field]: true, totalPrice: true }
    });

    const buckets = new Map();
    for (const o of orders) {
      const ts = o[field];
      if (!ts) continue;
      let key;
      const d = new Date(ts);
      if (groupBy === 'month') {
        key = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2,'0')}`;
      } else { // day
        key = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2,'0')}-${String(d.getUTCDate()).padStart(2,'0')}`;
      }
      const cur = buckets.get(key) || { count: 0, revenue: 0 };
      cur.count += 1;
      cur.revenue += o.totalPrice ? Number(o.totalPrice) : 0;
      buckets.set(key, cur);
    }

    // build continuous buckets between start and end
    const result = [];
    const startD = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth(), start.getUTCDate()));
    const endD = new Date(Date.UTC(end.getUTCFullYear(), end.getUTCMonth(), end.getUTCDate()));

    if (groupBy === 'month') {
      let curYear = startD.getUTCFullYear();
      let curMonth = startD.getUTCMonth();
      while (curYear < endD.getUTCFullYear() || (curYear === endD.getUTCFullYear() && curMonth <= endD.getUTCMonth())) {
        const key = `${curYear}-${String(curMonth + 1).padStart(2,'0')}`;
        const v = buckets.get(key) || { count: 0, revenue: 0 };
        result.push({ date: key, count: v.count, revenue: v.revenue });
        curMonth++;
        if (curMonth > 11) { curMonth = 0; curYear++; }
      }
    } else {
      const oneDay = 24 * 60 * 60 * 1000;
      for (let d = startD.getTime(); d <= endD.getTime(); d += oneDay) {
        const dt = new Date(d);
        const key = `${dt.getUTCFullYear()}-${String(dt.getUTCMonth() + 1).padStart(2,'0')}-${String(dt.getUTCDate()).padStart(2,'0')}`;
        const v = buckets.get(key) || { count: 0, revenue: 0 };
        result.push({ date: key, count: v.count, revenue: v.revenue });
      }
    }

    res.json({ tenantId, groupBy, dateField: field, result });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

// GET /metrics/top-customers?tenantId=...&limit=10
export async function getTopCustomers(req, res) {
  const { tenantId, limit = '10' } = req.query;
  if (!tenantId) return res.status(400).json({ error: 'tenantId required' });
  const lim = Math.min(100, Math.max(1, parseInt(limit,10) || 10));

  try {
    // Prefer customers.totalSpent if available
    const customerRows = await prisma.customer.findMany({ where: { tenantId }, orderBy: { totalSpent: 'desc' }, take: lim });
    if (customerRows && customerRows.length) {
      const result = customerRows.map(c => ({ customerId: c.id, ordersCount: null, revenue: Number(c.totalSpent || 0), info: { id: c.id, email: c.email, firstName: c.firstName, lastName: c.lastName } }));
      return res.json({ tenantId, limit: lim, source: 'customers.totalSpent', result });
    }

    // Fallback: aggregate orders by customerId
    const groups = await prisma.order.groupBy({ by: ['customerId'], where: { tenantId, customerId: { not: null } }, _sum: { totalPrice: true }, _count: { customerId: true }, orderBy: { _sum: { totalPrice: 'desc' } }, take: lim });
    const custIds = groups.map(g => g.customerId).filter(Boolean);
    const custInfo = await prisma.customer.findMany({ where: { id: { in: custIds } }, select: { id: true, email: true, firstName: true, lastName: true } });
    const custMap = new Map(custInfo.map(c => [c.id, c]));
    const result = groups.map(g => ({ customerId: g.customerId, ordersCount: g._count.customerId, revenue: Number(g._sum.totalPrice || 0), info: custMap.get(g.customerId) || null }));
    res.json({ tenantId, limit: lim, source: 'orders.aggregate', result });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

// GET /metrics/aov-by-date?tenantId=...&startDate=2025-09-01&endDate=2025-09-10&groupBy=day
export async function getAovByDate(req, res) {
  const { tenantId, startDate, endDate, groupBy = 'day', dateField = 'createdAt' } = req.query;
  if (!tenantId) return res.status(400).json({ error: 'tenantId required' });
  const start = parseDate(startDate) || new Date(0);
  const end = parseDate(endDate) || new Date();

  const allowedDateFields = new Set(['createdAt', 'processedAt']);
  const field = allowedDateFields.has(dateField) ? dateField : 'createdAt';

  try {
    const whereClause = { tenantId };
    whereClause[field] = { gte: start, lte: end };

    const orders = await prisma.order.findMany({ where: whereClause, select: { [field]: true, totalPrice: true } });

    const buckets = new Map();
    for (const o of orders) {
      const ts = o[field];
      if (!ts) continue;
      let key;
      const d = new Date(ts);
      if (groupBy === 'month') {
        key = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2,'0')}`;
      } else {
        key = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2,'0')}-${String(d.getUTCDate()).padStart(2,'0')}`;
      }
      const cur = buckets.get(key) || { count: 0, revenue: 0 };
      cur.count += 1;
      cur.revenue += o.totalPrice ? Number(o.totalPrice) : 0;
      buckets.set(key, cur);
    }

    // build continuous buckets between start and end
    const result = [];
    const startD = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth(), start.getUTCDate()));
    const endD = new Date(Date.UTC(end.getUTCFullYear(), end.getUTCMonth(), end.getUTCDate()));

    if (groupBy === 'month') {
      let curYear = startD.getUTCFullYear();
      let curMonth = startD.getUTCMonth();
      while (curYear < endD.getUTCFullYear() || (curYear === endD.getUTCFullYear() && curMonth <= endD.getUTCMonth())) {
        const key = `${curYear}-${String(curMonth + 1).padStart(2,'0')}`;
        const v = buckets.get(key) || { count: 0, revenue: 0 };
        const aov = v.count ? v.revenue / v.count : 0;
        result.push({ date: key, count: v.count, revenue: v.revenue, aov: Number(aov.toFixed(2)) });
        curMonth++;
        if (curMonth > 11) { curMonth = 0; curYear++; }
      }
    } else {
      const oneDay = 24 * 60 * 60 * 1000;
      for (let d = startD.getTime(); d <= endD.getTime(); d += oneDay) {
        const dt = new Date(d);
        const key = `${dt.getUTCFullYear()}-${String(dt.getUTCMonth() + 1).padStart(2,'0')}-${String(dt.getUTCDate()).padStart(2,'0')}`;
        const v = buckets.get(key) || { count: 0, revenue: 0 };
        const aov = v.count ? v.revenue / v.count : 0;
        result.push({ date: key, count: v.count, revenue: v.revenue, aov: Number(aov.toFixed(2)) });
      }
    }

    res.json({ tenantId, groupBy, dateField: field, result });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

// GET /metrics/product-counts
export async function getProductCounts(req, res) {
  console.log('[metrics] getProductCounts called');
  try {
    // Fetch all tenants, then left-join product counts so tenants with zero products are included
    const tenants = await prisma.tenant.findMany({ select: { id: true, name: true, shopDomain: true } });
    console.log('[metrics] tenants fetched count=', tenants.length);
    const tenantIds = tenants.map(t => t.id);
    console.log('[metrics] tenantIds=', tenantIds);

    let result = [];
    let counts = [];
    if (tenantIds.length) {
      counts = await prisma.product.groupBy({ by: ['tenantId'], _count: { tenantId: true }, where: { tenantId: { in: tenantIds } } });
      console.log('[metrics] raw counts rows=', counts.length, counts.map(c => ({ tenantId: c.tenantId, count: c._count.tenantId })));
      const countMap = new Map(counts.map(c => [c.tenantId, c._count.tenantId]));
      result = tenants.map(t => ({ tenantId: t.id, count: countMap.get(t.id) || 0, tenant: t }));
    } else {
      result = [];
    }

    console.log('[metrics] product-counts result rows=', result.length);
    if (req.query && req.query.debug === '1') {
      return res.json({ result, tenants, rawCounts: counts || [] });
    }
    res.json({ result });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}
