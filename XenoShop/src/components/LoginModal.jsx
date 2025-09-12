import React from 'react';

export default function LoginModal({ open, onClose, email, setEmail, code, setCode, step, requestCode, verifyCode, loading, error }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
  <div className="bg-white rounded-xl shadow-[0_8px_30px_rgb(0,0,0,0.12)] w-full max-w-md mx-4">
  <div className="px-6 py-4">
          <div className="flex justify-between items-center">
            <h3 className="text-lg font-semibold">Login</h3>
            <button onClick={onClose} className="text-gray-500 hover:text-gray-700">✕</button>
          </div>
        </div>
        <div className="p-6">
          {step === 1 && (
            <form onSubmit={requestCode} className="space-y-4">
              <label className="block text-sm font-medium">Email</label>
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                required
                className="w-full px-3 py-2 rounded-lg"
                placeholder="you@example.com"
              />
              {error && <div className="text-red-500 text-sm">{error}</div>}
              <div className="flex justify-end">
                <button type="submit" className="bg-blue-600 text-white px-4 py-2 rounded-lg" disabled={loading}>{loading ? 'Sending...' : 'Request Code'}</button>
              </div>
            </form>
          )}
          {step === 2 && (
            <form onSubmit={verifyCode} className="space-y-4">
              <label className="block text-sm font-medium">Verification Code</label>
              <input
                type="text"
                value={code}
                onChange={e => setCode(e.target.value)}
                required
                className="w-full px-3 py-2 rounded-lg"
                placeholder="123456"
              />
              {error && <div className="text-red-500 text-sm">{error}</div>}
              <div className="flex justify-end">
                <button type="submit" className="bg-green-600 text-white px-4 py-2 rounded-lg" disabled={loading}>{loading ? 'Verifying...' : 'Verify'}</button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
