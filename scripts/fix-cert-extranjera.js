/**
 * Script to fix:
 * 1. "Certificado para EDITORIAL EXTRANJERA_capítulo_libro.docx":
 *    - Fix "{autores}" in chapter title -> "{capitulo_titulo}"
 *    - Remove "(Colocar logo de la entidad)"
 *    - Set declarant to "El suscrito Vicerrector de Investigación, Extensión e Innovación de la Universidad Simón Bolívar, declara que:"
 *    - Set signature to Luis Eduardo Ortiz Ospino (Vicerrector)
 *    - Fix year to {anio_expedicion}
 * 2. "Certificado para EDITORIAL EXTRANJERA_libro.docx":
 *    - Remove "(Colocar logo de la entidad)"
 *    - Fix title typo "CERTIFICADO DE DE LIBRO" -> "CERTIFICADO DE LIBRO RESULTADO DE INVESTIGACIÓN"
 *    - Set declarant to "El suscrito Vicerrector de Investigación, Extensión e Innovación de la Universidad Simón Bolívar, declara que:"
 *    - Set signature to Luis Eduardo Ortiz Ospino (Vicerrector)
 *    - Fix year to {anio_expedicion}
 * 3. Also fix date placeholders in:
 *    - "Aval-Capítulo-Editorial extranjera.docx" (replace xxxx with {dia_expedicion} and {mes_expedicion})
 *    - "Aval-Libro-Editorial extranjera.docx" (replace xxxx with {dia_expedicion} and {mes_expedicion})
 * 4. Sync fixes to "Certificados/Avales/Editorial-Extranjera/"
 */
const PizZip = require('pizzip');
const fs = require('fs');

const VICE_LUIS_SIG = `
<w:p><w:pPr><w:spacing w:before="720" w:after="100"/><w:jc w:val="center"/><w:rPr><w:rFonts w:cstheme="minorHAnsi"/><w:sz w:val="22"/><w:szCs w:val="22"/></w:rPr></w:pPr><w:r><w:rPr><w:rFonts w:cstheme="minorHAnsi"/><w:sz w:val="22"/><w:szCs w:val="22"/></w:rPr><w:t>__________________________________</w:t></w:r></w:p>
<w:p><w:pPr><w:spacing w:after="60"/><w:jc w:val="center"/><w:rPr><w:rFonts w:cstheme="minorHAnsi"/><w:b/><w:bCs/><w:sz w:val="22"/><w:szCs w:val="22"/></w:rPr></w:pPr><w:r><w:rPr><w:rFonts w:cstheme="minorHAnsi"/><w:b/><w:bCs/><w:sz w:val="22"/><w:szCs w:val="22"/></w:rPr><w:t>LUIS EDUARDO ORTIZ OSPINO</w:t></w:r></w:p>
<w:p><w:pPr><w:spacing w:after="60"/><w:jc w:val="center"/><w:rPr><w:rFonts w:cstheme="minorHAnsi"/><w:sz w:val="20"/><w:szCs w:val="20"/></w:rPr></w:pPr><w:r><w:rPr><w:rFonts w:cstheme="minorHAnsi"/><w:sz w:val="20"/><w:szCs w:val="20"/></w:rPr><w:t>C.C. 72.002.980</w:t></w:r></w:p>
<w:p><w:pPr><w:spacing w:after="60"/><w:jc w:val="center"/><w:rPr><w:rFonts w:cstheme="minorHAnsi"/><w:sz w:val="20"/><w:szCs w:val="20"/></w:rPr></w:pPr><w:r><w:rPr><w:rFonts w:cstheme="minorHAnsi"/><w:sz w:val="20"/><w:szCs w:val="20"/></w:rPr><w:t>Vicerrector de Investigación, Extensión e Innovación</w:t></w:r></w:p>
<w:p><w:pPr><w:spacing w:after="60"/><w:jc w:val="center"/><w:rPr><w:rFonts w:cstheme="minorHAnsi"/><w:sz w:val="20"/><w:szCs w:val="20"/></w:rPr></w:pPr><w:r><w:rPr><w:rFonts w:cstheme="minorHAnsi"/><w:sz w:val="20"/><w:szCs w:val="20"/></w:rPr><w:t>Universidad Simón Bolívar</w:t></w:r></w:p>
`;

function fixCertEditorialCapitulo(filePath) {
  console.log('Fixing:', filePath);
  if (!fs.existsSync(filePath)) {
    console.log('File does not exist:', filePath);
    return;
  }
  const zip = new PizZip(fs.readFileSync(filePath));
  let xml = zip.file('word/document.xml').asText();

  // 1. Remove "(Colocar logo de la entidad)"
  xml = xml.replace(/<w:t>\(Colocar logo de la entidad\)<\/w:t>/g, '<w:t></w:t>');

  // 2. Fix chapter title placeholder: "El capítulo denominado {autores}" -> "El capítulo denominado {capitulo_titulo}"
  const denIdx = xml.indexOf('denominado');
  if (denIdx !== -1) {
    const nextAutoresIdx = xml.indexOf('{autores}', denIdx);
    const libroIdx = xml.indexOf('{libro_titulo}', denIdx);
    if (nextAutoresIdx !== -1 && (libroIdx === -1 || nextAutoresIdx < libroIdx)) {
      xml = xml.substring(0, nextAutoresIdx) + '{capitulo_titulo}' + xml.substring(nextAutoresIdx + '{autores}'.length);
      console.log('Replaced chapter {autores} with {capitulo_titulo}!');
    }
  }

  // 3. Fix declarant:
  const repIdx = xml.indexOf('El/la representante legal');
  const decIdx = xml.indexOf('eclara');
  if (repIdx !== -1 && decIdx !== -1) {
    const pStart = xml.lastIndexOf('<w:p', repIdx);
    const pEnd = xml.indexOf('</w:p>', decIdx) + '</w:p>'.length;
    if (pStart !== -1 && pEnd !== -1 && pStart < pEnd) {
      const newDeclarantP = `
<w:p><w:pPr><w:spacing w:before="240" w:after="200" w:line="276" w:lineRule="auto"/><w:jc w:val="both"/><w:rPr><w:rFonts w:cstheme="minorHAnsi"/><w:sz w:val="24"/><w:szCs w:val="24"/></w:rPr></w:pPr><w:r><w:rPr><w:rFonts w:cstheme="minorHAnsi"/><w:sz w:val="24"/><w:szCs w:val="24"/></w:rPr><w:t>El suscrito Vicerrector de Investigación, Extensión e Innovación de la Universidad Simón Bolívar, declara que:</w:t></w:r></w:p>
`;
      xml = xml.substring(0, pStart) + newDeclarantP + xml.substring(pEnd);
      console.log('Replaced declarant with Unisimón Vicerrector!');
    }
  }

  // 4. Fix year: replace 2021 with {anio_expedicion}
  xml = xml.replace(/<w:t>2021<\/w:t>/g, '<w:t>{anio_expedicion}</w:t>');

  // 5. Fix signature: replace the <w:tbl>...</w:tbl> containing {firmante_nombre} with Vice Luis signature
  const sigTableStart = xml.indexOf('<w:tbl>');
  const sigTableEnd = xml.indexOf('</w:tbl>') + '</w:tbl>'.length;
  if (sigTableStart !== -1 && sigTableEnd !== -1) {
    xml = xml.substring(0, sigTableStart) + VICE_LUIS_SIG + xml.substring(sigTableEnd);
    console.log('Replaced signature table with Vice Luis signature block!');
  }

  zip.file('word/document.xml', xml);
  const outBuf = zip.generate({ type: 'nodebuffer', compression: 'DEFLATE' });
  fs.writeFileSync(filePath, outBuf);
  console.log('Saved successfully:', filePath);
}

function fixCertEditorialLibro(filePath) {
  console.log('Fixing:', filePath);
  if (!fs.existsSync(filePath)) {
    console.log('File does not exist:', filePath);
    return;
  }
  const zip = new PizZip(fs.readFileSync(filePath));
  let xml = zip.file('word/document.xml').asText();

  // 1. Remove "(Colocar logo de la entidad)"
  xml = xml.replace(/<w:t>\(Colocar logo de la entidad\)<\/w:t>/g, '<w:t></w:t>');

  // 2. Fix typo "CERTIFICADO DE DE LIBRO" -> "CERTIFICADO DE LIBRO"
  xml = xml.replace(/<w:t>DE DE LIBRO<\/w:t>/g, '<w:t>DE LIBRO</w:t>');
  xml = xml.replace(/<w:t xml:space="preserve">DE <\/w:t><w:t>DE LIBRO<\/w:t>/g, '<w:t xml:space="preserve">DE LIBRO<\/w:t>');

  // 3. Fix declarant
  const repIdx = xml.indexOf('El/la representante legal');
  const decIdx = xml.indexOf('eclara');
  if (repIdx !== -1 && decIdx !== -1) {
    const pStart = xml.lastIndexOf('<w:p', repIdx);
    const pEnd = xml.indexOf('</w:p>', decIdx) + '</w:p>'.length;
    if (pStart !== -1 && pEnd !== -1 && pStart < pEnd) {
      const newDeclarantP = `
<w:p><w:pPr><w:spacing w:before="240" w:after="200" w:line="276" w:lineRule="auto"/><w:jc w:val="both"/><w:rPr><w:rFonts w:cstheme="minorHAnsi"/><w:sz w:val="24"/><w:szCs w:val="24"/></w:rPr></w:pPr><w:r><w:rPr><w:rFonts w:cstheme="minorHAnsi"/><w:sz w:val="24"/><w:szCs w:val="24"/></w:rPr><w:t>El suscrito Vicerrector de Investigación, Extensión e Innovación de la Universidad Simón Bolívar, declara que:</w:t></w:r></w:p>
`;
      xml = xml.substring(0, pStart) + newDeclarantP + xml.substring(pEnd);
      console.log('Replaced declarant with Unisimón Vicerrector (Libro)!');
    }
  }

  // 4. Fix year if needed
  xml = xml.replace(/año 202 4/g, 'año {anio_expedicion}');
  xml = xml.replace(/año 2024/g, 'año {anio_expedicion}');
  xml = xml.replace(/año 2021/g, 'año {anio_expedicion}');

  // 5. Fix signature
  const sigTableStart = xml.indexOf('<w:tbl>');
  const sigTableEnd = xml.indexOf('</w:tbl>') + '</w:tbl>'.length;
  if (sigTableStart !== -1 && sigTableEnd !== -1) {
    xml = xml.substring(0, sigTableStart) + VICE_LUIS_SIG + xml.substring(sigTableEnd);
    console.log('Replaced signature table with Vice Luis signature block (Libro)!');
  }

  zip.file('word/document.xml', xml);
  const outBuf = zip.generate({ type: 'nodebuffer', compression: 'DEFLATE' });
  fs.writeFileSync(filePath, outBuf);
  console.log('Saved successfully:', filePath);
}

function fixDatePlaceholders(filePath) {
  if (!fs.existsSync(filePath)) return;
  const zip = new PizZip(fs.readFileSync(filePath));
  let xml = zip.file('word/document.xml').asText();

  const before = xml;
  // Match <w:t>xxxx</w:t>
  xml = xml.replace(/<w:t>xxxx<\/w:t>/g, '<w:t>{dia_expedicion}<\/w:t>');
  xml = xml.replace(/<w:t>xxxxx<\/w:t>/g, '<w:t>{mes_expedicion}<\/w:t>');
  // Also regex for loose text
  xml = xml.replace(/xxxx\s*días\s*del\s*mes\s*xxxxx/gi, '{dia_expedicion} días del mes {mes_expedicion}');
  xml = xml.replace(/xxxx\s*días\s*del\s*mes\s*de\s*xxxxx/gi, '{dia_expedicion} días del mes de {mes_expedicion}');
  xml = xml.replace(/202\s*4/g, '{anio_expedicion}');

  if (xml !== before) {
    zip.file('word/document.xml', xml);
    const outBuf = zip.generate({ type: 'nodebuffer', compression: 'DEFLATE' });
    fs.writeFileSync(filePath, outBuf);
    console.log('Fixed xxxx dates in:', filePath);
  }
}

// 1. Fix public/templates
fixCertEditorialCapitulo('public/templates/Certificado para EDITORIAL EXTRANJERA_capítulo_libro.docx');
fixCertEditorialLibro('public/templates/Certificado para EDITORIAL EXTRANJERA_libro.docx');
fixDatePlaceholders('public/templates/Aval-Capítulo-Editorial extranjera.docx');
fixDatePlaceholders('public/templates/Aval-Libro-Editorial extranjera.docx');

// 2. Sync to Certificados/ folder
fixCertEditorialCapitulo('Certificados/Avales/Editorial-Extranjera/Certificado para EDITORIAL EXTRANJERA_capítulo_libro.docx');
fixCertEditorialLibro('Certificados/Avales/Editorial-Extranjera/Certificado para EDITORIAL EXTRANJERA_libro.docx');
fixDatePlaceholders('Certificados/Avales/Editorial-Extranjera/Aval-Capítulo-Editorial extranjera.docx');
fixDatePlaceholders('Certificados/Avales/Editorial-Extranjera/Aval-Libro-Editorial extranjera.docx');

console.log('ALL FIXES COMPLETED!');
