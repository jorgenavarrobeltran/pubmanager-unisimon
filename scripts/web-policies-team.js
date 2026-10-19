// Read-only: policies + team info for web prototype
const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');
const env = Object.fromEntries(
  fs.readFileSync(path.join(__dirname, '..', '.env.local'), 'utf8')
    .split(/\r?\n/).filter(l => l.includes('=') && !l.startsWith('#'))
    .map(l => { const i = l.indexOf('='); return [l.slice(0, i).trim(), l.slice(i + 1).trim().replace(/^"|"$/g, '')]; })
);
const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY || env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
(async () => {
  console.log('service key?', !!env.SUPABASE_SERVICE_ROLE_KEY);
  const p = await sb.from('policies').select('*');
  console.log('policies', p.error ? p.error.message : JSON.stringify(p.data, null, 1));
  const s = await sb.storage.from('policies_files').list('policies', { limit: 100 });
  console.log('storage policies/', s.error ? s.error.message : s.data.map(f => f.name));
  const s2 = await sb.storage.from('policies_files').list('', { limit: 100 });
  console.log('storage root', s2.error ? s2.error.message : s2.data.map(f => f.name));
  const b = await sb.storage.listBuckets();
  console.log('buckets', b.error ? b.error.message : b.data.map(x => x.name));
  const u = await sb.from('user_profiles').select('full_name, email, role, active').eq('active', true).order('full_name');
  console.log('team', JSON.stringify(u.data, null, 1));
})();
