const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const env = Object.fromEntries(fs.readFileSync('.env.local', 'utf8').split('\n').filter(l => l.includes('=')).map(l => {
  const [k, ...v] = l.split('=');
  return [k.trim(), v.join('=').trim()];
}));
const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY);

async function run() {
  const { data, error } = await supabase.from('certificates')
    .select('id, consecutive_number, recipient_name, title_reference, certificate_type, publication_type, status, requester_name, requester_email, request_channel, created_at')
    .order('consecutive_number', { ascending: true });
  if (error) { console.error(error); return; }

  console.log('Total certificados:', data.length);
  console.log('='.repeat(120));
  data.forEach(c => {
    const short = (c.recipient_name || '').substring(0, 55);
    const title = (c.title_reference || '').substring(0, 45);
    const req = c.requester_name ? 'REQ=' + c.requester_name : 'SIN_REQ';
    const ch = c.request_channel || '-';
    console.log('#' + c.consecutive_number + ' | ' + c.status.padEnd(10) + ' | ' + ch.padEnd(11) + ' | ' + req.padEnd(20).substring(0,20) + ' | ' + short.padEnd(55) + ' | ' + title);
  });
}
run();
