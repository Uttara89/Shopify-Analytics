import React, { useState, useEffect } from 'react';
import { apiFetch } from './api';

function Tenants() {
  const [name, setName] = useState('');
  const [shopDomain, setShopDomain] = useState('');
  const [accessTokenEnc, setAccessTokenEnc] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [tenants, setTenants] = useState([]);

  useEffect(() => {
    fetchTenants();
  }, []);

  const fetchTenants = async () => {
    try {
      const res = await apiFetch('/tenants', {
        credentials: 'include',
      });
      const data = await res.json();
      setTenants(data);
    } catch (err) {
      setError('Failed to fetch tenants');
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const res = await apiFetch('/tenants', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, shopDomain, accessTokenEnc }),
        credentials: 'include',
      });
      const data = await res.json();
      if (res.status === 201) {
        setName('');
        setShopDomain('');
        setAccessTokenEnc('');
        fetchTenants();
      } else {
        setError(data.error || 'Failed to add tenant');
      }
    } catch (err) {
      setError('Network error');
    }
    setLoading(false);
  };

  return (
  <div className="bg-white p-6 md:p-8 rounded-xl shadow-[0_8px_30px_rgb(0,0,0,0.12)]">
      <h2 className="text-xl md:text-2xl font-semibold mb-4">Tenants</h2>
      <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end mb-4">
        <div>
          <label className="text-sm text-gray-600">Store Name</label>
          <input type="text" className="w-full px-3 py-2 rounded-lg mt-1" placeholder="Store Name" value={name} onChange={e => setName(e.target.value)} required />
        </div>
        <div>
          <label className="text-sm text-gray-600">Shop Domain</label>
          <input type="text" className="w-full px-3 py-2 rounded-lg mt-1" placeholder="mystore.myshopify.com" value={shopDomain} onChange={e => setShopDomain(e.target.value)} required />
        </div>
        <div>
          <label className="text-sm text-gray-600">Admin Token</label>
          <input type="text" className="w-full px-3 py-2 rounded-lg mt-1" placeholder="API token" value={accessTokenEnc} onChange={e => setAccessTokenEnc(e.target.value)} required />
        </div>
        <div className="md:col-span-3">
          <button type="submit" className="bg-blue-600 text-white px-4 py-2 rounded-lg" disabled={loading}>{loading ? 'Adding...' : 'Add Tenant'}</button>
          {error && <div className="text-red-500 text-sm mt-2">{error}</div>}
        </div>
      </form>

      <ul className="space-y-3">
        {tenants.map(tenant => (
          <li key={tenant.id} className="flex flex-col md:flex-row md:items-center md:justify-between px-3 py-3 rounded-lg">
            <div className="mb-3 md:mb-0">
              <div className="font-medium">{tenant.name}</div>
              <div className="text-xs text-gray-500">{tenant.shopDomain}</div>
            </div>
            <div className="flex items-center gap-2">
              <button className="bg-yellow-500 text-white px-3 py-1 rounded-lg text-sm" onClick={() => navigator.clipboard?.writeText(tenant.id)}>Copy ID</button>
              <button className="bg-red-500 text-white px-3 py-1 rounded-lg text-sm" onClick={async () => {
                setLoading(true);
                setError('');
                try {
                  const res = await apiFetch(`/tenants/${tenant.id}` , { method: 'DELETE', credentials: 'include' });
                  const data = await res.json();
                  if (data.ok) fetchTenants(); else setError(data.error || 'Failed to delete tenant');
                } catch (err) { setError('Network error'); }
                setLoading(false);
              }} disabled={loading}>Delete</button>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

export default Tenants;
