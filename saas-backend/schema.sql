-- =============================================================================
-- Universal AI Fleet & Recommendation Engine — PostgreSQL Schema
-- Multi-Tenant Architecture with Logical Data Isolation via tenant_id (UUID)
-- =============================================================================

-- ─────────────────────────────────────────────────────────────────────────────
-- EXTENSIONS
-- ─────────────────────────────────────────────────────────────────────────────
CREATE EXTENSION IF NOT EXISTS "pgcrypto";   -- gen_random_uuid()
CREATE EXTENSION IF NOT EXISTS "pg_trgm";    -- trigram indexes for text search

-- ─────────────────────────────────────────────────────────────────────────────
-- ENUMS
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TYPE user_role_enum AS ENUM (
  'SuperAdmin',
  'FleetManager',
  'BookingExecutive',
  'Driver'
);

CREATE TYPE vehicle_tier_enum AS ENUM (
  'Budget',
  'Comfort',
  'Luxury'
);

CREATE TYPE vehicle_status_enum AS ENUM (
  'Available',
  'OnTrip',
  'Maintenance',
  'Retired'
);

CREATE TYPE enquiry_status_enum AS ENUM (
  'Pending',
  'Recommended',
  'Booked',
  'Cancelled'
);

CREATE TYPE trip_type_enum AS ENUM (
  'Airport',
  'Outstation',
  'Local',
  'Corporate',
  'Wedding',
  'Tourism'
);

-- ─────────────────────────────────────────────────────────────────────────────
-- TABLE: tenants
-- Root of the multi-tenant hierarchy. Each row = one SaaS customer company.
-- theme_config stores per-tenant branding: colors, logo_url, tagline etc.
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS tenants (
  tenant_id        UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  company_name     VARCHAR(200)  NOT NULL,
  domain_subdomain VARCHAR(100)  NOT NULL UNIQUE,   -- e.g. "manivtha", "cityrides"
  theme_config     JSONB         NOT NULL DEFAULT '{}',
  plan             VARCHAR(50)   NOT NULL DEFAULT 'starter',  -- starter | pro | enterprise
  is_active        BOOLEAN       NOT NULL DEFAULT TRUE,
  created_at       TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE tenants IS 'One row per SaaS tenant (client company). All downstream tables FK to tenant_id.';
COMMENT ON COLUMN tenants.theme_config IS 'JSONB blob: {"primary_color":"#D32F2F","logo_url":"...","tagline":"..."}';
COMMENT ON COLUMN tenants.domain_subdomain IS 'Unique subdomain handle used for JWT scoping and URL routing.';

-- ─────────────────────────────────────────────────────────────────────────────
-- TABLE: users
-- All human actors in the system. Scoped per tenant via tenant_id FK.
-- password_hash: bcrypt or argon2 hash — NEVER store plaintext.
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS users (
  user_id          UUID             PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id        UUID             NOT NULL REFERENCES tenants(tenant_id) ON DELETE CASCADE,
  name             VARCHAR(150)     NOT NULL,
  email            VARCHAR(200)     NOT NULL,
  password_hash    TEXT             NOT NULL,
  role             user_role_enum   NOT NULL DEFAULT 'BookingExecutive',
  is_active        BOOLEAN          NOT NULL DEFAULT TRUE,
  last_login_at    TIMESTAMPTZ,
  created_at       TIMESTAMPTZ      NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ      NOT NULL DEFAULT NOW(),

  -- Email must be unique WITHIN a tenant (different tenants can share the same email)
  CONSTRAINT uq_tenant_user_email UNIQUE (tenant_id, email)
);

COMMENT ON TABLE users IS 'Platform users scoped to a tenant. Roles drive RBAC across all API routes.';
COMMENT ON COLUMN users.role IS 'SuperAdmin can manage tenants. FleetManager manages vehicles. BookingExecutive handles enquiries.';

-- ─────────────────────────────────────────────────────────────────────────────
-- TABLE: vehicles
-- Fleet inventory, tenant-scoped. hourly_rate in minor currency units (paise/cents).
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS vehicles (
  vehicle_id           UUID                  PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id            UUID                  NOT NULL REFERENCES tenants(tenant_id) ON DELETE CASCADE,
  make                 VARCHAR(100)          NOT NULL,  -- e.g. "Toyota"
  model                VARCHAR(100)          NOT NULL,  -- e.g. "Innova Crysta"
  registration_no      VARCHAR(50),
  capacity_passengers  SMALLINT              NOT NULL CHECK (capacity_passengers > 0),
  capacity_luggage     VARCHAR(30)           NOT NULL DEFAULT 'medium',  -- small | medium | large | xl
  tier                 vehicle_tier_enum     NOT NULL DEFAULT 'Comfort',
  hourly_rate          NUMERIC(10, 2)        NOT NULL CHECK (hourly_rate >= 0),
  daily_rate           NUMERIC(10, 2),
  features             JSONB                 NOT NULL DEFAULT '[]',  -- ["AC","GPS","Sunroof"]
  image_url            TEXT,
  quantity             SMALLINT              NOT NULL DEFAULT 1 CHECK (quantity >= 0),
  status               vehicle_status_enum   NOT NULL DEFAULT 'Available',
  created_at           TIMESTAMPTZ           NOT NULL DEFAULT NOW(),
  updated_at           TIMESTAMPTZ           NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE vehicles IS 'Fleet inventory per tenant. All recommendation queries filter on tenant_id + status = Available.';
COMMENT ON COLUMN vehicles.features IS 'JSONB array of feature strings for AI prompt injection.';

-- ─────────────────────────────────────────────────────────────────────────────
-- TABLE: drivers
-- Human drivers, tenant-scoped and optionally linked to a vehicle.
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS drivers (
  driver_id          UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id          UUID          NOT NULL REFERENCES tenants(tenant_id) ON DELETE CASCADE,
  user_id            UUID          REFERENCES users(user_id) ON DELETE SET NULL,  -- optional portal account
  name               VARCHAR(150)  NOT NULL,
  phone              VARCHAR(20)   NOT NULL,
  license_no         VARCHAR(60),
  experience_years   SMALLINT      DEFAULT 0,
  rating             NUMERIC(3,2)  DEFAULT 5.00 CHECK (rating >= 0 AND rating <= 5),
  is_available       BOOLEAN       NOT NULL DEFAULT TRUE,
  assigned_vehicle_id UUID         REFERENCES vehicles(vehicle_id) ON DELETE SET NULL,
  created_at         TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE drivers IS 'Driver registry per tenant. Optionally linked to a user account with Driver role.';

-- ─────────────────────────────────────────────────────────────────────────────
-- TABLE: enquiries
-- A customer trip request. Lifecycle: Pending → Recommended → Booked | Cancelled.
-- contact_info is JSONB to store phone, email, address flexibly.
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS enquiries (
  enquiry_id          UUID                PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id           UUID                NOT NULL REFERENCES tenants(tenant_id) ON DELETE CASCADE,
  customer_name       VARCHAR(200)        NOT NULL,
  contact_info        JSONB               NOT NULL DEFAULT '{}',  -- {"phone":"...","email":"..."}
  trip_type           trip_type_enum      NOT NULL,
  passenger_count     SMALLINT            NOT NULL CHECK (passenger_count > 0),
  luggage_count       SMALLINT            NOT NULL DEFAULT 0,
  budget_min          NUMERIC(12, 2),
  budget_max          NUMERIC(12, 2),
  comfort_preference  VARCHAR(50)         NOT NULL DEFAULT 'standard',  -- economy | standard | premium
  pickup_location     TEXT,
  drop_location       TEXT,
  trip_date           DATE,
  return_date         DATE,
  special_requirements TEXT,
  status              enquiry_status_enum NOT NULL DEFAULT 'Pending',
  assigned_vehicle_id UUID                REFERENCES vehicles(vehicle_id) ON DELETE SET NULL,
  assigned_driver_id  UUID                REFERENCES drivers(driver_id) ON DELETE SET NULL,
  created_by          UUID                REFERENCES users(user_id) ON DELETE SET NULL,
  created_at          TIMESTAMPTZ         NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ         NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE enquiries IS 'Customer trip requests. Status transitions are enforced at the application layer.';
COMMENT ON COLUMN enquiries.contact_info IS 'JSONB: {"phone":"+919876543210","email":"customer@example.com"}';

-- ─────────────────────────────────────────────────────────────────────────────
-- TABLE: recommendation_history
-- Immutable audit log of every AI recommendation run.
-- recommended_vehicles stores the full AI-ranked JSON payload.
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS recommendation_history (
  rec_id               UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  enquiry_id           UUID          NOT NULL REFERENCES enquiries(enquiry_id) ON DELETE CASCADE,
  tenant_id            UUID          NOT NULL REFERENCES tenants(tenant_id) ON DELETE CASCADE,
  recommended_vehicles JSONB         NOT NULL DEFAULT '[]',  -- [{rank:1, vehicle_id, score, reason}]
  ai_explanation       TEXT,         -- raw summary paragraph from LLM
  model_used           VARCHAR(100)  NOT NULL DEFAULT 'rule-based-fallback',  -- e.g. "gemini-2.0-flash"
  prompt_tokens        INTEGER,
  completion_tokens    INTEGER,
  latency_ms           INTEGER,
  generated_at         TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE recommendation_history IS 'Append-only audit trail for every AI recommendation call. Never update, only insert.';
COMMENT ON COLUMN recommendation_history.recommended_vehicles IS 'JSONB: [{rank,vehicle_id,vehicle_name,suitability_score,reason}]';

-- ─────────────────────────────────────────────────────────────────────────────
-- TABLE: bookings
-- A confirmed booking derived from an accepted recommendation.
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS bookings (
  booking_id      UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID          NOT NULL REFERENCES tenants(tenant_id) ON DELETE CASCADE,
  enquiry_id      UUID          NOT NULL REFERENCES enquiries(enquiry_id) ON DELETE RESTRICT,
  vehicle_id      UUID          NOT NULL REFERENCES vehicles(vehicle_id) ON DELETE RESTRICT,
  driver_id       UUID          REFERENCES drivers(driver_id) ON DELETE SET NULL,
  total_amount    NUMERIC(12,2) NOT NULL,
  advance_paid    NUMERIC(12,2) NOT NULL DEFAULT 0,
  currency        CHAR(3)       NOT NULL DEFAULT 'INR',
  status          VARCHAR(30)   NOT NULL DEFAULT 'Confirmed',  -- Confirmed | InProgress | Completed | Cancelled
  notes           TEXT,
  confirmed_at    TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE bookings IS 'Confirmed bookings. enquiry_id has RESTRICT deletion to protect booking integrity.';

-- ─────────────────────────────────────────────────────────────────────────────
-- PERFORMANCE INDEXES
-- All hot-path queries filter first on tenant_id. Composite indexes ensure the
-- planner can satisfy tenant isolation checks + business filters in one scan.
-- ─────────────────────────────────────────────────────────────────────────────

-- tenants: fast lookup by subdomain (used in JWT scoping)
CREATE UNIQUE INDEX IF NOT EXISTS idx_tenants_subdomain
  ON tenants(domain_subdomain);

-- users: fast login lookup by (tenant, email)
CREATE UNIQUE INDEX IF NOT EXISTS idx_users_tenant_email
  ON users(tenant_id, email);

-- users: role-based listing per tenant
CREATE INDEX IF NOT EXISTS idx_users_tenant_role
  ON users(tenant_id, role);

-- vehicles: the most critical index — AI recommender fetches available fleet per tenant
CREATE INDEX IF NOT EXISTS idx_vehicles_tenant_status
  ON vehicles(tenant_id, status);

-- vehicles: filter by tier within a tenant
CREATE INDEX IF NOT EXISTS idx_vehicles_tenant_tier
  ON vehicles(tenant_id, tier);

-- enquiries: primary dashboard query (per tenant, by status)
CREATE INDEX IF NOT EXISTS idx_enquiries_tenant_status
  ON enquiries(tenant_id, status);

-- enquiries: filter by trip type within a tenant
CREATE INDEX IF NOT EXISTS idx_enquiries_tenant_triptype
  ON enquiries(tenant_id, trip_type);

-- enquiries: chronological listing per tenant
CREATE INDEX IF NOT EXISTS idx_enquiries_tenant_createdat
  ON enquiries(tenant_id, created_at DESC);

-- recommendation_history: lookup history for a specific enquiry
CREATE INDEX IF NOT EXISTS idx_rechist_enquiry_id
  ON recommendation_history(enquiry_id);

-- recommendation_history: per-tenant audit lookups
CREATE INDEX IF NOT EXISTS idx_rechist_tenant_generated
  ON recommendation_history(tenant_id, generated_at DESC);

-- bookings: per-tenant booking list
CREATE INDEX IF NOT EXISTS idx_bookings_tenant_status
  ON bookings(tenant_id, status);

-- drivers: available drivers per tenant
CREATE INDEX IF NOT EXISTS idx_drivers_tenant_available
  ON drivers(tenant_id, is_available);

-- ─────────────────────────────────────────────────────────────────────────────
-- UPDATED_AT TRIGGER (applied to mutable tables)
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_tenants_updated_at
  BEFORE UPDATE ON tenants
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER trg_users_updated_at
  BEFORE UPDATE ON users
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER trg_vehicles_updated_at
  BEFORE UPDATE ON vehicles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER trg_enquiries_updated_at
  BEFORE UPDATE ON enquiries
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER trg_bookings_updated_at
  BEFORE UPDATE ON bookings
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ─────────────────────────────────────────────────────────────────────────────
-- SEED DATA: One sample tenant + SuperAdmin user for local development
-- Password hash below = bcrypt("Admin@123", 12 rounds)
-- ─────────────────────────────────────────────────────────────────────────────
INSERT INTO tenants (tenant_id, company_name, domain_subdomain, theme_config, plan)
VALUES (
  'a0000000-0000-0000-0000-000000000001',
  'Manivtha Tours & Travels',
  'manivtha',
  '{
    "primary_color": "#D32F2F",
    "accent_color":  "#121212",
    "logo_url":      "/logos/manivtha.png",
    "tagline":       "Your trusted travel partner"
  }',
  'pro'
) ON CONFLICT (tenant_id) DO NOTHING;

INSERT INTO users (user_id, tenant_id, name, email, password_hash, role)
VALUES (
  'b0000000-0000-0000-0000-000000000001',
  'a0000000-0000-0000-0000-000000000001',
  'System Admin',
  'admin@manivtha.com',
  '$2b$12$q8vV3yBj3T.5K4K8bNe3m.jB5X8qJXqVNT9JOGLdPJk05fOLCB7ZK',  -- Admin@123
  'SuperAdmin'
) ON CONFLICT DO NOTHING;
