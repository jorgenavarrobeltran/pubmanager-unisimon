#!/usr/bin/env python3
"""
OJS Reviews CSV Importer for PubManager.
Usage: python3 import_ojs_reviews.py <csv_file> <journal_name_substring>
"""

import csv, sys, os, json, urllib.request, ssl
from datetime import datetime

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

def parse_date(s):
    if not s or not s.strip(): return None
    s = s.strip()
    for fmt in ["%Y-%m-%d %H:%M:%S", "%Y-%m-%d"]:
        try: return datetime.strptime(s, fmt).isoformat() + "+00:00"
        except ValueError: pass
    return None

def parse_bool(s):
    return s.strip().lower() in ('sí', 'si', 'yes', 'true', '1') if s else False

def parse_int(s):
    try: return int(s.strip())
    except: return None

if __name__ == "__main__":
    if len(sys.argv) < 3:
        print('Uso: python3 import_ojs_reviews.py <csv_file> "<nombre_revista>"')
        sys.exit(1)
    
    csv_path, journal_search = sys.argv[1], sys.argv[2]
    journal = find_journal(journal_search)
    journal_id = journal['id']
    print(f"✓ Revista: {journal['name']} ({journal_id})")
    
    with open(csv_path, 'r', encoding='utf-8-sig') as f:
        reader = csv.DictReader(f)
        reader.fieldnames = [k.strip().strip('"').strip('\ufeff').strip('"') for k in reader.fieldnames]
        rows = list(reader)
    
    print(f"📋 Total filas: {len(rows)}")
    
    imported = 0
    errors = 0
    
    for row in rows:
        ojs_id = parse_int(row.get('ID del envío', ''))
        if not ojs_id: continue
        
        rec = {
            'article_ojs_id': ojs_id,
            'journal_id': journal_id,
            'phase': row.get('Fase', '').strip() or None,
            'round': parse_int(row.get('Ronda', '1')) or 1,
            'reviewer_username': row.get('Revisor/a', '').strip() or None,
            'reviewer_first_name': row.get('Nombre', '').strip() or None,
            'reviewer_last_name': row.get('Apellidos', '').strip() or None,
            'reviewer_orcid': row.get('Identificador ORCID', '').strip() or None,
            'reviewer_country': row.get('País', '').strip() or None,
            'reviewer_affiliation': row.get('Afiliación', '').strip() or None,
            'reviewer_email': row.get('Correo electrónico', '').strip() or None,
            'review_interests': row.get('Intereses de revisión', '').strip() or None,
            'date_assigned': parse_date(row.get('Fecha asignada', '')),
            'date_notified': parse_date(row.get('Fecha notificada', '')),
            'date_confirmed': parse_date(row.get('Fecha confirmada', '')),
            'date_completed': parse_date(row.get('Fecha completada', '')),
            'unconsidered': row.get('Sin considerar', '').strip() or None,
            'date_reminder': parse_date(row.get('Fecha recordatorio', '')),
            'date_response_due': parse_date(row.get('Fecha límite de la contestación', '')),
            'days_response_overdue': parse_int(row.get('Días de vencimiento de la respuesta', '')),
            'date_review_due': parse_date(row.get('Fecha límite de la revisión', '')),
            'days_review_overdue': parse_int(row.get('Días de vencimiento de la revisión', '')),
            'declined': parse_bool(row.get('Rechazado', '')),
            'cancelled': parse_bool(row.get('Cancelado', '')),
            'recommendation': row.get('Recomendación', '').strip() or None,
            'comments': (row.get('Comentarios sobre el envío', '') or '').strip()[:10000] or None,
        }
        
        result = api("POST", "article_reviews", rec)
        if result:
            imported += 1
            if imported % 50 == 0:
                print(f"   ✓ {imported} revisiones...")
        else:
            errors += 1
    
    print(f"\n✅ Importación completada: {imported} revisiones, {errors} errores")
