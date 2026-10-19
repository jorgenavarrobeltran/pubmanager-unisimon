const fs = require('fs');
const path = require('path');
const PizZip = require('pizzip');
const Docxtemplater = require('docxtemplater');

const templatesDir = path.join(__dirname, '../public/templates');

function processTemplate(filename, modifierFn) {
  const filePath = path.join(templatesDir, filename);
  console.log(`\n---------------------------------------------\nProcessing: ${filename}`);
  const content = fs.readFileSync(filePath);
  const zip = new PizZip(content);
  let xml = zip.file('word/document.xml').asText();

  const originalXml = xml;
  xml = modifierFn(xml);

  if (xml === originalXml) {
    console.warn(`[WARN] No changes were made in ${filename}`);
  } else {
    console.log(`[OK] XML modified in ${filename}`);
  }

  zip.file('word/document.xml', xml);
  const outBuf = zip.generate({ type: 'nodebuffer', compression: 'DEFLATE' });
  fs.writeFileSync(filePath, outBuf);

  // Validate with Docxtemplater
  try {
    const testZip = new PizZip(outBuf);
    const doc = new Docxtemplater(testZip, { paragraphLoop: true, linebreaks: true });
    // Try rendering with mock data to test full pipeline
    doc.setData({
      libro_titulo: 'Test Libro',
      capitulo_titulo: 'Test Capitulo',
      autores: 'Juan Perez',
      editores: 'Carlos Gomez',
      compiladores: 'Carlos Gomez',
      editorial: 'Ediciones Unisimon',
      ciudad: 'Barranquilla, Colombia',
      mes_publicacion: 'julio',
      anio_publicacion: '2024',
      isbn_impreso: '978-000-0000-00-0',
      isbn_digital: '978-111-1111-11-1',
      dia_expedicion: '15',
      mes_expedicion: 'octubre',
      anio_expedicion: '2026',
      paginas: '10-25',
      capitulos: [
        { cap_titulo: 'Cap 1', cap_autores: 'Autor 1', paginas: '1-10' }
      ]
    });
    doc.render();
    console.log(`[VALID] Docxtemplater parsed and rendered ${filename} without any errors!`);
  } catch (err) {
    console.error(`[ERROR] Validation failed for ${filename}:`, err.message);
    if (err.properties && err.properties.errors) {
      console.error('Details:', err.properties.errors);
    }
  }
}

// =========================================================================
// 1. Aval-Capítulos_DIV.docx
// =========================================================================
processTemplate('Aval-Capítulos_DIV.docx', (xml) => {
  // Replace from <w:t xml:space="preserve">de las compiladoras: </w:t> down to 2022. </w:t></w:r>
  const targetRe = /<w:t xml:space="preserve">de las compiladoras:\s*<\/w:t><\/w:r>.*?Romina Ana Molina García.*?2022\.\s*<\/w:t><\/w:r>/s;
  const replacement = `<w:t xml:space="preserve">{#editores}de los/las compiladores/as: {editores}, {/editores}{^editores}{#compiladores}de los/las compiladores/as: {compiladores}, {/compiladores}{/editores}{#isbn_impreso}identificado con el ISBN (impreso): {isbn_impreso}, {/isbn_impreso}{#isbn_digital}ISBN (digital): {isbn_digital}, {/isbn_digital}publicado por {editorial}, en la ciudad de {ciudad}, en el mes de {mes_publicacion} del año {anio_publicacion}.</w:t></w:r>`;
  
  if (targetRe.test(xml)) {
    xml = xml.replace(targetRe, replacement);
    console.log('  -> Compilers and ISBN block replaced');
  } else {
    console.warn('  -> Could not find compilers/ISBN block');
  }

  // Expedition date
  const dateRe = /La siguiente constancia se expide a los\s*<\/w:t><\/w:r>.*?12.*?agosto.*?202\s*<\/w:t><\/w:r>\s*<w:r\b[^>]*>\s*<w:rPr>.*?<\/w:rPr>\s*<w:t>4<\/w:t><\/w:r>/s;
  const dateRepl = `La siguiente constancia se expide a los {dia_expedicion} días del mes de {mes_expedicion} del año {anio_expedicion}.</w:t></w:r>`;
  if (dateRe.test(xml)) {
    xml = xml.replace(dateRe, dateRepl);
    console.log('  -> Expedition date replaced');
  }

  return xml;
});

// =========================================================================
// 2. Aval_LIB_DIV.docx
// =========================================================================
processTemplate('Aval_LIB_DIV.docx', (xml) => {
  // Replace from Buenas prácticas... down to 2022. </w:t></w:r>
  const targetRe = /<w:t xml:space="preserve">Buenas prácticas para la internacionalización del currículo:\s*<\/w:t><\/w:r>.*?202\s*<\/w:t><\/w:r>\s*<w:r\b[^>]*>\s*<w:rPr>.*?<\/w:rPr>\s*<w:t>2<\/w:t><\/w:r>\s*<w:r\b[^>]*>\s*<w:rPr>.*?<\/w:rPr>\s*<w:t>\.<\/w:t><\/w:r>/s;
  const replacement = `<w:t xml:space="preserve">{libro_titulo}”, autor/a o autores/as: {autores}, {#editores}compilador/a o compiladores/as: {editores}, {/editores}{^editores}{#compiladores}compilador/a o compiladores/as: {compiladores}, {/compiladores}{/editores}{#isbn_impreso}identificado con el ISBN (impreso): {isbn_impreso}, {/isbn_impreso}{#isbn_digital}ISBN (digital): {isbn_digital}, {/isbn_digital}publicado por {editorial}, en la ciudad de {ciudad}, en el mes de {mes_publicacion} del año {anio_publicacion}.</w:t></w:r>`;
  
  if (targetRe.test(xml)) {
    xml = xml.replace(targetRe, replacement);
    console.log('  -> Book title and authors block replaced');
  } else {
    console.warn('  -> Could not find book title/authors block');
  }

  // Expedition date
  const dateRe = /La siguiente constancia se expide a los\s*<\/w:t><\/w:r>.*?5.*?julio.*?202\s*<\/w:t><\/w:r>\s*<w:r\b[^>]*>\s*<w:rPr>.*?<\/w:rPr>\s*<w:t>4<\/w:t><\/w:r>/s;
  const dateRepl = `La siguiente constancia se expide a los {dia_expedicion} días del mes de {mes_expedicion} del año {anio_expedicion}.</w:t></w:r>`;
  if (dateRe.test(xml)) {
    xml = xml.replace(dateRe, dateRepl);
    console.log('  -> Expedition date replaced');
  }

  return xml;
});

// =========================================================================
// 3. Créditos-Cap_editorial_extranjera.docx
// =========================================================================
processTemplate('Créditos-Cap_editorial_extranjera.docx', (xml) => {
  // Swap the inverted tags:
  // 1. {isbn_impreso} -> “{libro_titulo}”
  xml = xml.replace('<w:t>{isbn_impreso}</w:t>', '<w:t>“{libro_titulo}”</w:t>');
  // 2. {isbn_digital} -> {editorial}
  xml = xml.replace('<w:t>{isbn_digital}</w:t>', '<w:t>{editorial}</w:t>');
  // 3. {libro_titulo} -> {anio_publicacion}
  xml = xml.replace('<w:t>{libro_titulo}</w:t>', '<w:t>{anio_publicacion}</w:t>');

  // Expedition date: "a los 13 días del mes de septiembre del año 202 4"
  const dateRe = /La siguiente constancia se expide a los\s*<\/w:t><\/w:r>.*?13.*?septiembre.*?202\s*<\/w:t><\/w:r>\s*<w:r\b[^>]*>\s*<w:rPr>.*?<\/w:rPr>\s*<w:t>4<\/w:t><\/w:r>/s;
  const dateRepl = `La siguiente constancia se expide a los {dia_expedicion} días del mes de {mes_expedicion} del año {anio_expedicion}.</w:t></w:r>`;
  if (dateRe.test(xml)) {
    xml = xml.replace(dateRe, dateRepl);
    console.log('  -> Expedition date replaced');
  }

  return xml;
});

// =========================================================================
// 4. aval-varioscapitulos-editorial extranjera.docx
// =========================================================================
processTemplate('aval-varioscapitulos-editorial extranjera.docx', (xml) => {
  // Replace <w:t xml:space="preserve"> ISBN (digital): </w:t></w:r><w:proofErr w:type="spellStart"/><w:r ...><w:t>{libro_titulo}</w:t>
  const isbnRe = /(ISBN \(digital\):\s*<\/w:t><\/w:r>.*?<w:t>)\{libro_titulo\}(<\/w:t>)/s;
  if (isbnRe.test(xml)) {
    xml = xml.replace(isbnRe, '$1{isbn_digital}$2');
    console.log('  -> Replaced {libro_titulo} with {isbn_digital}');
  }

  // Expedition date: "a los 9 días del mes julio del año 202 4"
  const dateRe = /La siguiente constancia se expide a los\s*<\/w:t><\/w:r>.*?9.*?julio.*?202\s*<\/w:t><\/w:r>\s*<w:r\b[^>]*>\s*<w:rPr>.*?<\/w:rPr>\s*<w:t>4<\/w:t><\/w:r>/s;
  const dateRepl = `La siguiente constancia se expide a los {dia_expedicion} días del mes de {mes_expedicion} del año {anio_expedicion}.</w:t></w:r>`;
  if (dateRe.test(xml)) {
    xml = xml.replace(dateRe, dateRepl);
    console.log('  -> Expedition date replaced');
  }

  return xml;
});

// =========================================================================
// 5. AVAL-CAP-DIVULGACION.docx
// =========================================================================
processTemplate('AVAL-CAP-DIVULGACION.docx', (xml) => {
  // Expedition date: "a los 18 días del mes de octubre del año 202 4"
  const dateRe = /La siguiente constancia se expide a los\s*<\/w:t><\/w:r>.*?18.*?octubre.*?202\s*<\/w:t><\/w:r>\s*<w:r\b[^>]*>\s*<w:rPr>.*?<\/w:rPr>\s*<w:t>4<\/w:t><\/w:r>/s;
  const dateRepl = `La siguiente constancia se expide a los {dia_expedicion} días del mes de {mes_expedicion} del año {anio_expedicion}.</w:t></w:r>`;
  if (dateRe.test(xml)) {
    xml = xml.replace(dateRe, dateRepl);
    console.log('  -> Expedition date replaced');
  }
  return xml;
});

// =========================================================================
// 6. Créditos-varioscapitulos-usb.docx
// =========================================================================
processTemplate('Créditos-varioscapitulos-usb.docx', (xml) => {
  // Expedition date: "a los 16 días del mes de septiembre del año 202 4"
  const dateRe = /La siguiente constancia se expide a los\s*<\/w:t><\/w:r>.*?16.*?septiembre.*?202\s*<\/w:t><\/w:r>\s*<w:r\b[^>]*>\s*<w:rPr>.*?<\/w:rPr>\s*<w:t>4<\/w:t><\/w:r>/s;
  const dateRepl = `La siguiente constancia se expide a los {dia_expedicion} días del mes de {mes_expedicion} del año {anio_expedicion}.</w:t></w:r>`;
  if (dateRe.test(xml)) {
    xml = xml.replace(dateRe, dateRepl);
    console.log('  -> Expedition date replaced');
  }
  return xml;
});

// =========================================================================
// 7. Evaluación por pares-jefa de publicaciones.docx
// =========================================================================
processTemplate('Evaluación por pares-jefa de publicaciones.docx', (xml) => {
  // Remove rogue paragraph at the end with "Perspectivas sociales..."
  const rogueRe = /<w:p\b[^>]*>.*?Perspectivas sociales, jurídicas y económicas.*?año 20\s*<\/w:t><\/w:r>\s*<w:r\b[^>]*>\s*<w:rPr>.*?<\/w:rPr>\s*<w:t>20\.\s*<\/w:t><\/w:r>.*?<\/w:p>/s;
  if (rogueRe.test(xml)) {
    xml = xml.replace(rogueRe, '');
    console.log('  -> Removed duplicate rogue paragraph at end');
  }
  return xml;
});

// =========================================================================
// 8. Aval-Capítulo.docx
// =========================================================================
processTemplate('Aval-Capítulo.docx', (xml) => {
  // Insert chapter row in table
  const emptyRowRe = /<w:tc><w:tcPr><w:tcW w:w="2942" w:type="dxa"\/><\/w:tcPr><w:p w14:paraId="6213948A"[^>]*>.*?<\/w:tc><w:tc><w:tcPr><w:tcW w:w="2943" w:type="dxa"\/><\/w:tcPr><w:p w14:paraId="24365F3B"[^>]*>.*?<\/w:tc><w:tc><w:tcPr><w:tcW w:w="2943" w:type="dxa"\/><\/w:tcPr><w:p w14:paraId="54F01FE4"[^>]*>.*?<\/w:tc>/s;
  const populatedRow = `<w:tc><w:tcPr><w:tcW w:w="2942" w:type="dxa"/></w:tcPr><w:p><w:pPr><w:jc w:val="both"/></w:pPr><w:r><w:t>{autores}</w:t></w:r></w:p></w:tc><w:tc><w:tcPr><w:tcW w:w="2943" w:type="dxa"/></w:tcPr><w:p><w:pPr><w:jc w:val="both"/></w:pPr><w:r><w:t>{capitulo_titulo}</w:t></w:r></w:p></w:tc><w:tc><w:tcPr><w:tcW w:w="2943" w:type="dxa"/></w:tcPr><w:p><w:pPr><w:jc w:val="both"/></w:pPr><w:r><w:t>{paginas}</w:t></w:r></w:p></w:tc>`;
  if (emptyRowRe.test(xml)) {
    xml = xml.replace(emptyRowRe, populatedRow);
    console.log('  -> Inserted dynamic tags into chapter table row');
  }
  return xml;
});

// =========================================================================
// 9. Fix expedition year across ALL other templates that still have "del año 202 4"
// =========================================================================
const allDocx = fs.readdirSync(templatesDir).filter(f => f.endsWith('.docx'));
for (const f of allDocx) {
  processTemplate(f, (xml) => {
    const pattern = /del año 202\s*<\/w:t><\/w:r>\s*<w:r\b[^>]*>\s*<w:rPr>.*?<\/w:rPr>\s*<w:t>4<\/w:t><\/w:r>/s;
    if (pattern.test(xml)) {
      xml = xml.replace(pattern, `del año {anio_expedicion}.</w:t></w:r>`);
      console.log(`  -> Fixed generic expedition year 2024 to {anio_expedicion}`);
    }
    return xml;
  });
}

console.log('\n=============================================');
console.log('ALL TEMPLATES PROCESSED AND VERIFIED!');
console.log('=============================================\n');
