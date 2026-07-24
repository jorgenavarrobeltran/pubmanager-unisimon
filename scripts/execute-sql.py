#!/usr/bin/env python3
"""Execute SQL batches against Supabase using the Management API."""
import glob
import json
import os
import sys
import time
import urllib.request
import urllib.error

# Supabase Management API
SUPABASE_PROJECT_ID = "yonklzparwtjdwzltivr"

# Get access token from Supabase CLI or environment
def get_access_token():
    """Get Supabase access token."""
    # Try from environment
    token = os.environ.get("SUPABASE_ACCESS_TOKEN")
    if token:
        return token
    
    # Try from CLI config
    config_path = os.path.expanduser("~/.config/supabase/access-token")
    if os.path.exists(config_path):
        with open(config_path) as f:
            return f.read().strip()
    
    # Try from newer config location
    config_path2 = os.path.expanduser("~/.supabase/access-token")
    if os.path.exists(config_path2):
        with open(config_path2) as f:
            return f.read().strip()
    
    return None


def execute_sql_mgmt_api(sql, access_token):
    """Execute SQL via Supabase Management API."""
    url = f"https://api.supabase.com/v1/projects/{SUPABASE_PROJECT_ID}/database/query"
    headers = {
        "Authorization": f"Bearer {access_token}",
        "Content-Type": "application/json",
    }
    data = json.dumps({"query": sql}).encode()
    req = urllib.request.Request(url, data=data, headers=headers, method="POST")
    
    try:
        with urllib.request.urlopen(req, timeout=60) as resp:
            result = json.loads(resp.read().decode())
            return True, result
    except urllib.error.HTTPError as e:
        error_body = e.read().decode()
        return False, f"HTTP {e.code}: {error_body}"
    except Exception as e:
        return False, str(e)


def main():
    batch_dir = os.path.join(os.path.dirname(__file__), "output", "batch10")
    
    access_token = get_access_token()
    if not access_token:
        print("ERROR: No Supabase access token found.")
        print("Set SUPABASE_ACCESS_TOKEN environment variable or run 'supabase login'")
        sys.exit(1)
    
    # Define execution order
    patterns = [
        ("books_*.sql", "Books"),
        ("chapters_*.sql", "Chapters"),
        ("people_*.sql", "People"),
        ("authors_*.sql", "Book Authors"),
    ]
    
    for pattern, label in patterns:
        files = sorted(glob.glob(os.path.join(batch_dir, pattern)))
        if not files:
            print(f"\nSkipping {label}: no files found")
            continue
        
        print(f"\n{'='*60}")
        print(f"Executing {label}: {len(files)} batches")
        print(f"{'='*60}")
        
        success_count = 0
        error_count = 0
        
        for i, filepath in enumerate(files):
            with open(filepath) as f:
                sql = f.read()
            
            ok, result = execute_sql_mgmt_api(sql, access_token)
            
            if ok:
                success_count += 1
                print(f"  ✅ [{i+1}/{len(files)}] {os.path.basename(filepath)}")
            else:
                error_count += 1
                print(f"  ❌ [{i+1}/{len(files)}] {os.path.basename(filepath)}: {result[:200]}")
            
            # Small delay to avoid rate limiting
            time.sleep(0.3)
        
        print(f"\n  {label}: {success_count} success, {error_count} errors")
    
    print(f"\n{'='*60}")
    print("DONE!")


if __name__ == "__main__":
    main()
