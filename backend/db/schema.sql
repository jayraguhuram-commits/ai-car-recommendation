-- Manivtha Tours & Travels — Database Schema
-- All 5 tables from blueprint, exact column names

-- ─────────────────────────────────────────────
-- Table: vehicles
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS vehicles (
  vehicle_id      INTEGER PRIMARY KEY AUTOINCREMENT,
  name            VARCHAR(100) NOT NULL,
  category        TEXT NOT NULL CHECK(category IN ('budget','standard','premium','luxury')),
  seats           INTEGER NOT NULL,
  luggage_capacity TEXT NOT NULL CHECK(luggage_capacity IN ('small','medium','large')),
  price_per_day   DECIMAL(10,2) NOT NULL,
  quantity        INTEGER NOT NULL DEFAULT 1,
  is_available    BOOLEAN NOT NULL DEFAULT 1,
  features        TEXT,       -- JSON array e.g. ["AC","GPS","USB"]
  image_url       VARCHAR(255)
);

-- ─────────────────────────────────────────────
-- Table: enquiries
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS enquiries (
  enquiry_id              INTEGER PRIMARY KEY AUTOINCREMENT,
  customer_name           VARCHAR(100) NOT NULL,
  phone                   VARCHAR(15) NOT NULL,
  email                   VARCHAR(100),
  trip_type               VARCHAR(50) NOT NULL,
  passengers              INTEGER NOT NULL,
  luggage                 VARCHAR(20) NOT NULL,
  comfort_pref            VARCHAR(20) NOT NULL,
  budget_min              DECIMAL,
  budget_max              DECIMAL,
  pickup_location         VARCHAR(200),
  drop_location           VARCHAR(200),
  trip_date               DATE,
  return_date             DATE,
  special_requirements    TEXT,
  status                  TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','confirmed','cancelled')),
  ai_recommendation       TEXT,     -- Full AI JSON response
  recommended_vehicle_id  INTEGER REFERENCES vehicles(vehicle_id),
  created_at              TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ─────────────────────────────────────────────
-- Table: drivers
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS drivers (
  driver_id           INTEGER PRIMARY KEY AUTOINCREMENT,
  name                VARCHAR(100) NOT NULL,
  phone               VARCHAR(15) NOT NULL,
  license_no          VARCHAR(50),
  is_available        BOOLEAN DEFAULT 1,
  assigned_booking_id INTEGER,
  rating              DECIMAL(3,2) DEFAULT 5.0
);

-- ─────────────────────────────────────────────
-- Table: bookings
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS bookings (
  booking_id    INTEGER PRIMARY KEY AUTOINCREMENT,
  enquiry_id    INTEGER REFERENCES enquiries(enquiry_id),
  vehicle_id    INTEGER REFERENCES vehicles(vehicle_id),
  driver_id     INTEGER REFERENCES drivers(driver_id),
  total_amount  DECIMAL(10,2),
  advance_paid  DECIMAL(10,2) DEFAULT 0,
  status        TEXT DEFAULT 'pending',
  notes         TEXT,
  confirmed_at  TIMESTAMP
);

-- ─────────────────────────────────────────────
-- Table: action_history (audit trail)
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS action_history (
  history_id    INTEGER PRIMARY KEY AUTOINCREMENT,
  enquiry_id    INTEGER REFERENCES enquiries(enquiry_id),
  action        VARCHAR(100) NOT NULL,
  performed_by  VARCHAR(100) DEFAULT 'system',
  timestamp     TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  notes         TEXT
);
