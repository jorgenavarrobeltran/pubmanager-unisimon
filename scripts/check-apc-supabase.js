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
  console.log('Checking Supabase tables...');
  const { data: pData, error: pErr } = await supabase.from('apc_payments').select('id').limit(1);
  console.log('apc_payments:', pErr ? `NOT FOUND / Error (${pErr.message})` : `FOUND (${pData.length} records)`);

  const { data: bData, error: bErr } = await supabase.from('apc_annual_budgets').select('id').limit(1);
  console.log('apc_annual_budgets:', bErr ? `NOT FOUND / Error (${bErr.message})` : `FOUND (${bData.length} records)`);

  const { data: users, error: uErr } = await supabase.from('user_profiles').select('*');
  console.log('Total user_profiles:', users ? users.length : 0);
  if (users) {
    const fernando = users.find(u => u.email && u.email.toLowerCase().includes('fernando.penaranda'));
    console.log('Fernando Peñaranda in user_profiles:', fernando ? JSON.stringify(fernando) : 'NOT FOUND');
    console.log('Existing users:');
    users.forEach(u => console.log(`  - ${u.email} | ${u.full_name} | ${u.role}`));
  }
}

check().catch(console.error);
