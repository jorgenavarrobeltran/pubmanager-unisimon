import { NextRequest } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';

interface Alert {
  id: string;
  type: 'critical' | 'warning' | 'info';
  category: 'pares' | 'libros' | 'revistas' | 'finanzas';
  title: string;
  description: string;
  details?: any;
  actionUrl?: string;
  actionLabel?: string;
}

export async function GET(req: NextRequest) {
  const supabase = await createServerSupabaseClient();
  const alerts: Alert[] = [];
  const now = new Date();

  try {
    // ═══════════════════════════════════════
    // 1. EVALUACIÓN DE PARES — Reviews vencidas
    // ═══════════════════════════════════════
    
    // Fetch overdue reviews WITHOUT joins (composite FK doesn't work with Supabase client)
    const { data: overdueResponses } = await supabase
      .from('article_reviews')
      .select(`
        id, reviewer_first_name, reviewer_last_name, reviewer_email,
        date_assigned, date_response_due, days_response_overdue,
        date_confirmed, date_completed, declined, cancelled,
        article_ojs_id, journal_id
      `)
      .is('date_completed', null)
      .is('date_confirmed', null)
      .eq('declined', false)
      .or('cancelled.is.null,cancelled.eq.false')
      .gt('days_response_overdue', 0)
      .order('days_response_overdue', { ascending: false })
      .limit(50);

    // Pares que ACEPTARON pero no han entregado
    const { data: overdueReviews } = await supabase
      .from('article_reviews')
      .select(`
        id, reviewer_first_name, reviewer_last_name, reviewer_email,
        date_assigned, date_confirmed, date_review_due, days_review_overdue,
        date_completed, declined, cancelled,
        article_ojs_id, journal_id
      `)
      .is('date_completed', null)
      .not('date_confirmed', 'is', null)
      .eq('declined', false)
      .or('cancelled.is.null,cancelled.eq.false')
      .gt('days_review_overdue', 0)
      .order('days_review_overdue', { ascending: false })
      .limit(50);

    // Enrich with article titles and journal names via lookups
    const allReviewRecords = [...(overdueResponses || []), ...(overdueReviews || [])];
    const articleOjsIds = [...new Set(allReviewRecords.map(r => r.article_ojs_id).filter(Boolean))];
    const journalIds = [...new Set(allReviewRecords.map(r => r.journal_id).filter(Boolean))];

    // Fetch article titles
    const articleMap = new Map<string, string>();
    if (articleOjsIds.length > 0) {
      const { data: articles } = await supabase
        .from('journal_articles')
        .select('ojs_id, title, journal_id')
        .in('ojs_id', articleOjsIds);
      articles?.forEach(a => articleMap.set(`${a.ojs_id}-${a.journal_id}`, a.title));
    }

    // Fetch journal names
    const journalMap = new Map<string, string>();
    if (journalIds.length > 0) {
      const { data: journals } = await supabase
        .from('journals')
        .select('id, name')
        .in('id', journalIds);
      journals?.forEach(j => journalMap.set(j.id, j.name));
    }

    // Helper to enrich review record
    const enrichReview = (r: any) => ({
      reviewer: `${r.reviewer_first_name || ''} ${r.reviewer_last_name || ''}`.trim(),
      email: r.reviewer_email,
      article: articleMap.get(`${r.article_ojs_id}-${r.journal_id}`) || `Artículo #${r.article_ojs_id}`,
      journal: journalMap.get(r.journal_id) || 'Revista',
      days_overdue: r.days_response_overdue || r.days_review_overdue,
      assigned: r.date_assigned,
      confirmed: r.date_confirmed,
    });

    // Group overdue responses by severity
    const recentOverdueResponses = (overdueResponses || []).filter(r => r.days_response_overdue <= 30);
    const moderateOverdueResponses = (overdueResponses || []).filter(r => r.days_response_overdue > 30 && r.days_response_overdue <= 90);
    const criticalOverdueResponses = (overdueResponses || []).filter(r => r.days_response_overdue > 90);

    const recentOverdueReviews = (overdueReviews || []).filter(r => r.days_review_overdue <= 30);
    const moderateOverdueReviews = (overdueReviews || []).filter(r => r.days_review_overdue > 30 && r.days_review_overdue <= 90);
    const criticalOverdueReviews = (overdueReviews || []).filter(r => r.days_review_overdue > 90);

    // Critical: +90 días sin responder
    if (criticalOverdueResponses.length > 0) {
      alerts.push({
        id: 'pares-response-critical',
        type: 'critical',
        category: 'pares',
        title: `🚨 ${criticalOverdueResponses.length} pares sin responder (+90 días)`,
        description: `Evaluadores que no han aceptado ni rechazado la invitación en más de 3 meses. Se recomienda cancelar y reasignar.`,
        details: criticalOverdueResponses.slice(0, 5).map(enrichReview),
      });
    }

    // Warning: 30-90 días sin responder
    if (moderateOverdueResponses.length > 0) {
      alerts.push({
        id: 'pares-response-warning',
        type: 'warning',
        category: 'pares',
        title: `⚠️ ${moderateOverdueResponses.length} pares sin responder (30-90 días)`,
        description: `Evaluadores que llevan entre 1 y 3 meses sin aceptar/rechazar. Enviar recordatorio.`,
        details: moderateOverdueResponses.slice(0, 5).map(enrichReview),
      });
    }

    // Info: <30 días
    if (recentOverdueResponses.length > 0) {
      alerts.push({
        id: 'pares-response-recent',
        type: 'info',
        category: 'pares',
        title: `📋 ${recentOverdueResponses.length} pares por responder (<30 días)`,
        description: `Invitaciones recientes sin respuesta. Es normal, pero conviene hacer seguimiento.`,
        details: recentOverdueResponses.slice(0, 5).map(enrichReview),
      });
    }

    // Critical: Reviews aceptadas +90 días sin entregar
    if (criticalOverdueReviews.length > 0) {
      alerts.push({
        id: 'pares-review-critical',
        type: 'critical',
        category: 'pares',
        title: `🚨 ${criticalOverdueReviews.length} evaluaciones aceptadas sin entregar (+90 días)`,
        description: `Estos pares aceptaron evaluar pero no han enviado el dictamen en más de 3 meses.`,
        details: criticalOverdueReviews.slice(0, 5).map(enrichReview),
      });
    }

    // Warning: Reviews 30-90 días
    if (moderateOverdueReviews.length > 0) {
      alerts.push({
        id: 'pares-review-warning',
        type: 'warning',
        category: 'pares',
        title: `⚠️ ${moderateOverdueReviews.length} evaluaciones pendientes (30-90 días)`,
        description: `Pares que aceptaron pero llevan 1-3 meses sin entregar. Enviar recordatorio urgente.`,
        details: moderateOverdueReviews.slice(0, 5).map(enrichReview),
      });
    }

    // ═══════════════════════════════════════
    // 2. LIBROS — Etapas estancadas
    // ═══════════════════════════════════════

    const { data: booksInProcess } = await supabase
      .from('books')
      .select('id, title, current_stage, status, updated_at, created_at')
      .eq('status', 'en_proceso');

    if (booksInProcess && booksInProcess.length > 0) {
      const staleBooks = booksInProcess.filter(b => {
        const lastUpdate = new Date(b.updated_at || b.created_at);
        const daysSince = Math.floor((now.getTime() - lastUpdate.getTime()) / (1000 * 60 * 60 * 24));
        return daysSince > 60;
      });

      if (staleBooks.length > 0) {
        alerts.push({
          id: 'books-stale',
          type: 'warning',
          category: 'libros',
          title: `📚 ${staleBooks.length} libros estancados (+60 días sin actualización)`,
          description: `Libros en proceso sin cambios recientes. Verificar estado.`,
          actionUrl: '/books',
          actionLabel: 'Ver Libros',
          details: staleBooks.slice(0, 5).map(b => ({
            title: b.title,
            stage: b.current_stage,
            last_update: b.updated_at || b.created_at,
          })),
        });
      }
    }

    // Libros en evaluación de pares (book_stages)
    const { data: booksInPeerReview } = await supabase
      .from('book_stages')
      .select('id, book_id, stage_name, started_at, completed_at, responsible_person')
      .eq('stage_name', 'evaluacion_pares')
      .is('completed_at', null);

    if (booksInPeerReview && booksInPeerReview.length > 0) {
      // Enrich with book titles
      const bookIds = booksInPeerReview.map(bs => bs.book_id);
      const { data: booksData } = await supabase.from('books').select('id, title').in('id', bookIds);
      const bookTitles = new Map(booksData?.map(b => [b.id, b.title]) || []);

      const overdueBookPeers = booksInPeerReview.filter(bs => {
        if (!bs.started_at) return false;
        const daysSince = Math.floor((now.getTime() - new Date(bs.started_at).getTime()) / (1000 * 60 * 60 * 24));
        return daysSince > 30;
      });

      if (overdueBookPeers.length > 0) {
        alerts.push({
          id: 'books-peer-review',
          type: 'warning',
          category: 'libros',
          title: `📖 ${overdueBookPeers.length} libros esperando par evaluador (+30 días)`,
          description: `Libros en etapa de evaluación de pares que llevan más de un mes sin completarse.`,
          actionUrl: '/books',
          actionLabel: 'Ver Libros',
          details: overdueBookPeers.map(bs => ({
            book: bookTitles.get(bs.book_id) || 'Libro sin título',
            responsible: bs.responsible_person,
            started: bs.started_at,
          })),
        });
      }
    }

    // ═══════════════════════════════════════
    // 3. REVISTAS — Artículos sin decisión
    // ═══════════════════════════════════════
    
    const { data: pendingArticles } = await supabase
      .from('journal_articles')
      .select('id, title, status, submission_date, last_modified, journal_id')
      .in('status', ['Under Review', 'Submission', 'Queued'])
      .order('submission_date', { ascending: true })
      .limit(30);

    if (pendingArticles && pendingArticles.length > 0) {
      // Enrich with journal names
      const artJournalIds = [...new Set(pendingArticles.map(a => a.journal_id).filter(Boolean))];
      const artJournalMap = new Map<string, string>();
      if (artJournalIds.length > 0) {
        const { data: jdata } = await supabase.from('journals').select('id, name').in('id', artJournalIds);
        jdata?.forEach(j => artJournalMap.set(j.id, j.name));
      }

      const longPending = pendingArticles.filter(a => {
        const submitted = new Date(a.submission_date || a.last_modified);
        const daysSince = Math.floor((now.getTime() - submitted.getTime()) / (1000 * 60 * 60 * 24));
        return daysSince > 90;
      });

      if (longPending.length > 0) {
        alerts.push({
          id: 'articles-long-pending',
          type: 'warning',
          category: 'revistas',
          title: `📰 ${longPending.length} artículos sin decisión editorial (+90 días)`,
          description: `Artículos que llevan más de 3 meses en revisión o cola sin una decisión.`,
          details: longPending.slice(0, 5).map(a => ({
            title: a.title,
            journal: artJournalMap.get(a.journal_id) || 'Revista',
            status: a.status,
            submitted: a.submission_date,
          })),
        });
      }
    }

    // ═══════════════════════════════════════
    // 4. FINANZAS — Meta de ingresos
    // ═══════════════════════════════════════

    const currentYear = now.getFullYear();
    const { data: target } = await supabase
      .from('revenue_targets')
      .select('target_amount')
      .eq('year', currentYear)
      .single();

    if (target?.target_amount) {
      const { data: incomes } = await supabase
        .from('external_services')
        .select('amount')
        .in('status', ['facturado', 'pagado']);
      
      const totalIncome = incomes?.reduce((s, i) => s + (i.amount || 0), 0) || 0;
      const percent = Math.round((totalIncome / target.target_amount) * 100);
      const monthOfYear = now.getMonth() + 1;
      const expectedPercent = Math.round((monthOfYear / 12) * 100);

      if (percent < expectedPercent - 15) {
        alerts.push({
          id: 'finance-behind',
          type: 'warning',
          category: 'finanzas',
          title: `💰 Meta de ingresos ${currentYear} retrasada`,
          description: `Se ha recaudado ${percent}% de la meta ($${totalIncome.toLocaleString()} de $${target.target_amount.toLocaleString()}). A este punto del año debería estar en ~${expectedPercent}%.`,
          actionUrl: '/finances',
          actionLabel: 'Ver Finanzas',
        });
      }
    }

    // ═══════════════════════════════════════
    // 5. RESUMEN GENERAL
    // ═══════════════════════════════════════

    const totalPendingResponses = (overdueResponses || []).length;
    const totalPendingReviews = (overdueReviews || []).length;

    const summary = {
      pares_sin_responder: totalPendingResponses,
      evaluaciones_sin_entregar: totalPendingReviews,
      libros_en_proceso: booksInProcess?.length || 0,
      articulos_pendientes: pendingArticles?.length || 0,
      total_alertas: alerts.length,
      alertas_criticas: alerts.filter(a => a.type === 'critical').length,
      alertas_warning: alerts.filter(a => a.type === 'warning').length,
    };

    // Sort: critical first, then warning, then info
    const order = { critical: 0, warning: 1, info: 2 };
    alerts.sort((a, b) => order[a.type] - order[b.type]);

    return Response.json({ alerts, summary, generatedAt: now.toISOString() });
  } catch (err: any) {
    console.error('[AI Alerts] Error:', err);
    return Response.json({ error: err.message }, { status: 500 });
  }
}
