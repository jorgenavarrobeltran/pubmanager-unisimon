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
  const { data: pData, error: pErr } = await supabase.from('profiles').select('*').limit(3);
  console.log('profiles table:', pErr ? pErr.message : `FOUND (${pData.length})`);
  const { data: upData, error: upErr } = await supabase.from('user_profiles').select('*').limit(3);
  console.log('user_profiles table:', upErr ? upErr.message : `FOUND (${upData.length})`);
  if (upData) console.log('user_profiles fields:', Object.keys(upData[0] || {}));
}

check().catch(console.error);
