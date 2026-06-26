import { useEffect, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useRecommendation } from '../hooks/useRecommendation';
import toast from 'react-hot-toast';
import CarCard from './CarCard';
import './ResultsPage.css';

export default function ResultsPage() {
  const navigate = useNavigate();
  const { results, loading, error, getRecommendations } = useRecommendation();
  const [formData, setFormData] = useState(null);
  const [showAIPanel, setShowAIPanel] = useState(false);

  useEffect(() => {
    const savedForm = sessionStorage.getItem('recommendForm');
    if (!savedForm) {
      navigate('/');
      return;
    }
    const parsed = JSON.parse(savedForm);
    setFormData(parsed);
    // Fetch recommendations fresh
    getRecommendations(parsed);
  }, []);

  if (loading) {
    return (
      <div className="results-page">
        <div className="container">
          <div className="loading-center">
            <div className="spinner"></div>
            <p>🤖 Our AI is finding the best cars for you...</p>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="results-page">
        <div className="container">
          <div className="empty-state">
            <div className="empty-icon">⚠️</div>
            <h3>Something went wrong</h3>
            <p>{error}</p>
            <Link to="/" className="btn-primary" style={{ marginTop: 16 }}>Try Again</Link>
          </div>
        </div>
      </div>
    );
  }

  const recommendations = results?.recommendations || [];
  const count = recommendations.length;

  return (
    <div className="results-page" id="results-page">
      {/* Results Header */}
      <div className="results-header-bar">
        <div className="container results-header-inner">
          <div className="results-title-row">
            <span className="results-check">✅</span>
            <h1 className="results-title" id="results-count">
              {count} Car{count !== 1 ? 's' : ''} Found for Your Trip
            </h1>
          </div>
          <div className="results-actions">
            <Link to="/" className="btn-ghost results-edit-btn" id="edit-search-btn">
              ← Edit Search
            </Link>
            <button
              className="btn-secondary"
              id="share-results-btn"
              onClick={() => {
                if (navigator.share) {
                  navigator.share({ title: 'My Car Recommendations', url: window.location.href });
                } else {
                  navigator.clipboard.writeText(window.location.href);
                  toast.success('🔗 Link copied to clipboard!');
                }
              }}
            >
              📤 Share Results
            </button>
          </div>
        </div>
      </div>

      <div className="container">
        {/* Trip Summary */}
        {formData && (
          <div className="trip-summary" id="trip-summary">
            <span>🗓️ {formData.tripType}</span>
            <span>👥 {formData.passengers} passengers</span>
            <span>🧳 {formData.luggage}</span>
            <span>✨ {formData.comfortPref}</span>
            {formData.budgetMax && <span>₹{parseInt(formData.budgetMin||0).toLocaleString('en-IN')} – ₹{parseInt(formData.budgetMax).toLocaleString('en-IN')}/day</span>}
          </div>
        )}

        {/* AI Summary Panel */}
        {results?.summary && (
          <div className="ai-summary-card" id="ai-summary-panel">
            <button
              className="ai-summary-toggle"
              id="ai-panel-toggle"
              onClick={() => setShowAIPanel(!showAIPanel)}
            >
              <span>🤖 Why these cars? (AI Explanation)</span>
              <span className="toggle-icon">{showAIPanel ? '▲' : '▼'}</span>
            </button>
            {showAIPanel && (
              <div className="ai-summary-content">
                <p><strong>AI says:</strong> "{results.summary}"</p>
                {results.budget_note && (
                  <p className="budget-note">💰 {results.budget_note}</p>
                )}
              </div>
            )}
          </div>
        )}

        {/* Car Cards Grid — 3 columns on desktop */}
        {recommendations.length > 0 ? (
          <div className="results-grid" id="results-cards-grid">
            {recommendations.map((rec, i) => (
              <CarCard key={i} rec={rec} formData={formData} />
            ))}
          </div>
        ) : (
          <div className="empty-state">
            <div className="empty-icon">🔍</div>
            <h3>No recommendations found</h3>
            <p>Try adjusting your trip requirements or budget range.</p>
            <Link to="/" className="btn-primary" style={{ marginTop: 16 }}>Search Again</Link>
          </div>
        )}
      </div>
    </div>
  );
}
