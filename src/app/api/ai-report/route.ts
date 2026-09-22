import { GoogleGenAI } from '@google/genai';
import { NextRequest } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import initialAPCData from '@/lib/apc-initial-data.json';
import scopusBenchmark from '@/lib/scopus-benchmark.json';

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
    const cat = c.document_category || c.certificate_type || 'sin_categoria';
    porCategoria[cat] = (porCategoria[cat] || 0) + 1;

    if (c.publication_type) {
      porTipoPub[c.publication_type] = (porTipoPub[c.publication_type] || 0) + 1;
    }
    if (c.editorial_type) {
      porTipoEditorial[c.editorial_type] = (porTipoEditorial[c.editorial_type] || 0) + 1;
    }
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
    },
    por_categoria: porCategoria,
    por_tipo_publicacion: porTipoPub,
    por_tipo_editorial: porTipoEditorial,
    por_estado: porEstado,
    por_año: porAño,
    ultimos_expedidos: filtered.slice(0, 10).map((c: any) => ({
      consecutivo: c.consecutive_number,
      destinatario: c.recipient_name,
      categoria: c.document_category,
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
- Incluye secciones completas: Resumen Ejecutivo, Hallazgos Clave, Análisis Detallado por Área (Libros, Revistas, Mentorías, Certificados, Equipo, Finanzas según aplique), Indicadores de Calidad y Cumplimiento, Cuellos de Botella / Oportunidades de Mejora, y Plan de Recomendaciones Priorizadas.
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
   - **Certificados Editoriales**: Volumen de constancias y certificados emitidos, distribución por categorías (créditos, avales, capítulos, evaluadores), trazabilidad y destinatarios.
   - **Equipo Editorial**: Estructura de talento humano, distribución de roles (director, editores de revista, mentores, coordinadores), asignación de editores a revistas institucionales y cobertura operativa.
   - **Gestión Financiera**: Ejecución del presupuesto, distribución de costos de producción y servicios externos.
   - **Pagos APC y Fondo de Publicación Científica**: Liderado por Fernando Alberto Peñaranda (Coordinador de Proyectos). Monitoreo de la bolsa de presupuesto anual asignada vs ejecutada, financiamiento de cargos de procesamiento de artículos científicos, costo promedio por artículo ($7.07M COP en histórico), rango de inversión por ticket, calidad indexada por cuartil (Q1, Q2, Q3, Q4), tasa de alto impacto (83% Q1/Q2), índice de autoría de correspondencia Unisimón (62%), ranking de los 10 investigadores con mayor solicitud de servicios (Dr. Valmore Bermúdez, Dr. Eduardo Navarro Jiménez, Dr. Roosvel Soto Díaz, etc.), grupos de investigación beneficiados, y **análisis del porcentaje de publicaciones subsidiadas frente a la producción total indexada en Scopus (AF-ID 60106970 / 60112687)**, donde el 26.7% global de todos los artículos y reviews de Unisimón (373 de 1.395 en 2020-2026) fueron posibles gracias al subsidio APC, alcanzando picos del 37.9% en 2022 y 33.3% en 2025.
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
    ? ['books', 'journals', 'apc', 'mentoring', 'finances', 'certificates', 'team']
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

    const response = await ai.models.generateContentStream({
      model: 'gemini-2.5-flash',
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
