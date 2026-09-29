const PizZip = require('pizzip');
const fs = require('fs');

const files = [
  'public/templates/Certificado para EDITORIAL EXTRANJERA_capítulo_libro.docx',
  'public/templates/Certificado para EDITORIAL EXTRANJERA_libro.docx',
  'public/templates/Aval-Capítulo-Editorial extranjera.docx',
  'public/templates/Aval-Libro-Editorial extranjera.docx',
  'public/templates/aval-varioscapitulos-editorial extranjera.docx',
  'Certificados/Avales/Editorial-Extranjera/Certificado para EDITORIAL EXTRANJERA_capítulo_libro.docx',
  'Certificados/Avales/Editorial-Extranjera/Certificado para EDITORIAL EXTRANJERA_libro.docx',
  'Certificados/Avales/Editorial-Extranjera/Aval-Capítulo-Editorial extranjera.docx',
  'Certificados/Avales/Editorial-Extranjera/Aval-Libro-Editorial extranjera.docx',
  'Certificados/Avales/Editorial-Extranjera/aval-varioscapitulos-editorial extranjera.docx'
];

files.forEach(p => {
  if (!fs.existsSync(p)) return;
  const zip = new PizZip(fs.readFileSync(p));
  let xml = zip.file('word/document.xml').asText();

  // 1. Replace EXTRANJERA with EXTERNA in title and text
  xml = xml.replace(/POR EDITORIAL EXTRANJERA/g, 'POR EDITORIAL EXTERNA');
  xml = xml.replace(/editorial extranjera/gi, 'editorial externa');
  xml = xml.replace(/CAPÏTULO/g, 'CAPÍTULO');

  // 2. Fix year 202 4 to {anio_expedicion}
  xml = xml.replace(/año 202<\/w:t>[^<]*<w:t>4<\/w:t>/g, 'año {anio_expedicion}</w:t>');
  xml = xml.replace(/202<\/w:t>[^<]*<w:t>4<\/w:t>/g, '{anio_expedicion}</w:t>');
  xml = xml.replace(/año 202\s*4/g, 'año {anio_expedicion}');

  // 3. Fix P UBLICACION
  xml = xml.replace(/>P<\/w:t><\/w:r><w:r[^>]*><w:rPr>[\s\S]*?<\/w:rPr><w:t>UBLICACIÓN<\/w:t>/g, '>PUBLICACIÓN</w:t>');

  zip.file('word/document.xml', xml);
  fs.writeFileSync(p, zip.generate({ type: 'nodebuffer', compression: 'DEFLATE' }));
  console.log('Updated:', p);
});
console.log('All templates updated successfully!');
