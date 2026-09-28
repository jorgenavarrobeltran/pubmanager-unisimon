const fs = require('fs');
const path = require('path');
const PizZip = require('pizzip');

const rootDir = process.cwd();
const templatesDir = path.join(rootDir, 'public', 'templates');
const certificadosDir = path.join(rootDir, 'Certificados');
const backupDir = path.join(rootDir, 'templates_backup_' + Date.now());

// 1. Create backup
fs.mkdirSync(backupDir, { recursive: true });
console.log('Created backup directory:', backupDir);

const templateFiles = fs.readdirSync(templatesDir).filter(f => f.endsWith('.docx'));
for (const file of templateFiles) {
  fs.copyFileSync(path.join(templatesDir, file), path.join(backupDir, file));
}
console.log('Backed up', templateFiles.length, 'templates.');

// List of templates to be signed by Vicerrector
const vicerrectorTemplates = [
  'AVAL-CAP-DIVULGACION.docx',
  'Aval-Capítulo-Editorial extranjera.docx',
  'Aval-Capítulo.docx',
  'Aval-Capítulos_DIV.docx',
  'Aval-Libro-Editorial extranjera.docx',
  'Aval-Libro.docx',
  'aval-varioscapitulos-editorial extranjera.docx',
  'Aval-varioscapitulos.docx',
  'Aval_LIB_DIV.docx',
  'Créditos-Cap_editorial_extranjera.docx',
  'Créditos-Capítulo-Proyecto.docx',
  'Créditos-Capítulo-Universidad Simón Bolívar.docx',
  'Créditos-Libro-Proyecto.docx',
  'Créditos-Libro-Universidad Simón Bolívar.docx',
  'Créditos-varioscapitulos-usb.docx'
];

// Evaluacion por pares signed by Jefe de Publicaciones (Jorge Navarro Beltrán)
const jefeTemplates = [
  'Evaluación por pares-jefa de publicaciones.docx'
];

function updateDocx(filePath, type) {
  const buf = fs.readFileSync(filePath);
  const zip = new PizZip(buf);
  let xml = zip.file('word/document.xml').asText();

  if (type === 'vicerrector') {
    // 1. Update intro paragraph
    // Replace "El suscrito Director/director de Conocimiento, Innovación y Apropiación Social de la Universidad Simón Bolívar, delegado para expedir este tipo de certificado, declara que:"
    // With: "El suscrito Vicerrector de Investigación, Extensión e Innovación de la Universidad Simón Bolívar, declara que:"
    xml = xml.replace(
      /(<w:t[^>]*>)El suscrito\s*<\/w:t>.*?<w:t[^>]*>declara que:<\/w:t>/s,
      '$1El suscrito Vicerrector de Investigación, Extensión e Innovación de la Universidad Simón Bolívar, declara que:</w:t>'
    );
    // Also handle case where it's within a single or different run
    xml = xml.replace(
      /El suscrito [dD]irector de Conocimiento, Innovaci[oó]n y Apropiaci[oó]n Social de la Universidad Sim[oó]n Bol[ií]var, delegado para expedir este tipo de certificado, declara que:/g,
      'El suscrito Vicerrector de Investigación, Extensión e Innovación de la Universidad Simón Bolívar, declara que:'
    );

    // 2. Update signature line
    // Replace {autores}______ or {firmante_nombre} or 2698115... with __________________________________
    xml = xml.replace(/<w:t[^>]*>(\{autores\}______|\{firmante_nombre\}|2698115[^<]*)<\/w:t>/g, '<w:t>__________________________________</w:t>');

    // 3. Update title
    // In signature block:
    // Replace "Director de Conocimiento, Innovación y Apropiación Social" with "Vicerrector de Investigación, Extensión e Innovación"
    xml = xml.replace(
      /<w:t[^>]*>Director de Conocimiento, Innovaci[oó]n y Apropiaci[oó]n Social<\/w:t>/g,
      '<w:t>Vicerrector de Investigación, Extensión e Innovación</w:t>'
    );

    // Remove the redundant paragraph that had "Vicerrectoría de Investigación, Extensión e Innovación" right below the title
    // Only if it immediately follows "Vicerrector de Investigación, Extensión e Innovación"
    const redundantParaRegex = /<w:p\b[^>]*>(?:(?!<\/w:p>).)*?<w:t[^>]*>Vicerrector[ií]a de Investigaci[oó]n, Extensi[oó]n e Innovaci[oó]n<\/w:t>.*?<\/w:p>/g;
    xml = xml.replace(redundantParaRegex, '');

  } else if (type === 'jefe') {
    // 1. Update intro paragraph
    xml = xml.replace(
      /La suscrita jefa de Publicaciones de la Universidad Sim[oó]n Bol[ií]var, declara que:/g,
      'El suscrito Jefe del Departamento de Publicaciones de la Universidad Simón Bolívar, declara que:'
    );
    // Also in case of split tags:
    xml = xml.replace(
      /(<w:t[^>]*>)La suscrita jefa de Publicaciones.*?<w:t[^>]*>declara que:<\/w:t>/s,
      '$1El suscrito Jefe del Departamento de Publicaciones de la Universidad Simón Bolívar, declara que:</w:t>'
    );

    // 2. Update signature line
    xml = xml.replace(/<w:t[^>]*>\{firmante_nombre\}<\/w:t>/g, '<w:t>__________________________________</w:t>');

    // 3. Update name
    xml = xml.replace(
      /<w:t[^>]*>DHAYANA CAROLINA FERN[AÁ]NDEZ MATOS<\/w:t>/g,
      '<w:t>JORGE ARMANDO NAVARRO BELTRÁN</w:t>'
    );

    // 4. Update ID
    xml = xml.replace(
      /<w:t[^>]*>C\.<\/w:t>\s*<w:r[^>]*>.*?<w:t[^>]*>E\.\s*581\.440<\/w:t>/g,
      '<w:t>C.C. 1.045.683.896</w:t>'
    );
    xml = xml.replace(
      /<w:t[^>]*>C\.E\.\s*581\.440<\/w:t>/g,
      '<w:t>C.C. 1.045.683.896</w:t>'
    );

    // 5. Update title
    xml = xml.replace(
      /<w:t[^>]*>Jefa de Publicaciones<\/w:t>/g,
      '<w:t>Jefe del Departamento de Publicaciones</w:t>'
    );
  }

  zip.file('word/document.xml', xml);
  const outBuf = zip.generate({
    type: 'nodebuffer',
    compression: 'DEFLATE'
  });
  fs.writeFileSync(filePath, outBuf);
}

// Update public/templates
for (const file of vicerrectorTemplates) {
  const p = path.join(templatesDir, file);
  if (fs.existsSync(p)) {
    updateDocx(p, 'vicerrector');
    console.log('[Vicerrector] Updated public/templates/' + file);
  }
}

for (const file of jefeTemplates) {
  const p = path.join(templatesDir, file);
  if (fs.existsSync(p)) {
    updateDocx(p, 'jefe');
    console.log('[Jefe Publicaciones] Updated public/templates/' + file);
  }
}

// Update Certificados folder recursively
function findAndSync(dir) {
  if (!fs.existsSync(dir)) return;
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      findAndSync(fullPath);
    } else if (entry.isFile() && entry.name.endsWith('.docx')) {
      const matchV = vicerrectorTemplates.find(t => t.toLowerCase() === entry.name.toLowerCase());
      if (matchV) {
        updateDocx(fullPath, 'vicerrector');
        console.log('[Vicerrector] Updated ' + fullPath);
      }
      const matchJ = jefeTemplates.find(t => t.toLowerCase() === entry.name.toLowerCase());
      if (matchJ) {
        updateDocx(fullPath, 'jefe');
        console.log('[Jefe Publicaciones] Updated ' + fullPath);
      }
    }
  }
}
findAndSync(certificadosDir);

console.log('Update script completed successfully.');
