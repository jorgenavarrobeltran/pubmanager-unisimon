const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

const envContent = fs.readFileSync('c:\\Users\\jorge.navarro\\OneDrive\\Unisimon\\pubmanager-unisimon\\.env.local', 'utf8');
envContent.split('\n').forEach(line => {
  const match = line.match(/^([^#=]+)=(.+)$/);
  if (match) process.env[match[1].trim()] = match[2].trim();
});

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

async function check() {
  const rpcs = ['exec_sql', 'execute_sql', 'run_sql', 'exec', 'query'];
  for (const r of rpcs) {
    const { data, error } = await supabase.rpc(r, { query: 'SELECT 1;' });
    console.log(`RPC ${r}:`, error ? error.message : 'SUCCESS');
  }
}

check().catch(console.error);
