#!/usr/bin/env python3
"""Phase 6: Create finance tables in Supabase."""
import ssl
import urllib.request
import json

SUPABASE_URL = "https://yonklzparwtjdwzltivr.supabase.co"
SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlvbmtsenBhcnd0amR3emx0aXZyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODExMjA1MTksImV4cCI6MjA5NjY5NjUxOX0.Q8qQwV-LXd262RfibOTiggSB0YjwpZH1vmxwOtyItZM"

SQL = """
-- =============================================
-- PHASE 6: FINANCE & SERVICES TABLES
-- =============================================

-- 1. Providers
CREATE TABLE IF NOT EXISTS providers (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  name text NOT NULL,
  nit text,
  contact_name text,
  phone text,
  email text,
  service_types text[] DEFAULT '{}',
  status text DEFAULT 'activo' CHECK (status IN ('activo', 'inactivo')),
  notes text,
  created_at timestamptz DEFAULT now()
);

-- 2. Revenue targets
CREATE TABLE IF NOT EXISTS revenue_targets (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  year int NOT NULL UNIQUE,
  target_amount numeric NOT NULL DEFAULT 0,
  notes text,
  created_at timestamptz DEFAULT now()
);

-- 3. External services sold to third parties
CREATE TABLE IF NOT EXISTS external_services (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  service_type text NOT NULL CHECK (service_type IN ('diagramacion', 'edicion', 'formacion', 'asesoria', 'otro')),
  client_name text NOT NULL,
  description text,
  amount numeric NOT NULL DEFAULT 0,
  invoice_number text,
  date date NOT NULL DEFAULT CURRENT_DATE,
  status text DEFAULT 'cotizado' CHECK (status IN ('cotizado', 'en_proceso', 'facturado', 'pagado')),
  notes text,
  created_at timestamptz DEFAULT now()
);

-- 4. Production costs (books & journals)
CREATE TABLE IF NOT EXISTS production_costs (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  entity_type text NOT NULL CHECK (entity_type IN ('book', 'journal')),
  entity_id uuid NOT NULL,
  cost_type text NOT NULL CHECK (cost_type IN ('imprenta', 'isbn', 'diseno', 'correccion', 'doi', 'apc', 'hosting_ojs', 'otro')),
  description text,
  amount numeric NOT NULL DEFAULT 0,
  date date NOT NULL DEFAULT CURRENT_DATE,
  provider_id uuid REFERENCES providers(id),
  invoice_number text,
  created_at timestamptz DEFAULT now()
);

-- 5. Book sales
CREATE TABLE IF NOT EXISTS book_sales (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  book_id uuid NOT NULL REFERENCES books(id),
  quantity int NOT NULL DEFAULT 1,
  unit_price numeric NOT NULL DEFAULT 0,
  total_amount numeric NOT NULL DEFAULT 0,
  buyer text,
  date date NOT NULL DEFAULT CURRENT_DATE,
  channel text DEFAULT 'directo' CHECK (channel IN ('directo', 'libreria', 'feria', 'online')),
  notes text,
  created_at timestamptz DEFAULT now()
);

-- 6. Budget items
CREATE TABLE IF NOT EXISTS budget_items (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  year int NOT NULL,
  category text NOT NULL CHECK (category IN ('nomina', 'produccion_libros', 'produccion_revistas', 'eventos', 'servicios', 'operacion', 'otro')),
  planned_amount numeric NOT NULL DEFAULT 0,
  executed_amount numeric NOT NULL DEFAULT 0,
  description text,
  created_at timestamptz DEFAULT now()
);

-- Enable RLS but allow all for now (public access with anon key)
ALTER TABLE providers ENABLE ROW LEVEL SECURITY;
ALTER TABLE revenue_targets ENABLE ROW LEVEL SECURITY;
ALTER TABLE external_services ENABLE ROW LEVEL SECURITY;
ALTER TABLE production_costs ENABLE ROW LEVEL SECURITY;
ALTER TABLE book_sales ENABLE ROW LEVEL SECURITY;
ALTER TABLE budget_items ENABLE ROW LEVEL SECURITY;

-- Policies (permissive for development)
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'providers' AND policyname = 'providers_all') THEN
    CREATE POLICY providers_all ON providers FOR ALL USING (true) WITH CHECK (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'revenue_targets' AND policyname = 'revenue_targets_all') THEN
    CREATE POLICY revenue_targets_all ON revenue_targets FOR ALL USING (true) WITH CHECK (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'external_services' AND policyname = 'external_services_all') THEN
    CREATE POLICY external_services_all ON external_services FOR ALL USING (true) WITH CHECK (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'production_costs' AND policyname = 'production_costs_all') THEN
    CREATE POLICY production_costs_all ON production_costs FOR ALL USING (true) WITH CHECK (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'book_sales' AND policyname = 'book_sales_all') THEN
    CREATE POLICY book_sales_all ON book_sales FOR ALL USING (true) WITH CHECK (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'budget_items' AND policyname = 'budget_items_all') THEN
    CREATE POLICY budget_items_all ON budget_items FOR ALL USING (true) WITH CHECK (true);
  END IF;
END $$;
"""

def run():
    ctx = ssl._create_unverified_context()
    url = f"{SUPABASE_URL}/rest/v1/rpc/exec_sql"
    
    # Try direct SQL via REST - but Supabase doesn't expose exec_sql by default
    # Use the SQL editor approach via management API
    # Actually, let's use the supabase-mcp-server tool instead
    print("SQL migration ready. Executing via Supabase MCP...")
    print(SQL)

if __name__ == "__main__":
    run()
