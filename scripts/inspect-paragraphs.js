const fs = require('fs');
const path = require('path');
const PizZip = require('pizzip');

function inspectParas(file) {
  const filePath = path.join(__dirname, '..', 'public', 'templates', file);
  const zip = new PizZip(fs.readFileSync(filePath));
  const xml = zip.file('word/document.xml').asText();
  const paras = xml.match(/<w:p\b[\s\S]*?<\/w:p>/g) || [];
  console.log('=== ' + file + ' (' + paras.length + ' paras) ===');
  paras.forEach((p, idx) => {
    const text = p.replace(/<[^>]+>/g, '').trim();
    if (text.toLowerCase().includes('suscrit') || 
        text.toLowerCase().includes('ortiz') || 
        text.toLowerCase().includes('vicerrector') || 
        text.toLowerCase().includes('conocimiento') || 
        text.toLowerCase().includes('navarro') || 
        text.toLowerCase().includes('jefa') || 
        text.toLowerCase().includes('firma')) {
      console.log('[P ' + idx + '] Text: ' + text);
      console.log('[P ' + idx + '] XML: ' + p + '\n');
    }
  });
}

inspectParas('Aval-Libro.docx');
inspectParas('Evaluación por pares-jefa de publicaciones.docx');
