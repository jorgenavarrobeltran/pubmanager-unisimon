/**
 * Creates 3 variants of the "Evaluación por pares" template:
 * 1. Libro completo (no chapters)
 * 2. Capítulo individual (single chapter)
 * 3. Varios capítulos (multi-chapter with loop)
 */
const PizZip = require('pizzip');
const fs = require('fs');
const path = require('path');

const TEMPLATES_DIR = path.join(__dirname, '..', 'public', 'templates');
const SOURCE_FILE = path.join(TEMPLATES_DIR, 'Evaluación por pares-jefa de publicaciones.docx');

// Read source template
const buf = fs.readFileSync(SOURCE_FILE);
const zip = new PizZip(buf);
const docXml = zip.file('word/document.xml').asText();

// Helper: find the body content between <w:body> tags
function getBodyContent(xml) {
  const bodyMatch = xml.match(/<w:body>([\s\S]*)<\/w:body>/);
  return bodyMatch ? bodyMatch[1] : '';
}

// Helper: extract all <w:p> paragraphs as an array
function extractParagraphs(xml) {
  const paragraphs = [];
  const regex = /<w:p[\s>][\s\S]*?<\/w:p>/g;
  let match;
  while ((match = regex.exec(xml)) !== null) {
    paragraphs.push(match[0]);
  }
  return paragraphs;
}

// Helper: get text content of a paragraph
function getParaText(paraXml) {
  return paraXml.replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();
}

// ============================================================
// Build the certificate body text for each variant
// ============================================================

// Common signature block
const SIGNATURE_NAME = 'JORGE ARMANDO NAVARRO BELTRÁN';
const SIGNATURE_CC = 'C.C. 1.045.683.896';
const SIGNATURE_TITLE = 'Jefe del Departamento de Publicaciones';
const SIGNATURE_INST = 'Universidad Simón Bolívar';

// Find paragraph containing the "El capítulo titulado" text and the one with "Los capítulos"
const bodyContent = getBodyContent(docXml);
const paragraphs = extractParagraphs(bodyContent);

console.log(`Found ${paragraphs.length} paragraphs in source template`);
paragraphs.forEach((p, i) => {
  const text = getParaText(p);
  if (text.length > 10) {
    console.log(`  P${i}: ${text.substring(0, 120)}...`);
  }
});

// Strategy: We'll modify the document.xml directly by replacing the body content.
// We need to keep the header/footer references, section properties, etc.

// Find the sectPr (section properties) - it's usually at the end of the body
const sectPrMatch = bodyContent.match(/<w:sectPr[\s\S]*?<\/w:sectPr>/);
const sectPr = sectPrMatch ? sectPrMatch[0] : '';

// Find the paragraph style used (extract from existing paragraphs)
// We'll reuse the style from the source template's main text paragraph
function findStyleId(paras, searchText) {
  for (const p of paras) {
    if (getParaText(p).includes(searchText)) {
      const styleMatch = p.match(/<w:pStyle w:val="([^"]+)"/);
      return styleMatch ? styleMatch[1] : null;
    }
  }
  return null;
}

// Find the run properties (font, size) from the main text
function findRunProps(paras, searchText) {
  for (const p of paras) {
    if (getParaText(p).includes(searchText)) {
      const rPrMatch = p.match(/<w:rPr>([\s\S]*?)<\/w:rPr>/);
      return rPrMatch ? rPrMatch[0] : '<w:rPr><w:rFonts w:ascii="Century Gothic" w:hAnsi="Century Gothic"/><w:sz w:val="22"/><w:szCs w:val="22"/></w:rPr>';
    }
  }
  return '<w:rPr><w:rFonts w:ascii="Century Gothic" w:hAnsi="Century Gothic"/><w:sz w:val="22"/><w:szCs w:val="22"/></w:rPr>';
}

const mainStyle = findStyleId(paragraphs, 'suscrito') || 'Normal';
const mainRPr = findRunProps(paragraphs, 'suscrito');

// Helper to create a paragraph with text
function makePara(text, options = {}) {
  const { bold = false, center = false, style = mainStyle } = options;
  const pPr = `<w:pPr>${style ? `<w:pStyle w:val="${style}"/>` : ''}${center ? '<w:jc w:val="center"/>' : '<w:jc w:val="both"/>'}</w:pPr>`;
  const rPr = bold 
    ? mainRPr.replace('</w:rPr>', '<w:b/><w:bCs/></w:rPr>') 
    : mainRPr;
  return `<w:p>${pPr}<w:r>${rPr}<w:t xml:space="preserve">${text}</w:t></w:r></w:p>`;
}

function makeEmptyPara() {
  return `<w:p><w:pPr><w:pStyle w:val="${mainStyle}"/></w:pPr></w:p>`;
}

// ============================================================
// VARIANT 1: Libro completo
// ============================================================
function buildLibroBody() {
  const title = makePara('CERTIFICADO DE EVALUACIÓN POR PARES', { bold: true, center: true });
  const subtitle = makePara('LIBRO RESULTADO DE INVESTIGACIÓN', { bold: true, center: true });
  const blank1 = makeEmptyPara();
  
  const body1 = makePara('El suscrito Jefe del Departamento de Publicaciones de la Universidad Simón Bolívar, declara que:');
  const blank2 = makeEmptyPara();
  
  const body2 = makePara('El libro titulado {libro_titulo}, de autor/a o autores/as {autores}, identificado con el ISBN (impreso): {isbn_impreso}, ISBN (digital): {isbn_digital}, fue evaluado por dos (2) árbitros o pares evaluadores externos a la institución, culminando satisfactoriamente el proceso editorial y cumpliendo con los siguientes aspectos: calidad de contenido; originalidad; presentación y estructura; actualidad de las referencias bibliográficas y consideraciones éticas, y publicado por Ediciones Universidad Simón Bolívar, en la ciudad de Barranquilla, Colombia, en el mes de {mes_publicacion} del año {anio_publicacion}.');
  const blank3 = makeEmptyPara();
  
  const constancia = makePara('La siguiente constancia se expide a los {dia_expedicion} días del mes de {mes_expedicion} del año {anio_expedicion}.');
  const blank4 = makeEmptyPara();
  const blank5 = makeEmptyPara();
  
  const line = makePara('__________________________________', { center: true });
  const sigName = makePara(SIGNATURE_NAME, { bold: true, center: true });
  const sigCC = makePara(SIGNATURE_CC, { center: true });
  const sigTitle = makePara(SIGNATURE_TITLE, { center: true });
  const sigInst = makePara(SIGNATURE_INST, { center: true });

  return [title, subtitle, blank1, body1, blank2, body2, blank3, constancia, blank4, blank5, line, sigName, sigCC, sigTitle, sigInst].join('');
}

// ============================================================
// VARIANT 2: Capítulo individual
// ============================================================
function buildCapituloBody() {
  const title = makePara('CERTIFICADO DE EVALUACIÓN POR PARES', { bold: true, center: true });
  const subtitle = makePara('CAPÍTULO EN LIBRO RESULTADO DE INVESTIGACIÓN', { bold: true, center: true });
  const blank1 = makeEmptyPara();
  
  const body1 = makePara('El suscrito Jefe del Departamento de Publicaciones de la Universidad Simón Bolívar, declara que:');
  const blank2 = makeEmptyPara();
  
  const body2 = makePara('El capítulo titulado {capitulo_titulo}, de autor/a o autores/as {autores}, fue publicado en el libro resultado de investigación: {libro_titulo}, el cual fue evaluado por dos (2) árbitros o pares evaluadores externos a la institución, identificado con el ISBN (impreso): {isbn_impreso}, ISBN (digital): {isbn_digital}, culminando satisfactoriamente el proceso editorial y cumpliendo con los siguientes aspectos: calidad de contenido; originalidad; presentación y estructura; actualidad de las referencias bibliográficas y consideraciones éticas, y publicado por Ediciones Universidad Simón Bolívar, en la ciudad de Barranquilla, Colombia, en el mes de {mes_publicacion} del año {anio_publicacion}.');
  const blank3 = makeEmptyPara();
  
  const constancia = makePara('La siguiente constancia se expide a los {dia_expedicion} días del mes de {mes_expedicion} del año {anio_expedicion}.');
  const blank4 = makeEmptyPara();
  const blank5 = makeEmptyPara();
  
  const line = makePara('__________________________________', { center: true });
  const sigName = makePara(SIGNATURE_NAME, { bold: true, center: true });
  const sigCC = makePara(SIGNATURE_CC, { center: true });
  const sigTitle = makePara(SIGNATURE_TITLE, { center: true });
  const sigInst = makePara(SIGNATURE_INST, { center: true });

  return [title, subtitle, blank1, body1, blank2, body2, blank3, constancia, blank4, blank5, line, sigName, sigCC, sigTitle, sigInst].join('');
}

// ============================================================
// VARIANT 3: Varios capítulos (con loop)
// ============================================================
function buildVariosCapitulosBody() {
  const title = makePara('CERTIFICADO DE EVALUACIÓN POR PARES', { bold: true, center: true });
  const subtitle = makePara('LIBRO RESULTADO DE INVESTIGACIÓN – VARIOS CAPÍTULOS', { bold: true, center: true });
  const blank1 = makeEmptyPara();
  
  const body1 = makePara('El suscrito Jefe del Departamento de Publicaciones de la Universidad Simón Bolívar, declara que:');
  const blank2 = makeEmptyPara();
  
  const body2 = makePara('Los capítulos que se detallan a continuación fueron publicados en el libro resultado de investigación: {libro_titulo}, identificado con el ISBN (impreso): {isbn_impreso}, ISBN (digital): {isbn_digital}, de los editores/as: {editores}, y fue evaluado por dos (2) árbitros o pares evaluadores externos a la institución, culminando satisfactoriamente el proceso editorial y cumpliendo con los siguientes aspectos: calidad de contenido; originalidad; presentación y estructura; actualidad de las referencias bibliográficas y consideraciones éticas, y publicado por Ediciones Universidad Simón Bolívar, en la ciudad de Barranquilla, Colombia, en el mes de {mes_publicacion} del año {anio_publicacion}.');
  const blank3 = makeEmptyPara();
  
  // Loop header
  const tableHeader = makePara('Capítulos certificados:', { bold: true });
  
  // Docxtemplater loop - each chapter as a paragraph
  const loopStart = makePara('{#capitulos}');
  const loopContent = makePara('• {cap_titulo} — Autor(es): {cap_autores}{paginas_str}');
  const loopEnd = makePara('{/capitulos}');
  const blank4 = makeEmptyPara();
  
  const constancia = makePara('La siguiente constancia se expide a los {dia_expedicion} días del mes de {mes_expedicion} del año {anio_expedicion}.');
  const blank5 = makeEmptyPara();
  const blank6 = makeEmptyPara();
  
  const line = makePara('__________________________________', { center: true });
  const sigName = makePara(SIGNATURE_NAME, { bold: true, center: true });
  const sigCC = makePara(SIGNATURE_CC, { center: true });
  const sigTitle = makePara(SIGNATURE_TITLE, { center: true });
  const sigInst = makePara(SIGNATURE_INST, { center: true });

  return [title, subtitle, blank1, body1, blank2, body2, blank3, tableHeader, loopStart, loopContent, loopEnd, blank4, constancia, blank5, blank6, line, sigName, sigCC, sigTitle, sigInst].join('');
}

// ============================================================
// Generate the 3 template files
// ============================================================
function createVariant(bodyBuilder, outputFileName) {
  const newZip = new PizZip(buf); // Clone from original to keep styles, headers, images
  const originalXml = newZip.file('word/document.xml').asText();
  
  // Replace body content but keep sectPr
  const newBody = bodyBuilder();
  const newXml = originalXml.replace(
    /<w:body>[\s\S]*<\/w:body>/,
    `<w:body>${newBody}${sectPr}</w:body>`
  );
  
  newZip.file('word/document.xml', newXml);
  
  const outputPath = path.join(TEMPLATES_DIR, outputFileName);
  const output = newZip.generate({ type: 'nodebuffer', compression: 'DEFLATE' });
  fs.writeFileSync(outputPath, output);
  console.log(`✅ Created: ${outputFileName} (${output.length} bytes)`);
}

createVariant(buildLibroBody, 'Evaluación por pares-libro.docx');
createVariant(buildCapituloBody, 'Evaluación por pares-capitulo.docx');
createVariant(buildVariosCapitulosBody, 'Evaluación por pares-varios-capitulos.docx');

// Verify placeholders
console.log('\n--- Verification ---');
['Evaluación por pares-libro.docx', 'Evaluación por pares-capitulo.docx', 'Evaluación por pares-varios-capitulos.docx'].forEach(f => {
  const b = fs.readFileSync(path.join(TEMPLATES_DIR, f));
  const z = new PizZip(b);
  const x = z.file('word/document.xml').asText();
  const tags = x.match(/\{[#/]?[^}]+\}/g);
  console.log(`${f}: ${JSON.stringify(tags)}`);
});

console.log('\n✅ All 3 variants created successfully!');
