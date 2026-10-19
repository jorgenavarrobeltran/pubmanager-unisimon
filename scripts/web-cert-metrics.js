// Read-only: certificate metrics for web prototype
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
  const { data, error } = await sb.from('certificates').select('certificate_type, status, consecutive_number, created_at');
  if (error) { console.error(error); return; }
  const by = (k) => data.reduce((a, r) => (a[r[k]] = (a[r[k]] || 0) + 1, a), {});
  console.log('total', data.length);
  console.log('type', by('certificate_type'));
  console.log('status', by('status'));
  console.log('max consecutive', Math.max(...data.map(r => r.consecutive_number || 0)));
  console.log('first created', data.map(r => r.created_at).sort()[0]);
  const m = await sb.from('mentoring_sessions').select('*', { count: 'exact', head: true });
  console.log('mentoring_sessions', m.count, m.error && m.error.message);
})();
