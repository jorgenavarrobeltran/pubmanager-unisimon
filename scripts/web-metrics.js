// Extrae métricas reales de PubManager para la propuesta de página web de Ediciones Unisimón
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const env = Object.fromEntries(fs.readFileSync('.env.local', 'utf8').split('\n').filter(l => l.includes('=')).map(l => {
  const [k, ...v] = l.split('=');
  return [k.trim(), v.join('=').trim()];
}));
const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY);

const countBy = (arr, fn) => arr.reduce((acc, x) => { const k = fn(x) ?? '(vacío)'; acc[k] = (acc[k] || 0) + 1; return acc; }, {});

async function safe(table, select = '*') {
  const { data, error } = await supabase.from(table).select(select);
  if (error) return { error: error.message, data: [] };
  return { data };
}

async function run() {
  const out = {};

  // Libros
  const books = await safe('books');
  out.books_total = books.data.length;
  if (books.data[0]) out.books_columns = Object.keys(books.data[0]);
  out.books_by_year = countBy(books.data, b => b.year_published);
  out.books_by_type = countBy(books.data, b => b.book_type);
  out.books_by_status = countBy(books.data, b => b.status);
  out.books_by_editorial = countBy(books.data, b => b.editorial);
  out.books_sample = books.data.slice(0, 3);

  // Capítulos
  const chapters = await safe('book_chapters', 'id');
  out.chapters_total = chapters.data.length;

  // Autores
  const people = await safe('people', 'id');
  out.people_total = people.data.length;

  // Revistas
  const journals = await safe('journals');
  out.journals_total = journals.data.length;
  if (journals.data[0]) out.journals_columns = Object.keys(journals.data[0]);
  out.journals = journals.data.map(j => ({ name: j.name, type: j.type, area: j.area, status: j.status, issn_print: j.issn_print, issn_online: j.issn_online, h_index: j.h_index, ojs_url: j.ojs_url, editor: j.editor_name }));

  const idx = await safe('journal_indexations');
  if (idx.data[0]) out.indexations_columns = Object.keys(idx.data[0]);
  out.indexations = idx.data;

  const metrics = await safe('journal_metrics');
  if (metrics.data[0]) out.metrics_columns = Object.keys(metrics.data[0]);
  out.metrics_count = metrics.data.length;
  out.metrics_sample = metrics.data.slice(0, 10);

  // Certificados
  const certs = await safe('certificates', 'document_category, status, issue_date, created_at');
  out.certs_total = certs.data.length;
  out.certs_by_category = countBy(certs.data, c => c.document_category);
  out.certs_by_status = countBy(certs.data, c => c.status);

  // Mentorías
  const ment = await safe('mentoring_sessions');
  out.mentoring_total = ment.data.length;
  if (ment.data[0]) out.mentoring_columns = Object.keys(ment.data[0]);
  out.mentoring_by_year = countBy(ment.data, m => (m.session_date || '').slice(0, 4));
  out.mentoring_by_type = countBy(ment.data, m => m.session_type || m.type || m.modality);
  const researchers = await safe('researchers', 'id');
  out.researchers_total = researchers.data.length;
  const groups = await safe('research_groups', 'id');
  out.research_groups_total = groups.data.length;

  // Equipo
  const team = await safe('user_profiles', 'full_name, role, position, active, email');
  out.team = team.data.filter(u => u.active !== false);
  if (team.error) out.team_error = team.error;

  // Políticas / documentos
  const pol = await safe('policies', 'title, category, file_url, created_at');
  out.policies = pol.data;
  if (pol.error) out.policies_error = pol.error;

  // Servicios externos
  const ext = await safe('external_services', 'service_type, status, client_name, created_at');
  out.external_services_total = ext.data.length;
  out.external_by_type = countBy(ext.data, e => e.service_type);

  // APC
  const apc = await safe('apc_payments');
  out.apc_total = apc.data.length;
  if (apc.error) out.apc_error = apc.error;
  if (apc.data[0]) out.apc_columns = Object.keys(apc.data[0]);

  fs.writeFileSync('scripts/web-metrics-output.json', JSON.stringify(out, null, 2));
  console.log('OK -> scripts/web-metrics-output.json');
  console.log(JSON.stringify({
    books_total: out.books_total, chapters_total: out.chapters_total, people_total: out.people_total,
    journals_total: out.journals_total, certs_total: out.certs_total, mentoring_total: out.mentoring_total,
    researchers_total: out.researchers_total, research_groups_total: out.research_groups_total,
    external_services_total: out.external_services_total, apc_total: out.apc_total,
  }, null, 2));
}
run();
