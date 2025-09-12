import React, { useEffect, useRef, useState } from 'react';

export default function Products() {
  const [rows, setRows] = useState([]);
  const [sortMode, setSortMode] = useState('count_desc'); // count_desc | name_asc
  const chartRef = useRef(null);
  const chartInstance = useRef(null);
  const pollingRef = useRef(null);

  useEffect(() => { fetchData();
    // start polling to keep counts fresh
    pollingRef.current = setInterval(() => { fetchData(); }, 15000);
    return () => { if (pollingRef.current) clearInterval(pollingRef.current); };
  }, []);
  useEffect(() => { renderChart(); }, [rows, sortMode]);

  async function fetchData() {
    try {
      const res = await fetch('http://localhost:3000/metrics/product-counts', { credentials: 'include' });
      if (!res.ok) return;
      const data = await res.json();
  console.debug('fetchProductCounts result:', data);
  setRows(data.result || []);
    } catch (e) {}
  }

  // manual refresh button handler (for users)
  function handleRefresh() {
    fetchData();
  }

  function sortedRows() {
    const copy = (rows || []).slice();
    if (sortMode === 'count_desc') copy.sort((a,b) => (b.count||0) - (a.count||0));
    else if (sortMode === 'name_asc') copy.sort((a,b) => ((a.tenant?.name||a.tenantId) > (b.tenant?.name||b.tenantId) ? 1 : -1));
  console.debug('sortedRows', sortMode, copy);
    return copy;
  }

  function destroy() {
    if (chartInstance.current) try { chartInstance.current.destroy(); } catch (e) {}
    chartInstance.current = null;
  }

  function renderChart() {
    destroy();
    const data = sortedRows();
    if (!window.Chart || !chartRef.current) {
      // canvas not ready yet — try again shortly
      console.debug('Chart or canvas not ready, retrying in 100ms');
      setTimeout(() => { try { renderChart(); } catch (e) {} }, 100);
      return;
    }
    const ctx = chartRef.current.getContext('2d');
    const total = data.reduce((s, r) => s + (r.count||0), 0) || 1;
    chartInstance.current = new window.Chart(ctx, {
      type: 'bar',
      data: {
        labels: data.map(r => r.tenant?.name || r.tenantId),
        datasets: [{ label: 'Products', data: data.map(r => r.count || 0), backgroundColor: 'rgba(54,162,235,0.8)' }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          tooltip: {
            callbacks: {
              label: function(context) {
                const idx = context.dataIndex;
                const row = data[idx];
                const pct = ((row.count||0) / total * 100).toFixed(1);
                return `${row.count || 0} products (${pct}% of total)`;
              },
              title: function(context) { return data[context[0].dataIndex].tenant?.name || data[context[0].dataIndex].tenantId; }
            }
          }
        }
      }
    });
  }

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-2xl font-bold">Products</h2>
        <div className="flex items-center gap-2">
          <label className="text-sm">Sort:</label>
          <select value={sortMode} onChange={e => setSortMode(e.target.value)} className="px-2 py-1 border rounded-lg">
            <option value="count_desc">Count (high → low)</option>
            <option value="name_asc">Name (A → Z)</option>
          </select>
          <button onClick={handleRefresh} className="ml-2 bg-blue-600 text-white px-3 py-1 rounded-lg text-sm">Refresh</button>
        </div>
      </div>

      <div className="bg-white p-4 rounded-lg shadow-[0_8px_30px_rgb(0,0,0,0.12)]">
        <div className="h-72">
          <canvas ref={chartRef} className="w-full h-full block"></canvas>
        </div>
      </div>
    </div>
  );
}
