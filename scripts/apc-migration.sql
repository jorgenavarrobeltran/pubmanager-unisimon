-- =============================================================================
-- Módulo de Pagos APC — Migración SQL
-- Universidad Simón Bolívar - Dto. de Publicaciones
-- Líder del módulo: Fernando Alberto Peñaranda (Coordinador de Proyectos)
-- =============================================================================

-- 1. Presupuestos Anuales (Bolsa de Presupuesto Anual)
CREATE TABLE IF NOT EXISTS apc_annual_budgets (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  year integer UNIQUE NOT NULL,
  allocated_budget numeric(15,2) DEFAULT 0,  -- Bolsa asignada en pesos COP
  currency text DEFAULT 'COP',
  notes text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- 2. Pagos APC
CREATE TABLE IF NOT EXISTS apc_payments (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  year integer NOT NULL,
  consecutive integer,
  investigador text NOT NULL,
  cedula text,
  fecha_autorizacion date,
  autorizado_por text,
  articulo text NOT NULL,
  revista text NOT NULL,
  issn text,
  beneficiario text,
  valor_factura_divisa text,
  moneda text,
  monto_divisa numeric(14,2),
  consecutivo_factura text,
  codigo_interno text,
  orden_compra text,
  fecha_pago date,
  cuartil text,
  estado_solicitud text DEFAULT 'ATENDIDA',
  estado_final text DEFAULT 'PAGADA',
  valor_pagado_pesos numeric(15,2) DEFAULT 0,
  valor_retenido_pesos numeric(15,2) DEFAULT 0,
  pais_origen text,
  link_publicacion text,
  programa_academico text,
  facultad text,
  centro_investigacion text,
  autor_correspondencia text,
  afiliacion_institucional text,
  grupo_investigacion text,
  vinculado_grupo text,
  observaciones text,
  created_by uuid REFERENCES user_profiles(id),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Índices de alto rendimiento
CREATE INDEX IF NOT EXISTS idx_apc_payments_year ON apc_payments(year);
CREATE INDEX IF NOT EXISTS idx_apc_payments_cuartil ON apc_payments(cuartil);
CREATE INDEX IF NOT EXISTS idx_apc_payments_facultad ON apc_payments(facultad);
CREATE INDEX IF NOT EXISTS idx_apc_payments_investigador ON apc_payments(investigador);
CREATE INDEX IF NOT EXISTS idx_apc_payments_beneficiario ON apc_payments(beneficiario);
CREATE INDEX IF NOT EXISTS idx_apc_payments_estado_final ON apc_payments(estado_final);

-- Seguridad RLS
ALTER TABLE apc_annual_budgets ENABLE ROW LEVEL SECURITY;
ALTER TABLE apc_payments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "apc_annual_budgets_read" ON apc_annual_budgets FOR SELECT TO authenticated USING (true);
CREATE POLICY "apc_annual_budgets_write" ON apc_annual_budgets FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "apc_payments_read" ON apc_payments FOR SELECT TO authenticated USING (true);
CREATE POLICY "apc_payments_write" ON apc_payments FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "apc_annual_budgets_anon_read" ON apc_annual_budgets FOR SELECT TO anon USING (true);
CREATE POLICY "apc_annual_budgets_anon_write" ON apc_annual_budgets FOR ALL TO anon USING (true) WITH CHECK (true);

CREATE POLICY "apc_payments_anon_read" ON apc_payments FOR SELECT TO anon USING (true);
CREATE POLICY "apc_payments_anon_write" ON apc_payments FOR ALL TO anon USING (true) WITH CHECK (true);

-- 3. Crear / actualizar usuario Fernando Alberto Peñaranda (coord_proyectos)
DO $$
DECLARE
  v_user_id uuid;
BEGIN
  -- Check if user exists in auth.users
  SELECT id INTO v_user_id FROM auth.users WHERE email = 'fernando.penaranda@unisimon.edu.co';
  
  IF v_user_id IS NULL THEN
    v_user_id := gen_random_uuid();
    INSERT INTO auth.users (id, email, encrypted_password, email_confirmed_at, role, aud, instance_id)
    VALUES (
      v_user_id,
      'fernando.penaranda@unisimon.edu.co',
      crypt('PubManager2026!', gen_salt('bf')),
      now(),
      'authenticated',
      'authenticated',
      '00000000-0000-0000-0000-000000000000'
    );
  END IF;

  -- Upsert in user_profiles
  INSERT INTO user_profiles (id, email, full_name, role, active, created_at, updated_at)
  VALUES (
    v_user_id,
    'fernando.penaranda@unisimon.edu.co',
    'Fernando Alberto Peñaranda',
    'coord_proyectos',
    true,
    now(),
    now()
  )
  ON CONFLICT (id) DO UPDATE
  SET role = 'coord_proyectos',
      full_name = 'Fernando Alberto Peñaranda',
      active = true,
      updated_at = now();

  RAISE NOTICE 'Fernando Alberto Peñaranda configurado como coord_proyectos (id: %)', v_user_id;
END $$;
