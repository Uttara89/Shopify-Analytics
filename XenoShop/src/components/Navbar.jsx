import React from 'react';

export default function Navbar({ onLogin, user, onLogout, setView, view }) {
  return (
  <header className="fixed inset-x-0 top-0 bg-zinc-950 shadow-[0_8px_30px_rgb(0,0,0,0.12)] z-40">
      <div className="max-w-7xl mx-auto px-4 py-3 flex items-center">
        <div className="text-lg font-bold text-white">XenoShop Analytics</div>
        {user && (
          <div className="ml-6 flex items-center gap-3">
            <button onClick={() => setView('dashboard')} className={`px-3 py-2 rounded-lg ${view === 'dashboard' ? 'bg-blue-600 text-white' : 'text-zinc-200 hover:text-white'}`}>
              Dashboard
            </button>
            <button onClick={() => setView('tenants')} className={`px-3 py-2 rounded-lg ${view === 'tenants' ? 'bg-blue-600 text-white' : 'text-zinc-200 hover:text-white'}`}>
              Tenants
            </button>
            <button onClick={() => setView('products')} className={`px-3 py-2 rounded-lg ${view === 'products' ? 'bg-blue-600 text-white' : 'text-zinc-200 hover:text-white'}`}>
              Products
            </button>
          </div>
        )}
        <div className="ml-auto">
          {!user ? (
            <button onClick={onLogin} className="bg-blue-600 text-white px-4 py-2 rounded-lg font-medium">Login</button>
          ) : (
            <div className="flex items-center gap-4">
              <button onClick={onLogout} className="text-sm text-red-400">Logout</button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
