require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { initDB } = require('./db/database');

const app = express();
const PORT = process.env.PORT || 5000;

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use(cors({
  origin: [
    process.env.FRONTEND_URL || 'http://localhost:5173',
    'http://localhost:3000',
    'http://localhost:5173'
  ],
  methods: ['GET', 'POST', 'PATCH', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true
}));

// ─────────────────────────────────────────────
// Boot: init DB first, then start server
// ─────────────────────────────────────────────
async function start() {
  try {
    await initDB();
    console.log('[DB] Database ready.');
  } catch (err) {
    console.error('[DB] Failed to initialize database:', err);
    process.exit(1);
  }

  // Mount routes AFTER DB is ready
  app.use('/api/auth',      require('./routes/auth'));
  app.use('/api/recommend', require('./routes/recommend'));
  app.use('/api/enquiries', require('./routes/enquiries'));
  app.use('/api/vehicles',  require('./routes/vehicles'));
  app.use('/api/drivers',   require('./routes/drivers'));
  app.use('/api/dashboard', require('./routes/dashboard'));

  app.get('/api/health', (req, res) => {
    res.json({
      success: true,
      message: 'Manivtha Car Assistant API is running!',
      timestamp: new Date().toISOString(),
      geminiConfigured: !!(process.env.GEMINI_API_KEY && !process.env.GEMINI_API_KEY.startsWith('AIzaSyxxxxxxx'))
    });
  });

  app.use((req, res) => {
    res.status(404).json({ success: false, message: `Route not found: ${req.method} ${req.path}` });
  });

  app.use((err, req, res, next) => {
    console.error('[Server Error]', err);
    res.status(500).json({ success: false, message: 'Internal server error.' });
  });

  app.listen(PORT, () => {
    console.log(`\n🚗 Manivtha Car Assistant API`);
    console.log(`   Running on: http://localhost:${PORT}`);
    console.log(`   Health:     http://localhost:${PORT}/api/health`);
    const hasKey = process.env.GEMINI_API_KEY && !process.env.GEMINI_API_KEY.startsWith('AIzaSyxxxxxxx');
    console.log(`   Gemini AI:  ${hasKey ? '✅ Configured' : '⚠️  Not configured (using rule-based fallback)'}`);
    console.log('');
  });
}

start();
