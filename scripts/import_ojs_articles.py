#!/usr/bin/env python3
"""
OJS CSV Importer for PubManager.
Usage: python3 import_ojs_articles.py <csv_file> <journal_name_substring>

Imports articles, authors, and editorial decisions from an OJS CSV export.
Matches journal by name substring (case-insensitive).
Skips duplicates based on ojs_id + journal_id.
"""

import csv
import sys
import os
import json
from datetime import datetime

# Supabase REST API
SUPABASE_URL = "https://yonklzparwtjdwzltivr.supabase.co"
SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlvbmtsenBhcnd0amR3emx0aXZyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODExMjA1MTksImV4cCI6MjA5NjY5NjUxOX0.Q8qQwV-LXd262RfibOTiggSB0YjwpZH1vmxwOtyItZM"

import urllib.request
import ssl

# Fix macOS SSL cert issue
ssl._create_default_https_context = ssl._create_unverified_context

def api(method, table, data=None, params=""):
    url = f"{SUPABASE_URL}/rest/v1/{table}?{params}"
    headers = {
        "apikey": SUPABASE_KEY,
        "Authorization": f"Bearer {SUPABASE_KEY}",
        "Content-Type": "application/json",
        "Prefer": "return=representation",
    }
    body = json.dumps(data).encode() if data else None
    req = urllib.request.Request(url, data=body, headers=headers, method=method)
    try:
        with urllib.request.urlopen(req) as resp:
            return json.loads(resp.read().decode())
    except urllib.error.HTTPError as e:
        err = e.read().decode()
        print(f"  ⚠ API error {e.code}: {err[:200]}")
        return None


def find_journal(name_substr):
    """Find journal by name substring."""
    journals = api("GET", "journals", params="select=id,name")
    if not journals:
        print("ERROR: No se pudieron obtener las revistas")
        sys.exit(1)
    
    matches = [j for j in journals if name_substr.lower() in j['name'].lower()]
    if len(matches) == 0:
        print(f"ERROR: No se encontró ninguna revista con '{name_substr}'")
        print("Revistas disponibles:")
        for j in journals:
            print(f"  - {j['name']}")
        sys.exit(1)
    if len(matches) > 1:
        print(f"AMBIGUO: Múltiples revistas contienen '{name_substr}':")
        for j in matches:
            print(f"  - {j['name']} ({j['id']})")
        sys.exit(1)
    
    return matches[0]


def parse_date(s):
    """Parse OJS date string."""
    if not s or not s.strip():
        return None
    s = s.strip()
    try:
        dt = datetime.strptime(s, "%Y-%m-%d %H:%M:%S")
        return dt.isoformat() + "+00:00"
    except ValueError:
        try:
            dt = datetime.strptime(s, "%Y-%m-%d")
            return dt.isoformat() + "+00:00"
        except ValueError:
            return None


def import_csv(csv_path, journal):
    journal_id = journal['id']
    journal_name = journal['name']
    
    print(f"\n📚 Importando artículos a: {journal_name}")
    print(f"   Journal ID: {journal_id}")
    print(f"   Archivo: {csv_path}\n")
    
    with open(csv_path, 'r', encoding='utf-8-sig') as f:
        reader = csv.DictReader(f)
        # Clean header keys: remove BOM, extra quotes, whitespace
        reader.fieldnames = [k.strip().strip('"').strip('\ufeff').strip('"') for k in reader.fieldnames]
        rows = list(reader)
    
    print(f"   Total filas en CSV: {len(rows)}")
    
    # Check existing articles for this journal
    existing = api("GET", "journal_articles", params=f"select=ojs_id&journal_id=eq.{journal_id}")
    existing_ids = {r['ojs_id'] for r in (existing or []) if r['ojs_id']}
    print(f"   Artículos ya importados: {len(existing_ids)}")
    
    imported = 0
    skipped = 0
    errors = 0
    
    for i, row in enumerate(rows):
        ojs_id = row.get('Id. del envío', '').strip()
        if not ojs_id:
            continue
        
        try:
            ojs_id = int(ojs_id)
        except ValueError:
            continue
        
        if ojs_id in existing_ids:
            skipped += 1
            continue
        
        title = row.get('Título', '').strip()
        if not title:
            continue
        
        # Filter out non-article sections (preliminares, contenido, presentación, etc.)
        section = row.get('Título de sección', '').strip()
        
        # Build article record
        article = {
            'journal_id': journal_id,
            'ojs_id': ojs_id,
            'title': title[:500],
            'abstract': (row.get('Resumen', '') or '').strip()[:10000] or None,
            'section': section or None,
            'language': row.get('Idioma', 'es_ES').strip() or 'es_ES',
            'keywords': row.get('Palabras clave', '').strip() or None,
            'doi': row.get('DOI', '').strip() or None,
            'ojs_url': row.get('URL', '').strip() or None,
            'status': row.get('Estado', 'Envío').strip() or 'Envío',
            'submission_date': parse_date(row.get('Fecha de envío', '')),
            'last_modified': parse_date(row.get('Última modificación', '')),
            'coverage': row.get('Cobertura', '').strip() or None,
            'rights': row.get('Derechos', '').strip() or None,
            'source': row.get('Fuente', '').strip() or None,
            'subjects': row.get('Asuntos', '').strip() or None,
            'article_type': row.get('Tipo', '').strip() or None,
            'disciplines': row.get('Disciplina(s)', '').strip() or None,
            'support_agencies': row.get('Agencias de apoyo', '').strip() or None,
        }
        
        result = api("POST", "journal_articles", article)
        if not result or len(result) == 0:
            errors += 1
            continue
        
        article_id = result[0]['id']
        
        # Import authors (up to 10)
        for a_idx in range(1, 11):
            first = row.get(f'Nombre (Autor/a {a_idx})', '').strip()
            last = row.get(f'Apellidos (Autor/a {a_idx})', '').strip()
            if not first and not last:
                break
            
            author = {
                'article_id': article_id,
                'author_order': a_idx,
                'first_name': first or None,
                'last_name': last or None,
                'orcid': row.get(f'Identificador ORCID (Autor/a {a_idx})', '').strip() or None,
                'country': row.get(f'País (Autor/a {a_idx})', '').strip() or None,
                'affiliation': row.get(f'Afiliación (Autor/a {a_idx})', '').strip() or None,
                'email': row.get(f'Correo electrónico (Autor/a {a_idx})', '').strip() or None,
                'url': row.get(f'URL (Autor/a {a_idx})', '').strip() or None,
                'bio': row.get(f'Resumen biográfico (Autor/a {a_idx})', '').strip()[:5000] or None,
            }
            api("POST", "article_authors", author)
        
        # Import editorial decisions (up to 4 editors x 5 rounds)
        for e_idx in range(1, 5):
            ed_first = row.get(f'Nombre (Editor/a {e_idx})', '').strip()
            ed_last = row.get(f'Apellidos (Editor/a {e_idx})', '').strip()
            if not ed_first and not ed_last:
                continue
            
            ed_orcid = row.get(f'Identificador ORCID (Editor/a {e_idx})', '').strip() or None
            ed_email = row.get(f'Correo electrónico (Editor/a {e_idx})', '').strip() or None
            
            for d_idx in range(1, 6):
                decision = row.get(f'Decisión del editor/a {d_idx}  (Editor/a {e_idx})', '').strip()
                date_str = row.get(f'Fecha decidida {d_idx}  (Editor/a {e_idx})', '').strip()
                
                if not decision:
                    continue
                
                dec_record = {
                    'article_id': article_id,
                    'editor_order': e_idx,
                    'editor_first_name': ed_first or None,
                    'editor_last_name': ed_last or None,
                    'editor_orcid': ed_orcid,
                    'editor_email': ed_email,
                    'decision_round': d_idx,
                    'decision': decision,
                    'decision_date': parse_date(date_str),
                }
                api("POST", "editorial_decisions", dec_record)
        
        imported += 1
        if (imported % 50) == 0:
            print(f"   ✓ {imported} artículos importados...")
    
    print(f"\n{'='*50}")
    print(f"✅ Importación completada")
    print(f"   Importados: {imported}")
    print(f"   Omitidos (ya existían): {skipped}")
    print(f"   Errores: {errors}")
    print(f"{'='*50}")


if __name__ == "__main__":
    if len(sys.argv) < 3:
        print("Uso: python3 import_ojs_articles.py <csv_file> <nombre_revista>")
        print('Ejemplo: python3 import_ojs_articles.py articles.csv "Innovación en Ingenierías"')
        sys.exit(1)
    
    csv_path = sys.argv[1]
    journal_search = sys.argv[2]
    
    if not os.path.exists(csv_path):
        print(f"ERROR: Archivo no encontrado: {csv_path}")
        sys.exit(1)
    
    journal = find_journal(journal_search)
    print(f"✓ Revista encontrada: {journal['name']}")
    
    import_csv(csv_path, journal)
