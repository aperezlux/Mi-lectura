CREATE TABLE IF NOT EXISTS generation_configurations (
  id SERIAL PRIMARY KEY,
  day_type TEXT NOT NULL UNIQUE,
  label TEXT NOT NULL,
  is_enabled BOOLEAN NOT NULL DEFAULT true,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP DEFAULT now() NOT NULL,
  updated_at TIMESTAMP DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS liturgical_functions (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  is_active BOOLEAN NOT NULL DEFAULT true,
  sort_order INTEGER NOT NULL DEFAULT 0,
  color TEXT,
  icon TEXT,
  is_visible BOOLEAN NOT NULL DEFAULT true,
  requires_reader BOOLEAN NOT NULL DEFAULT true,
  description TEXT,
  created_at TIMESTAMP DEFAULT now() NOT NULL,
  updated_at TIMESTAMP DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS generation_function_assignments (
  id SERIAL PRIMARY KEY,
  generation_configuration_id INTEGER NOT NULL REFERENCES generation_configurations(id) ON DELETE CASCADE,
  function_id INTEGER NOT NULL REFERENCES liturgical_functions(id) ON DELETE CASCADE,
  sort_order INTEGER NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP DEFAULT now() NOT NULL,
  updated_at TIMESTAMP DEFAULT now() NOT NULL,
  UNIQUE(generation_configuration_id, function_id)
);

CREATE TABLE IF NOT EXISTS app_settings (
  id SERIAL PRIMARY KEY,
  key TEXT NOT NULL UNIQUE,
  value TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT now() NOT NULL,
  updated_at TIMESTAMP DEFAULT now() NOT NULL
);
