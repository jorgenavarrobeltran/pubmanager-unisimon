const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

// Load environment variables
const envPath = 'c:\\Users\\jorge.navarro\\OneDrive\\Unisimon\\pubmanager-unisimon\\.env.local';
const envContent = fs.readFileSync(envPath, 'utf8');
envContent.split('\n').forEach(line => {
  const match = line.match(/^([^#=]+)=(.+)$/);
  if (match) process.env[match[1].trim()] = match[2].trim();
});

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

async function run() {
  console.log('=== IMPORTING APC PAYMENTS & BUDGETS TO SUPABASE ===\n');

  // Check if tables exist
  const { error: tErr } = await supabase.from('apc_payments').select('id').limit(1);
  if (tErr) {
    console.error('❌ Table "apc_payments" does not exist in Supabase yet.');
    console.log('Please execute the migration script in Supabase SQL Editor:');
    console.log('👉 File: scripts/apc-migration.sql');
    console.log('👉 URL: https://supabase.com/dashboard/project/yonklzparwtjdwzltivr/sql/new');
    console.log('\nOnce executed in Supabase, re-run this script to populate all 373 records.\n');
    return;
  }

  // Load JSON data
  const jsonPath = path.join(__dirname, '..', 'src', 'lib', 'apc-initial-data.json');
  const rawData = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
  const { budgets, payments } = rawData;

  console.log(`Found ${budgets.length} budgets and ${payments.length} payments to import.`);

  // 1. Import budgets
  console.log('\n1. Upserting annual budgets...');
  const { data: bData, error: bErr } = await supabase
    .from('apc_annual_budgets')
    .upsert(budgets, { onConflict: 'year' })
    .select();

  if (bErr) {
    console.error('Error importing budgets:', bErr.message);
  } else {
    console.log(`✅ ${bData.length} annual budgets saved.`);
  }

  // 2. Import payments in batches of 50
  console.log('\n2. Inserting APC payments in batches of 50...');
  let inserted = 0;
  for (let i = 0; i < payments.length; i += 50) {
    const batch = payments.slice(i, i + 50).map(p => {
      // Ensure clean object without client-generated temp id if uuid is expected
      const record = { ...p };
      delete record.id; // let Supabase gen_random_uuid() generate the PK
      return record;
    });

    const { data: pData, error: pErr } = await supabase
      .from('apc_payments')
      .insert(batch)
      .select('id');

    if (pErr) {
      console.error(`❌ Error in batch ${i} - ${i + batch.length}:`, pErr.message);
    } else {
      inserted += pData.length;
      console.log(`  ✅ Batch ${i + 1} - ${i + pData.length}: ${pData.length} rows inserted (total: ${inserted}/${payments.length})`);
    }
  }

  console.log(`\n🎉 IMPORT FINISHED! Successfully inserted ${inserted} records.`);
}

run().catch(console.error);
