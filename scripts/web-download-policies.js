// Read-only download of editorial policy files into the web prototype (assets/docs)
const fs = require('fs');
const path = require('path');
const env = Object.fromEntries(
  fs.readFileSync(path.join(__dirname, '..', '.env.local'), 'utf8')
    .split(/\r?\n/).filter(l => l.includes('=') && !l.startsWith('#'))
    .map(l => { const i = l.indexOf('='); return [l.slice(0, i).trim(), l.slice(i + 1).trim().replace(/^"|"$/g, '')]; })
);
const files = {
  '1781463786151_Lineamiento__de_publicaci_n_2026_VF__2_.pdf': 'lineamiento-de-publicacion-2026.pdf',
  '1781463787848_Comit__editorial.pdf': 'comite-editorial.pdf',
  '1781463788835_Lineamientos_editoriales_Dpto_publicaciones.pdf': 'lineamientos-editoriales.pdf',
  '1781463789335_Politica_editorial_Dpto_publicaciones.pdf': 'politica-editorial.pdf',
};
const outDir = path.join(__dirname, '..', 'web-ediciones-unisimon', 'assets', 'docs');
fs.mkdirSync(outDir, { recursive: true });
(async () => {
  for (const [src, dst] of Object.entries(files)) {
    const url = `${env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/policies_files/policies/${src}`;
    const r = await fetch(url);
    if (!r.ok) { console.log('FAIL', src, r.status); continue; }
    const buf = Buffer.from(await r.arrayBuffer());
    fs.writeFileSync(path.join(outDir, dst), buf);
    console.log('ok', dst, buf.length);
  }
})();
