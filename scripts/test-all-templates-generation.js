const fs = require('fs');
const path = require('path');
const PizZip = require('pizzip');
const Docxtemplater = require('docxtemplater');

const templatesDir = path.join(__dirname, '..', 'public', 'templates');
const outDir = path.join(__dirname, '..', 'scripts', 'test_outputs');

fs.mkdirSync(outDir, { recursive: true });

const testCases = [
  {
    template: 'Aval-Libro.docx',
    data: {
      libro_titulo: 'CIENCIA E INNOVACIÓN EN EL CARIBE COLOMBIANO',
      autores: 'Jorge Navarro Beltrán, Luis Ortiz Ospino',
      isbn_impreso: '978-958-5430-10-1',
      isbn_digital: '978-958-5430-11-8',
      editorial: 'Ediciones Universidad Simón Bolívar',
      mes_publicacion: 'septiembre',
      anio_publicacion: '2024',
      dia_expedicion: '28',
      mes_expedicion: 'septiembre',
      anio_expedicion: '2024'
    }
  },
  {
    template: 'Aval-Capítulo.docx',
    data: {
      capitulo_titulo: 'Estrategias de Divulgación y Visibilidad Científica',
      libro_titulo: 'CIENCIA E INNOVACIÓN EN EL CARIBE COLOMBIANO',
      autores: 'Jorge Navarro Beltrán',
      isbn_impreso: '978-958-5430-10-1',
      isbn_digital: '978-958-5430-11-8',
      editorial: 'Ediciones Universidad Simón Bolívar',
      mes_publicacion: 'septiembre',
      anio_publicacion: '2024',
      dia_expedicion: '28',
      mes_expedicion: 'septiembre',
      anio_expedicion: '2024'
    }
  },
  {
    template: 'Aval-varioscapitulos.docx',
    data: {
      libro_titulo: 'COMPILATORIO DE INVESTIGACIONES EN SALUD Y SOCIEDAD',
      editores: 'Jorge Navarro Beltrán',
      isbn_digital: '978-958-5430-55-5',
      editorial: 'Ediciones Universidad Simón Bolívar',
      ciudad: 'Barranquilla',
      mes_publicacion: 'agosto',
      anio_publicacion: '2024',
      dia_expedicion: '28',
      mes_expedicion: 'septiembre',
      anio_expedicion: '2024',
      capitulos: [
        { cap_titulo: 'Capítulo 1: Salud Pública en el Caribe', cap_autores: 'Aldo Pardo García', paginas: '12-34' },
        { cap_titulo: 'Capítulo 2: Epidemiología Comunitaria', cap_autores: 'Enohemit Olivero Vega', paginas: '35-58' }
      ]
    }
  },
  {
    template: 'Créditos-Libro-Universidad Simón Bolívar.docx',
    data: {
      libro_titulo: 'CIENCIA E INNOVACIÓN EN EL CARIBE COLOMBIANO',
      anio_financiacion: '2024',
      dia_expedicion: '28',
      mes_expedicion: 'septiembre',
      anio_expedicion: '2024'
    }
  },
  {
    template: 'Créditos-Capítulo-Universidad Simón Bolívar.docx',
    data: {
      capitulo_titulo: 'Estrategias de Divulgación y Visibilidad Científica',
      libro_titulo: 'CIENCIA E INNOVACIÓN EN EL CARIBE COLOMBIANO',
      anio_financiacion: '2024',
      dia_expedicion: '28',
      mes_expedicion: 'septiembre',
      anio_expedicion: '2024'
    }
  },
  {
    template: 'Evaluación por pares-jefa de publicaciones.docx',
    data: {
      capitulo_titulo: 'Estrategias de Divulgación y Visibilidad Científica',
      autores: 'Jorge Navarro Beltrán',
      libro_titulo: 'CIENCIA E INNOVACIÓN EN EL CARIBE COLOMBIANO',
      isbn_impreso: '978-958-5430-10-1',
      isbn_digital: '978-958-5430-11-8',
      mes_publicacion: 'septiembre',
      anio_publicacion: '2024',
      dia_expedicion: '28',
      mes_expedicion: 'septiembre',
      anio_expedicion: '2024'
    }
  },
  {
    template: 'Certificado-Edicion-Revista-Libro.docx',
    data: {
      nombre_investigador: 'Jorge Armando Navarro Beltrán',
      tipo_documento: 'C.C.',
      numero_documento: '1.045.683.896',
      rol_editorial: 'Editor General',
      titulo_publicacion: 'Revista Desarrollo Gerencial',
      tipo_codigo: 'ISSN',
      codigo_issn_isbn: '2145-5147',
      volumen: 'Vol. 16',
      numero: 'No. 2',
      fecha_publicacion: 'julio - diciembre de 2024',
      enlace_publicacion: 'https://revistas.unisimon.edu.co/index.php/desarrollogerencial',
      dia_expedicion: '28',
      mes_expedicion: 'septiembre',
      anio_expedicion: '2024'
    }
  },
  {
    template: 'Certificado-Publicacion-No-Especializada.docx',
    data: {
      entidad_aliada: 'Alcaldía Distrital de Barranquilla',
      tipo_producto: 'Cartilla divulgativa',
      titulo_publicacion: 'Guía Ciudadana de Promoción de la Salud Comunitaria',
      autores: 'Jorge Navarro Beltrán, Investigadores Unisimón',
      proyecto_nombre: 'Fortalecimiento de la salud comunitaria en el Caribe',
      proyecto_codigo: 'PRY-CS-2024-001',
      paginas_totales: '24 páginas',
      publico_objetivo: 'Líderes comunales y ciudadanía general',
      ruta_circulacion: 'ciudadana y comunitaria',
      enfoque_diferencial: 'infancia, juventud o adulto mayor',
      url_bonga: 'https://bonga.unisimon.edu.co/handle/20.500.12442/12345',
      dia_expedicion: '28',
      mes_expedicion: 'septiembre',
      anio_expedicion: '2024'
    }
  },
  {
    template: 'Aval_LIB_DIV.docx',
    data: {
      libro_titulo: 'CONVERSACIONES SOBRE CIENCIA Y SOCIEDAD',
      autores: 'Jorge Navarro Beltrán',
      isbn_impreso: '978-958-5430-88-8',
      isbn_digital: '978-958-5430-89-5',
      url_bonga: 'https://bonga.unisimon.edu.co/handle/20.500.12442/9999',
      mes_publicacion: 'junio',
      anio_publicacion: '2024',
      dia_expedicion: '28',
      mes_expedicion: 'septiembre',
      anio_expedicion: '2024'
    }
  },
  {
    template: 'Certificado-Libro-Formacion.docx',
    data: {
      libro_titulo: 'FUNDAMENTOS DE METODOLOGÍA DE LA INVESTIGACIÓN CIENTÍFICA',
      autores: 'Jorge Navarro Beltrán, Luis Ortiz Ospino',
      isbn_impreso: '978-958-5430-77-7',
      isbn_digital: '978-958-5430-78-4',
      editorial: 'Ediciones Universidad Simón Bolívar',
      asignaturas_curriculares: 'Metodología de la Investigación I y II',
      unidad_academica: 'Facultad de Ciencias Jurídicas y Sociales',
      mes_publicacion: 'enero',
      anio_publicacion: '2024',
      dia_expedicion: '28',
      mes_expedicion: 'septiembre',
      anio_expedicion: '2024'
    }
  },
  {
    template: 'Certificado-Manual-Guia-Especializada.docx',
    data: {
      titulo_obra: 'MANUAL DE PROCEDIMIENTOS EDITORIALES Y EVALUACIÓN POR PARES',
      autores: 'Jorge Armando Navarro Beltrán',
      proyecto_nombre: 'Sistemas Integrados de Gestión Editorial Universitaria',
      proyecto_codigo: 'PRY-PUB-2024-002',
      entidad_financiadora: 'Universidad Simón Bolívar',
      isbn_deposito: 'ISBN: 978-958-5430-90-1',
      editorial: 'Ediciones Universidad Simón Bolívar',
      mes_publicacion: 'febrero',
      anio_publicacion: '2024',
      dia_expedicion: '28',
      mes_expedicion: 'septiembre',
      anio_expedicion: '2024'
    }
  },
  {
    template: 'Certificado-Boletin-Divulgativo.docx',
    data: {
      titulo_boletin: 'BOLETÍN EDITORIAL UNISIMÓN - VOCES CIENTÍFICAS',
      identificador_serie: 'ISSN 2665-0011',
      autores: 'Departamento de Publicaciones Unisimón',
      periodicidad: 'trimestral',
      numero: 'Vol. 4, No. 3',
      anio_publicacion: '2024',
      url_bonga: 'https://bonga.unisimon.edu.co/handle/20.500.12442/7777',
      dia_expedicion: '28',
      mes_expedicion: 'septiembre',
      anio_expedicion: '2024'
    }
  }
];

let passed = 0;
let failed = 0;

for (const tc of testCases) {
  const tplPath = path.join(templatesDir, tc.template);
  if (!fs.existsSync(tplPath)) {
    console.error(`[FAIL] Template not found: ${tc.template}`);
    failed++;
    continue;
  }

  try {
    const zip = new PizZip(fs.readFileSync(tplPath));
    const doc = new Docxtemplater(zip, {
      paragraphLoop: true,
      linebreaks: true,
      nullGetter: () => ''
    });

    doc.render(tc.data);

    const outBuf = doc.getZip().generate({ type: 'nodebuffer', compression: 'DEFLATE' });
    const outPath = path.join(outDir, 'Generated_' + tc.template);
    fs.writeFileSync(outPath, outBuf);
    console.log(`[PASS] Successfully generated: ${tc.template} -> ${outPath} (${outBuf.length} bytes)`);
    passed++;
  } catch (err) {
    console.error(`[FAIL] Error rendering ${tc.template}:`, err.message);
    failed++;
  }
}

console.log(`\n========================================`);
console.log(`Results: ${passed} PASSED, ${failed} FAILED out of ${testCases.length} tested.`);
console.log(`========================================`);
