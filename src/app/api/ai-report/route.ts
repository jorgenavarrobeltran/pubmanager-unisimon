import { GoogleGenAI } from '@google/genai';
import { NextRequest } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';

/* ─── Helpers to paginate past 1000-row PostgREST limit ─── */
async function fetchAll(supabase: any, table: string, select: string) {
  const all: any[] = [];
  let offset = 0;
  while (true) {
    const { data, error } = await supabase.from(table).select(select).range(offset, offset + 999);
    if (error) { console.error(`fetchAll(${table}):`, error.message); break; }
    if (!data || data.length === 0) break;
    all.push(...data);
    if (data.length < 1000) break;
    offset += 1000;
  }
  return all;
}

/* ─── Data fetchers by report type ─── */
async function getBooksData(supabase: any, yearFrom: number, yearTo: number) {
  const books = await fetchAll(supabase, 'books', '*');
  const chapters = await fetchAll(supabase, 'book_chapters', 'id, book_id, title');
  const authorLinks = await fetchAll(supabase, 'book_authors', 'book_id, person_id, role');

  const published = books.filter(
    (b: any) => b.status === 'publicado' && b.year_published >= yearFrom && b.year_published <= yearTo
  );
  const publishedIds = new Set(published.map((b: any) => b.id));
  const filteredChapters = chapters.filter((c: any) => publishedIds.has(c.book_id));
  const filteredAuthors = authorLinks.filter((a: any) => publishedIds.has(a.book_id));

  // Build yearly summary
  const yearMap = new Map<number, any>();
  for (let y = yearFrom; y <= yearTo; y++) {
    yearMap.set(y, { libros: 0, capitulos: 0, autores: new Set(), completo: 0, compilatorio: 0, memorias: 0, cartilla: 0, isbn: 0 });
  }
  for (const b of published) {
    const y = yearMap.get(b.year_published);
    if (!y) continue;
    y.libros++;
    if (b.book_type === 'libro_completo') y.completo++;
    if (b.book_type === 'libro_compilatorio') y.compilatorio++;
    if (b.book_type === 'memorias') y.memorias++;
    if (b.book_type === 'cartilla_manual') y.cartilla++;
    if (b.isbn_digital || b.isbn_print) y.isbn++;
  }
  for (const c of filteredChapters) {
    const book = published.find((b: any) => b.id === c.book_id);
    if (book && yearMap.has(book.year_published)) yearMap.get(book.year_published).capitulos++;
  }
  for (const a of filteredAuthors) {
    const book = published.find((b: any) => b.id === a.book_id);
    if (book && yearMap.has(book.year_published)) yearMap.get(book.year_published).autores.add(a.person_id);
  }

  const yearlyTable = Array.from(yearMap.entries()).map(([year, d]) => ({
    año: year, libros: d.libros, capitulos: d.capitulos, autores_unicos: d.autores.size,
    completo: d.completo, compilatorio: d.compilatorio, memorias: d.memorias, cartilla: d.cartilla, isbn: d.isbn,
  }));

  // Format distribution
  const formats: Record<string, number> = {};
  for (const b of published) { const f = b.format || 'sin_datos'; formats[f] = (formats[f] || 0) + 1; }

  // Minciencias
  const tipoMinc: Record<string, number> = {};
  for (const b of published) { if (b.tipo_minciencias) tipoMinc[b.tipo_minciencias] = (tipoMinc[b.tipo_minciencias] || 0) + 1; }

  // Roles
  const roles: Record<string, number> = {};
  for (const a of filteredAuthors) { roles[a.role] = (roles[a.role] || 0) + 1; }

  return {
    resumen: {
      total_libros: published.length,
      total_capitulos: filteredChapters.length,
      autores_unicos: new Set(filteredAuthors.map((a: any) => a.person_id)).size,
      isbn_registrados: published.filter((b: any) => b.isbn_digital || b.isbn_print).length,
      promedio_anual: yearlyTable.length > 0 ? (published.length / yearlyTable.length).toFixed(1) : '0',
    },
    tabla_anual: yearlyTable,
    distribucion_formato: formats,
    clasificacion_minciencias: tipoMinc,
    roles_autoria: roles,
  };
}

async function getJournalsData(supabase: any) {
  const { data: journals, error } = await supabase.from('journals').select('*');
  if (error) console.error('getJournalsData:', error.message);
  if (!journals) return { revistas: [] };

  // Fetch indexation history from the separate table
  const { data: indexations, error: idxErr } = await supabase
    .from('journal_indexations')
    .select('journal_id, indexer, category, year, subject_category')
    .order('year', { ascending: false });
  if (idxErr) console.error('getJournalsData indexations:', idxErr.message);

  const idxByJournal = new Map<string, any[]>();
  for (const idx of (indexations || [])) {
    if (!idxByJournal.has(idx.journal_id)) idxByJournal.set(idx.journal_id, []);
    idxByJournal.get(idx.journal_id)!.push(idx);
  }

  // Build per-journal summary with indexation details
  const revistas = journals.map((j: any) => {
    const idxList = idxByJournal.get(j.id) || [];
    const latestScopus = idxList.find((i: any) => i.indexer === 'scopus');
    const latestPublindex = idxList.find((i: any) => i.indexer === 'publindex');

    return {
      nombre: j.title || j.name,
      issn: j.issn,
      cuartil_scopus_actual: latestScopus ? `${latestScopus.category} (${latestScopus.year})` : 'No indexada en Scopus',
      subject_category_scopus: latestScopus?.subject_category || null,
      categoria_publindex_actual: latestPublindex ? `${latestPublindex.category} (${latestPublindex.year})` : 'No categorizada en Publindex',
      historial_indexaciones: idxList.map((i: any) => ({
        indexador: i.indexer,
        categoria: i.category,
        año: i.year,
        area_tematica: i.subject_category,
      })),
      estado: j.status,
      periodicidad: j.periodicity,
      url: j.url,
    };
  });

  // Aggregated stats
  const conScopus = revistas.filter((r: any) => !r.cuartil_scopus_actual.includes('No indexada')).length;
  const conPublindex = revistas.filter((r: any) => !r.categoria_publindex_actual.includes('No categorizada')).length;

  return {
    total_revistas: journals.length,
    revistas_en_scopus: conScopus,
    revistas_en_publindex: conPublindex,
    revistas,
  };
}

async function getFinancesData(supabase: any, yearFrom: number, yearTo: number) {
  const { data: expenses, error } = await supabase.from('expenses').select('*');
  if (error) console.error('getFinancesData:', error.message);
  if (!expenses) return { gastos: [] };

  const filtered = expenses.filter((e: any) => {
    const year = new Date(e.date).getFullYear();
    return year >= yearFrom && year <= yearTo;
  });

  const byCategory: Record<string, number> = {};
  const byYear: Record<number, number> = {};
  for (const e of filtered) {
    byCategory[e.category] = (byCategory[e.category] || 0) + (e.amount || 0);
    const y = new Date(e.date).getFullYear();
    byYear[y] = (byYear[y] || 0) + (e.amount || 0);
  }

  return {
    total_gastos: filtered.reduce((s: number, e: any) => s + (e.amount || 0), 0),
    num_transacciones: filtered.length,
    gastos_por_categoria: byCategory,
    gastos_por_año: byYear,
  };
}

async function getAllData(supabase: any, yearFrom: number, yearTo: number) {
  const [books, journals, finances] = await Promise.all([
    getBooksData(supabase, yearFrom, yearTo),
    getJournalsData(supabase),
    getFinancesData(supabase, yearFrom, yearTo),
  ]);
  return { libros: books, revistas: journals, finanzas: finances };
}

/* ─── System prompt builder ─── */
function buildSystemPrompt(reportLength: string): string {
  const lengthInstructions: Record<string, string> = {
    brief: `- Extensión MÁXIMA: 300 palabras. Sé extremadamente conciso.
- NO uses secciones largas. Solo una tabla resumen y 3-5 bullets con cifras clave.
- NO incluyas recomendaciones ni análisis extenso. Solo datos duros.
- Formato: Un título, una tabla de resumen, y una lista corta de hallazgos principales.`,
    executive: `- Extensión: entre 500 y 700 palabras.
- Incluye una sección breve de "Hallazgos Clave" (5-7 bullets) y una de "Recomendaciones" (3-4 bullets).
- Una tabla resumen y análisis conciso de tendencias principales.
- Tono directo: va al grano con las cifras más relevantes.`,
    detailed: `- Extensión: entre 1200 y 1800 palabras.
- Incluye secciones completas: Hallazgos Clave, Análisis por área, Fortalezas, Debilidades, y Recomendaciones detalladas.
- Usa múltiples tablas para desglosar datos por año, tipo, categoría, etc.
- Incluye análisis de tendencias año a año con porcentajes de cambio.
- Relaciona los datos con estándares de Minciencias, Scopus, Publindex.`,
  };

  return `Eres un analista experto en gestión editorial universitaria. Trabajas para la Dirección de Publicaciones de la Universidad Simón Bolívar (Barranquilla, Colombia).

Tu rol es generar informes inteligentes basados en datos reales del sistema PubManager. Debes:

1. **Analizar tendencias**: Identificar patrones de crecimiento/decrecimiento año a año
2. **Comparar períodos**: Contrastar años entre sí y señalar cambios significativos
3. **Detectar fortalezas y debilidades**: Señalar lo que funciona bien y lo que necesita atención
4. **Dar recomendaciones accionables**: Sugerir mejoras concretas basadas en los datos
5. **Contextualizar**: Relacionar con estándares de calidad editorial (Minciencias, Scopus, Publindex)

Reglas de ESTRUCTURA (MUY IMPORTANTE):
- Cuando el informe cubra múltiples áreas (libros, revistas, finanzas), CADA ÁREA debe tener su PROPIA SECCIÓN separada con encabezado ## independiente
- NUNCA mezcles datos de libros y revistas en la misma tabla. Cada tabla debe ser de UN SOLO tema
- Tabla de Revistas: una fila por revista, con columnas de nombre, Scopus, Publindex, estado
- Tabla de Libros: una fila por año, con columnas de producción, tipos, ISBN
- Al final puedes tener una sección transversal de "Conclusiones y Recomendaciones" que relacione ambas áreas

Reglas de formato:
- Escribe en español
- Usa formato Markdown rico: encabezados ##, **negritas**, tablas, listas, emojis para secciones
- Sé específico: cita números exactos, porcentajes y años
- Tono: profesional pero accesible, como un informe para un vicerrector académico
${lengthInstructions[reportLength] || lengthInstructions.executive}`;
}

/* ─── Route handler ─── */
export async function POST(req: NextRequest) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return Response.json({ error: 'GEMINI_API_KEY no configurada en .env.local' }, { status: 500 });
  }

  const { reportTypes, yearFrom, yearTo, reportLength, customPrompt } = await req.json();

  // Create authenticated server Supabase client
  const supabase = await createServerSupabaseClient();

  // Support both legacy single type and new multi-type
  const types: string[] = Array.isArray(reportTypes) ? reportTypes : [reportTypes];

  if (types.length === 0) {
    return Response.json({ error: 'Selecciona al menos un tipo de informe' }, { status: 400 });
  }

  // Fetch data for each selected type
  const data: Record<string, any> = {};
  const sections: string[] = [];

  const fetchers: Record<string, () => Promise<any>> = {
    books: () => getBooksData(supabase, yearFrom, yearTo),
    journals: () => getJournalsData(supabase),
    finances: () => getFinancesData(supabase, yearFrom, yearTo),
  };
  const labels: Record<string, string> = {
    books: 'LIBROS Y CAPÍTULOS',
    journals: 'REVISTAS CIENTÍFICAS',
    finances: 'GESTIÓN FINANCIERA',
  };

  // Handle special types
  const isCustom = types.includes('custom');
  const isExecutive = types.includes('executive');
  const modulesToFetch = isExecutive
    ? ['books', 'journals', 'finances']
    : types.filter(t => t !== 'custom' && t !== 'executive');

  await Promise.all(
    modulesToFetch.map(async (t) => {
      if (fetchers[t]) {
        data[t] = await fetchers[t]();
        sections.push(labels[t] || t);
      }
    })
  );

  let basePrompt: string;
  if (isCustom && customPrompt) {
    basePrompt = customPrompt;
  } else if (isExecutive || modulesToFetch.length === 3) {
    basePrompt = `Genera un INFORME EJECUTIVO GENERAL de toda la gestión editorial para el período ${yearFrom}–${yearTo}. Cubre: ${sections.join(', ')}.`;
  } else if (sections.length > 1) {
    basePrompt = `Genera un informe ejecutivo COMBINADO que analice: ${sections.join(' y ')} de la editorial universitaria para el período ${yearFrom}–${yearTo}. Analiza cada área y también las relaciones entre ellas.`;
  } else if (sections.length === 1) {
    basePrompt = `Genera un informe ejecutivo sobre ${sections[0]} de la editorial universitaria para el período ${yearFrom}–${yearTo}.`;
  } else {
    basePrompt = 'Genera un análisis general de la producción editorial.';
  }

  const userPrompt = `${basePrompt}

${customPrompt && !isCustom ? `\nENFOQUE ESPECIAL SOLICITADO POR EL USUARIO: ${customPrompt}\n` : ''}

DATOS REALES DEL SISTEMA (JSON):
\`\`\`json
${JSON.stringify(data, null, 2)}
\`\`\`

Genera el informe basado exclusivamente en estos datos. No inventes cifras.`;

  try {
    const ai = new GoogleGenAI({ apiKey });

    const response = await ai.models.generateContentStream({
      model: 'gemini-3.5-flash',
      contents: [{ role: 'user', parts: [{ text: userPrompt }] }],
      config: {
        systemInstruction: buildSystemPrompt(reportLength || 'executive'),
        temperature: 0.7,
        maxOutputTokens: 4096,
      },
    });

    // Stream the response
    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      async start(controller) {
        try {
          for await (const chunk of response) {
            const text = chunk.text || '';
            if (text) {
              controller.enqueue(encoder.encode(text));
            }
          }
          controller.close();
        } catch (err) {
          controller.error(err);
        }
      },
    });

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/plain; charset=utf-8',
        'Transfer-Encoding': 'chunked',
        'Cache-Control': 'no-cache',
      },
    });
  } catch (err: any) {
    console.error('Gemini error:', err);
    return Response.json({ error: err.message || 'Error al generar informe' }, { status: 500 });
  }
}
