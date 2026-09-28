const fs = require('fs');
const path = require('path');
const PizZip = require('pizzip');

const filePath = path.join(__dirname, '..', 'public', 'templates', 'Aval-varioscapitulos.docx');
const zip = new PizZip(fs.readFileSync(filePath));
const xml = zip.file('word/document.xml').asText();
const plainText = xml.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ');

console.log('Plain text of Aval-varioscapitulos.docx:');
console.log(plainText);
