#!/usr/bin/env python3
"""
Import author-book links using existing book_ids and people_ids from the database.
"""
import json, ssl, time, uuid, urllib.request, urllib.error
import certifi, openpyxl

ssl_context = ssl.create_default_context(cafile=certifi.where())

EXCEL_FILE = "/Users/joarnabe/Library/CloudStorage/OneDrive-Personal/Unisimon/Libros/Base de Datos - Libros Autores Capitulos - Publicaciones.xlsx"
SUPABASE_URL = "https://yonklzparwtjdwzltivr.supabase.co"
ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlvbmtsenBhcnd0amR3emx0aXZyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODExMjA1MTksImV4cCI6MjA5NjY5NjUxOX0.Q8qQwV-LXd262RfibOTiggSB0YjwpZH1vmxwOtyItZM"
BATCH_SIZE = 50

ROLE_MAP = {"autor": "Autor", "editor": "Editor", "compilador": "Compilador", "colaborador": "Colaborador"}


def supabase_get(table, params=""):
    url = f"{SUPABASE_URL}/rest/v1/{table}?{params}"
    headers = {"apikey": ANON_KEY, "Authorization": f"Bearer {ANON_KEY}"}
    req = urllib.request.Request(url, headers=headers)
    with urllib.request.urlopen(req, timeout=30, context=ssl_context) as resp:
        return json.loads(resp.read().decode())


def supabase_post(table, batch):
    url = f"{SUPABASE_URL}/rest/v1/{table}"
    headers = {
        "apikey": ANON_KEY, "Authorization": f"Bearer {ANON_KEY}",
        "Content-Type": "application/json", "Prefer": "return=minimal",
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


# ═══════════════════════════════════
# STEP 1: Load existing book IDs from DB
# ═══════════════════════════════════
print("Loading books from DB...")
books_data = supabase_get("books", "select=code,id&limit=1000")
code_to_bookid = {b["code"]: b["id"] for b in books_data}
print(f"  Found {len(code_to_bookid)} books in DB")

# ═══════════════════════════════════
# STEP 2: Load existing people IDs from DB (by cedula and full_name)
# ═══════════════════════════════════
print("Loading people from DB...")
# Get all people in batches (PostgREST default limit is 1000)
all_people = []
offset = 0
while True:
    batch = supabase_get("people", f"select=id,full_name,cedula&limit=1000&offset={offset}")
    all_people.extend(batch)
    if len(batch) < 1000:
        break
    offset += 1000

cedula_to_personid = {}
name_to_personid = {}
for p in all_people:
    if p.get("cedula"):
        cedula_to_personid[p["cedula"]] = p["id"]
    if p.get("full_name"):
        name_to_personid[p["full_name"].strip().lower()] = p["id"]
print(f"  Found {len(all_people)} people in DB ({len(cedula_to_personid)} with cedula)")

# ═══════════════════════════════════
# STEP 3: Read authors from Excel
# ═══════════════════════════════════
print("\nReading authors from Excel...")
wb = openpyxl.load_workbook(EXCEL_FILE, read_only=True, data_only=True)
ws = wb["Autores"]

author_links = []
skipped = 0

for row in ws.iter_rows(min_row=2, values_only=True):
    persona = row[3]
    if not persona: continue
    persona = str(persona).strip()
    
    cod_libro_raw = row[4]
    if cod_libro_raw is None: continue
    cod_libro = str(int(cod_libro_raw)) if isinstance(cod_libro_raw, (int, float)) else str(cod_libro_raw)
    if cod_libro.startswith("="): continue
    
    # Resolve book_id from DB
    book_id = code_to_bookid.get(cod_libro)
    if not book_id:
        skipped += 1
        continue
    
    # Resolve person_id from DB
    cedula = row[5]
    cedula_str = str(int(cedula)) if isinstance(cedula, (int, float)) and cedula else None
    
    person_id = None
    if cedula_str:
        person_id = cedula_to_personid.get(cedula_str)
    if not person_id:
        person_id = name_to_personid.get(persona.lower())
    if not person_id:
        skipped += 1
        continue
    
    role = ROLE_MAP.get(str(row[2] or "").strip().lower(), "Autor")
    
    author_links.append({
        "id": str(uuid.uuid4()),
        "book_id": book_id,
        "person_id": person_id,
        "role": role,
    })

wb.close()
print(f"  Resolved {len(author_links)} author links ({skipped} skipped)")

# ═══════════════════════════════════
# STEP 4: Insert author links
# ═══════════════════════════════════
print(f"\nInserting {len(author_links)} author links in batches of {BATCH_SIZE}...")
ok_count = 0
err_count = 0

for i in range(0, len(author_links), BATCH_SIZE):
    batch = author_links[i:i + BATCH_SIZE]
    ok, result = supabase_post("book_authors", batch)
    if ok:
        ok_count += len(batch)
        print(f"  ✅ Batch {i // BATCH_SIZE + 1}: {len(batch)} links")
    else:
        err_count += len(batch)
        print(f"  ❌ Batch {i // BATCH_SIZE + 1}: {result}")
    time.sleep(0.15)

print(f"\n{'='*60}")
print(f"Author Links: {ok_count}/{len(author_links)} inserted, {err_count} failed, {skipped} skipped")
print(f"{'='*60}")
