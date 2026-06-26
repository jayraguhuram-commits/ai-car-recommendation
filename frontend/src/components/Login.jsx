import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import BASE from '../api';
import './Login.css';

/* ── SVG Icons ── */
const IconKey = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="m21 2-2 2m-7.61 7.61a5.5 5.5 0 1 1-7.778 7.778 5.5 5.5 0 0 1 7.777-7.777zm0 0L15.5 7.5m0 0 3 3L22 7l-3-3m-3.5 3.5L19 4"/>
  </svg>
);
const IconShield = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
  </svg>
);
const IconArrow = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M5 12h14"/><path d="m12 5 7 7-7 7"/>
  </svg>
);

export default function Login() {
  const navigate = useNavigate();
  const [loginType, setLoginType] = useState('passenger');

  // Passenger state
  const [passengerId, setPassengerId] = useState('');

  // Admin state
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');

  const [loading, setLoading] = useState(false);

  const handlePassengerLogin = async (e) => {
    e.preventDefault();
    if (!passengerId.trim()) {
      toast.error('Please enter your email or phone number.');
      return;
    }
    setLoading(true);
    try {
      const isEmail = passengerId.includes('@');
      const payload = isEmail ? { email: passengerId.trim() } : { phone: passengerId.trim() };

      const res = await fetch(`${BASE}/api/auth/passenger-login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const data = await res.json();
      if (data.success) {
        localStorage.setItem('passengerToken', data.token);
        localStorage.setItem('passengerUser', JSON.stringify(data.user));
        toast.success(`Welcome back, ${data.user.customerName || 'Customer'}!`);
        navigate('/history');
      } else {
        toast.error(data.message || 'No booking history found.');
      }
    } catch (err) {
      toast.error('Network error. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleAdminLogin = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await fetch(`${BASE}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password })
      });
      const data = await res.json();
      if (data.success) {
        localStorage.setItem('adminToken', data.token);
        localStorage.setItem('adminUser', JSON.stringify(data.user));
        toast.success('Admin login successful!');
        navigate('/dashboard');
      } else {
        toast.error(data.message || 'Login failed.');
      }
    } catch (err) {
      toast.error('Network error. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-page">
      <div className="login-card card card-static" role="main" aria-label="Login">

        {/* Tab switcher */}
        <div className="login-tabs" role="tablist" aria-label="Login type">
          <button
            className={`login-tab-btn${loginType === 'passenger' ? ' active' : ''}`}
            onClick={() => setLoginType('passenger')}
            role="tab"
            aria-selected={loginType === 'passenger'}
            aria-controls="passenger-panel"
            id="passenger-tab"
          >
            Customer History
          </button>
          <button
            className={`login-tab-btn${loginType === 'admin' ? ' active' : ''}`}
            onClick={() => setLoginType('admin')}
            role="tab"
            aria-selected={loginType === 'admin'}
            aria-controls="admin-panel"
            id="admin-tab"
          >
            Admin Portal
          </button>
        </div>

        {/* Passenger panel */}
        {loginType === 'passenger' && (
          <div
            className="login-form-container"
            id="passenger-panel"
            role="tabpanel"
            aria-labelledby="passenger-tab"
          >
            <div className="login-header">
              <div className="login-icon-wrap" aria-hidden="true">
                <IconKey />
              </div>
              <h1 className="login-title">Customer History</h1>
              <p className="text-muted text-sm">
                Enter the email or phone number you used for your enquiries to view your history.
              </p>
            </div>

            <form onSubmit={handlePassengerLogin} className="login-form" noValidate>
              <div className="form-group">
                <label className="form-label" htmlFor="passengerId">Email or Phone Number</label>
                <input
                  type="text"
                  id="passengerId"
                  className="form-input"
                  placeholder="e.g. karthik@example.com or +91 9876543210"
                  value={passengerId}
                  onChange={(e) => setPassengerId(e.target.value)}
                  required
                  aria-required="true"
                  autoComplete="username"
                />
              </div>

              <button
                type="submit"
                className="btn-primary btn-primary-full"
                disabled={loading}
                aria-busy={loading}
              >
                {loading
                  ? <><span className="btn-spinner" aria-hidden="true" /> Logging in…</>
                  : <>View My History <IconArrow /></>
                }
              </button>
            </form>

            <div className="login-hint" role="note">
              Enter a matching customer email or phone from your enquiries database.
            </div>
          </div>
        )}

        {/* Admin panel */}
        {loginType === 'admin' && (
          <div
            className="login-form-container"
            id="admin-panel"
            role="tabpanel"
            aria-labelledby="admin-tab"
          >
            <div className="login-header">
              <div className="login-icon-wrap" aria-hidden="true">
                <IconShield />
              </div>
              <h1 className="login-title">Admin Portal</h1>
              <p className="text-muted text-sm">
                Enter admin credentials to access the operational dashboard.
              </p>
            </div>

            <form onSubmit={handleAdminLogin} className="login-form" noValidate>
              <div className="form-group">
                <label className="form-label" htmlFor="username">Username</label>
                <input
                  type="text"
                  id="username"
                  className="form-input"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  required
                  aria-required="true"
                  autoComplete="username"
                />
              </div>
              <div className="form-group">
                <label className="form-label" htmlFor="password">Password</label>
                <input
                  type="password"
                  id="password"
                  className="form-input"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  aria-required="true"
                  autoComplete="current-password"
                />
              </div>

              <button
                type="submit"
                className="btn-primary btn-primary-full"
                disabled={loading}
                aria-busy={loading}
              >
                {loading
                  ? <><span className="btn-spinner" aria-hidden="true" /> Logging in…</>
                  : <>Login to Dashboard <IconArrow /></>
                }
              </button>
            </form>

            <div className="login-hint" role="note">
              Default credentials: <code>admin</code> / <code>manivtha2026</code>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
