/**
 * api.js — Centralized API base URL
 *
 * In development:  VITE_API_URL is empty → relative paths work via Vite proxy
 * In production:   Set VITE_API_URL=https://your-backend.onrender.com in the
 *                  deployment platform's environment variables
 */
const BASE = import.meta.env.VITE_API_URL || '';

export default BASE;
