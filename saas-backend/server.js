'use strict';

/**
 * server.js
 * ─────────────────────────────────────────────────────────────────────────────
 * Universal AI Fleet & Recommendation Engine — Application Entry Point
 *
 * Start with:
 *   node server.js          (production)
 *   nodemon server.js       (development — auto-restart on change)
 * ─────────────────────────────────────────────────────────────────────────────
 */

require('dotenv').config();

const express    = require('express');
const cors       = require('cors');
const helmet     = require('helmet');
const morgan     = require('morgan');
const compression = require('compression');
const rateLimit  = require('express-rate-limit');

const app  = express();
const PORT = process.env.PORT || 4000;

// ─── Security Middleware ──────────────────────────────────────────────────────

// Helmet sets HTTP security headers (CSP, HSTS, XSS protection etc.)
app.use(helmet());

// GZIP compression for all responses
app.use(compression());

// CORS — lock down to known origins in production via env var
const allowedOrigins = (process.env.ALLOWED_ORIGINS || 'http://localhost:5173,http://localhost:3000')
  .split(',').map((o) => o.trim());

app.use(cors({
  origin: (origin, callback) => {
    // Allow server-to-server (no origin) and whitelisted origins
    if (!origin || allowedOrigins.includes(origin)) return callback(null, true);
    return callback(new Error(`CORS: origin "${origin}" is not allowed.`));
  },
  methods:     ['GET', 'POST', 'PATCH', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true,
}));

// ─── Request Parsing ──────────────────────────────────────────────────────────

app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true, limit: '1mb' }));

// ─── Logging ──────────────────────────────────────────────────────────────────

const logFormat = process.env.NODE_ENV === 'production' ? 'combined' : 'dev';
app.use(morgan(logFormat));

// ─── Rate Limiting ────────────────────────────────────────────────────────────

// Global limiter: 200 requests per 15 minutes per IP
const globalLimiter = rateLimit({
  windowMs:         15 * 60 * 1000,
  max:              200,
  standardHeaders:  true,
  legacyHeaders:    false,
  message: {
    success: false,
    error: {
      code:    'RATE_LIMIT_EXCEEDED',
      message: 'Too many requests from this IP. Please retry after 15 minutes.',
    },
  },
});

// Stricter limiter for the AI endpoint (expensive calls)
const aiLimiter = rateLimit({
  windowMs:        60 * 1000,   // 1 minute
  max:             10,           // 10 AI calls per minute per IP
  standardHeaders: true,
  legacyHeaders:   false,
  message: {
    success: false,
    error: {
      code:    'AI_RATE_LIMIT_EXCEEDED',
      message: 'AI recommendation requests are limited to 10 per minute. Please slow down.',
    },
  },
});

app.use(globalLimiter);

// ─── API Routes ───────────────────────────────────────────────────────────────

// Mount all v1 routes under /api/v1
app.use('/api/v1/recommend', aiLimiter, require('./routes/recommend'));
app.use('/api/v1/dashboard', require('./routes/dashboard'));

// Health check (no auth required)
app.get('/api/health', (_req, res) => {
  res.json({
    success:     true,
    service:     'Universal AI Fleet & Recommendation Engine',
    version:     '1.0.0',
    timestamp:   new Date().toISOString(),
    environment: process.env.NODE_ENV || 'development',
    ai_provider: process.env.AI_PROVIDER || 'mock',
    gemini_configured: !!(process.env.GEMINI_API_KEY && process.env.GEMINI_API_KEY.length > 20),
  });
});

// ─── 404 Fallback ─────────────────────────────────────────────────────────────

app.use((req, res) => {
  res.status(404).json({
    success: false,
    error: {
      code:    'ROUTE_NOT_FOUND',
      message: `No route matched: ${req.method} ${req.path}`,
    },
  });
});

// ─── Global Error Handler ─────────────────────────────────────────────────────

// eslint-disable-next-line no-unused-vars
app.use((err, req, res, _next) => {
  // CORS errors
  if (err.message && err.message.startsWith('CORS:')) {
    return res.status(403).json({
      success: false,
      error: { code: 'CORS_BLOCKED', message: err.message },
    });
  }

  // JSON parse errors (malformed request body)
  if (err.type === 'entity.parse.failed') {
    return res.status(400).json({
      success: false,
      error: { code: 'INVALID_JSON', message: 'Request body contains malformed JSON.' },
    });
  }

  // Generic server error — never leak stack traces in production
  console.error('[Server] Unhandled error:', err);
  return res.status(500).json({
    success: false,
    error: {
      code:    'INTERNAL_SERVER_ERROR',
      message: process.env.NODE_ENV === 'production'
        ? 'An unexpected error occurred. Please try again later.'
        : err.message,
    },
  });
});

// ─── Start ────────────────────────────────────────────────────────────────────

app.listen(PORT, () => {
  console.log('\n🚀 Universal AI Fleet & Recommendation Engine');
  console.log(`   Port:        ${PORT}`);
  console.log(`   Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`   Health:      http://localhost:${PORT}/api/health`);
  console.log(`   AI Provider: ${process.env.AI_PROVIDER || 'mock'}`);
  console.log('');
});

module.exports = app;   // exported for testing
