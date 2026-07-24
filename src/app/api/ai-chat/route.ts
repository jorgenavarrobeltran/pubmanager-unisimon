import { GoogleGenAI, Type } from '@google/genai';
import { NextRequest } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';

/* ─── Helpers ─── */
async function fetchAll(supabase: any, table: string, select: string, filters?: any) {
  const all: any[] = [];
  let offset = 0;
  while (true) {
    let query = supabase.from(table).select(select).range(offset, offset + 999);
    if (filters) {
      for (const [key, val] of Object.entries(filters)) {
        query = query.eq(key, val);
      }
    }
    const { data, error } = await query;
    if (error) { console.error(`fetchAll(${table}):`, error.message); break; }
    if (!data || data.length === 0) break;
    all.push(...data);
    if (data.length < 1000) break;
    offset += 1000;
  }
  return all;
}

/* ═══════════════════════════════════════════════
   READ-ONLY TOOLS (Query)
   ═══════════════════════════════════════════════ */

async function queryBooks(supabase: any, params: any) {
  const books = await fetchAll(supabase, 'books', '*, book_authors(person_id, role, persons(full_name))');
  
  let filtered = books;
  if (params.year) filtered = filtered.filter((b: any) => b.year_published === params.year);
  if (params.year_from && params.year_to) {
    filtered = filtered.filter((b: any) => b.year_published >= params.year_from && b.year_published <= params.year_to);
  }
  if (params.book_type) filtered = filtered.filter((b: any) => b.book_type === params.book_type);
  if (params.status) filtered = filtered.filter((b: any) => b.status === params.status);
  if (params.author_name) {
    const searchName = params.author_name.toLowerCase();
    filtered = filtered.filter((b: any) => 
      b.book_authors?.some((a: any) => a.persons?.full_name?.toLowerCase().includes(searchName))
    );
  }
  if (params.search) {
    const searchTerm = params.search.toLowerCase();
    filtered = filtered.filter((b: any) => b.title?.toLowerCase().includes(searchTerm));
  }
  
  const allAuthors = new Set<string>();
  filtered.forEach((b: any) => b.book_authors?.forEach((a: any) => { if (a.persons?.full_name) allAuthors.add(a.persons.full_name); }));
  const byYear: Record<number, number> = {};
  filtered.forEach((b: any) => { byYear[b.year_published] = (byYear[b.year_published] || 0) + 1; });
  const byType: Record<string, number> = {};
  filtered.forEach((b: any) => { byType[b.book_type || 'sin_tipo'] = (byType[b.book_type || 'sin_tipo'] || 0) + 1; });
  
  return {
    total_encontrados: filtered.length,
    distribucion_por_año: byYear,
    distribucion_por_tipo: byType,
    autores_unicos: allAuthors.size,
    libros: filtered.slice(0, 20).map((b: any) => ({
      titulo: b.title, año: b.year_published, tipo: b.book_type, estado: b.status,
      isbn: b.isbn_digital || b.isbn_print || null,
      autores: b.book_authors?.map((a: any) => a.persons?.full_name).filter(Boolean).join(', ') || 'Sin autores',
      observaciones: b.notes || null, url: b.repository_url || null,
    })),
    nota: filtered.length > 20 ? `Mostrando 20 de ${filtered.length} resultados` : undefined,
  };
}

async function queryJournals(supabase: any, params: any) {
  const { data: journals } = await supabase.from('journals').select('*');
  const { data: indexations } = await supabase.from('journal_indexations')
    .select('journal_id, indexer, category, year, subject_category, status')
    .order('year', { ascending: false });
  
  let filtered = journals || [];
  if (params.search) {
    const s = params.search.toLowerCase();
    filtered = filtered.filter((j: any) => j.name?.toLowerCase().includes(s) || j.title?.toLowerCase().includes(s));
  }
  if (params.type) filtered = filtered.filter((j: any) => j.type === params.type);
  
  const idxByJournal = new Map<string, any[]>();
  (indexations || []).forEach((idx: any) => {
    if (!idxByJournal.has(idx.journal_id)) idxByJournal.set(idx.journal_id, []);
    idxByJournal.get(idx.journal_id)!.push(idx);
  });
  
  return {
    total_revistas: filtered.length,
    en_scopus: filtered.filter((j: any) => (idxByJournal.get(j.id) || []).some((i: any) => i.indexer === 'scopus')).length,
    revistas: filtered.map((j: any) => {
      const idx = idxByJournal.get(j.id) || [];
      return {
        nombre: j.name || j.title, tipo: j.type, issn: j.issn_online || j.issn_print,
        scopus: idx.find((i: any) => i.indexer === 'scopus')?.category || 'No indexada',
        publindex: idx.find((i: any) => i.indexer === 'publindex')?.category || 'No categorizada',
      };
    }),
  };
}

async function queryFinances(supabase: any, params: any) {
  const { data: expenses } = await supabase.from('expenses').select('*');
  const { data: incomes } = await supabase.from('external_services').select('*');
  let filteredE = expenses || [];
  let filteredI = (incomes || []).filter((i: any) => ['facturado', 'pagado'].includes(i.status));
  if (params.year) {
    filteredE = filteredE.filter((e: any) => new Date(e.date).getFullYear() === params.year);
    filteredI = filteredI.filter((i: any) => new Date(i.date || i.created_at).getFullYear() === params.year);
  }
  if (params.category) filteredE = filteredE.filter((e: any) => e.category === params.category);
  const totalG = filteredE.reduce((s: number, e: any) => s + (e.amount || 0), 0);
  const totalI = filteredI.reduce((s: number, i: any) => s + (i.amount || 0), 0);
  const byCategory: Record<string, number> = {};
  filteredE.forEach((e: any) => { byCategory[e.category || 'otro'] = (byCategory[e.category || 'otro'] || 0) + (e.amount || 0); });
  return { total_gastos: totalG, total_ingresos: totalI, balance: totalI - totalG, gastos_por_categoria: byCategory };
}

async function queryAuthors(supabase: any, params: any) {
  const ba = await fetchAll(supabase, 'book_authors', 'book_id, person_id, role, persons(full_name), books(title, year_published, status)');
  const map = new Map<string, { name: string; count: number; roles: Record<string, number> }>();
  for (const a of ba) {
    if (!a.persons?.full_name || a.books?.status !== 'publicado') continue;
    if (!map.has(a.person_id)) map.set(a.person_id, { name: a.persons.full_name, count: 0, roles: {} });
    const au = map.get(a.person_id)!;
    au.count++;
    au.roles[a.role] = (au.roles[a.role] || 0) + 1;
  }
  let authors = Array.from(map.values());
  if (params.name) { const s = params.name.toLowerCase(); authors = authors.filter(a => a.name.toLowerCase().includes(s)); }
  if (params.min_books) authors = authors.filter(a => a.count >= params.min_books);
  authors.sort((a, b) => b.count - a.count);
  return { total_autores: authors.length, ranking: authors.slice(0, params.limit || 20) };
}

async function queryChapters(supabase: any, params: any) {
  const chapters = await fetchAll(supabase, 'book_chapters', '*, books(title, year_published, status)');
  let filtered = chapters.filter((c: any) => c.books?.status === 'publicado');
  if (params.year) filtered = filtered.filter((c: any) => c.books?.year_published === params.year);
  if (params.search) { const s = params.search.toLowerCase(); filtered = filtered.filter((c: any) => c.title?.toLowerCase().includes(s)); }
  return { total: filtered.length, capitulos: filtered.slice(0, 20).map((c: any) => ({ titulo: c.title, libro: c.books?.title, año: c.books?.year_published })) };
}

async function getGeneralStats(supabase: any) {
  const { count: bookCount } = await supabase.from('books').select('*', { count: 'exact', head: true }).eq('status', 'publicado');
  const { count: chapterCount } = await supabase.from('book_chapters').select('*', { count: 'exact', head: true });
  const { count: journalCount } = await supabase.from('journals').select('*', { count: 'exact', head: true });
  const { count: certCount } = await supabase.from('certificates').select('*', { count: 'exact', head: true });
  return { libros_publicados: bookCount || 0, capitulos: chapterCount || 0, revistas: journalCount || 0, certificados: certCount || 0 };
}

/* ═══════════════════════════════════════════════
   WRITE TOOLS (Create/Update records)
   ═══════════════════════════════════════════════ */

async function createBook(supabase: any, params: any) {
  // Build payload matching books table schema
  const payload: any = {
    title: params.title,
    subtitle: params.subtitle || null,
    book_type: params.book_type || 'libro_completo',
    edition_type: params.edition_type || 'propio',
    isbn_digital: params.isbn_digital || null,
    isbn_print: params.isbn_print || null,
    doi: params.doi || null,
    issn: params.issn || null,
    repository_url: params.repository_url || null,
    editorial: params.editorial || 'Ediciones Universidad Simón Bolívar',
    current_stage: params.current_stage || 'propuesta',
    status: params.status || 'en_proceso',
    year_published: params.year_published || null,
    page_count: params.page_count || null,
    format: params.format || 'digital',
    notes: params.notes || null,
  };

  const { data, error } = await supabase.from('books').insert(payload).select().single();
  if (error) return { success: false, error: error.message };
  
  // If authors provided, create persons + link them
  const authorResults: string[] = [];
  if (params.authors && Array.isArray(params.authors)) {
    for (const author of params.authors) {
      const name = typeof author === 'string' ? author : author.name;
      const role = typeof author === 'string' ? 'autor' : (author.role || 'autor');
      
      if (!name) continue;
      
      // Find or create person
      const { data: existing } = await supabase.from('people')
        .select('id').ilike('full_name', name).limit(1).single();
      
      let personId: string;
      if (existing) {
        personId = existing.id;
      } else {
        const { data: newPerson, error: pErr } = await supabase.from('people')
          .insert({ full_name: name }).select('id').single();
        if (pErr) { authorResults.push(`⚠ No se pudo crear autor: ${name}`); continue; }
        personId = newPerson.id;
      }
      
      // Link to book
      const { error: linkErr } = await supabase.from('book_authors')
        .insert({ book_id: data.id, person_id: personId, role });
      
      if (linkErr) { authorResults.push(`⚠ No se pudo vincular: ${name}`); }
      else { authorResults.push(`✅ ${name} (${role})`); }
    }
  }

  return {
    success: true,
    book_id: data.id,
    title: data.title,
    code: data.code,
    autores_registrados: authorResults,
    url: `/books`,
    message: `Libro "${data.title}" creado exitosamente`,
  };
}

async function createExpense(supabase: any, params: any) {
  const payload = {
    description: params.description,
    amount: params.amount,
    category: params.category || 'otro',
    date: params.date || new Date().toISOString().split('T')[0],
    notes: params.notes || null,
    vendor: params.vendor || null,
  };
  
  const { data, error } = await supabase.from('expenses').insert(payload).select().single();
  if (error) return { success: false, error: error.message };
  return { success: true, expense_id: data.id, message: `Gasto "$${params.amount}" registrado` };
}

async function createChapter(supabase: any, params: any) {
  // Find book by title if book_title provided instead of book_id
  let bookId = params.book_id;
  if (!bookId && params.book_title) {
    const { data } = await supabase.from('books').select('id')
      .ilike('title', `%${params.book_title}%`).limit(1).single();
    if (data) bookId = data.id;
    else return { success: false, error: `No se encontró el libro: "${params.book_title}"` };
  }
  if (!bookId) return { success: false, error: 'Se requiere book_id o book_title' };
  
  const payload = {
    book_id: bookId,
    title: params.title,
    page_start: params.page_start || null,
    page_end: params.page_end || null,
  };
  
  const { data, error } = await supabase.from('book_chapters').insert(payload).select().single();
  if (error) return { success: false, error: error.message };
  
  // Register chapter authors if provided
  const authorResults: string[] = [];
  if (params.authors && Array.isArray(params.authors)) {
    for (const name of params.authors) {
      if (!name) continue;
      const { data: existing } = await supabase.from('people')
        .select('id').ilike('full_name', name).limit(1).single();
      
      let personId: string;
      if (existing) {
        personId = existing.id;
      } else {
        const { data: newPerson, error: pErr } = await supabase.from('people')
          .insert({ full_name: name }).select('id').single();
        if (pErr) { authorResults.push(`⚠ ${name}`); continue; }
        personId = newPerson.id;
      }
      
      await supabase.from('chapter_authors')
        .insert({ chapter_id: data.id, person_id: personId, role: 'autor' });
      authorResults.push(`✅ ${name}`);
    }
  }
  
  return { success: true, chapter_id: data.id, title: data.title, autores: authorResults, message: `Capítulo "${data.title}" registrado` };
}

/* ─── Tool declarations for Gemini ─── */
const tools: any[] = [
  {
    functionDeclarations: [
      // ── READ tools ──
      {
        name: 'query_books',
        description: 'Buscar y analizar libros publicados. Puede filtrar por año, tipo, autor, estado.',
        parameters: {
          type: Type.OBJECT,
          properties: {
            year: { type: Type.NUMBER, description: 'Año específico' },
            year_from: { type: Type.NUMBER, description: 'Año inicio del rango' },
            year_to: { type: Type.NUMBER, description: 'Año fin del rango' },
            book_type: { type: Type.STRING, description: 'Tipo: libro_completo, libro_compilatorio, memorias, cartilla_manual' },
            status: { type: Type.STRING, description: 'Estado: publicado, en_proceso, en_revision' },
            author_name: { type: Type.STRING, description: 'Nombre o apellido del autor' },
            search: { type: Type.STRING, description: 'Buscar en el título' },
          },
        },
      },
      {
        name: 'query_journals',
        description: 'Consultar revistas científicas, indexaciones Scopus/Publindex.',
        parameters: {
          type: Type.OBJECT,
          properties: {
            search: { type: Type.STRING, description: 'Buscar por nombre' },
            type: { type: Type.STRING, description: 'Tipo: cientifica, academica' },
          },
        },
      },
      {
        name: 'query_finances',
        description: 'Consultar gastos, ingresos, balance financiero.',
        parameters: {
          type: Type.OBJECT,
          properties: {
            year: { type: Type.NUMBER }, year_from: { type: Type.NUMBER }, year_to: { type: Type.NUMBER },
            category: { type: Type.STRING },
          },
        },
      },
      {
        name: 'query_authors',
        description: 'Consultar productividad de autores, ranking.',
        parameters: {
          type: Type.OBJECT,
          properties: {
            name: { type: Type.STRING }, min_books: { type: Type.NUMBER }, limit: { type: Type.NUMBER },
          },
        },
      },
      {
        name: 'query_chapters',
        description: 'Consultar capítulos de libros.',
        parameters: {
          type: Type.OBJECT,
          properties: {
            year: { type: Type.NUMBER }, search: { type: Type.STRING },
          },
        },
      },
      {
        name: 'get_general_stats',
        description: 'Estadísticas generales rápidas del sistema.',
        parameters: { type: Type.OBJECT, properties: {} },
      },
      // ── WRITE tools ──
      {
        name: 'create_book',
        description: 'Crear un nuevo libro en el sistema. Usa esto cuando el usuario envíe una imagen de un libro, pantalla o datos y quiera registrarlo. Extrae TODOS los datos posibles de la imagen: título, subtítulo, autores, ISBN, editorial, año, tipo, formato, páginas, DOI, etc.',
        parameters: {
          type: Type.OBJECT,
          properties: {
            title: { type: Type.STRING, description: 'Título del libro (obligatorio)' },
            subtitle: { type: Type.STRING, description: 'Subtítulo si existe' },
            book_type: { type: Type.STRING, description: 'libro_completo, libro_compilatorio, memorias, cartilla_manual' },
            edition_type: { type: Type.STRING, description: 'propio, coedicion, participacion_externa' },
            isbn_digital: { type: Type.STRING, description: 'ISBN digital/electrónico' },
            isbn_print: { type: Type.STRING, description: 'ISBN impreso' },
            doi: { type: Type.STRING, description: 'DOI del libro' },
            issn: { type: Type.STRING, description: 'ISSN si aplica' },
            repository_url: { type: Type.STRING, description: 'URL del repositorio' },
            editorial: { type: Type.STRING, description: 'Editorial/sello editor' },
            year_published: { type: Type.NUMBER, description: 'Año de publicación' },
            page_count: { type: Type.NUMBER, description: 'Número de páginas' },
            format: { type: Type.STRING, description: 'digital, impreso, ambos' },
            current_stage: { type: Type.STRING, description: 'Etapa: propuesta, publicacion, etc.' },
            status: { type: Type.STRING, description: 'en_proceso, publicado, cancelado' },
            notes: { type: Type.STRING, description: 'Observaciones o notas adicionales' },
            authors: {
              type: Type.ARRAY,
              description: 'Lista de autores con nombre completo y rol',
              items: {
                type: Type.OBJECT,
                properties: {
                  name: { type: Type.STRING, description: 'Nombre completo del autor' },
                  role: { type: Type.STRING, description: 'autor, editor, compilador, prologuista, traductor' },
                },
              },
            },
          },
          required: ['title'],
        },
      },
      {
        name: 'create_chapter',
        description: 'Crear un capítulo de libro. Usa cuando el usuario envíe datos de un capítulo.',
        parameters: {
          type: Type.OBJECT,
          properties: {
            title: { type: Type.STRING, description: 'Título del capítulo' },
            book_id: { type: Type.STRING, description: 'ID del libro (UUID)' },
            book_title: { type: Type.STRING, description: 'Título del libro (si no se tiene el ID)' },
            page_start: { type: Type.NUMBER, description: 'Página inicio' },
            page_end: { type: Type.NUMBER, description: 'Página fin' },
            authors: {
              type: Type.ARRAY, description: 'Nombres de los autores del capítulo',
              items: { type: Type.STRING },
            },
          },
          required: ['title'],
        },
      },
      {
        name: 'create_expense',
        description: 'Registrar un gasto. Usa cuando el usuario envíe facturas, recibos o mencione gastos.',
        parameters: {
          type: Type.OBJECT,
          properties: {
            description: { type: Type.STRING, description: 'Descripción del gasto' },
            amount: { type: Type.NUMBER, description: 'Monto en pesos colombianos' },
            category: { type: Type.STRING, description: 'proveedor, materiales, eventos_talleres, viaticos, suscripciones, otro' },
            date: { type: Type.STRING, description: 'Fecha YYYY-MM-DD' },
            vendor: { type: Type.STRING, description: 'Proveedor' },
            notes: { type: Type.STRING, description: 'Notas adicionales' },
          },
          required: ['description', 'amount'],
        },
      },
    ],
  },
  { googleSearch: {} },
];

/* ─── Execute tool call ─── */
async function executeTool(supabase: any, name: string, args: any): Promise<any> {
  switch (name) {
    // Read
    case 'query_books': return queryBooks(supabase, args);
    case 'query_journals': return queryJournals(supabase, args);
    case 'query_finances': return queryFinances(supabase, args);
    case 'query_authors': return queryAuthors(supabase, args);
    case 'query_chapters': return queryChapters(supabase, args);
    case 'get_general_stats': return getGeneralStats(supabase);
    // Write — these return proposed actions, not direct writes
    case 'create_book':
    case 'create_chapter':
    case 'create_expense':
      return { __action: name, __args: args, __status: 'pending_confirmation' };
    default: return { error: `Tool ${name} not found` };
  }
}

/* ─── Actually execute a write action (after confirmation) ─── */
async function executeWriteAction(supabase: any, action: string, args: any): Promise<any> {
  switch (action) {
    case 'create_book': return createBook(supabase, args);
    case 'create_chapter': return createChapter(supabase, args);
    case 'create_expense': return createExpense(supabase, args);
    default: return { error: `Unknown action: ${action}` };
  }
}

/* ─── System prompt ─── */
const SYSTEM_PROMPT = `Eres el asistente IA de **PubManager**, el sistema de gestión editorial de la Universidad Simón Bolívar (Barranquilla, Colombia).

Tu rol es ayudar al Director de Publicaciones. Puedes consultar datos Y crear registros nuevos.

**Capacidades:**
- 📊 Consultar libros, capítulos, autores, revistas y finanzas
- 🔍 Buscar en Google información externa
- 🖼️ Analizar imágenes (portadas, tablas, capturas, facturas, permisos)
- 🎙️ Escuchar notas de voz
- ✏️ **CREAR registros**: libros, capítulos, gastos — extrayendo datos de imágenes o texto

**Reglas para CREAR registros:**
1. Cuando el usuario envíe una IMAGEN de un libro (portada, página legal, ficha catalográfica) o te pida registrar un libro:
   - Analiza la imagen exhaustivamente y extrae TODOS los datos visibles
   - Llama a create_book con TODOS los campos que puedas identificar
   - Incluye TODOS los autores/editores/compiladores que veas
   - El sistema pedirá confirmación al usuario antes de guardar
2. Cuando envíe una factura o recibo: usa create_expense
3. Cuando envíe datos de capítulos: usa create_chapter
4. SIEMPRE muestra un resumen claro de los datos extraídos para que el usuario revise ANTES de confirmar
5. Si no puedes leer algún campo claramente, indícalo con "⚠️ No legible" y sugiere que el usuario lo complete

**Reglas generales:**
1. Usa las herramientas para consultar datos antes de responder. Nunca inventes cifras.
2. Responde en español, conciso pero informativo.
3. Usa Markdown: **negritas**, tablas, emojis.
4. Si algo es ambiguo, aclara tus suposiciones.
5. El año actual es ${new Date().getFullYear()}.

**Formato para datos extraídos:**
Cuando extraigas datos de una imagen, presenta los resultados así:
📋 **Datos extraídos:**
| Campo | Valor |
|-------|-------|
| Título | ... |
| Autores | ... |
(etc.)

Luego llama a la herramienta create_book/create_chapter/create_expense.

**Contexto:**
- Editorial por defecto: "Ediciones Universidad Simón Bolívar"
- Tipos de libro: libro_completo, libro_compilatorio, memorias, cartilla_manual
- Roles de autor: autor, editor, compilador, prologuista, traductor
- Categorías de gasto: proveedor, materiales, eventos_talleres, viaticos, suscripciones, otro`;

/* ─── Route handler ─── */
export async function POST(req: NextRequest) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return Response.json({ error: 'GEMINI_API_KEY no configurada' }, { status: 500 });

  const body = await req.json();
  const { messages, attachments, confirmAction } = body;

  const supabase = await createServerSupabaseClient();

  // ── Handle action confirmation ──
  if (confirmAction) {
    const result = await executeWriteAction(supabase, confirmAction.action, confirmAction.args);
    return Response.json({ response: null, actionResult: result });
  }

  if (!messages || !Array.isArray(messages) || messages.length === 0) {
    return Response.json({ error: 'Se requiere al menos un mensaje' }, { status: 400 });
  }

  const ai = new GoogleGenAI({ apiKey });

  // Convert messages to Gemini format
  const contents = messages.map((m: any, idx: number) => {
    const parts: any[] = [];
    if (m.content) parts.push({ text: m.content });
    
    // Add attachments to the LAST user message
    if (m.role === 'user' && idx === messages.length - 1 && attachments?.length) {
      for (const att of attachments) {
        if ((att.type === 'image' || att.type === 'audio') && att.data) {
          parts.push({
            inlineData: {
              mimeType: att.mimeType || (att.type === 'image' ? 'image/jpeg' : 'audio/webm'),
              data: att.data,
            },
          });
        }
      }
    }
    
    return { role: m.role === 'assistant' ? 'model' : 'user', parts };
  });

  try {
    let response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents,
      config: { systemInstruction: SYSTEM_PROMPT, temperature: 0.7, maxOutputTokens: 4096, tools },
    });

    let pendingAction: any = null;
    let iterations = 0;

    while (iterations < 3) {
      const candidate = response.candidates?.[0];
      const parts = candidate?.content?.parts || [];
      const functionCalls = parts.filter((p: any) => p.functionCall);

      if (functionCalls.length === 0) break;

      const functionResponses = [];
      for (const part of functionCalls) {
        const { name, args } = part.functionCall!;
        const toolName = name || 'unknown';
        console.log(`[AI Chat] Tool: ${toolName}`, JSON.stringify(args).slice(0, 300));
        const result = await executeTool(supabase, toolName, args || {});
        
        // Intercept write actions — don't execute, return as pending
        if (result.__action) {
          pendingAction = { action: result.__action, args: result.__args };
          // Tell the model the action is pending user confirmation
          functionResponses.push({
            functionResponse: {
              name,
              response: { status: 'pending_confirmation', message: 'Acción pendiente de confirmación del usuario. Muestra un resumen de los datos extraídos para que el usuario los revise y confirme.' },
            },
          });
        } else {
          functionResponses.push({ functionResponse: { name, response: result } });
        }
      }

      contents.push({ role: 'model', parts });
      contents.push({ role: 'user', parts: functionResponses });

      response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents,
        config: { systemInstruction: SYSTEM_PROMPT, temperature: 0.7, maxOutputTokens: 4096, tools },
      });

      iterations++;
    }

    const finalText = response.candidates?.[0]?.content?.parts
      ?.filter((p: any) => p.text)
      .map((p: any) => p.text)
      .join('') || 'No pude generar una respuesta.';

    const groundingMetadata = response.candidates?.[0]?.groundingMetadata;
    const groundingChunks = groundingMetadata?.groundingChunks;

    return Response.json({
      response: finalText,
      sources: groundingChunks?.map((c: any) => ({ title: c.web?.title, url: c.web?.uri })).filter((s: any) => s.url) || [],
      pendingAction: pendingAction || null,
    });
  } catch (err: any) {
    console.error('[AI Chat] Error:', err);
    return Response.json({ error: err.message || 'Error al procesar la consulta' }, { status: 500 });
  }
}
