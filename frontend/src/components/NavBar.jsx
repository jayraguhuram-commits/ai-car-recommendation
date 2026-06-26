import { useState, useEffect } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import './NavBar.css';

/* ── SVG Icons ── */
const CarSVG = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M5 17H3a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v9a2 2 0 0 1-2 2h-1" />
    <circle cx="7.5" cy="17.5" r="2.5"/>
    <circle cx="17.5" cy="17.5" r="2.5"/>
  </svg>
);

/** Sun icon — shown when in dark mode (click to go light) */
const IconSun = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <circle cx="12" cy="12" r="4"/>
    <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41"/>
  </svg>
);

/** Moon icon — shown when in light mode (click to go dark) */
const IconMoon = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>
  </svg>
);

/**
 * Reads the saved theme from localStorage, defaulting to 'dark'.
 * Applies it immediately to <html> so there's no flash on load.
 */
function getInitialTheme() {
  const saved = localStorage.getItem('theme');
  return saved === 'light' ? 'light' : 'dark';
}

/** Apply theme to <html data-theme="..."> */
function applyTheme(theme) {
  document.documentElement.setAttribute('data-theme', theme);
  localStorage.setItem('theme', theme);
}

// Apply on module load — prevents white flash before React mounts
applyTheme(getInitialTheme());

export default function NavBar() {
  const navigate  = useNavigate();
  const location  = useLocation();
  const [isAdmin,    setIsAdmin]    = useState(!!localStorage.getItem('adminToken'));
  const [isPassenger,setIsPassenger]= useState(!!localStorage.getItem('passengerToken'));
  const [scrolled,   setScrolled]   = useState(false);
  const [theme,      setTheme]      = useState(getInitialTheme);

  /* Keep auth state in sync on route change */
  useEffect(() => {
    setIsAdmin(!!localStorage.getItem('adminToken'));
    setIsPassenger(!!localStorage.getItem('passengerToken'));
  }, [location.pathname]);

  /* Scroll-aware navbar styling */
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  /** Toggle between dark ↔ light and persist the choice */
  const toggleTheme = () => {
    const next = theme === 'dark' ? 'light' : 'dark';
    setTheme(next);
    applyTheme(next);
  };

  const handleLogout = () => {
    const path = window.location.pathname;
    if (path.startsWith('/dashboard') || path.startsWith('/booking') || path.startsWith('/fleet')) {
      localStorage.removeItem('adminToken');
      localStorage.removeItem('adminUser');
    } else if (path.startsWith('/history')) {
      localStorage.removeItem('passengerToken');
      localStorage.removeItem('passengerUser');
    } else {
      localStorage.removeItem('adminToken');
      localStorage.removeItem('adminUser');
      localStorage.removeItem('passengerToken');
      localStorage.removeItem('passengerUser');
    }
    navigate('/');
  };

  const isActive = (path) => location.pathname === path;

  const isDark = theme === 'dark';

  return (
    <nav
      className={`navbar${scrolled ? ' navbar-scrolled' : ''}`}
      id="main-navbar"
      role="navigation"
      aria-label="Main navigation"
    >
      <div className="container navbar-inner">

        {/* Brand */}
        <Link to="/" className="navbar-brand" id="navbar-logo" aria-label="AI Car Assistant – Home">
          <div className="navbar-brand-icon" aria-hidden="true">
            <CarSVG />
          </div>
          <span className="navbar-logo-text">AI Car Assistant</span>
        </Link>

        <div className="navbar-actions">

          {/* ── Nav links ── */}
          {isAdmin ? (
            <>
              <Link to="/dashboard" className={`navbar-link${isActive('/dashboard') ? ' active' : ''}`} id="nav-dashboard">Dashboard</Link>
              <Link to="/fleet"     className={`navbar-link${isActive('/fleet')     ? ' active' : ''}`} id="nav-fleet">Fleet</Link>
              <button onClick={handleLogout} className="btn-secondary navbar-btn" id="nav-logout">Sign Out</button>
            </>
          ) : isPassenger ? (
            <>
              <Link to="/history" className={`navbar-link${isActive('/history') ? ' active' : ''}`} id="nav-history">My History</Link>
              <button onClick={handleLogout} className="btn-secondary navbar-btn" id="nav-logout">Sign Out</button>
            </>
          ) : (
            <Link to="/login" className="btn-secondary navbar-btn" id="nav-login">Sign In</Link>
          )}

          {/* ── Theme Toggle ── */}
          <button
            id="theme-toggle-btn"
            className="theme-toggle"
            onClick={toggleTheme}
            aria-label={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
            title={isDark ? 'Light mode' : 'Dark mode'}
          >
            <span className="theme-toggle-track" aria-hidden="true">
              <span className="theme-toggle-thumb">
                {isDark ? <IconMoon /> : <IconSun />}
              </span>
            </span>
          </button>

        </div>
      </div>
    </nav>
  );
}
