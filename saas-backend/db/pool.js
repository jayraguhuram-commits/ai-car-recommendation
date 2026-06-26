'use strict';

/**
 * db/pool.js
 * ─────────────────────────────────────────────────────────────────────────────
 * PostgreSQL connection pool singleton using the `pg` library.
 *
 * Configuration is read from environment variables only — never hardcoded.
 * The pool is exported as a singleton so the entire application shares a
 * single pool (max 20 connections by default).
 *
 * Usage in route files:
 *   const { pool } = require('../db/pool');
 *   const result   = await pool.query('SELECT ...', [params]);
 * ─────────────────────────────────────────────────────────────────────────────
 */

const { Pool } = require('pg');

// Guard: fail at startup if the connection string is absent
if (!process.env.DATABASE_URL && !process.env.PGHOST) {
  console.error('[DB] FATAL: No PostgreSQL connection configured. Set DATABASE_URL or PG* env variables.');
  process.exit(1);
}

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,   // e.g. "postgres://user:pass@host:5432/dbname"
  // Individual PG* vars are used automatically by pg if DATABASE_URL is not set.
  host:     process.env.PGHOST,
  port:     parseInt(process.env.PGPORT || '5432', 10),
  database: process.env.PGDATABASE,
  user:     process.env.PGUSER,
  password: process.env.PGPASSWORD,

  // Pool settings
  max:              parseInt(process.env.PG_POOL_MAX     || '20',   10),
  idleTimeoutMillis: parseInt(process.env.PG_IDLE_MS     || '30000', 10),
  connectionTimeoutMillis: parseInt(process.env.PG_CONN_TIMEOUT_MS || '5000', 10),

  // SSL: required for managed cloud DBs (Supabase, Railway, Neon, RDS)
  ssl: process.env.DATABASE_SSL === 'true'
    ? { rejectUnauthorized: false }
    : false,
});

// Log pool errors to prevent silent connection failures
pool.on('error', (err) => {
  console.error('[DB] Idle pool client encountered an error:', err.message);
});

// Verify connectivity at startup (non-blocking — server still starts)
pool.query('SELECT NOW() AS pg_now')
  .then((res) => console.log(`[DB] PostgreSQL connected. Server time: ${res.rows[0].pg_now}`))
  .catch((err) => console.error('[DB] Connection test failed:', err.message));

module.exports = { pool };
