import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useRecommendation } from '../hooks/useRecommendation';
import './RecommendationForm.css';

/* ── SVG Icon set (Skill rule: use SVG, not emoji) ── */
const IconSparkle = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
    <path d="M12 2L9.5 9.5 2 12l7.5 2.5L12 22l2.5-7.5L22 12l-7.5-2.5z"/>
  </svg>
);
const IconSearch = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
  </svg>
);
const IconBolt = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
    <path d="M13 2L3 14h9l-1 8 10-12h-9z"/>
  </svg>
);
const IconCheck = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <polyline points="20 6 9 17 4 12"/>
  </svg>
);
const IconLock = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>
  </svg>
);
const IconPhone = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.69 12 19.79 19.79 0 0 1 1.6 3.36 2 2 0 0 1 3.59 1h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L7.91 8.56a16 16 0 0 0 6.53 6.53l.97-.92a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z"/>
  </svg>
);
const IconAlert = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="m21.73 18-8-14a2 2 0 0 0-3.46 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/><line x1="12" x2="12" y1="9" y2="13"/><line x1="12" x2="12.01" y1="17" y2="17"/>
  </svg>
);

const TRIP_TYPES = ['One-Way', 'Round Trip', 'Outstation', 'Corporate', 'Airport Transfer'];
const LUGGAGE_OPTIONS = ['No Luggage', '1 Small Bag', '2+ Bags', 'Heavy Luggage'];
const COMFORT_OPTIONS = ['Budget', 'Standard', 'Premium', 'Luxury'];

export default function RecommendationForm() {
  const navigate = useNavigate();
  const { getRecommendations, loading, error } = useRecommendation();

  const [form, setForm] = useState({
    tripType: '',
    passengers: '',
    luggage: '',
    comfortPref: '',
    budgetMin: '',
    budgetMax: '',
    tripDate: ''
  });

  const handleChange = (e) => {
    setForm(prev => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const setPassengers = (n) => {
    setForm(prev => ({ ...prev, passengers: n }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const results = await getRecommendations(form);
    sessionStorage.setItem('recommendForm', JSON.stringify(form));
    navigate('/results');
  };

  const passengersOptions = [1, 2, 3, 4, '5+'];

  return (
    <div className="landing-page" id="landing-page">

      {/* ── HERO BANNER ── */}
      <section className="hero-banner" id="hero-banner" aria-label="Hero section">
        <div className="container hero-content">
          <div className="hero-badge" aria-label="AI-Powered Recommendations">
            <IconSparkle /> AI-Powered Recommendations
          </div>
          <h1 className="hero-title">
            Find the Perfect Car<br />
            <span>for Your Trip</span>
          </h1>
          <p className="hero-subtitle">
            Answer 5 quick questions. Our AI matches you to the ideal vehicle instantly.
          </p>
          <div className="hero-stats" role="list" aria-label="Service statistics">
            <div className="hero-stat" role="listitem">
              <span className="hero-stat-num">7+</span>
              <span className="hero-stat-label">Car Models</span>
            </div>
            <div className="hero-stat" role="listitem">
              <span className="hero-stat-num">AI</span>
              <span className="hero-stat-label">Powered</span>
            </div>
            <div className="hero-stat" role="listitem">
              <span className="hero-stat-num">Free</span>
              <span className="hero-stat-label">Service</span>
            </div>
          </div>
        </div>
      </section>

      {/* ── RECOMMENDATION FORM ── */}
      <section className="form-section" id="recommendation-form-section" aria-label="Trip recommendation form">
        <div className="container">
          <div className="form-card card card-static" id="recommendation-form-card">
            <div className="form-card-header">
              <div className="form-step-indicator" aria-label="Step 1 of 2">
                <span className="step-dot active" aria-current="step" />
                <span className="step-line" aria-hidden="true" />
                <span className="step-dot" aria-hidden="true" />
              </div>
              <h2 className="form-card-title">Step 1 of 2 — Tell us about your trip</h2>
            </div>

            <form onSubmit={handleSubmit} id="trip-recommendation-form" noValidate>
              <div className="form-grid">

                {/* Trip Type */}
                <div className="form-group" id="field-trip-type">
                  <label className="form-label" htmlFor="tripType">Trip Type</label>
                  <select
                    id="tripType"
                    name="tripType"
                    className="form-select"
                    value={form.tripType}
                    onChange={handleChange}
                    required
                    aria-required="true"
                  >
                    <option value="">Select trip type…</option>
                    {TRIP_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                  </select>
                </div>

                {/* Pickup Date */}
                <div className="form-group" id="field-trip-date">
                  <label className="form-label" htmlFor="tripDate">Pickup Date</label>
                  <input
                    type="date"
                    id="tripDate"
                    name="tripDate"
                    className="form-input"
                    value={form.tripDate}
                    onChange={handleChange}
                    min={new Date().toISOString().split('T')[0]}
                    required
                    aria-required="true"
                  />
                </div>
              </div>

              {/* Passengers */}
              <div className="form-group passenger-group" id="field-passengers">
                <label className="form-label" id="passengers-label">No. of Passengers</label>
                <div className="passenger-selector" role="group" aria-labelledby="passengers-label">
                  {passengersOptions.map(n => (
                    <button
                      key={n}
                      type="button"
                      id={`passenger-btn-${n}`}
                      className={`passenger-btn ${form.passengers == n || (n === '5+' && form.passengers === '5+') ? 'active' : ''}`}
                      onClick={() => setPassengers(n)}
                      aria-pressed={form.passengers == n || (n === '5+' && form.passengers === '5+')}
                      aria-label={`${n} passenger${n !== 1 ? 's' : ''}`}
                    >
                      {n}
                    </button>
                  ))}
                </div>
              </div>

              <div className="form-grid">
                {/* Luggage */}
                <div className="form-group" id="field-luggage">
                  <label className="form-label" htmlFor="luggage">Luggage</label>
                  <select
                    id="luggage"
                    name="luggage"
                    className="form-select"
                    value={form.luggage}
                    onChange={handleChange}
                    required
                    aria-required="true"
                  >
                    <option value="">Select luggage…</option>
                    {LUGGAGE_OPTIONS.map(l => <option key={l} value={l}>{l}</option>)}
                  </select>
                </div>

                {/* Comfort Level */}
                <div className="form-group" id="field-comfort">
                  <label className="form-label" htmlFor="comfortPref">Comfort Level</label>
                  <select
                    id="comfortPref"
                    name="comfortPref"
                    className="form-select"
                    value={form.comfortPref}
                    onChange={handleChange}
                    required
                    aria-required="true"
                  >
                    <option value="">Select comfort…</option>
                    {COMFORT_OPTIONS.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
              </div>

              {/* Budget Range */}
              <div className="form-group" id="field-budget">
                <label className="form-label" id="budget-label">Budget per day (₹)</label>
                <div className="budget-range" role="group" aria-labelledby="budget-label">
                  <input
                    type="number"
                    id="budgetMin"
                    name="budgetMin"
                    className="form-input"
                    placeholder="Min (e.g. 800)"
                    value={form.budgetMin}
                    onChange={handleChange}
                    min="0"
                    aria-label="Minimum budget in rupees"
                  />
                  <span className="budget-dash" aria-hidden="true">–</span>
                  <input
                    type="number"
                    id="budgetMax"
                    name="budgetMax"
                    className="form-input"
                    placeholder="Max (e.g. 3000)"
                    value={form.budgetMax}
                    onChange={handleChange}
                    min="0"
                    aria-label="Maximum budget in rupees"
                  />
                </div>
              </div>

              {/* Error state */}
              {error && (
                <div className="form-error" role="alert" aria-live="assertive">
                  <IconAlert />
                  {error}
                </div>
              )}

              {/* Submit */}
              <button
                type="submit"
                className="btn-primary btn-primary-full submit-btn"
                id="get-recommendations-btn"
                disabled={loading}
                aria-busy={loading}
              >
                {loading ? (
                  <><span className="btn-spinner" aria-hidden="true" /> Finding your perfect car…</>
                ) : (
                  <><IconSearch /> Get My Car Recommendations</>
                )}
              </button>
            </form>
          </div>

          {/* Features strip — SVG icons */}
          <div className="features-strip" aria-label="Service highlights">
            <div className="feature-item">
              <IconBolt aria-hidden="true" />
              <span>Instant AI Matching</span>
            </div>
            <div className="feature-item">
              <IconCheck aria-hidden="true" />
              <span>Free Service</span>
            </div>
            <div className="feature-item">
              <IconLock aria-hidden="true" />
              <span>No Hidden Charges</span>
            </div>
            <div className="feature-item">
              <IconPhone aria-hidden="true" />
              <span>24/7 Support</span>
            </div>
          </div>

          {/* Footer */}
          <footer className="demo-credits-footer">
            <div className="credits-text">
              <strong>AI Car Recommendation Assistant</strong> — Smart Working Prototype
            </div>
            <div className="credits-sub">
              Developed by Team 3 (Frontend · Backend · QA &amp; Testing)
            </div>
            <div className="credits-badge">
              Manivtha Tours &amp; Travels · Internship June 2026
            </div>
          </footer>
        </div>
      </section>
    </div>
  );
}
