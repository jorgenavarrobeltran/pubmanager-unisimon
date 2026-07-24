#!/usr/bin/env python3
"""Migrate repository_url and notes/observaciones from Excel to Supabase books table."""

import openpyxl
import os
import json
import ssl
from urllib.request import Request, urlopen

# Fix macOS SSL certificate issue
ssl_ctx = ssl.create_default_context()
ssl_ctx.check_hostname = False
ssl_ctx.verify_mode = ssl.CERT_NONE

EXCEL_PATH = "/Users/joarnabe/Library/CloudStorage/OneDrive-Personal/Unisimon/Libros/Base de Datos - Libros Autores Capitulos - Publicaciones.xlsx"
SUPABASE_URL = "https://yonklzparwtjdwzltivr.supabase.co"
SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlvbmtsenBhcnd0amR3emx0aXZyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODExMjA1MTksImV4cCI6MjA5NjY5NjUxOX0.Q8qQwV-LXd262RfibOTiggSB0YjwpZH1vmxwOtyItZM"

def api_get(path):
    req = Request(f"{SUPABASE_URL}/rest/v1/{path}", headers={
        "apikey": SUPABASE_KEY,
        "Authorization": f"Bearer {SUPABASE_KEY}",
    })
    resp = urlopen(req, context=ssl_ctx)
    return json.loads(resp.read())

def api_patch(table, book_id, data):
    body = json.dumps(data).encode()
    req = Request(
        f"{SUPABASE_URL}/rest/v1/{table}?id=eq.{book_id}",
        data=body, method="PATCH",
        headers={
            "apikey": SUPABASE_KEY,
            "Authorization": f"Bearer {SUPABASE_KEY}",
            "Content-Type": "application/json",
            "Prefer": "return=minimal",
        }
    )
    resp = urlopen(req, context=ssl_ctx)
    return resp.status

def normalize(s):
    if not s: return ""
    return s.strip().lower().replace("\u00e1","a").replace("\u00e9","e").replace("\u00ed","i").replace("\u00f3","o").replace("\u00fa","u").replace("\u00f1","n").replace("\u00fc","u")

# ── 1. Read Excel ──
print("📖 Reading Excel...")
wb = openpyxl.load_workbook(EXCEL_PATH, read_only=True)
ws = wb["Libro"]
# Col 1=Title, 17=Url/Doi, 20=Observaciones
excel_rows = []
for row in ws.iter_rows(min_row=2, values_only=True):
    title = row[1]
    url_raw = row[17]
    obs_raw = row[20]
    if not title:
        continue
    url = str(url_raw).strip() if url_raw else ""
    obs = str(obs_raw).strip() if obs_raw else ""
    # Skip invalid URLs
    if "No disponible" in url or url == "None" or url == "NA" or url == "":
        url = ""
    if obs == "None" or obs == "NA":
        obs = ""
    excel_rows.append({
        "title_norm": normalize(str(title)),
        "title": str(title).strip(),
        "url": url,
        "obs": obs,
    })

has_url = sum(1 for r in excel_rows if r["url"])
has_obs = sum(1 for r in excel_rows if r["obs"])
print(f"  Total: {len(excel_rows)} libros, {has_url} con URL, {has_obs} con observaciones")

# ── 2. Fetch all books from Supabase ──
print("🔄 Fetching books from Supabase...")
all_books = []
offset = 0
while True:
    batch = api_get(f"books?select=id,title,repository_url,notes&offset={offset}&limit=1000")
    if not batch:
        break
    all_books.extend(batch)
    if len(batch) < 1000:
        break
    offset += 1000
print(f"  Found {len(all_books)} books in database")

# Build lookup by normalized title
db_lookup = {}
for b in all_books:
    nt = normalize(b["title"])
    db_lookup[nt] = b

# ── 3. Match and update ──
print("🚀 Updating...")
updated = 0
skipped = 0
no_match = 0

for ex in excel_rows:
    db_book = db_lookup.get(ex["title_norm"])
    if not db_book:
        no_match += 1
        continue

    patch = {}
    # Only update if field is empty in DB
    if ex["url"] and not db_book.get("repository_url"):
        patch["repository_url"] = ex["url"]
    if ex["obs"] and not db_book.get("notes"):
        patch["notes"] = ex["obs"]

    if not patch:
        skipped += 1
        continue

    try:
        status = api_patch("books", db_book["id"], patch)
        if status in (200, 204):
            updated += 1
            fields = ", ".join(patch.keys())
            if updated <= 8:
                print(f"  ✅ [{fields}] {db_book['title'][:55]}")
        else:
            print(f"  ❌ HTTP {status}: {db_book['title'][:40]}")
    except Exception as e:
        print(f"  ❌ Error: {e} — {db_book['title'][:40]}")

print(f"\n{'='*40}")
print(f"✅ Updated:    {updated}")
print(f"⏭️  Skipped:    {skipped} (ya tenían datos)")
print(f"❓ No match:   {no_match}")
print(f"📊 Total Excel: {len(excel_rows)}")
