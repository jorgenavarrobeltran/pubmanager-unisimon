/**
 * Fix: Regenerate "Evaluación por pares-varios-capitulos.docx"
 * using a proper Word XML table for listing chapters.
 */
const PizZip = require('pizzip');
const fs = require('fs');
const path = require('path');

const TEMPLATES_DIR = path.join(__dirname, '..', 'public', 'templates');
const SOURCE_FILE = path.join(TEMPLATES_DIR, 'Evaluación por pares-jefa de publicaciones.docx');

const buf = fs.readFileSync(SOURCE_FILE);
const zip = new PizZip(buf);
const docXml = zip.file('word/document.xml').asText();

// Extract section properties (page margins, headers, footers)
const bodyContent = docXml.match(/<w:body>([\s\S]*)<\/w:body>/)[1];
const sectPrMatch = bodyContent.match(/<w:sectPr[\s\S]*?<\/w:sectPr>/);
const sectPr = sectPrMatch ? sectPrMatch[0] : '';

// Extract existing run properties from the template for font consistency
const rPrMatch = docXml.match(/<w:rPr>[\s\S]*?<w:rFonts[^/]*\/>[^<]*<w:sz[^/]*\/>[^<]*<w:szCs[^/]*\/>[\s\S]*?<\/w:rPr>/);
let baseRPr = '<w:rPr><w:rFonts w:ascii="Century Gothic" w:hAnsi="Century Gothic" w:cs="Century Gothic"/><w:sz w:val="22"/><w:szCs w:val="22"/></w:rPr>';

// Try to detect font from existing paragraphs
const fontMatch = docXml.match(/w:ascii="([^"]+)"/);
const fontName = fontMatch ? fontMatch[1] : 'Century Gothic';
const sizeMatch = docXml.match(/<w:sz w:val="(\d+)"/);
const fontSize = sizeMatch ? sizeMatch[1] : '22';

console.log(`Detected font: ${fontName}, size: ${fontSize}`);

baseRPr = `<w:rPr><w:rFonts w:ascii="${fontName}" w:hAnsi="${fontName}" w:cs="${fontName}"/><w:sz w:val="${fontSize}"/><w:szCs w:val="${fontSize}"/></w:rPr>`;
const boldRPr = `<w:rPr><w:rFonts w:ascii="${fontName}" w:hAnsi="${fontName}" w:cs="${fontName}"/><w:b/><w:bCs/><w:sz w:val="${fontSize}"/><w:szCs w:val="${fontSize}"/></w:rPr>`;
const smallRPr = `<w:rPr><w:rFonts w:ascii="${fontName}" w:hAnsi="${fontName}" w:cs="${fontName}"/><w:sz w:val="18"/><w:szCs w:val="18"/></w:rPr>`;
const smallBoldRPr = `<w:rPr><w:rFonts w:ascii="${fontName}" w:hAnsi="${fontName}" w:cs="${fontName}"/><w:b/><w:bCs/><w:sz w:val="18"/><w:szCs w:val="18"/></w:rPr>`;

// Helpers
function p(text, rpr = baseRPr, jc = 'both') {
  return `<w:p><w:pPr><w:jc w:val="${jc}"/></w:pPr><w:r>${rpr}<w:t xml:space="preserve">${text}</w:t></w:r></w:p>`;
}
function emptyP() {
  return `<w:p><w:pPr></w:pPr></w:p>`;
}

// Build table cell
function tc(text, rpr = smallRPr, width = null, jc = 'left') {
  const tcPr = width 
    ? `<w:tcPr><w:tcW w:w="${width}" w:type="dxa"/><w:tcBorders><w:top w:val="single" w:sz="4" w:space="0" w:color="999999"/><w:left w:val="single" w:sz="4" w:space="0" w:color="999999"/><w:bottom w:val="single" w:sz="4" w:space="0" w:color="999999"/><w:right w:val="single" w:sz="4" w:space="0" w:color="999999"/></w:tcBorders><w:vAlign w:val="center"/></w:tcPr>`
    : `<w:tcPr><w:tcBorders><w:top w:val="single" w:sz="4" w:space="0" w:color="999999"/><w:left w:val="single" w:sz="4" w:space="0" w:color="999999"/><w:bottom w:val="single" w:sz="4" w:space="0" w:color="999999"/><w:right w:val="single" w:sz="4" w:space="0" w:color="999999"/></w:tcBorders><w:vAlign w:val="center"/></w:tcPr>`;
  return `<w:tc>${tcPr}<w:p><w:pPr><w:jc w:val="${jc}"/><w:spacing w:before="40" w:after="40"/></w:pPr><w:r>${rpr}<w:t xml:space="preserve">${text}</w:t></w:r></w:p></w:tc>`;
}

// Build the table with header + loop rows
function buildTable() {
  // Table properties - full width, auto layout
  const tblPr = `<w:tblPr>
    <w:tblStyle w:val="TableGrid"/>
    <w:tblW w:w="5000" w:type="pct"/>
    <w:tblBorders>
      <w:top w:val="single" w:sz="4" w:space="0" w:color="999999"/>
      <w:left w:val="single" w:sz="4" w:space="0" w:color="999999"/>
      <w:bottom w:val="single" w:sz="4" w:space="0" w:color="999999"/>
      <w:right w:val="single" w:sz="4" w:space="0" w:color="999999"/>
      <w:insideH w:val="single" w:sz="4" w:space="0" w:color="999999"/>
      <w:insideV w:val="single" w:sz="4" w:space="0" w:color="999999"/>
    </w:tblBorders>
    <w:tblLook w:val="04A0" w:firstRow="1" w:lastRow="0" w:firstColumn="1" w:lastColumn="0" w:noHBand="0" w:noVBand="1"/>
  </w:tblPr>`;

  // Column grid (3 columns: No., Título del capítulo, Autor(es)/Páginas)
  const tblGrid = `<w:tblGrid>
    <w:gridCol w:w="600"/>
    <w:gridCol w:w="5400"/>
    <w:gridCol w:w="3000"/>
  </w:tblGrid>`;

  // Header row with shading
  const headerShading = `<w:shd w:val="clear" w:color="auto" w:fill="1B5E20"/>`;
  const headerRPr = `<w:rPr><w:rFonts w:ascii="${fontName}" w:hAnsi="${fontName}" w:cs="${fontName}"/><w:b/><w:bCs/><w:color w:val="FFFFFF"/><w:sz w:val="18"/><w:szCs w:val="18"/></w:rPr>`;
  
  function headerTc(text, width) {
    return `<w:tc><w:tcPr><w:tcW w:w="${width}" w:type="dxa"/>${headerShading}<w:tcBorders><w:top w:val="single" w:sz="4" w:space="0" w:color="1B5E20"/><w:left w:val="single" w:sz="4" w:space="0" w:color="1B5E20"/><w:bottom w:val="single" w:sz="4" w:space="0" w:color="1B5E20"/><w:right w:val="single" w:sz="4" w:space="0" w:color="1B5E20"/></w:tcBorders><w:vAlign w:val="center"/></w:tcPr><w:p><w:pPr><w:jc w:val="center"/><w:spacing w:before="60" w:after="60"/></w:pPr><w:r>${headerRPr}<w:t xml:space="preserve">${text}</w:t></w:r></w:p></w:tc>`;
  }

  const headerRow = `<w:tr><w:trPr><w:trHeight w:val="400"/></w:trPr>${headerTc('No.', '600')}${headerTc('Título del capítulo', '5400')}${headerTc('Autor(es) / Páginas', '3000')}</w:tr>`;

  // Loop row for docxtemplater - {#capitulos} ... {/capitulos}
  // We use a row that repeats for each chapter
  const loopRow = `<w:tr><w:trPr><w:trHeight w:val="300"/></w:trPr>${tc('{cap_numero}', smallRPr, '600', 'center')}${tc('{cap_titulo}', smallRPr, '5400')}${tc('{cap_autores_pags}', smallRPr, '3000')}</w:tr>`;

  // Wrap loop in docxtemplater section tags
  // The loop tags go in separate paragraphs OUTSIDE the table - but docxtemplater
  // supports table row loops if the tags are in the first and last cells of the row.
  // We'll use the {#capitulos} in a paragraph before the loop row approach doesn't work in tables.
  // Instead, use the table row loop: the loop tags must be in the SAME row.
  
  // Actually for docxtemplater TABLE ROW LOOP, the {#capitulos} and {/capitulos} 
  // tags must be in the first cell of the row to indicate a loop row.
  const loopRowWithTags = `<w:tr><w:trPr><w:trHeight w:val="300"/></w:trPr><w:tc><w:tcPr><w:tcW w:w="600" w:type="dxa"/><w:tcBorders><w:top w:val="single" w:sz="4" w:space="0" w:color="999999"/><w:left w:val="single" w:sz="4" w:space="0" w:color="999999"/><w:bottom w:val="single" w:sz="4" w:space="0" w:color="999999"/><w:right w:val="single" w:sz="4" w:space="0" w:color="999999"/></w:tcBorders><w:vAlign w:val="center"/></w:tcPr><w:p><w:pPr><w:jc w:val="center"/><w:spacing w:before="40" w:after="40"/></w:pPr><w:r>${smallRPr}<w:t xml:space="preserve">{#capitulos}{cap_numero}</w:t></w:r></w:p></w:tc>${tc('{cap_titulo}', smallRPr, '5400')}<w:tc><w:tcPr><w:tcW w:w="3000" w:type="dxa"/><w:tcBorders><w:top w:val="single" w:sz="4" w:space="0" w:color="999999"/><w:left w:val="single" w:sz="4" w:space="0" w:color="999999"/><w:bottom w:val="single" w:sz="4" w:space="0" w:color="999999"/><w:right w:val="single" w:sz="4" w:space="0" w:color="999999"/></w:tcBorders><w:vAlign w:val="center"/></w:tcPr><w:p><w:pPr><w:jc w:val="left"/><w:spacing w:before="40" w:after="40"/></w:pPr><w:r>${smallRPr}<w:t xml:space="preserve">{cap_autores_pags}{/capitulos}</w:t></w:r></w:p></w:tc></w:tr>`;

  return `<w:tbl>${tblPr}${tblGrid}${headerRow}${loopRowWithTags}</w:tbl>`;
}

// Build full body
function buildBody() {
  const parts = [];
  
  // Title
  parts.push(p('CERTIFICADO DE EVALUACIÓN POR PARES', boldRPr, 'center'));
  parts.push(p('LIBRO RESULTADO DE INVESTIGACIÓN – VARIOS CAPÍTULOS', boldRPr, 'center'));
  parts.push(emptyP());
  
  // Declaration
  parts.push(p('El suscrito Jefe del Departamento de Publicaciones de la Universidad Simón Bolívar, declara que:'));
  parts.push(emptyP());
  
  // Body text
  parts.push(p('Los capítulos que se detallan en la tabla a continuación fueron publicados en el libro resultado de investigación: {libro_titulo}, identificado con el ISBN (impreso): {isbn_impreso}, ISBN (digital): {isbn_digital}, de los editores/as: {editores}, y fue evaluado por dos (2) árbitros o pares evaluadores externos a la institución, culminando satisfactoriamente el proceso editorial y cumpliendo con los siguientes aspectos: calidad de contenido; originalidad; presentación y estructura; actualidad de las referencias bibliográficas y consideraciones éticas, y publicado por Ediciones Universidad Simón Bolívar, en la ciudad de Barranquilla, Colombia, en el mes de {mes_publicacion} del año {anio_publicacion}.'));
  parts.push(emptyP());
  
  // Table with chapters
  parts.push(buildTable());
  parts.push(emptyP());
  
  // Constancia
  parts.push(p('La siguiente constancia se expide a los {dia_expedicion} días del mes de {mes_expedicion} del año {anio_expedicion}.'));
  parts.push(emptyP());
  parts.push(emptyP());
  
  // Signature
  parts.push(p('__________________________________', baseRPr, 'center'));
  parts.push(p('JORGE ARMANDO NAVARRO BELTRÁN', boldRPr, 'center'));
  parts.push(p('C.C. 1.045.683.896', baseRPr, 'center'));
  parts.push(p('Jefe del Departamento de Publicaciones', baseRPr, 'center'));
  parts.push(p('Universidad Simón Bolívar', baseRPr, 'center'));
  
  return parts.join('');
}

// Generate the file
const newZip = new PizZip(buf);
const originalXml = newZip.file('word/document.xml').asText();

const newBody = buildBody();
const newXml = originalXml.replace(
  /<w:body>[\s\S]*<\/w:body>/,
  `<w:body>${newBody}${sectPr}</w:body>`
);

newZip.file('word/document.xml', newXml);

const outputPath = path.join(TEMPLATES_DIR, 'Evaluación por pares-varios-capitulos.docx');
const output = newZip.generate({ type: 'nodebuffer', compression: 'DEFLATE' });
fs.writeFileSync(outputPath, output);
console.log(`✅ Regenerated: Evaluación por pares-varios-capitulos.docx (${output.length} bytes)`);

// Verify
const verifyBuf = fs.readFileSync(outputPath);
const verifyZip = new PizZip(verifyBuf);
const verifyXml = verifyZip.file('word/document.xml').asText();
const tags = verifyXml.match(/\{[#/]?[^}]+\}/g);
console.log('Tags found:', JSON.stringify(tags));

// Check that there's a table
const hasTbl = verifyXml.includes('<w:tbl>');
console.log('Has table:', hasTbl);
console.log('\n✅ Done!');
