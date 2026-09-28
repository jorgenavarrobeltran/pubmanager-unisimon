const fs = require('fs');
const path = require('path');
const PizZip = require('pizzip');

const files = [
  'Aval-Capítulos_DIV.docx',
  'aval-varioscapitulos-editorial extranjera.docx',
  'Aval-varioscapitulos.docx'
];

for (const file of files) {
  const filePath = path.join(__dirname, '..', 'public', 'templates', file);
  const zip = new PizZip(fs.readFileSync(filePath));
  const docXml = zip.file('word/document.xml').asText();
  const drawings = docXml.match(/<w:drawing\b[\s\S]*?<\/w:drawing>/g) || [];
  console.log(`=== ${file} has ${drawings.length} drawings in document.xml ===`);
  drawings.forEach((d, i) => {
    const descr = d.match(/descr="([^"]+)"/) || [];
    const rEmbed = d.match(/r:embed="([^"]+)"/) || [];
    console.log(`  Drawing ${i}: r:embed=${rEmbed[1]}, descr=${descr[1] ? descr[1].substring(0, 50) : 'none'}`);
  });
}
