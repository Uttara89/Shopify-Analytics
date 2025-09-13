// API helper - centralizes backend base URL and fetch wrapper
// Prefer an explicit Vite env var. If that isn't set (e.g. a static build without
// environment injection), fall back to the current page origin so a deployed
// frontend will call the same host that served the app. Last fallback is
// localhost:3000 for local dev convenience.
const _rawBase = import.meta.env.VITE_BACKEND_BASE_URL || (typeof window !== 'undefined' ? window.location.origin : 'http://localhost:3000');
const BASE_URL = String(_rawBase).replace(/\/+$/,'');

async function apiFetch(path, options = {}) {
  const url = path.startsWith('http') ? path : `${BASE_URL}${path.startsWith('/') ? '' : '/'}${path}`;
  const res = await fetch(url, options);
  return res;
}

export { BASE_URL, apiFetch };
