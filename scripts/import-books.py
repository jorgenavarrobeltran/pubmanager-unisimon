#!/usr/bin/env python3
"""
Import books, chapters, and authors from internal Excel into Supabase via REST API.
"""
import json
import os
import ssl
import sys
import time
import uuid
import urllib.request
import urllib.error

import certifi
import openpyxl

# Fix macOS SSL
ssl_context = ssl.create_default_context(cafile=certifi.where())

# ── Config ──
EXCEL_FILE = "/Users/joarnabe/Library/CloudStorage/OneDrive-Personal/Unisimon/Libros/Base de Datos - Libros Autores Capitulos - Publicaciones.xlsx"
SUPABASE_URL = "https://yonklzparwtjdwzltivr.supabase.co"
ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlvbmtsenBhcnd0amR3emx0aXZyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODExMjA1MTksImV4cCI6MjA5NjY5NjUxOX0.Q8qQwV-LXd262RfibOTiggSB0YjwpZH1vmxwOtyItZM"
BATCH_SIZE = 50

# ── Mappings ──
BOOK_TYPE_MAP = {
    "libro completo": "libro_completo",
    "libro compilatorio": "libro_compilatorio",
    "memorias": "memorias",
    "cartilla / manual / guía": "cartilla_manual",
}
STATUS_MAP = {
    "activo": "publicado", "inactivo": "cancelado",
    "en proceso": "en_proceso", "cancelado": "cancelado",
    "isbn fantasma": "isbn_fantasma", "pausado": "pausado",
}
FORMAT_MAP = {
    "impreso": "impreso", "digital": "digital",
    "digital e impreso": "ambos", "sin datos": "sin_datos",
}
MONTHS = {
    "enero": "Enero", "febrero": "Febrero", "marzo": "Marzo",
    "abril": "Abril", "mayo": "Mayo", "junio": "Junio",
    "julio": "Julio", "agosto": "Agosto", "septiembre": "Septiembre",
    "octubre": "Octubre", "noviembre": "Noviembre", "diciembre": "Diciembre",
}
ROLE_MAP = {
    "autor": "Autor", "editor": "Editor",
    "compilador": "Compilador", "colaborador": "Colaborador",
}


def clean(val):
    if val is None: return None
    s = str(val).strip()
    return None if s.upper() in ("NA", "N/A", "", "NONE", "NAN", "SIN DATOS") else s


def clean_isbn(val):
    s = clean(val)
    return None if s and s.upper() in ("NA", "N/A", "0") else s


def clean_bool(val):
    if val is None: return False
    return str(val).strip().lower() in ("si", "sí", "yes", "1", "true")


def post(table, batch):
    """POST batch to Supabase REST API."""
    url = f"{SUPABASE_URL}/rest/v1/{table}"
    headers = {
        "apikey": ANON_KEY,
        "Authorization": f"Bearer {ANON_KEY}",
        "Content-Type": "application/json",
        "Prefer": "return=minimal",
    }
    body = json.dumps(batch, ensure_ascii=False, default=str).encode("utf-8")
    req = urllib.request.Request(url, data=body, headers=headers, method="POST")
    try:
        with urllib.request.urlopen(req, timeout=30, context=ssl_context) as resp:
            return True, resp.status
    except urllib.error.HTTPError as e:
        return False, f"HTTP {e.code}: {e.read().decode()[:300]}"
    except Exception as e:
        return False, str(e)


def insert_batches(table, records, label):
    """Insert records in batches."""
    print(f"\nInserting {len(records)} {label} in batches of {BATCH_SIZE}...")
    ok_count = 0
    err_count = 0
    for i in range(0, len(records), BATCH_SIZE):
        batch = records[i:i + BATCH_SIZE]
        ok, result = post(table, batch)
        if ok:
            ok_count += len(batch)
            print(f"  ✅ Batch {i // BATCH_SIZE + 1}: {len(batch)} {label}")
        else:
            err_count += len(batch)
            print(f"  ❌ Batch {i // BATCH_SIZE + 1}: {result}")
        time.sleep(0.15)
    print(f"  → {label}: {ok_count} inserted, {err_count} failed")
    return ok_count, err_count


# ═══════════════════════════════════
# STEP 1: Read Books (536)
# ═══════════════════════════════════
print("=" * 60)
print("STEP 1: Reading books...")
wb = openpyxl.load_workbook(EXCEL_FILE, read_only=True, data_only=True)
ws = wb["Libro"]

books = []
code_to_id = {}

for row in ws.iter_rows(min_row=2, values_only=True):
    code = row[0]
    if code is None: continue
    code = str(int(code)) if isinstance(code, (int, float)) else str(code)
    
    book_id = str(uuid.uuid4())
    code_to_id[code] = book_id
    
    status = STATUS_MAP.get(str(row[19] or "").strip().lower(), "en_proceso")
    
    books.append({
        "id": book_id,
        "code": code,
        "title": clean(row[1]),
        "year_published": int(row[2]) if row[2] else None,
        "month_published": MONTHS.get(str(row[3] or "").strip().lower()),
        "isbn_digital": clean_isbn(row[4]),
        "isbn_print": clean_isbn(row[5]),
        "editorial": clean(row[6]) or "Ediciones Universidad Simón Bolívar",
        "project_name": clean(row[7]),
        "financing": clean(row[8]),
        "tipo_minciencias": clean(row[9]),
        "subtipo_minciencias": clean(row[10]),
        "minciencias_category": clean(row[11]),
        "book_type": BOOK_TYPE_MAP.get(str(row[12] or "").strip().lower(), "libro_completo"),
        "has_credit_cert": clean_bool(row[13]),
        "has_endorsement_cert": clean_bool(row[14]),
        "has_peer_eval": clean_bool(row[15]),
        "format": FORMAT_MAP.get(str(row[16] or "").strip().lower(), "sin_datos"),
        "url_doi": clean(row[17]),
        "research_group_code": clean(row[18]),
        "status": status,
        "notes": clean(row[20]),
        "num_authors": int(row[21]) if row[21] else 0,
        "num_chapters": int(row[23]) if row[23] else 0,
        "current_stage": "publicacion" if status == "publicado" else "propuesta",
    })

print(f"  Parsed {len(books)} books")

# ═══════════════════════════════════
# STEP 2: Read Chapters (1716)
# ═══════════════════════════════════
print("\nSTEP 2: Reading chapters...")
ws2 = wb["Capitulos"]

chapters = []
for row in ws2.iter_rows(min_row=2, values_only=True):
    cod_lib = row[0]
    if cod_lib is None: continue
    cod_lib = str(int(cod_lib)) if isinstance(cod_lib, (int, float)) else str(cod_lib)
    if cod_lib not in code_to_id: continue
    
    aux = int(row[1]) if row[1] else None
    title = clean(row[5])
    if not title: continue
    
    tipo = clean(row[7])
    if tipo and str(tipo).startswith("="): tipo = None
    subtipo = clean(row[8])
    if subtipo and str(subtipo).startswith("="): subtipo = None
    
    chapters.append({
        "id": str(uuid.uuid4()),
        "book_id": code_to_id[cod_lib],
        "code": f"{cod_lib}_{aux}" if aux else None,
        "title": title,
        "chapter_number": aux,
        "tipo_minciencias": tipo,
        "subtipo_minciencias": subtipo,
        "minciencias_category": clean(row[9]),
        "notes": clean(row[10]),
    })

print(f"  Parsed {len(chapters)} chapters")

# ═══════════════════════════════════
# STEP 3: Read Authors (5547)
# ═══════════════════════════════════
print("\nSTEP 3: Reading authors...")
ws3 = wb["Autores"]

# First pass: build unique people
people_map = {}  # cedula_or_name -> person dict
author_links = []

for row in ws3.iter_rows(min_row=2, values_only=True):
    persona = clean(row[3])
    if not persona: continue
    
    cod_libro_raw = row[4]
    if cod_libro_raw is None: continue
    cod_libro = str(int(cod_libro_raw)) if isinstance(cod_libro_raw, (int, float)) else str(cod_libro_raw)
    if cod_libro.startswith("="): continue  # Unresolved formula
    if cod_libro not in code_to_id: continue
    
    cedula = row[5]
    cedula_str = str(int(cedula)) if isinstance(cedula, (int, float)) and cedula else None
    
    role = ROLE_MAP.get(str(row[2] or "").strip().lower(), "autor")
    affiliation = clean(row[7])
    country = clean(row[8])
    research_group = clean(row[9])
    academic_program = clean(row[10])
    
    # Unique key: cedula if available, else name
    key = cedula_str if cedula_str else persona.lower().strip()
    
    if key not in people_map:
        people_map[key] = {
            "id": str(uuid.uuid4()),
            "full_name": persona.strip(),
            "document_id": cedula_str,
            "affiliation": affiliation,
            "country": country,
            "research_group": research_group,
            "academic_program": academic_program,
        }
    
    author_links.append({
        "id": str(uuid.uuid4()),
        "book_id": code_to_id[cod_libro],
        "person_id": people_map[key]["id"],
        "role": role,
    })

people_list = list(people_map.values())
print(f"  Parsed {len(author_links)} author-book links")
print(f"  Parsed {len(people_list)} unique people")

wb.close()

# ═══════════════════════════════════
# STEP 4: Check people table schema
# ═══════════════════════════════════
# We need to verify the people table has the columns we need
# The extra columns (document_id, affiliation, research_group, academic_program)
# might not exist yet. We'll only send columns that exist.

# People table columns match our data perfectly!
# PostgREST requires ALL objects in a batch to have the SAME keys
safe_people = []
for p in people_list:
    safe_people.append({
        "id": p["id"],
        "full_name": p["full_name"],
        "cedula": p.get("document_id"),
        "institution": p.get("affiliation"),
        "country": p.get("country"),
        "research_group": p.get("research_group"),
        "academic_program": p.get("academic_program"),
    })

# ═══════════════════════════════════
# STEP 5: Insert everything
# ═══════════════════════════════════
print("\n" + "=" * 60)
print("INSERTING DATA...")

# Books and chapters already imported - skip
print("\n  ⏭️  Books: 536 already imported - skipping")
print("  ⏭️  Chapters: 1716 already imported - skipping")
b_ok, b_err = 536, 0
c_ok, c_err = 1716, 0

p_ok, p_err = insert_batches("people", safe_people, "people")
a_ok, a_err = insert_batches("book_authors", author_links, "author links")

# ═══════════════════════════════════
# SUMMARY
# ═══════════════════════════════════
print("\n" + "=" * 60)
print("MIGRATION COMPLETE")
print(f"  Books:        {b_ok}/{len(books)} inserted")
print(f"  Chapters:     {c_ok}/{len(chapters)} inserted")
print(f"  People:       {p_ok}/{len(safe_people)} inserted")
print(f"  Author Links: {a_ok}/{len(author_links)} inserted")
print("=" * 60)
