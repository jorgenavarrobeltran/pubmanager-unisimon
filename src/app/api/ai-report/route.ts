import { GoogleGenAI } from '@google/genai';
import { NextRequest } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import initialAPCData from '@/lib/apc-initial-data.json';
import scopusBenchmark from '@/lib/scopus-benchmark.json';
import initialTranslationsData from '@/lib/translations-initial-data.json';

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

async function getMentoringData(supabase: any, yearFrom: number, yearTo: number) {
  const sessions = await fetchAll(supabase, 'mentoring_sessions', '*');
  const researchers = await fetchAll(supabase, 'researchers', 'id, name, faculty, category_2024');
  const groups = await fetchAll(supabase, 'research_groups', 'id, code, name, category_2024');

  // Filter sessions by session_date year
  const filtered = sessions.filter((s: any) => {
    if (!s.session_date) return true;
    const y = parseInt(String(s.session_date).substring(0, 4), 10);
    return isNaN(y) || (y >= yearFrom && y <= yearTo);
  });

  const porAccion: Record<string, number> = {};
  const porMentor: Record<string, { total: number; completadas: number; agendadas: number; invitaciones: number }> = {};
  const porFacultad: Record<string, number> = {};
  const porContacto: Record<string, number> = {};
  const porPlataforma: Record<string, number> = {};
  const investigadoresUnicos = new Set<string>();
  const gruposUnicos = new Set<string>();

  for (const s of filtered) {
    const act = s.action || 'Sin clasificar';
    porAccion[act] = (porAccion[act] || 0) + 1;

    const m = s.mentor_name || 'Sin mentor';
    if (!porMentor[m]) {
      porMentor[m] = { total: 0, completadas: 0, agendadas: 0, invitaciones: 0 };
    }
    porMentor[m].total++;
    if (s.action === 'Mentoría completada') porMentor[m].completadas++;
    if (s.action === 'Mentoría agendada') porMentor[m].agendadas++;
    if (s.action === 'Invitación enviada') porMentor[m].invitaciones++;

    const fac = s.researcher_faculty || 'No especificada';
    porFacultad[fac] = (porFacultad[fac] || 0) + 1;

    if (s.contact_method) {
      porContacto[s.contact_method] = (porContacto[s.contact_method] || 0) + 1;
    }
    if (s.platform_status) {
      porPlataforma[s.platform_status] = (porPlataforma[s.platform_status] || 0) + 1;
    }
    if (s.researcher_name) investigadoresUnicos.add(s.researcher_name);
    if (s.group_name || s.group_code) gruposUnicos.add(s.group_name || s.group_code);
  }

  const tablaMentores = Object.entries(porMentor).map(([mentor, stats]) => ({
    mentor,
    total_acciones: stats.total,
    mentorias_completadas: stats.completadas,
    agendadas: stats.agendadas,
    invitaciones: stats.invitaciones,
    tasa_cumplimiento: stats.total > 0 ? `${Math.round((stats.completadas / stats.total) * 100)}%` : '0%',
  })).sort((a, b) => b.total_acciones - a.total_acciones);

  return {
    resumen: {
      total_sesiones_registradas: filtered.length,
      mentorias_completadas: filtered.filter((s: any) => s.action === 'Mentoría completada').length,
      investigadores_atendidos_unicos: investigadoresUnicos.size,
      grupos_atendidos_unicos: gruposUnicos.size,
      total_investigadores_censo: researchers.length,
      total_grupos_investigacion: groups.length,
    },
    tabla_mentores: tablaMentores,
    distribucion_acciones: porAccion,
    distribucion_facultades: porFacultad,
    metodos_contacto: porContacto,
    estado_adopcion_plataforma: porPlataforma,
  };
}

const CERT_CATEGORY_LABELS: Record<string, string> = {
  aval: 'Avales y Tipología',
  creditos: 'Créditos y Financiación',
  evaluacion: 'Evaluación por Pares',
  erl: 'Edición Revistas/Libros (ERL)',
  no_especializada: 'No Especializada (Cartillas/Manuales)',
  formacion: 'Libros de Formación (LIB_FOR)',
  manual_guia: 'Manuales y Guías (MAN_GUI)',
  boletin: 'Boletines Divulgativos (BOL)',
  certificado_editorial: 'Certificados Editorial Externa',
  declaracion: 'Declaraciones de Autores',
};

async function getCertificatesData(supabase: any, yearFrom: number, yearTo: number) {
  const certs = await fetchAll(supabase, 'certificates', '*');

  const filtered = certs.filter((c: any) => {
    const dateStr = c.issue_date || c.created_at;
    if (!dateStr) return true;
    const y = parseInt(String(dateStr).substring(0, 4), 10);
    return isNaN(y) || (y >= yearFrom && y <= yearTo);
  });

  const porCategoria: Record<string, number> = {};
  const porTipoPub: Record<string, number> = {};
  const porTipoEditorial: Record<string, number> = {};
  const porEstado: Record<string, number> = {};
  const porAño: Record<number, number> = {};
  const destinatariosUnicos = new Set<string>();

  for (const c of filtered) {
    const rawCat = c.document_category || c.certificate_type || 'sin_categoria';
    const cat = CERT_CATEGORY_LABELS[rawCat] || rawCat;
    porCategoria[cat] = (porCategoria[cat] || 0) + 1;

    if (c.publication_type) {
      const pubType = c.publication_type === 'capitulo' ? 'Capítulos' : c.publication_type === 'libro' ? 'Libros' : c.publication_type;
      porTipoPub[pubType] = (porTipoPub[pubType] || 0) + 1;
    }

    const isExterna = c.document_category === 'certificado_editorial' ||
      c.editorial_type === 'editorial_externa' ||
      c.editorial_type === 'editorial_extranjera' ||
      c.certificate_type?.includes('extranjera') ||
      c.certificate_type?.includes('externa');

    const edLabel = isExterna ? 'Editorial Externa' :
      c.editorial_type === 'divulgacion' ? 'Divulgación' :
      'Sello Propio (Ediciones Universidad Simón Bolívar)';

    porTipoEditorial[edLabel] = (porTipoEditorial[edLabel] || 0) + 1;

    if (c.status) {
      porEstado[c.status] = (porEstado[c.status] || 0) + 1;
    }
    if (c.recipient_name) {
      destinatariosUnicos.add(c.recipient_name);
    }
    const dStr = c.issue_date || c.created_at;
    if (dStr) {
      const y = parseInt(String(dStr).substring(0, 4), 10);
      if (!isNaN(y)) porAño[y] = (porAño[y] || 0) + 1;
    }
  }

  return {
    resumen: {
      total_certificados_expedidos: filtered.length,
      destinatarios_unicos: destinatariosUnicos.size,
      categorias_activas: Object.keys(porCategoria).length,
      certificados_editorial_externa: porTipoEditorial['Editorial Externa'] || 0,
      certificados_sello_propio: porTipoEditorial['Sello Propio (Ediciones Universidad Simón Bolívar)'] || 0,
    },
    por_categoria: porCategoria,
    por_tipo_publicacion: porTipoPub,
    por_tipo_editorial: porTipoEditorial,
    por_estado: porEstado,
    por_año: porAño,
    ultimos_expedidos: filtered.slice(0, 15).map((c: any) => ({
      consecutivo: c.consecutive_number,
      destinatario: c.recipient_name,
      categoria: CERT_CATEGORY_LABELS[c.document_category] || c.document_category,
      editorial: c.generated_data?.editorial || (c.editorial_type === 'editorial_externa' ? 'Editorial Externa' : 'Ediciones Universidad Simón Bolívar'),
      referencia: c.title_reference,
      fecha: c.issue_date || c.created_at?.substring(0, 10),
    })),
  };
}

async function getTeamData(supabase: any) {
  const { data: users, error: uErr } = await supabase.from('user_profiles').select('*').order('full_name');
  if (uErr) console.error('getTeamData users:', uErr.message);

  const { data: journals, error: jErr } = await supabase.from('journals').select('id, name, editor_name, editor_email, status');
  if (jErr) console.error('getTeamData journals:', jErr.message);

  const profiles = users || [];
  const journalList = journals || [];

  const porRol: Record<string, number> = {};
  const activos = profiles.filter((u: any) => u.active !== false);

  for (const u of profiles) {
    const r = u.role || 'sin_rol';
    porRol[r] = (porRol[r] || 0) + 1;
  }

  const revistasConEditor = journalList.map((j: any) => ({
    revista: j.name,
    editor_asignado: j.editor_name || 'Sin editor registrado',
    correo_editor: j.editor_email || 'Sin correo',
    estado_revista: j.status,
  }));

  return {
    total_miembros: profiles.length,
    total_activos: activos.length,
    distribucion_roles: porRol,
    miembros_equipo: activos.map((u: any) => ({
      nombre: u.full_name,
      rol: u.role,
      email: u.email,
    })),
    editores_por_revista: revistasConEditor,
  };
}

async function getEditorsSchoolData(supabase: any) {
  const { data: sessions, error } = await supabase.from('editors_school').select('*');
  if (error || !sessions || sessions.length === 0) {
    return {
      estado: 'En fase de programación y convocatoria',
      sesiones: [],
      total_sesiones: 0,
      nota: 'Módulo Escuela de Editores recientemente inaugurado en PubManager para consolidar talleres de formación para comités editoriales, evaluadores y autores.',
    };
  }

  return {
    estado: 'Activo',
    total_sesiones: sessions.length,
    sesiones: sessions,
    nota: 'Módulo de formación y acompañamiento pedagógico a la comunidad editorial.',
  };
}

function normalizeAPCResearcherName(name: string): string {
  if (!name) return 'Sin Investigador';
  let s = name.toUpperCase()
    .replace(/^DR\.\s*|^DRA\.\s*/i, '')
    .replace(/\s+Y\s+EQUIPO$/i, '')
    .replace(/\s+/g, ' ')
    .trim();

  if (s.startsWith('VALMORE') && s.includes('BERMUDEZ')) return 'Dr. Valmore Bermúdez';
  if (s.startsWith('EDUARDO') && s.includes('NAVARRO')) return 'Dr. Eduardo Navarro Jiménez';
  if (s.startsWith('ELKIN') && s.includes('NAVARRO')) return 'Dr. Elkin Navarro Quiroz';
  if (s.startsWith('LEONARDO') && s.includes('PACHECO')) return 'Dr. Leonardo Pacheco Londoño';
  if (s.startsWith('INDIANA') && s.includes('ROJAS')) return 'Dra. Indiana Luz Rojas Torres';
  if (s.startsWith('ROOSVEL') && s.includes('SOTO')) return 'Dr. Roosvel Soto Díaz';
  if (s.startsWith('ANDERSON') && s.includes('DIAZ')) return 'Dr. Anderson Díaz Pérez';
  if (s.startsWith('HERNAN') && s.includes('HERNANDEZ')) return 'Dr. Hernán Hernández Herrera';
  if (s.startsWith('JUAN DIEGO') && s.includes('HERNANDEZ')) return 'Dr. Juan Diego Hernández Lalinde';
  if (s.startsWith('HERNAN') && s.includes('GUILLEN')) return 'Dr. Hernán Felipe Guillén Burgos';

  return s.split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(' ');
}

async function getAPCData(supabase: any, yearFrom: number, yearTo: number) {
  let payments: any[] = [];
  let budgets: any[] = [];

  try {
    const { data: pData } = await supabase.from('apc_payments').select('*');
    if (pData && pData.length > 0) payments = pData;

    const { data: bData } = await supabase.from('apc_annual_budgets').select('*');
    if (bData && bData.length > 0) budgets = bData;
  } catch (e) {
    console.error('getAPCData supabase error:', e);
  }

  if (payments.length === 0 && (initialAPCData as any)?.payments) {
    payments = (initialAPCData as any).payments;
  }
  if (budgets.length === 0 && (initialAPCData as any)?.budgets) {
    budgets = (initialAPCData as any).budgets;
  }

  const filtered = payments.filter((p: any) => {
    const y = p.year || parseInt(String(p.fecha_pago || p.fecha_autorizacion || '').substring(0, 4), 10);
    return y >= yearFrom && y <= yearTo;
  });

  const totalInvertido = filtered.reduce((acc, p) => acc + (p.valor_pagado_pesos || 0), 0);
  const paidCount = filtered.filter(p => p.valor_pagado_pesos > 0).length;
  const avgCostCOP = paidCount > 0 ? Math.round(totalInvertido / paidCount) : 0;

  const quartiles: Record<string, { count: number; totalCOP: number }> = {
    Q1: { count: 0, totalCOP: 0 },
    Q2: { count: 0, totalCOP: 0 },
    Q3: { count: 0, totalCOP: 0 },
    Q4: { count: 0, totalCOP: 0 },
    'S/C': { count: 0, totalCOP: 0 },
  };

  let correspondenceCount = 0;
  let retencionesTotal = 0;
  const paidTickets: number[] = [];

  filtered.forEach(p => {
    const q = p.cuartil || 'S/C';
    if (!quartiles[q]) quartiles[q] = { count: 0, totalCOP: 0 };
    quartiles[q].count++;
    quartiles[q].totalCOP += (p.valor_pagado_pesos || 0);

    if (p.autor_correspondencia === 'SÍ' || p.autor_correspondencia === 'SI') {
      correspondenceCount++;
    }
    if (p.valor_retenido_pesos) {
      retencionesTotal += p.valor_retenido_pesos;
    }
    if (p.valor_pagado_pesos > 0) {
      paidTickets.push(p.valor_pagado_pesos);
    }
  });

  const highImpactCount = quartiles.Q1.count + quartiles.Q2.count;
  const highImpactPct = filtered.length > 0 ? Math.round((highImpactCount / filtered.length) * 100) : 0;
  const leadershipPct = filtered.length > 0 ? Math.round((correspondenceCount / filtered.length) * 100) : 0;

  const researcherMap: Record<string, { name: string; count: number; totalCOP: number; q1: number; q2: number; faculty: string }> = {};
  filtered.forEach(p => {
    const name = normalizeAPCResearcherName(p.investigador);
    if (!researcherMap[name]) {
      researcherMap[name] = { name, count: 0, totalCOP: 0, q1: 0, q2: 0, faculty: p.facultad || 'Ciencias de la Salud' };
    }
    researcherMap[name].count++;
    researcherMap[name].totalCOP += (p.valor_pagado_pesos || 0);
    if (p.cuartil === 'Q1') researcherMap[name].q1++;
    if (p.cuartil === 'Q2') researcherMap[name].q2++;
  });
  const topResearchers = Object.values(researcherMap)
    .sort((a, b) => b.count - a.count || b.totalCOP - a.totalCOP)
    .slice(0, 10);

  const groupMap: Record<string, { name: string; count: number; totalCOP: number }> = {};
  filtered.forEach(p => {
    const g = p.grupo_investigacion?.trim();
    if (!g) return;
    if (!groupMap[g]) groupMap[g] = { name: g, count: 0, totalCOP: 0 };
    groupMap[g].count++;
    groupMap[g].totalCOP += (p.valor_pagado_pesos || 0);
  });
  const topGroups = Object.values(groupMap)
    .sort((a, b) => b.count - a.count)
    .slice(0, 5);

  const yearsInRange: number[] = [];
  for (let y = yearFrom; y <= yearTo; y++) yearsInRange.push(y);

  const budgetSummary = yearsInRange.map(yr => {
    const b = budgets.find((item: any) => item.year === yr);
    const allocated = b ? b.allocated_budget : (yr === 2026 ? 400000000 : 350000000);
    const executed = filtered.filter(p => p.year === yr).reduce((acc, p) => acc + (p.valor_pagado_pesos || 0), 0);
    const remaining = allocated - executed;
    const pct = allocated > 0 ? Math.round((executed / allocated) * 100) : 0;
    return {
      año: yr,
      bolsa_asignada_cop: allocated,
      total_ejecutado_cop: executed,
      saldo_disponible_cop: remaining,
      consumo_bolsa_pct: `${pct}%`,
      articulos_año: filtered.filter(p => p.year === yr).length,
    };
  });

  const totalBolsaAsignada = budgetSummary.reduce((acc, b) => acc + b.bolsa_asignada_cop, 0);
  const totalBolsaSaldo = totalBolsaAsignada - totalInvertido;

  // Scopus benchmark calculation: % de publicaciones subsidiadas con APC
  const scopusTotals = (scopusBenchmark as any).yearlyScopusTotals as Record<string, number>;
  let totalScopusEnPeriodo = 0;
  for (let yr = yearFrom; yr <= yearTo; yr++) {
    totalScopusEnPeriodo += scopusTotals[yr.toString()] || 0;
  }
  const tasaApalancamientoScopus = totalScopusEnPeriodo > 0
    ? `${((filtered.length / totalScopusEnPeriodo) * 100).toFixed(1)}%`
    : '0%';

  const detalleApalancamientoInteranual = yearsInRange.map(yr => {
    const scopusYr = scopusTotals[yr.toString()] || 0;
    const apcYr = filtered.filter(p => p.year === yr).length;
    const cob = scopusYr > 0 ? `${((apcYr / scopusYr) * 100).toFixed(1)}%` : '0%';
    return {
      año: yr,
      produccion_total_scopus_unisimon: scopusYr,
      articulos_subsidiados_apc: apcYr,
      porcentaje_subsidiado_apc: cob
    };
  });

  return {
    coordinador_modulo: 'Fernando Alberto Peñaranda (Coordinador de Proyectos - fernando.penaranda@unisimon.edu.co)',
    resumen_periodo: {
      periodo: `${yearFrom}–${yearTo}`,
      total_articulos_apoyados: filtered.length,
      total_inversion_apc_cop: totalInvertido,
      costo_promedio_por_paper_cop: avgCostCOP,
      ticket_minimo_cop: paidTickets.length > 0 ? Math.min(...paidTickets) : 0,
      ticket_maximo_cop: paidTickets.length > 0 ? Math.max(...paidTickets) : 0,
      tasa_alto_impacto_q1_q2: `${highImpactPct}%`,
      tasa_liderazgo_correspondencia: `${leadershipPct}%`,
      retenciones_tributarias_acumuladas_cop: retencionesTotal,
      bolsa_presupuestal_total_asignada_cop: totalBolsaAsignada,
      bolsa_presupuestal_saldo_disponible_cop: totalBolsaSaldo,
      total_produccion_scopus_unisimon: totalScopusEnPeriodo,
      porcentaje_publicaciones_subsidiadas_apc: tasaApalancamientoScopus,
    },
    ejecucion_anual_bolsa: budgetSummary,
    cobertura_scopus_benchmark: {
      fuente: 'Scopus Oficial (AF-ID 60106970 / 60112687)',
      total_scopus_periodo: totalScopusEnPeriodo,
      articulos_subsidiados: filtered.length,
      porcentaje_subsidiado_apc: tasaApalancamientoScopus,
      desglose_por_año: detalleApalancamientoInteranual,
    },
    desglose_por_cuartil: Object.entries(quartiles).map(([q, d]) => ({
      cuartil: q,
      articulos: d.count,
      total_cop: d.totalCOP,
      costo_promedio_cop: d.count > 0 ? Math.round(d.totalCOP / d.count) : 0,
    })),
    top_10_investigadores: topResearchers,
    top_5_grupos_investigacion: topGroups,
  };
}

/* ─── Traducciones (ENAGO, depósito prepagado) ─── */
const trKey = (name: string) =>
  name.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/\by equipo\b|\bequipo\b/g, '').replace(/[^a-z\s]/g, ' ')
    .split(/\s+/).filter(Boolean).sort().join(' ');

async function getTranslationsData(supabase: any, yearFrom: number, yearTo: number) {
  let orders: any[] = [];
  let deposits: any[] = [];
  let fuente = `Histórico ENAGO (${(initialTranslationsData as any).source_file || 'Excel'})`;
  try {
    const { data: oData } = await supabase.from('translation_orders').select('*');
    if (oData && oData.length > 0) { orders = oData; fuente = 'Supabase (translation_orders)'; }
    const { data: dData } = await supabase.from('translation_deposits').select('*');
    if (dData && dData.length > 0) deposits = dData;
  } catch (e) {
    console.error('getTranslationsData supabase error:', e);
  }
  if (orders.length === 0) orders = (initialTranslationsData as any).orders || [];
  if (deposits.length === 0) deposits = (initialTranslationsData as any).deposits || [];

  const r2 = (n: number) => Math.round(n * 100) / 100;
  const fee = (o: any) => Number(o.fee_usd) || 0;
  const dep = (d: any) => Number(d.received_usd) || 0;
  const yearOf = (o: any) => o.year || (o.confirmed_on ? parseInt(String(o.confirmed_on).slice(0, 4), 10) : null);
  deposits = [...deposits].sort((a, b) => String(a.deposit_date).localeCompare(String(b.deposit_date)));
  const charged = orders.filter(o => o.charged_to_deposit && fee(o) > 0 && o.confirmed_on);

  // Estado global del depósito (siempre a la fecha, el depósito es acumulativo)
  const totalDep = deposits.reduce((a, d) => a + dep(d), 0);
  const totalUsed = charged.reduce((a, o) => a + fee(o), 0);
  const saldoActual = totalDep - totalUsed;
  const last = deposits[deposits.length - 1];
  let paqueteVigente: any = null;
  if (last) {
    const prev = deposits.slice(0, -1).reduce((a, d) => a + dep(d), 0);
    const usedBefore = charged.filter(o => o.confirmed_on < last.deposit_date).reduce((a, o) => a + fee(o), 0);
    const since = charged.filter(o => o.confirmed_on >= last.deposit_date);
    const consumed = since.reduce((a, o) => a + fee(o), 0);
    const carry = prev - usedBefore;
    const months = Math.max(1, (Date.now() - new Date(`${last.deposit_date}T00:00:00`).getTime()) / (86400000 * 30.44));
    const monthly = consumed / months;
    const monthsLeft = monthly > 0 ? saldoActual / monthly : null;
    paqueteVigente = {
      fecha_compra: last.deposit_date,
      valor_paquete_usd: r2(dep(last)),
      saldo_arrastrado_paquete_anterior_usd: r2(carry),
      nota_saldo_arrastrado: carry < 0
        ? `Antes de esta compra se habían consumido USD ${r2(-carry)} por encima de lo prepagado; esa deuda se cubrió con este paquete.`
        : 'Saldo a favor trasladado del paquete anterior.',
      servicios_descontados_desde_compra: since.length,
      consumido_desde_compra_usd: r2(consumed),
      saldo_disponible_usd: r2(carry + dep(last) - consumed),
      porcentaje_consumido: `${carry + dep(last) > 0 ? ((1 - (carry + dep(last) - consumed) / (carry + dep(last))) * 100).toFixed(1) : '100'}%`,
      consumo_promedio_mensual_usd: r2(monthly),
      meses_estimados_de_saldo: monthsLeft != null ? Number(monthsLeft.toFixed(1)) : null,
      proyeccion_agotamiento: monthsLeft != null
        ? new Date(Date.now() + monthsLeft * 30.44 * 86400000).toLocaleDateString('es-CO', { month: 'long', year: 'numeric' })
        : null,
    };
  }

  // Cierre anual del depósito (saldo inicial, recargas, consumo, saldo final)
  const allYears = Array.from(new Set([
    ...deposits.map(d => parseInt(String(d.deposit_date).slice(0, 4), 10)),
    ...charged.map(o => parseInt(String(o.confirmed_on).slice(0, 4), 10)),
  ])).sort((a, b) => a - b);
  const nowY = new Date().getFullYear();
  let running = 0;
  const cierreAnual = allYears.map(y => {
    const rec = deposits.filter(d => String(d.deposit_date).startsWith(String(y))).reduce((a, d) => a + dep(d), 0);
    const os = charged.filter(o => String(o.confirmed_on).startsWith(String(y)));
    const con = os.reduce((a, o) => a + fee(o), 0);
    const opening = running;
    running = opening + rec - con;
    return {
      año: y,
      saldo_al_1_enero_usd: r2(opening),
      recargas_usd: r2(rec),
      consumido_usd: r2(con),
      servicios_descontados: os.length,
      saldo_al_cierre_usd: r2(running),
      estado: y === nowY ? 'Año en curso (saldo a la fecha)' : running < 0 ? 'Cerró en NEGATIVO (consumo por encima de lo prepagado)' : 'Cerró con saldo a favor',
    };
  }).filter(r => r.año >= yearFrom && r.año <= yearTo);

  // Encargos del período
  const inRange = orders.filter(o => { const y = yearOf(o); return y != null && y >= yearFrom && y <= yearTo; });
  const active = inRange.filter(o => o.status !== 'Cancelado');
  const totalUSD = active.reduce((a, o) => a + fee(o), 0);
  const words = active.reduce((a, o) => a + (Number(o.word_count) || 0), 0);
  const priced = active.filter(o => fee(o) > 0 && o.word_count);
  const pricedWords = priced.reduce((a, o) => a + Number(o.word_count), 0);
  const pricedUSD = priced.reduce((a, o) => a + fee(o), 0);
  const ta = active.filter(o => o.turnaround_days != null && o.turnaround_days >= 0 && o.turnaround_days < 120);

  const group = (keyFn: (o: any) => string | null) => {
    const m: Record<string, { nombre: string; encargos: number; valor_usd: number; palabras: number }> = {};
    active.forEach(o => {
      const k = keyFn(o); if (!k) return;
      m[k] ??= { nombre: k, encargos: 0, valor_usd: 0, palabras: 0 };
      m[k].encargos++; m[k].valor_usd += fee(o); m[k].palabras += Number(o.word_count) || 0;
    });
    return Object.values(m).map(x => ({ ...x, valor_usd: r2(x.valor_usd) })).sort((a, b) => b.encargos - a.encargos || b.valor_usd - a.valor_usd);
  };

  const porServicio = group(o => o.service).map(s => ({
    servicio: s.nombre, encargos: s.encargos, valor_usd: s.valor_usd, palabras: s.palabras,
    costo_por_palabra_usd: s.palabras ? Number((s.valor_usd / s.palabras).toFixed(4)) : null,
    participacion_pct: `${active.length ? ((s.encargos / active.length) * 100).toFixed(1) : 0}%`,
  }));
  const porGestor = group(o => o.requested_by || 'Sin registrar').slice(0, 8)
    .map(g => ({ gestor_solicitante: g.nombre, encargos: g.encargos, valor_usd: g.valor_usd }));

  const resMap: Record<string, { investigador: string; encargos: number; valor_usd: number; q1_q2: number; facultad: string | null }> = {};
  active.forEach(o => {
    if (!o.researcher_team) return;
    const k = trKey(o.researcher_team);
    resMap[k] ??= { investigador: o.researcher_team, encargos: 0, valor_usd: 0, q1_q2: 0, facultad: null };
    const m = resMap[k];
    if (o.researcher_team.length > m.investigador.length) m.investigador = o.researcher_team;
    m.encargos++; m.valor_usd += fee(o);
    if (o.quartile === 'Q1' || o.quartile === 'Q2') m.q1_q2++;
    if (!m.facultad && o.facultad) m.facultad = o.facultad;
  });
  const topInvestigadores = Object.values(resMap).sort((a, b) => b.encargos - a.encargos || b.valor_usd - a.valor_usd)
    .slice(0, 10).map((r, i) => ({ ranking: i + 1, ...r, valor_usd: r2(r.valor_usd) }));

  const enriched = active.filter(o => o.manuscript_title || o.researcher_team || o.journal);
  const withQ = active.filter(o => o.quartile);
  const porCuartil = ['Q1', 'Q2', 'Q3', 'Q4'].map(q => {
    const os = withQ.filter(o => o.quartile === q);
    return { cuartil: q, articulos: os.length, valor_usd: r2(os.reduce((a, o) => a + fee(o), 0)) };
  });
  const porFacultad = group(o => o.facultad).map(f => ({ facultad: f.nombre, encargos: f.encargos, valor_usd: f.valor_usd }));
  const topRevistas = group(o => o.journal).slice(0, 10).map(j => {
    const q = active.find(o => o.journal === j.nombre && o.quartile)?.quartile || 'S/C';
    return { revista: j.nombre, cuartil: q, articulos: j.encargos };
  });
  const porAño: Record<number, { año: number; encargos: number; valor_usd: number; palabras: number }> = {};
  active.forEach(o => {
    const y = yearOf(o) as number;
    porAño[y] ??= { año: y, encargos: 0, valor_usd: 0, palabras: 0 };
    porAño[y].encargos++; porAño[y].valor_usd += fee(o); porAño[y].palabras += Number(o.word_count) || 0;
  });

  return {
    coordinador_modulo: 'Fernando Alberto Peñaranda (Coordinador de Proyectos - fernando.penaranda@unisimon.edu.co)',
    proveedor: 'ENAGO (membresía UNISIL)',
    modelo_de_contratacion: 'Paquetes PREPAGADOS en USD. La Universidad compra un paquete (depósito) y cada servicio confirmado se DESCUENTA del saldo. Las cifras de valor, fechas y palabras provienen exclusivamente del reporte oficial de ENAGO. Si el saldo de un año cierra en negativo significa que se consumió por encima de lo prepagado y la siguiente recarga cubrió esa diferencia.',
    fuente_datos: fuente,
    moneda: 'USD',
    estado_deposito_a_la_fecha: {
      total_depositado_historico_usd: r2(totalDep),
      total_utilizado_historico_usd: r2(totalUsed),
      saldo_disponible_actual_usd: r2(saldoActual),
      paquetes_comprados: deposits.map(d => ({ fecha: d.deposit_date, valor_usd: r2(Number(d.amount_usd) || dep(d)), retencion_usd: r2(Number(d.withholding_tax_usd) || 0), recibido_usd: r2(dep(d)) })),
      paquete_vigente: paqueteVigente,
    },
    cierre_anual_deposito: cierreAnual,
    resumen_periodo: {
      periodo: `${yearFrom}–${yearTo}`,
      encargos_atendidos: active.length,
      encargos_en_proceso: inRange.filter(o => o.status === 'En proceso').length,
      encargos_cancelados: inRange.filter(o => o.status === 'Cancelado').length,
      inversion_total_usd: r2(totalUSD),
      palabras_procesadas: words,
      costo_promedio_por_palabra_usd: pricedWords ? Number((pricedUSD / pricedWords).toFixed(4)) : null,
      ticket_promedio_usd: priced.length ? r2(pricedUSD / priced.length) : 0,
      palabras_promedio_por_manuscrito: active.length ? Math.round(words / active.length) : 0,
      tiempo_promedio_entrega_dias: ta.length ? Math.round(ta.reduce((a, o) => a + o.turnaround_days, 0) / ta.length) : null,
    },
    evolucion_anual: Object.values(porAño).sort((a, b) => a.año - b.año).map(r => ({ ...r, valor_usd: r2(r.valor_usd) })),
    desglose_por_servicio: porServicio,
    gestores_que_tramitan_solicitudes: porGestor,
    datos_academicos: {
      nota_cobertura: `El registro interno (investigador, artículo, revista, cuartil, facultad) solo existe para ${enriched.length} de ${active.length} encargos del período (registro iniciado en 2024). Los porcentajes de cuartil y facultad se calculan SOLO sobre los encargos con dato; no extrapolar al total.`,
      encargos_con_datos_academicos: enriched.length,
      encargos_con_cuartil: withQ.length,
      tasa_alto_impacto_q1_q2: withQ.length ? `${Math.round((withQ.filter(o => o.quartile === 'Q1' || o.quartile === 'Q2').length / withQ.length) * 100)}%` : 'Sin datos',
      desglose_por_cuartil: porCuartil,
      desglose_por_facultad: porFacultad,
      top_10_investigadores: topInvestigadores,
      top_revistas_destino: topRevistas,
    },
  };
}

async function getAllData(supabase: any, yearFrom: number, yearTo: number) {
  const [books, journals, finances, mentoring, certificates, team] = await Promise.all([
    getBooksData(supabase, yearFrom, yearTo),
    getJournalsData(supabase),
    getFinancesData(supabase, yearFrom, yearTo),
    getMentoringData(supabase, yearFrom, yearTo),
    getCertificatesData(supabase, yearFrom, yearTo),
    getTeamData(supabase),
  ]);
  return { libros: books, revistas: journals, finanzas: finances, mentorias: mentoring, certificados: certificates, equipo: team };
}

/* ─── System prompt builder ─── */
function buildSystemPrompt(reportLength: string): string {
  const lengthInstructions: Record<string, string> = {
    brief: `- Extensión MÁXIMA: 350 palabras. Sé extremadamente conciso.
- NO uses secciones largas. Solo tablas resumen compactas y 3-5 bullets con cifras clave.
- NO incluyas recomendaciones extensas. Solo datos duros y métricas críticas.
- Formato: Un título, tablas de resumen por área, y una lista corta de hallazgos principales.`,
    executive: `- Extensión: entre 600 y 900 palabras.
- Incluye una sección breve de "Hallazgos Clave" (5-7 bullets con cifras y porcentajes) y una de "Recomendaciones Accionables" (3-5 bullets).
- Tablas resumen por área y análisis conciso de fortalezas, cuellos de botella y tendencias.
- Tono directo: va al grano con las cifras más relevantes para la toma de decisiones.`,
    detailed: `- Extensión: entre 1400 y 2200 palabras.
- Incluye secciones completas: Resumen Ejecutivo, Hallazgos Clave, Análisis Detallado por Área (Libros, Revistas, Mentorías, Certificados, Equipo, Finanzas, Pagos APC, Traducciones según aplique), Indicadores de Calidad y Cumplimiento, Cuellos de Botella / Oportunidades de Mejora, y Plan de Recomendaciones Priorizadas.
- Usa múltiples tablas para desglosar datos por año, tipo, mentor, facultad, categoría, etc.
- Incluye análisis de tendencias año a año con porcentajes de cambio y comparativas.
- Relaciona los datos con estándares de Minciencias, Scopus, Publindex y lineamientos institucionales de la Universidad Simón Bolívar.`,
  };

  return `Eres un analista experto y consultor senior en gestión editorial universitaria. Trabajas para la Dirección de Publicaciones de la Universidad Simón Bolívar (Barranquilla / Cúcuta, Colombia).

Tu rol es generar informes inteligentes de alto impacto basados en datos reales del sistema PubManager. Debes:

1. **Analizar tendencias**: Identificar patrones de crecimiento/decrecimiento año a año o por período
2. **Evaluar desempeño por área**:
   - **Libros y Capítulos**: Producción anual, formatos (digital vs impreso), tipos de libro (compilatorio, completo, memorias, cartillas), registro de ISBN, tipología Minciencias y autores participantes.
   - **Revistas Científicas**: Estado de indexación, posicionamiento en Scopus (cuartiles Q1-Q4), categorías Publindex (A1, A2, B, C), periodicidad y visibilidad internacional.
   - **Programa de Mentorías a Investigadores**: Actividad de acompañamiento a investigadores, sesiones completadas vs agendadas o invitaciones, productividad por mentor (Danilo Valenzuela, Sharon Benitez, Fanny Ortega, etc.), cobertura por facultades y grupos de investigación (A1, A, B), y adopción de plataformas.
   - **Certificados Editoriales**: Volumen de constancias y certificados emitidos, distribución por categorías institucionales (Avales y Tipología, Créditos y Financiación, Certificados Editorial Externa, Libros de Formación, Manuales y Guías, Evaluación de Pares). NOTA CRÍTICA: En el desglose de editorial, reporta con estricta precisión las cifras de "Editorial Externa" (capítulos y obras en sellos externos como Springer Nature, John Wiley & Sons, Elsevier, CUC, RedCOLSI, etc.) y "Sello Propio (Ediciones Unisimón)", tal como vienen indicadas en el JSON. Jamás reduzcas ni confundas las certificaciones de Editorial Externa.
   - **Equipo Editorial**: Estructura de talento humano, distribución de roles (director, editores de revista, mentores, coordinadores), asignación de editores a revistas institucionales y cobertura operativa.
   - **Gestión Financiera**: Ejecución del presupuesto, distribución de costos de producción y servicios externos.
   - **Pagos APC y Fondo de Publicación Científica**: Liderado por Fernando Alberto Peñaranda (Coordinador de Proyectos). Monitoreo de la bolsa de presupuesto anual asignada vs ejecutada, financiamiento de cargos de procesamiento de artículos científicos, costo promedio por artículo ($7.07M COP en histórico), rango de inversión por ticket, calidad indexada por cuartil (Q1, Q2, Q3, Q4), tasa de alto impacto (83% Q1/Q2), índice de autoría de correspondencia Unisimón (62%), ranking de los 10 investigadores con mayor solicitud de servicios (Dr. Valmore Bermúdez, Dr. Eduardo Navarro Jiménez, Dr. Roosvel Soto Díaz, etc.), grupos de investigación beneficiados, y **análisis del porcentaje de publicaciones subsidiadas frente a la producción total indexada en Scopus (AF-ID 60106970 / 60112687)**, donde el 26.7% global de todos los artículos y reviews de Unisimón (373 de 1.395 en 2020-2026) fueron posibles gracias al subsidio APC, alcanzando picos del 37.9% en 2022 y 33.3% en 2025.
   - **Traducciones Científicas (ENAGO)**: Liderado por Fernando Alberto Peñaranda (Coordinador de Proyectos). La Universidad compra a ENAGO **paquetes PREPAGADOS en USD** (el último: 27 de enero de 2025 por USD 74.317,68) y cada servicio (Traducción + Edición, Corrección de estilo, Edición sustantiva) se DESCUENTA del saldo. El informe debe: (a) presentar el ESTADO DEL DEPÓSITO a la fecha (paquete vigente, saldo arrastrado, consumido, saldo disponible, consumo mensual promedio y proyección de agotamiento); (b) el CIERRE ANUAL del depósito para cada año del período (saldo al 1 de enero, recargas, consumo y saldo al cierre), señalando explícitamente los años que cerraron en NEGATIVO (sobreconsumo cubierto por la recarga siguiente); (c) volumen de encargos, palabras, costo por palabra, ticket promedio y tiempo de entrega; (d) mezcla de servicios; (e) investigadores, facultades, revistas destino y cuartiles (respetando la nota de cobertura: esos datos solo existen desde 2024 y los porcentajes se calculan sobre los encargos con dato). Todas las cifras son en **USD** (NO convertir a COP ni mezclar con la bolsa APC, que es en COP). Recomienda cuándo gestionar la próxima recarga según la proyección.
3. **Detectar fortalezas y alertas**: Señalar logros sobresalientes y áreas que requieren intervención o seguimiento.
4. **Dar recomendaciones accionables**: Sugerir mejoras concretas, viables y basadas en los datos reales suministrados.
5. **Contextualizar institucionalmente**: Considerar la visibilidad de la Universidad Simón Bolívar ante Minciencias, Scopus, Publindex y la comunidad científica.

Reglas de ESTRUCTURA (MUY IMPORTANTE):
- Cuando el informe cubra múltiples áreas, CADA ÁREA debe tener su PROPIA SECCIÓN separada con encabezado ## independiente.
- NUNCA mezcles datos de diferentes áreas en la misma tabla. Cada tabla debe ser de UN SOLO tema claramente rotulado.
- Tabla de Revistas: columnas de Revista, Scopus Actual, Publindex Actual, Periodicidad, Estado.
- Tabla de Libros: columnas de Año, Libros, Capítulos, Autores Únicos, ISBN.
- Tabla de Mentorías: columnas de Mentor, Sesiones Totales, Completadas, Agendadas, Tasa de Cumplimiento.
- Tabla de Certificados: columnas de Categoría / Tipo, Certificados Expedidos, Destinatarios.
- Tabla de Equipo Editorial: columnas de Revista / Rol, Responsable, Estado.
- Tabla de Pagos APC: columnas de Vigencia/Año, Bolsa Asignada (COP), Total Invertido (COP), Saldo Disponible (COP), Artículos Financiados, Costo Promedio / Paper, % Q1-Q2.
- Tabla de Cobertura Scopus vs APC: columnas de Vigencia/Año, Producción Total Scopus Unisimón, Artículos Subsidiados con Fondo APC, % Subsidio APC.
- Tabla de Top Investigadores APC: columnas de Ranking, Investigador, Artículos Apoyados, Impacto (Q1/Q2), Inversión Total (COP), Facultad.
- Tabla de Estado del Depósito de Traducciones: columnas de Concepto y Valor (USD) con las filas Valor del paquete vigente, Saldo arrastrado del paquete anterior, Servicios descontados desde la compra, Saldo disponible.
- Tabla de Cierre Anual del Depósito de Traducciones: columnas de Año, Saldo al 1 de enero (USD), Recargas (USD), Consumido (USD), Servicios, Saldo al cierre (USD), Estado.
- Tabla de Traducciones por Servicio: columnas de Servicio, Encargos, Valor (USD), Palabras, Costo por palabra (USD), % Participación.
- Tabla de Top Investigadores en Traducciones: columnas de Ranking, Investigador / Equipo, Encargos, Artículos Q1-Q2, Valor (USD), Facultad.
- Tabla de Traducciones por Facultad y por Cuartil: columnas de Facultad (o Cuartil), Encargos, Valor (USD).
- Al final incluye siempre una sección transversal de "Conclusiones y Recomendaciones Estratégicas".

Reglas de formato:
- Escribe en español formal y profesional.
- Usa formato Markdown rico: encabezados ## y ###, **negritas** para cifras y nombres clave, tablas bien alineadas, listas de viñetas, emojis discretos para secciones.
- Sé específico: cita números exactos, porcentajes, nombres de mentores/revistas/facultades que aparecen en los datos JSON.
- Si un campo no tiene datos o es cero, menciónalo constructivamente sin inventar cifras ficticias.
- Tono: ejecutivo, analítico y propositivo, como un informe presentado a la Vicerrectoría de Investigación o Rectoría.
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
    apc: () => getAPCData(supabase, yearFrom, yearTo),
    translations: () => getTranslationsData(supabase, yearFrom, yearTo),
    mentoring: () => getMentoringData(supabase, yearFrom, yearTo),
    finances: () => getFinancesData(supabase, yearFrom, yearTo),
    certificates: () => getCertificatesData(supabase, yearFrom, yearTo),
    team: () => getTeamData(supabase),
    editors_school: () => getEditorsSchoolData(supabase),
  };
  const labels: Record<string, string> = {
    books: 'LIBROS Y CAPÍTULOS',
    journals: 'REVISTAS CIENTÍFICAS',
    apc: 'PAGOS APC Y FONDO DE PUBLICACIÓN CIENTÍFICA',
    translations: 'TRADUCCIONES CIENTÍFICAS (ENAGO · DEPÓSITO PREPAGADO)',
    mentoring: 'PROGRAMA DE MENTORÍAS A INVESTIGADORES',
    finances: 'GESTIÓN FINANCIERA Y COSTOS',
    certificates: 'EMISIÓN DE CERTIFICADOS EDITORIALES',
    team: 'EQUIPO EDITORIAL Y ROLES',
    editors_school: 'ESCUELA DE EDITORES',
  };

  // Handle special types
  const isCustom = types.includes('custom');
  const isExecutive = types.includes('executive');
  const modulesToFetch = isExecutive
    ? ['books', 'journals', 'apc', 'translations', 'mentoring', 'finances', 'certificates', 'team']
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
  } else if (isExecutive) {
    basePrompt = `Genera un INFORME EJECUTIVO GENERAL E INTEGRAL de toda la gestión editorial para el período ${yearFrom}–${yearTo}. Cubre todas las áreas activas: ${sections.join(', ')}. Sintetiza la producción bibliográfica, visibilidad en revistas indexadas, acompañamiento a investigadores mediante mentorías, certificaciones expedidas, estructura del equipo de trabajo y finanzas.`;
  } else if (sections.length > 1) {
    basePrompt = `Genera un informe ejecutivo COMBINADO que analice: ${sections.join(' y ')} de la editorial universitaria para el período ${yearFrom}–${yearTo}. Analiza cada área en su propia sección y también las relaciones y sinergias entre ellas.`;
  } else if (sections.length === 1 && modulesToFetch[0] === 'translations') {
    basePrompt = `Genera un informe ejecutivo especializado sobre el SERVICIO DE TRADUCCIÓN Y EDICIÓN CIENTÍFICA contratado con ENAGO mediante paquetes prepagados, para el período ${yearFrom}–${yearTo}. Estructura obligatoria:
## 1. Estado del depósito prepagado a la fecha (tabla Concepto / Valor USD con paquete vigente, saldo arrastrado, consumido y saldo disponible; consumo mensual promedio y proyección de agotamiento).
## 2. Cierre anual del depósito (tabla por año del período; explica los años que cerraron en negativo).
## 3. Volumen y eficiencia del servicio (encargos, palabras, costo por palabra, ticket promedio, tiempo de entrega, en proceso / cancelados, evolución anual).
## 4. Mezcla de servicios (tabla por servicio).
## 5. Impacto académico (investigadores, facultades, revistas destino y cuartiles, aclarando la cobertura del dato).
## 6. Alertas y recomendaciones (incluye cuándo gestionar la próxima recarga).
Usa siempre la moneda USD tal como viene en los datos.`;
  } else if (sections.length === 1) {
    basePrompt = `Genera un informe ejecutivo especializado sobre ${sections[0]} de la editorial universitaria para el período ${yearFrom}–${yearTo}.`;
  } else {
    basePrompt = 'Genera un análisis general de la producción y gestión editorial.';
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
    const request = {
      model: 'gemini-2.5-flash',
      contents: [{ role: 'user', parts: [{ text: userPrompt }] }],
      config: {
        systemInstruction: buildSystemPrompt(reportLength || 'executive'),
        temperature: 0.7,
        maxOutputTokens: 8192,
      },
    };

    // Reintentos ante fallas de red transitorias (DNS / conexión)
    let response: Awaited<ReturnType<typeof ai.models.generateContentStream>> | undefined;
    for (let attempt = 1; ; attempt++) {
      try {
        response = await ai.models.generateContentStream(request);
        break;
      } catch (e: any) {
        const code = e?.cause?.code || e?.code;
        const isNetwork = e?.message === 'fetch failed' || ['ENOTFOUND', 'ECONNRESET', 'ETIMEDOUT', 'EAI_AGAIN', 'UND_ERR_CONNECT_TIMEOUT'].includes(code);
        if (!isNetwork || attempt >= 3) throw e;
        await new Promise(r => setTimeout(r, 1500 * attempt));
      }
    }

    // Stream the response
    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      async start(controller) {
        try {
          for await (const chunk of response!) {
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
    const code = err?.cause?.code || err?.code;
    const isNetwork = err?.message === 'fetch failed' || ['ENOTFOUND', 'ECONNRESET', 'ETIMEDOUT', 'EAI_AGAIN', 'UND_ERR_CONNECT_TIMEOUT'].includes(code);
    const msg = isNetwork
      ? 'No hay conexión con el servicio de IA de Google (Gemini). Verifique la conexión a internet o la red/VPN institucional e intente de nuevo.'
      : (err.message || 'Error al generar informe');
    return Response.json({ error: msg }, { status: isNetwork ? 503 : 500 });
  }
}
