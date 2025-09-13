import React, { useEffect, useState, useRef } from 'react';
import { apiFetch, BASE_URL } from './api';

function Dashboard() {
  const [tenantId, setTenantId] = useState('');
  const [tenants, setTenants] = useState([]);
  const [ordersData, setOrdersData] = useState([]);
  const [topCustomers, setTopCustomers] = useState([]);
  const [startDate, setStartDate] = useState(() => {
    const end = new Date();
    const start = new Date(end.getTime() - 29 * 24 * 60 * 60 * 1000);
    return start.toISOString().slice(0,10);
  });
  const [endDate, setEndDate] = useState(() => new Date().toISOString().slice(0,10));
  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState(null); // { message, type }
  const [lastOverview, setLastOverview] = useState(null);
  const [overview, setOverview] = useState({ totalCustomers: 0, totalOrders: 0, totalRevenue: 0 });
  const ordersChartRef = useRef(null);
  const customersChartRef = useRef(null);
  const aovChartRef = useRef(null);
  const aovChartInstance = useRef(null);
  const ordersChartInstance = useRef(null);
  const customersChartInstance = useRef(null);
  

  useEffect(() => {
    const saved = localStorage.getItem('selectedTenant');
    if (saved) setTenantId(saved);
    fetchTenants();
  }, []);

  useEffect(() => {
    if (!tenantId) return;
    localStorage.setItem('selectedTenant', tenantId);
  fetchOrdersByDate();
  fetchTopCustomers();
  fetchAovByDate();
  // populate overview immediately
  (async () => { const o = await getOverview(); if (o) setOverview(o); })();
  }, [tenantId]);

  // poll overview periodically to detect external backfills/updates
  useEffect(() => {
    if (!tenantId) return;
    let stopped = false;
    // initial fetch of overview
    async function init() {
      const o = await getOverview();
      if (o && !stopped) {
        setOverview(o);
        setLastOverview(o);
      }
    }
    init();
    const iv = setInterval(async () => {
      try {
        const o = await getOverview();
        if (!o) return;
        // compare totals
        if (lastOverview && (o.totalOrders !== lastOverview.totalOrders || o.totalRevenue !== lastOverview.totalRevenue || o.totalCustomers !== lastOverview.totalCustomers)) {
          setToast({ message: 'Data updated', type: 'info' });
          // refresh charts
          fetchOrdersByDate();
          fetchTopCustomers();
          setOverview(o);
        }
        setLastOverview(o);
      } catch (e) {}
    }, 15000);
    return () => { stopped = true; clearInterval(iv); };
  }, [tenantId, lastOverview]);

  // refetch when date range changes automatically
  useEffect(() => {
    if (!tenantId) return;
    fetchOrdersByDate();
  fetchAovByDate();
  }, [startDate, endDate]);

  async function fetchTenants() {
    try {
      const res = await apiFetch('/tenants', { credentials: 'include' });
      if (!res.ok) return;
      const data = await res.json();
      setTenants(data || []);
      if (!tenantId && data && data.length) {
        // default to first tenant if none selected
        setTenantId(data[0].id);
      }
    } catch (err) {
      // ignore for now
    }
  }

  function destroyChart(instanceRef) {
    if (instanceRef.current) {
      try { instanceRef.current.destroy(); } catch (e) {}
      instanceRef.current = null;
    }
  }

  async function fetchOrdersByDate() {
    if (!tenantId) return;
    setLoading(true);
    try {
      // default to last 30 days
      // normalize dates (YYYY-MM-DD)
      let s = startDate;
      let e = endDate;
      if (!s || !e) {
        const end = new Date();
        const start = new Date(end.getTime() - 29 * 24 * 60 * 60 * 1000);
        s = start.toISOString().slice(0,10);
        e = end.toISOString().slice(0,10);
      }
      // ensure start <= end
      if (new Date(s) > new Date(e)) { const tmp = s; s = e; e = tmp; }
  const url = `/metrics/orders-by-date?tenantId=${tenantId}&groupBy=day&startDate=${s}&endDate=${e}`;
  const res = await apiFetch(url, { credentials: 'include' });
      if (!res.ok) { setOrdersData([]); return; }
      const data = await res.json();
      const rows = data.result || [];
      setOrdersData(rows);

      // render chart, destroy previous first
      destroyChart(ordersChartInstance);
      if (window.Chart && ordersChartRef.current) {
        const ctx = ordersChartRef.current.getContext('2d');
        ordersChartInstance.current = new window.Chart(ctx, {
          type: 'bar',
          data: {
            labels: rows.map(r => r.date),
            datasets: [{ label: 'Orders', data: rows.map(r => r.count), backgroundColor: 'rgba(54, 162, 235, 0.6)' }]
          },
          options: { responsive: true, maintainAspectRatio: false }
        });
      }
    } catch (err) {
      setOrdersData([]);
    } finally { setLoading(false); }
  }

  async function fetchTopCustomers() {
    if (!tenantId) return;
    try {
  const res = await apiFetch(`/metrics/top-customers?tenantId=${tenantId}&limit=5`, { credentials: 'include' });
      if (!res.ok) { setTopCustomers([]); return; }
      const data = await res.json();
      const rows = data.result || [];
      setTopCustomers(rows);

      destroyChart(customersChartInstance);
      if (window.Chart && customersChartRef.current) {
        const ctx = customersChartRef.current.getContext('2d');
        customersChartInstance.current = new window.Chart(ctx, {
          type: 'pie',
          data: {
            labels: rows.map(r => r.info?.email || r.customerId),
            datasets: [{ data: rows.map(r => r.revenue), backgroundColor: ['#4caf50','#ff9800','#2196f3','#e91e63','#9c27b0'] }]
          },
          options: { responsive: true, maintainAspectRatio: false }
        });
      }
    } catch (err) {
      setTopCustomers([]);
    }
  }

  async function fetchAovByDate() {
    if (!tenantId) return;
    try {
      let s = startDate;
      let e = endDate;
      if (!s || !e) {
        const end = new Date();
        const start = new Date(end.getTime() - 29 * 24 * 60 * 60 * 1000);
        s = start.toISOString().slice(0,10);
        e = end.toISOString().slice(0,10);
      }
      if (new Date(s) > new Date(e)) { const tmp = s; s = e; e = tmp; }
  const res = await apiFetch(`/metrics/aov-by-date?tenantId=${tenantId}&groupBy=day&startDate=${s}&endDate=${e}`, { credentials: 'include' });
      if (!res.ok) return;
      const data = await res.json();
      const rows = data.result || [];

      // render chart
      destroyChart(aovChartInstance);
      if (window.Chart && aovChartRef.current) {
        const ctx = aovChartRef.current.getContext('2d');
        aovChartInstance.current = new window.Chart(ctx, {
          type: 'line',
          data: { labels: rows.map(r => r.date), datasets: [{ label: 'AOV', data: rows.map(r => r.aov), borderColor: '#10b981', backgroundColor: 'rgba(16,185,129,0.1)', fill: true }] },
          options: { responsive: true, maintainAspectRatio: false }
        });
      }
    } catch (e) {}
  }

  

  async function getOverview() {
    if (!tenantId) return null;
    try {
  const res = await apiFetch(`/metrics/overview?tenantId=${tenantId}`, { credentials: 'include' });
      if (!res.ok) return null;
      const data = await res.json();
      return { totalOrders: data.totalOrders, totalRevenue: data.totalRevenue, totalCustomers: data.totalCustomers };
    } catch (e) { return null; }
  }

  

  async function triggerBackfill() {
    if (!tenantId) return setToast({ message: 'Select a tenant first', type: 'error' });
    setLoading(true);
    try {
  const res = await apiFetch(`/ingest/backfill?tenantId=${tenantId}`, { method: 'POST', credentials: 'include' });
      const data = await res.json();
      if (!(res.ok && data.ok && data.jobId)) {
        setToast({ message: data.error || 'Backfill enqueue failed', type: 'error' });
        setLoading(false);
        setTimeout(() => setToast(null), 4000);
        return;
      }
      const jobId = data.jobId;
      setToast({ message: 'Backfill queued — processing...', type: 'info' });

      // poll job status
      let finished = false;
      while (!finished) {
        await new Promise(r => setTimeout(r, 2000));
        try {
          const jr = await apiFetch(`/ingest/backfill/job/${jobId}`, { credentials: 'include' });
          if (!jr.ok) continue;
          const jdata = await jr.json();
          if (jdata.status === 'running') {
            setToast({ message: jdata.message || 'Backfill running...', type: 'info' });
          } else if (jdata.status === 'completed') {
            setToast({ message: jdata.message || 'Backfill completed', type: 'success' });
            finished = true;
            // refresh charts and overview
            await fetchOrdersByDate();
            await fetchTopCustomers();
            const o = await getOverview(); if (o) setLastOverview(o);
          } else if (jdata.status === 'failed') {
            setToast({ message: jdata.error || 'Backfill failed', type: 'error' });
            finished = true;
            
          }
        } catch (e) {}
      }
    } catch (e) {
      setToast({ message: 'Backfill request failed', type: 'error' });
    } finally { setLoading(false); setTimeout(() => setToast(null), 5000); }
  }

  return (
    <div className="p-6">
      <h2 className="text-2xl font-bold mb-4">Dashboard</h2>

      {/* Overview cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
  <div className="bg-white p-4 md:p-6 rounded-lg shadow-[0_8px_30px_rgb(0,0,0,0.12)]">
          <div className="text-sm text-gray-500">Total Customers</div>
          <div className="text-2xl font-bold">{overview.totalCustomers}</div>
        </div>
  <div className="bg-white p-4 md:p-6 rounded-lg shadow-[0_8px_30px_rgb(0,0,0,0.12)]">
          <div className="text-sm text-gray-500">Total Orders</div>
          <div className="text-2xl font-bold">{overview.totalOrders}</div>
        </div>
  <div className="bg-white p-4 md:p-6 rounded-lg shadow-[0_8px_30px_rgb(0,0,0,0.12)]">
          <div className="text-sm text-gray-500">Total Revenue</div>
          <div className="text-2xl font-bold">${overview.totalRevenue.toFixed(2)}</div>
          <div className="text-xs text-gray-500">AOV: ${overview.totalOrders ? (overview.totalRevenue / overview.totalOrders).toFixed(2) : '0.00'}</div>
        </div>
      </div>

      <div className="mb-4 flex flex-col md:flex-row md:items-center gap-3">
        <label className="font-medium">Tenant:</label>
  <select value={tenantId} onChange={e => setTenantId(e.target.value)} className="px-2 py-1">
          {tenants.map(t => (
            <option key={t.id} value={t.id}>{t.name} ({t.shopDomain})</option>
          ))}
        </select>
        <div className="md:ml-4 flex flex-wrap items-center gap-2">
          <label className="text-sm">From</label>
          <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className="px-2 py-1" />
          <label className="text-sm">To</label>
          <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} className="px-2 py-1" />
          <button className="ml-2 bg-blue-600 text-white px-3 py-1 rounded-lg" onClick={() => { fetchOrdersByDate(); fetchTopCustomers(); }}>Load</button>
          <button className="ml-2 bg-green-600 text-white px-3 py-1 rounded-lg" onClick={() => triggerBackfill()} disabled={loading}>{loading ? 'Running...' : 'Run backfill'}</button>
          {loading && <div className="ml-2 text-sm text-gray-400">Loading...</div>}
        </div>
      </div>

      {/* Backfill state panel removed */}

      {/* AOV chart */}
  <div className="mb-4 bg-white p-4 md:p-6 rounded-lg shadow-[0_8px_30px_rgb(0,0,0,0.12)] overflow-hidden">
        <h3 className="font-semibold mb-2">Avg Order Value (AOV)</h3>
  <div className="h-56 md:h-64">
          <canvas ref={aovChartRef} className="w-full h-full block"></canvas>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
  <div className="bg-white p-4 md:p-6 rounded-lg shadow-[0_8px_30px_rgb(0,0,0,0.12)] overflow-hidden">
          <h3 className="font-semibold mb-2">Orders by Date</h3>
          <div className="h-64 md:h-72">
            <canvas ref={ordersChartRef} className="w-full h-full block"></canvas>
          </div>
        </div>
  <div className="bg-white p-4 md:p-6 rounded-lg shadow-[0_8px_30px_rgb(0,0,0,0.12)] overflow-hidden">
          <h3 className="font-semibold mb-2">Top Customers</h3>
          <div className="h-64 md:h-72">
            <canvas ref={customersChartRef} className="w-full h-full block"></canvas>
          </div>
          <ul className="mt-4">
            {topCustomers.map(c => (
              <li key={c.customerId} className="py-2">
                <div className="text-sm font-medium">{c.info?.email || c.customerId}</div>
                <div className="text-xs text-gray-600">Revenue: ${c.revenue}</div>
              </li>
            ))}
          </ul>
        </div>
      </div>
      {/* Products graph removed from Dashboard */}
    </div>
  );
}

export default Dashboard;
