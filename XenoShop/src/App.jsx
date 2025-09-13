import React, { useState, useEffect } from 'react';
import { apiFetch } from './api';
import heroImage from './assets/image.png';
import Tenants from './Tenants';
import Dashboard from './Dashboard';
import Products from './Products';
import Navbar from './components/Navbar';
import LoginModal from './components/LoginModal';


function App() {
  const [step, setStep] = useState(1);
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [user, setUser] = useState(null);
  const [view, setView] = useState('dashboard');
  const [modalOpen, setModalOpen] = useState(false);

    useEffect(() => {
    // Check session on mount
    apiFetch('/auth/me', { credentials: 'include' })
      .then(res => res.json())
      .then(data => {
        if (data.user) {
          setUser(data);
          setStep(3);
        }
      });
  }, []);

  const requestCode = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const res = await apiFetch('/auth/request-code', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
        credentials: 'include',
      });
      const data = await res.json();
      if (data.ok) {
        setStep(2);
      } else {
        setError(data.error || 'Failed to send code');
      }
    } catch (err) {
      setError('Network error');
    }
    setLoading(false);
  };

  const verifyCode = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const res = await apiFetch('/auth/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, code }),
        credentials: 'include',
      });
      const data = await res.json();
      if (data.ok) {
        // Fetch user info
        const userRes = await apiFetch('/auth/me', {
          credentials: 'include',
        });
        const userData = await userRes.json();
        setUser(userData);
        setStep(3);
      } else {
        setError(data.error || 'Invalid code');
      }
    } catch (err) {
      setError('Network error');
    }
    setLoading(false);
  };

  async function logout() {
    try {
      await apiFetch('/auth/logout', { method: 'POST', credentials: 'include' });
    } catch (e) {}
    setUser(null);
    setStep(1);
  }

  return (
    <>
  <Navbar onLogin={() => setModalOpen(true)} user={user} onLogout={logout} setView={setView} view={view} />
  <LoginModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        email={email}
        setEmail={setEmail}
        code={code}
        setCode={setCode}
        step={step}
        setStep={setStep}
        requestCode={requestCode}
        verifyCode={verifyCode}
        loading={loading}
        error={error}
      />
  <div className="h-16" />
  {!user || step !== 3 ? (
    <div className="min-h-screen flex flex-col">
  <div className="flex-1 bg-amber-100">
            <div className="max-w-7xl mx-auto px-6 py-20 flex flex-col lg:flex-row items-center gap-12">
              <div className="lg:w-1/2 w-full text-white">
                
                <h1 className="text-4xl lg:text-6xl font-extrabold mb-4 leading-tight text-sky-950 drop-shadow-lg">Analyze Your<br/>Shopify Stores</h1>
                <p className="text-lg max-w-xl mb-6 text-sky-950">Make analysing multiple tenants easier, with one click</p>
                {/* hero small preview image is moved to the right column */}
              </div>
              <div className="lg:w-1/2 w-full flex flex-col justify-between h-[520px]">
                <div className="flex justify-end">
                    <img
                      src={heroImage}
                      alt="orders chart"
                      className="rounded-xl shadow-[0_8px_30px_rgb(0,0,0,0.12)] bg-white w-[520px] md:w-[720px] lg:w-[880px] transform transition-transform duration-300 ease-out hover:scale-105 hover:shadow-[0_8px_30px_rgb(0,0,0,0.12)] hover:-translate-y-1 cursor-pointer"
                  />
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : (
  <div className="min-h-screen bg-amber-50">
          <main className="max-w-7xl mx-auto px-4 py-6">
            <div className="space-y-6">
              {view === 'dashboard' && <Dashboard />}
              {view === 'tenants' && <Tenants />}
              {view === 'products' && <Products />}
            </div>
          </main>
        </div>
      )}
    </>
   );
 }

 export default App;
