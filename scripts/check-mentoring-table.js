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
  const { data, error } = await supabase.from('mentoring_sessions').select('id').limit(1);
  console.log('mentoring_sessions:', error ? error.message : `EXISTS (${data.length})`);
  const { data: bData, error: bError } = await supabase.from('books').select('id').limit(1);
  console.log('books:', bError ? bError.message : `EXISTS (${bData.length})`);
}

check().catch(console.error);
