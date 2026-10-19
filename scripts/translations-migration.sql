-- =============================================================================
-- Módulo de Traducciones (Proveedor: ENAGO) — Migración SQL
-- Universidad Simón Bolívar - Dto. de Publicaciones
-- Líder del módulo: Fernando Alberto Peñaranda (Coordinador de Proyectos)
-- =============================================================================

-- 1. Depósitos prepagados al proveedor (bolsa en USD)
CREATE TABLE IF NOT EXISTS translation_deposits (
  id text PRIMARY KEY,
  provider text NOT NULL DEFAULT 'ENAGO',
  deposit_date date NOT NULL,
  year integer NOT NULL,
  amount_usd numeric(14,2) NOT NULL DEFAULT 0,
  withholding_tax_usd numeric(14,2) DEFAULT 0,
  received_usd numeric(14,2) NOT NULL DEFAULT 0,
  notes text,
  created_by uuid REFERENCES user_profiles(id),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- 2. Encargos de traducción / edición (assignments)
CREATE TABLE IF NOT EXISTS translation_orders (
  id text PRIMARY KEY,                       -- Número de asignación (p. ej. UNISIL-436)
  assignment_number text NOT NULL,
  provider text NOT NULL DEFAULT 'ENAGO',
  membership_id text DEFAULT 'UNISIL',
  year integer,
  fee_usd numeric(14,2) DEFAULT 0,
  quoted_off_deposit_usd numeric(14,2),      -- Valor cotizado que NO se descontó del depósito
  charged_to_deposit boolean DEFAULT true,
  confirmed_on date,
  delivered_on date,
  turnaround_days integer,
  service text,                              -- Traducción + Edición, Corrección de estilo, Edición sustantiva…
  word_count integer,
  status text DEFAULT 'En proceso',          -- Completado | En proceso | Cancelado
  inquiry_number text,
  priority text DEFAULT 'Standard',
  requested_by text,                         -- Gestor Unisimón que tramitó el encargo
  researcher_email text,                     -- Investigador / supervisor beneficiario (reporte ENAGO)
  researcher_team text,                      -- Equipo de investigadores solicitante (registro interno)
  manuscript_title text,                     -- Nombre del artículo (registro interno)
  journal text,                              -- Revista destino (registro interno)
  quartile text,                             -- Cuartil de la revista: Q1..Q4 (registro interno)
  facultad text,                             -- Facultad (registro interno)
  notes text,
  created_by uuid REFERENCES user_profiles(id),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Si la tabla ya existía de una versión anterior de este script
ALTER TABLE translation_orders ADD COLUMN IF NOT EXISTS researcher_team text;
ALTER TABLE translation_orders ADD COLUMN IF NOT EXISTS journal text;
ALTER TABLE translation_orders ADD COLUMN IF NOT EXISTS quartile text;

CREATE INDEX IF NOT EXISTS idx_translation_orders_year ON translation_orders(year);
CREATE INDEX IF NOT EXISTS idx_translation_orders_service ON translation_orders(service);
CREATE INDEX IF NOT EXISTS idx_translation_orders_status ON translation_orders(status);
CREATE INDEX IF NOT EXISTS idx_translation_orders_requested_by ON translation_orders(requested_by);
CREATE INDEX IF NOT EXISTS idx_translation_deposits_year ON translation_deposits(year);

-- Seguridad RLS (mismo esquema que el módulo APC)
ALTER TABLE translation_deposits ENABLE ROW LEVEL SECURITY;
ALTER TABLE translation_orders ENABLE ROW LEVEL SECURITY;

CREATE POLICY "translation_deposits_read" ON translation_deposits FOR SELECT TO authenticated USING (true);
CREATE POLICY "translation_deposits_write" ON translation_deposits FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "translation_orders_read" ON translation_orders FOR SELECT TO authenticated USING (true);
CREATE POLICY "translation_orders_write" ON translation_orders FOR ALL TO authenticated USING (true) WITH CHECK (true);
