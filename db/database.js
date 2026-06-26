const path = require('path');
const fs = require('fs');
const initSqlJs = require('sql.js');

const DB_PATH = path.join(__dirname, 'manivtha.db');

// In-memory DB instance (shared across the app)
let _db = null;

/**
 * Persist in-memory DB to disk as binary
 */
function persist() {
  const data = _db.export();
  fs.writeFileSync(DB_PATH, Buffer.from(data));
}

/**
 * Run SQL and auto-persist
 */
function run(sql, params = []) {
  _db.run(sql, params);
  persist();
}

/**
 * Get a single row
 */
function get(sql, params = []) {
  const stmt = _db.prepare(sql);
  stmt.bind(params);
  const row = stmt.step() ? stmt.getAsObject() : null;
  stmt.free(); // ← fixes memory leak: always free the WASM statement
  return row;
}

/**
 * Get all matching rows
 */
function all(sql, params = []) {
  const stmt = _db.prepare(sql);
  stmt.bind(params);
  const rows = [];
  while (stmt.step()) {
    rows.push(stmt.getAsObject());
  }
  stmt.free();
  return rows;
}

/**
 * Run insert and return lastInsertRowid
 */
function insert(sql, params = []) {
  _db.run(sql, params);
  const row = get('SELECT last_insert_rowid() as id');
  persist();
  return row ? row.id : null;
}

/**
 * Create all tables from schema
 */
function migrate(db) {
  db.run(`
    CREATE TABLE IF NOT EXISTS vehicles (
      vehicle_id      INTEGER PRIMARY KEY AUTOINCREMENT,
      name            TEXT NOT NULL,
      category        TEXT NOT NULL,
      seats           INTEGER NOT NULL,
      luggage_capacity TEXT NOT NULL,
      price_per_day   REAL NOT NULL,
      quantity        INTEGER NOT NULL DEFAULT 1,
      is_available    INTEGER NOT NULL DEFAULT 1,
      features        TEXT,
      image_url       TEXT
    );
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS enquiries (
      enquiry_id              INTEGER PRIMARY KEY AUTOINCREMENT,
      customer_name           TEXT NOT NULL,
      phone                   TEXT NOT NULL,
      email                   TEXT,
      trip_type               TEXT NOT NULL,
      passengers              INTEGER NOT NULL,
      luggage                 TEXT NOT NULL,
      comfort_pref            TEXT NOT NULL,
      budget_min              REAL,
      budget_max              REAL,
      pickup_location         TEXT,
      drop_location           TEXT,
      trip_date               TEXT,
      return_date             TEXT,
      special_requirements    TEXT,
      status                  TEXT NOT NULL DEFAULT 'pending',
      ai_recommendation       TEXT,
      recommended_vehicle_id  INTEGER,
      created_at              TEXT DEFAULT (datetime('now'))
    );
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS drivers (
      driver_id           INTEGER PRIMARY KEY AUTOINCREMENT,
      name                TEXT NOT NULL,
      phone               TEXT NOT NULL,
      license_no          TEXT,
      is_available        INTEGER DEFAULT 1,
      assigned_booking_id INTEGER,
      rating              REAL DEFAULT 5.0
    );
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS bookings (
      booking_id    INTEGER PRIMARY KEY AUTOINCREMENT,
      enquiry_id    INTEGER,
      vehicle_id    INTEGER,
      driver_id     INTEGER,
      total_amount  REAL,
      advance_paid  REAL DEFAULT 0,
      status        TEXT DEFAULT 'pending',
      notes         TEXT,
      confirmed_at  TEXT
    );
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS action_history (
      history_id    INTEGER PRIMARY KEY AUTOINCREMENT,
      enquiry_id    INTEGER,
      action        TEXT NOT NULL,
      performed_by  TEXT DEFAULT 'system',
      timestamp     TEXT DEFAULT (datetime('now')),
      notes         TEXT
    );
  `);

  console.log('[DB] Tables created / verified.');
}

/**
 * Seed vehicle data if table is empty
 */
function seed(db) {
  const stmt = db.prepare('SELECT COUNT(*) as c FROM vehicles');
  stmt.step();
  const count = stmt.getAsObject().c;
  stmt.free();
  if (count > 0) return;

  const vehicles = [
    ['Alto K10 / WagonR', 'budget', 4, 'small', 900, 3, 1, JSON.stringify(['AC', 'Music System']), 'https://images.unsplash.com/photo-1541899481282-d53bffe3c35d?auto=format&fit=crop&q=80&w=800'],
    ['Swift Dzire', 'standard', 4, 'medium', 1400, 5, 1, JSON.stringify(['AC', 'GPS', 'Music System']), 'https://images.unsplash.com/photo-1549399542-7e3f8b79c341?auto=format&fit=crop&q=80&w=800'],
    ['Honda City', 'standard', 4, 'medium', 2000, 4, 1, JSON.stringify(['AC', 'GPS', 'USB', 'Sunroof']), 'https://images.unsplash.com/photo-1533473359331-0135ef1b58bf?auto=format&fit=crop&q=80&w=800'],
    ['Toyota Innova Crysta', 'premium', 7, 'large', 2800, 6, 1, JSON.stringify(['AC', 'GPS', 'USB', 'Pushback Seats', 'Driver Included']), 'https://images.unsplash.com/photo-1532581140115-3e355d1ed1de?auto=format&fit=crop&q=80&w=800'],
    ['Kia Carens', 'premium', 6, 'large', 2500, 3, 1, JSON.stringify(['AC', 'GPS', 'USB', 'ADAS', 'Panoramic Roof']), 'https://images.unsplash.com/photo-1542282088-72c9c27ed0cd?auto=format&fit=crop&q=80&w=800'],
    ['Toyota Fortuner', 'luxury', 7, 'large', 4500, 2, 1, JSON.stringify(['AC', 'GPS', '4WD', 'Leather Seats', 'Driver Included']), 'https://images.unsplash.com/photo-1550344071-70014db4566c?auto=format&fit=crop&q=80&w=800'],
    ['Mercedes E-Class', 'luxury', 4, 'medium', 7000, 1, 1, JSON.stringify(['AC', 'GPS', 'Leather Seats', 'Chauffeur', 'Minibar']), 'https://images.unsplash.com/photo-1540066019607-e5f6f48366e4?auto=format&fit=crop&q=80&w=800']
  ];

  for (const v of vehicles) {
    db.run(
      'INSERT INTO vehicles (name, category, seats, luggage_capacity, price_per_day, quantity, is_available, features, image_url) VALUES (?,?,?,?,?,?,?,?,?)',
      v
    );
  }
  console.log('[DB] Seeded 7 vehicles.');

  // Seed drivers
  const drivers = [
    ['Suresh Kumar', '+91 98765 43210', 'KA01 20201234', 1, 4.8],
    ['Rajan M', '+91 87654 32109', 'KA02 20195678', 1, 4.9],
    ['Venkat P', '+91 76543 21098', 'KA03 20189012', 0, 4.7]
  ];
  for (const d of drivers) {
    db.run(
      'INSERT INTO drivers (name, phone, license_no, is_available, rating) VALUES (?,?,?,?,?)',
      d
    );
  }
  console.log('[DB] Seeded 3 drivers.');
}

/**
 * Initialize database — async because sql.js uses WASM
 * Returns a promise that resolves when DB is ready
 */
async function initDB() {
  if (_db) return _db;

  const SQL = await initSqlJs();

  if (fs.existsSync(DB_PATH)) {
    // Load from existing file
    const fileBuffer = fs.readFileSync(DB_PATH);
    _db = new SQL.Database(fileBuffer);
    console.log('[DB] Loaded existing database from disk.');
    
    // Add quantity column if it doesn't exist (Migration)
    try {
      _db.run("ALTER TABLE vehicles ADD COLUMN quantity INTEGER NOT NULL DEFAULT 1;");
      console.log('[DB] Migrated: Added quantity column to vehicles.');
      persist();
    } catch (e) {
      // Column might already exist
    }

    // Populate images and quantities for existing seeded vehicles if empty
    try {
      const check = _db.prepare("SELECT COUNT(*) as c FROM vehicles WHERE image_url IS NULL");
      check.step();
      const count = check.getAsObject().c;
      check.free();
      if (count > 0) {
        console.log('[DB] Seeding image URLs and quantities for existing vehicles...');
        const updates = [
          ['https://images.unsplash.com/photo-1541899481282-d53bffe3c35d?auto=format&fit=crop&q=80&w=800', 3, 'Alto K10 / WagonR'],
          ['https://images.unsplash.com/photo-1549399542-7e3f8b79c341?auto=format&fit=crop&q=80&w=800', 5, 'Swift Dzire'],
          ['https://images.unsplash.com/photo-1533473359331-0135ef1b58bf?auto=format&fit=crop&q=80&w=800', 4, 'Honda City'],
          ['https://images.unsplash.com/photo-1532581140115-3e355d1ed1de?auto=format&fit=crop&q=80&w=800', 6, 'Toyota Innova Crysta'],
          ['https://images.unsplash.com/photo-1542282088-72c9c27ed0cd?auto=format&fit=crop&q=80&w=800', 3, 'Kia Carens'],
          ['https://images.unsplash.com/photo-1550344071-70014db4566c?auto=format&fit=crop&q=80&w=800', 2, 'Toyota Fortuner'],
          ['https://images.unsplash.com/photo-1540066019607-e5f6f48366e4?auto=format&fit=crop&q=80&w=800', 1, 'Mercedes E-Class']
        ];
        for (const [img, qty, name] of updates) {
          _db.run("UPDATE vehicles SET image_url = ?, quantity = ? WHERE name = ? AND image_url IS NULL", [img, qty, name]);
        }
        persist();
        console.log('[DB] Seeded vehicle images and quantities.');
      }
    } catch (e) {
      console.error('[DB] Migration of images/quantities failed:', e);
    }
  } else {
    // Create fresh database
    _db = new SQL.Database();
    migrate(_db);
    seed(_db);
    persist();
    console.log('[DB] Created new database.');
  }

  // Ensure tables exist even on existing DB (idempotent)
  migrate(_db);

  return _db;
}

module.exports = { initDB, run, get, all, insert, persist };
