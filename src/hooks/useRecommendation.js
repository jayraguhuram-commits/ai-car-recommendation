import { useState } from 'react';
import BASE from '../api';

/**
 * Section 7.2 — useRecommendation hook (exact from blueprint)
 * Calls POST /api/recommend and manages loading/error state
 */
export function useRecommendation() {
  const [results, setResults] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const getRecommendations = async (formData) => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${BASE}/api/recommend`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      });
      const data = await res.json();
      if (data.success) {
        setResults(data.data);
      } else {
        setError(data.message || 'Failed to get recommendations.');
      }
    } catch (e) {
      setError('Failed to get recommendations. Try again.');
    } finally {
      setLoading(false);
    }
  };

  const clearResults = () => setResults(null);

  return { results, loading, error, getRecommendations, clearResults };
}
