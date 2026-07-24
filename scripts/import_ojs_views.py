#!/usr/bin/env python3
"""
OJS Views CSV Importer for PubManager.
Usage: python3 import_ojs_views.py <csv_file> <journal_name_substring>
"""

import csv, sys, os, json, urllib.request, ssl

ssl._create_default_https_context = ssl._create_unverified_context

SUPABASE_URL = "https://yonklzparwtjdwzltivr.supabase.co"
SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlvbmtsenBhcnd0amR3emx0aXZyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODExMjA1MTksImV4cCI6MjA5NjY5NjUxOX0.Q8qQwV-LXd262RfibOTiggSB0YjwpZH1vmxwOtyItZM"

def api(method, table, data=None, params=""):
    url = f"{SUPABASE_URL}/rest/v1/{table}?{params}"
    headers = {"apikey": SUPABASE_KEY, "Authorization": f"Bearer {SUPABASE_KEY}",
               "Content-Type": "application/json", "Prefer": "return=representation"}
    body = json.dumps(data).encode() if data else None
    req = urllib.request.Request(url, data=body, headers=headers, method=method)
    try:
        with urllib.request.urlopen(req) as resp:
            return json.loads(resp.read().decode())
    except urllib.error.HTTPError as e:
        print(f"  ⚠ API error {e.code}: {e.read().decode()[:200]}")
        return None

def find_journal(name_substr):
    journals = api("GET", "journals", params="select=id,name")
    matches = [j for j in (journals or []) if name_substr.lower() in j['name'].lower()]
    if len(matches) != 1:
        print(f"ERROR: Found {len(matches)} matches for '{name_substr}'")
        sys.exit(1)
    return matches[0]

def parse_int(s):
    try: return int(s.strip().replace(',',''))
    except: return 0

if __name__ == "__main__":
    if len(sys.argv) < 3:
        print('Uso: python3 import_ojs_views.py <csv_file> "<nombre_revista>"')
        sys.exit(1)
    
    csv_path, journal_search = sys.argv[1], sys.argv[2]
    journal = find_journal(journal_search)
    journal_id = journal['id']
    print(f"✓ Revista: {journal['name']} ({journal_id})")
    
    with open(csv_path, 'r', encoding='utf-8-sig') as f:
        reader = csv.DictReader(f)
        reader.fieldnames = [k.strip().strip('"').strip('\ufeff').strip('"') for k in reader.fieldnames]
        rows = list(reader)
    
    print(f"👁 Total filas: {len(rows)}")
    
    imported = 0
    errors = 0
    
    for row in rows:
        ojs_id = parse_int(row.get('ID del artículo', ''))
        if not ojs_id: continue
        
        # Sum all galley types for "other"
        pdf = parse_int(row.get('PDF', ''))
        pdf_en = parse_int(row.get('PDF (English)', '')) + parse_int(row.get('ENGLISH PDF', ''))
        html = parse_int(row.get('HTML', ''))
        xml = parse_int(row.get('XML', ''))
        pdf_completo = parse_int(row.get('PDF COMPLETO', ''))
        traduccion = parse_int(row.get('Traducción (PDF)', ''))
        total_pdf = pdf + pdf_en + pdf_completo + traduccion
        
        rec = {
            'article_ojs_id': ojs_id,
            'journal_id': journal_id,
            'title': row.get('Título del artículo', '').strip()[:500] or None,
            'issue': row.get('Número', '').strip() or None,
            'pub_date': row.get('Fecha de publicación', '').strip() or None,
            'abstract_views': parse_int(row.get('Vistas del resumen', '')),
            'total_galley_views': parse_int(row.get('Total de vistas de la galerada', '')),
            'pdf_views': total_pdf,
            'pdf_english_views': pdf_en,
            'html_views': html,
            'xml_views': xml,
            'other_views': traduccion,
        }
        
        result = api("POST", "article_views", rec)
        if result:
            imported += 1
        else:
            errors += 1
    
    print(f"\n✅ Importación completada: {imported} vistas, {errors} errores")
