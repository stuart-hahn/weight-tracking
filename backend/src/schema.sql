-- Body Fat Tracker - Legacy PostgreSQL schema (reference only).
-- Canonical schema: prisma/schema.prisma (SQLite; switch provider for Postgres).

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  email VARCHAR(255) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  age INTEGER NOT NULL CHECK (age >= 10 AND age <= 120),
  sex VARCHAR(10) NOT NULL CHECK (sex IN ('male', 'female')),
  height_cm NUMERIC(5,2) NOT NULL CHECK (height_cm > 0 AND height_cm <= 300),
  current_weight_kg NUMERIC(5,2) NOT NULL CHECK (current_weight_kg > 0 AND current_weight_kg <= 500),
  target_body_fat_percent NUMERIC(4,2) NOT NULL CHECK (target_body_fat_percent > 0 AND target_body_fat_percent < 100),
  activity_level VARCHAR(20) CHECK (activity_level IN ('sedentary', 'light', 'moderate', 'very_active')),
  lean_mass_kg NUMERIC(5,2) CHECK (lean_mass_kg IS NULL OR (lean_mass_kg > 0 AND lean_mass_kg <= 500)),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS daily_entries (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  weight_kg NUMERIC(5,2) NOT NULL CHECK (weight_kg > 0 AND weight_kg <= 500),
  calories INTEGER CHECK (calories IS NULL OR (calories >= 0 AND calories <= 10000)),
  waist_cm NUMERIC(5,2) CHECK (waist_cm IS NULL OR (waist_cm > 0 AND waist_cm <= 200)),
  hip_cm NUMERIC(5,2) CHECK (hip_cm IS NULL OR (hip_cm > 0 AND hip_cm <= 200)),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id, date)
);

CREATE TABLE IF NOT EXISTS optional_metrics (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  body_fat_percent NUMERIC(4,2) CHECK (body_fat_percent IS NULL OR (body_fat_percent > 0 AND body_fat_percent < 100)),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id, date)
);

CREATE INDEX idx_daily_entries_user_date ON daily_entries(user_id, date DESC);
CREATE INDEX idx_optional_metrics_user_date ON optional_metrics(user_id, date DESC);

-- Trigger to update users.updated_at
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS users_updated_at ON users;
CREATE TRIGGER users_updated_at
  BEFORE UPDATE ON users
  FOR EACH ROW EXECUTE PROCEDURE set_updated_at();
