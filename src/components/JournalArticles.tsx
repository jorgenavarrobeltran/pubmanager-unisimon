'use client';

import { useEffect, useState, useMemo } from 'react';
import { createClient } from '@/lib/supabase/client';
import { FileText, Users, Eye, CheckCircle, XCircle, Clock, Search, ChevronDown, ChevronUp, Calendar, BookOpen } from 'lucide-react';

interface Article {
  id: string;
  ojs_id: number;
  title: string;
  section: string | null;
  status: string;
  language: string;
  keywords: string | null;
  doi: string | null;
  ojs_url: string | null;
  submission_date: string | null;
  source: string | null; // contains issue/volume info from OJS
}

interface ViewItem {
  article_ojs_id: number;
  title: string | null;
  issue: string | null;
  pub_date: string | null;
  abstract_views: number;
  total_galley_views: number;
  pdf_views: number;
}

interface ReviewStat {
  total_reviews: number;
  unique_reviewers: number;
  recommendations: Record<string, number>;
}

const STATUS_CONFIG: Record<string, { color: string; icon: any; label: string }> = {
  'Publicado': { color: '#43A047', icon: CheckCircle, label: 'Publicados' },
  'Rechazado': { color: '#E53935', icon: XCircle, label: 'Rechazados' },
  'Envío': { color: '#1565C0', icon: Clock, label: 'En Envío' },
  'Revisión': { color: '#F57C00', icon: Users, label: 'En Revisión' },
};

export default function JournalArticles({ journalId }: { journalId: string }) {
  const [articles, setArticles] = useState<Article[]>([]);
  const [views, setViews] = useState<ViewItem[]>([]);
  const [reviewStat, setReviewStat] = useState<ReviewStat | null>(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [expandedArticle, setExpandedArticle] = useState<string | null>(null);
  const [articleAuthors, setArticleAuthors] = useState<Record<string, any[]>>({});
  const [articleReviews, setArticleReviews] = useState<Record<string, any[]>>({});

  useEffect(() => {
    async function load() {
      const supabase = createClient();

      const [artsRes, viewsRes, reviewsRes] = await Promise.all([
        supabase
          .from('journal_articles')
          .select('id, ojs_id, title, section, status, language, keywords, doi, ojs_url, submission_date, source')
          .eq('journal_id', journalId)
          .order('submission_date', { ascending: false }),
        supabase
          .from('article_views')
          .select('article_ojs_id, title, issue, pub_date, abstract_views, total_galley_views, pdf_views')
          .eq('journal_id', journalId)
          .order('abstract_views', { ascending: false }),
        supabase
          .from('article_reviews')
          .select('recommendation, reviewer_first_name, reviewer_last_name')
          .eq('journal_id', journalId),
      ]);

      setArticles(artsRes.data || []);
      setViews(viewsRes.data || []);

      const reviews = reviewsRes.data || [];
      if (reviews.length > 0) {
        const uniqueReviewers = new Set(
          reviews.map((r: any) => `${r.reviewer_first_name} ${r.reviewer_last_name}`.trim())
        );
        const recs: Record<string, number> = {};
        reviews.forEach((r: any) => { if (r.recommendation) recs[r.recommendation] = (recs[r.recommendation] || 0) + 1; });
        setReviewStat({ total_reviews: reviews.length, unique_reviewers: uniqueReviewers.size, recommendations: recs });
      }

      setLoading(false);
    }
    load();
  }, [journalId]);

  // Filtered articles
  const filtered = useMemo(() => {
    return articles.filter(a => {
      const matchSearch = !search || a.title.toLowerCase().includes(search.toLowerCase())
        || (a.keywords || '').toLowerCase().includes(search.toLowerCase())
        || (a.doi || '').toLowerCase().includes(search.toLowerCase());
      const matchStatus = statusFilter === 'all' || a.status === statusFilter;
      const sub = a.submission_date?.substring(0, 10) || '';
      const matchFrom = !dateFrom || sub >= dateFrom;
      const matchTo = !dateTo || sub <= dateTo;
      return matchSearch && matchStatus && matchFrom && matchTo;
    });
  }, [articles, search, statusFilter, dateFrom, dateTo]);

  // === KEY METRICS ===

  // Stats per year: published, rejected, total, rejection rate
  const yearStats = useMemo(() => {
    const map: Record<string, { pub: number; rej: number; total: number }> = {};
    articles.forEach(a => {
      const y = a.submission_date?.substring(0, 4) || '?';
      if (y === '?') return;
      if (!map[y]) map[y] = { pub: 0, rej: 0, total: 0 };
      map[y].total++;
      if (a.status === 'Publicado') map[y].pub++;
      if (a.status === 'Rechazado') map[y].rej++;
    });
    return Object.entries(map)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([y, d]) => ({ year: y, ...d, rejRate: d.total > 0 ? Math.round((d.rej / d.total) * 100) : 0 }));
  }, [articles]);

  // Articles per issue/number (from views data) + rejection from articles data mapped by source/issue
  const issueStats = useMemo(() => {
    // Published per issue from views
    const pubMap: Record<string, number> = {};
    views.forEach(v => { if (v.issue) pubMap[v.issue] = (pubMap[v.issue] || 0) + 1; });
    
    // Total & rejected per issue from articles (source field or section grouping by year)
    // We group rejection rates by year extracted from views issue names (e.g. "Vol. 8 Núm. 2 (2020)")
    const issueYearMap: Record<string, string> = {};
    views.forEach(v => {
      if (v.issue) {
        const m = v.issue.match(/\((\d{4})\)/);
        if (m) issueYearMap[v.issue] = m[1];
      }
    });

    return Object.entries(pubMap)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([issue, count]) => {
        const year = issueYearMap[issue];
        const ys = year ? yearStats.find(y => y.year === year) : null;
        return { issue, count, rejRate: ys?.rejRate ?? null, year };
      });
  }, [views, yearStats]);

  // Year distribution (all submissions)
  const yearCounts = useMemo(() => {
    const map: Record<string, number> = {};
    filtered.forEach(a => {
      const y = a.submission_date?.substring(0, 4) || '?';
      if (y !== '?') map[y] = (map[y] || 0) + 1;
    });
    return Object.entries(map).sort(([a], [b]) => a.localeCompare(b));
  }, [filtered]);

  // Status counts
  const statusCounts = useMemo(() => {
    const map: Record<string, number> = {};
    filtered.forEach(a => { map[a.status] = (map[a.status] || 0) + 1; });
    return map;
  }, [filtered]);

  // View totals
  const viewTotals = useMemo(() => {
    if (views.length === 0) return null;
    return {
      abstracts: views.reduce((s, v) => s + (v.abstract_views || 0), 0),
      pdfs: views.reduce((s, v) => s + (v.pdf_views || 0), 0),
      top5: views.slice(0, 5),
    };
  }, [views]);

  const loadArticleDetails = async (articleId: string, ojsId: number) => {
    if (expandedArticle === articleId) { setExpandedArticle(null); return; }
    setExpandedArticle(articleId);
    const supabase = createClient();
    if (!articleAuthors[articleId]) {
      const { data } = await supabase.from('article_authors').select('*').eq('article_id', articleId).order('author_order');
      setArticleAuthors(prev => ({ ...prev, [articleId]: data || [] }));
    }
    if (!articleReviews[articleId]) {
      const { data } = await supabase.from('article_reviews').select('*').eq('article_ojs_id', ojsId).eq('journal_id', journalId).order('date_assigned');
      setArticleReviews(prev => ({ ...prev, [articleId]: data || [] }));
    }
  };

  const clearFilters = () => { setSearch(''); setStatusFilter('all'); setDateFrom(''); setDateTo(''); };
  const hasFilters = search || statusFilter !== 'all' || dateFrom || dateTo;

  if (loading) return <p style={{ padding: '20px', color: 'var(--gray-400)', fontSize: '13px' }}>Cargando artículos...</p>;

  if (articles.length === 0) return (
    <div style={{ padding: '40px', textAlign: 'center' }}>
      <div style={{ fontSize: '48px', marginBottom: '12px' }}>📄</div>
      <h3 style={{ color: 'var(--gray-600)' }}>Sin artículos importados</h3>
      <p style={{ color: 'var(--gray-400)', fontSize: '13px', marginTop: '4px' }}>
        Importa el reporte OJS de esta revista usando el script de importación.
      </p>
    </div>
  );

  const maxYearCount = Math.max(...yearCounts.map(([, c]) => c), 1);
  const maxPubYear = Math.max(...yearStats.map(d => d.pub), 1);

  return (
    <div>
      {/* KPI Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(155px, 1fr))', gap: '12px', marginBottom: '24px' }}>
        {Object.entries(STATUS_CONFIG).map(([key, cfg]) => {
          const count = statusCounts[key] || 0;
          if (count === 0) return null;
          const Icon = cfg.icon;
          return (
            <div key={key} style={{
              background: 'white', border: '1px solid var(--gray-100)',
              borderRadius: 'var(--radius-lg)', padding: '16px',
              cursor: 'pointer', borderLeft: `4px solid ${cfg.color}`,
              transition: 'all 0.15s',
              ...(statusFilter === key ? { boxShadow: `0 0 0 2px ${cfg.color}40` } : {}),
            }} onClick={() => setStatusFilter(statusFilter === key ? 'all' : key)}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Icon size={18} color={cfg.color} />
                <span style={{ fontSize: '11px', fontWeight: 600, color: 'var(--gray-500)', textTransform: 'uppercase' }}>{cfg.label}</span>
              </div>
              <div style={{ fontSize: '28px', fontWeight: 800, color: cfg.color, marginTop: '4px' }}>{count}</div>
            </div>
          );
        })}

        {reviewStat && (
          <div style={{ background: 'white', border: '1px solid var(--gray-100)', borderRadius: 'var(--radius-lg)', padding: '16px', borderLeft: '4px solid #7B1FA2' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Users size={18} color="#7B1FA2" />
              <span style={{ fontSize: '11px', fontWeight: 600, color: 'var(--gray-500)', textTransform: 'uppercase' }}>Revisores</span>
            </div>
            <div style={{ fontSize: '28px', fontWeight: 800, color: '#7B1FA2', marginTop: '4px' }}>{reviewStat.unique_reviewers}</div>
            <div style={{ fontSize: '11px', color: 'var(--gray-400)' }}>{reviewStat.total_reviews} evaluaciones</div>
          </div>
        )}

        {viewTotals && (
          <div style={{ background: 'white', border: '1px solid var(--gray-100)', borderRadius: 'var(--radius-lg)', padding: '16px', borderLeft: '4px solid #0097A7' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Eye size={18} color="#0097A7" />
              <span style={{ fontSize: '11px', fontWeight: 600, color: 'var(--gray-500)', textTransform: 'uppercase' }}>Vistas</span>
            </div>
            <div style={{ fontSize: '28px', fontWeight: 800, color: '#0097A7', marginTop: '4px' }}>{viewTotals.abstracts.toLocaleString()}</div>
            <div style={{ fontSize: '11px', color: 'var(--gray-400)' }}>{viewTotals.pdfs.toLocaleString()} descargas PDF</div>
          </div>
        )}
      </div>

      {/* ====== ARTICLES PER ISSUE & PER YEAR ====== */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '24px' }}>
        {/* Published per Year + Rejection Rate */}
        {yearStats.length > 0 && (
          <div style={{ padding: '16px', background: 'var(--gray-50)', borderRadius: 'var(--radius-lg)', border: '1px solid var(--gray-100)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '14px' }}>
              <Calendar size={14} color="var(--primary)" />
              <span style={{ fontSize: '12px', fontWeight: 700, color: 'var(--gray-600)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                Publicados & Rechazo por Año
              </span>
            </div>
            <div style={{ display: 'flex', gap: '6px', alignItems: 'flex-end', height: '110px' }}>
              {yearStats.map(d => (
                <div key={d.year} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '2px' }}>
                  <span style={{ fontSize: '11px', fontWeight: 700, color: 'var(--primary)' }}>{d.pub}</span>
                  <div style={{
                    width: '100%', maxWidth: '48px',
                    height: `${Math.max((d.pub / maxPubYear) * 56, 6)}px`,
                    background: 'linear-gradient(180deg, var(--primary), #43A047)',
                    borderRadius: '3px 3px 0 0', transition: 'height 0.4s ease',
                  }} />
                  <span style={{
                    fontSize: '9px', fontWeight: 700,
                    color: d.rejRate >= 60 ? '#E53935' : d.rejRate >= 40 ? '#F57C00' : '#43A047',
                    background: d.rejRate >= 60 ? '#FFEBEE' : d.rejRate >= 40 ? '#FFF3E0' : '#E8F5E9',
                    padding: '1px 4px', borderRadius: '4px',
                  }}>
                    {d.rejRate}%⛔
                  </span>
                  <span style={{ fontSize: '10px', color: 'var(--gray-500)', fontWeight: 600 }}>{d.year}</span>
                </div>
              ))}
            </div>
            <div style={{
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              marginTop: '10px', paddingTop: '10px', borderTop: '1px solid var(--gray-100)',
            }}>
              <div>
                <span style={{ fontSize: '11px', color: 'var(--gray-400)' }}>Promedio: </span>
                <span style={{ fontSize: '13px', fontWeight: 800, color: 'var(--primary)' }}>
                  {(yearStats.reduce((s, d) => s + d.pub, 0) / yearStats.length).toFixed(1)} art/año
                </span>
              </div>
              <div>
                <span style={{ fontSize: '11px', color: 'var(--gray-400)' }}>Rechazo global: </span>
                <span style={{ fontSize: '13px', fontWeight: 800, color: '#E53935' }}>
                  {(() => {
                    const totR = yearStats.reduce((s, d) => s + d.rej, 0);
                    const totA = yearStats.reduce((s, d) => s + d.total, 0);
                    return totA > 0 ? Math.round((totR / totA) * 100) : 0;
                  })()}%
                </span>
              </div>
            </div>
          </div>
        )}

        {/* Articles per Issue/Número + Rejection Rate */}
        {issueStats.length > 0 && (
          <div style={{ padding: '16px', background: 'var(--gray-50)', borderRadius: 'var(--radius-lg)', border: '1px solid var(--gray-100)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '14px' }}>
              <BookOpen size={14} color="#7B1FA2" />
              <span style={{ fontSize: '12px', fontWeight: 700, color: 'var(--gray-600)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                Artículos por Número + % Rechazo
              </span>
            </div>
            <div style={{ maxHeight: '160px', overflowY: 'auto', paddingRight: '4px' }}>
              {issueStats.map(d => {
                const maxIssue = Math.max(...issueStats.map(x => x.count));
                return (
                  <div key={d.issue} style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
                    <span style={{ fontSize: '11px', color: 'var(--gray-500)', minWidth: '170px', flexShrink: 0 }}>
                      {d.issue.length > 28 ? d.issue.slice(0, 28) + '…' : d.issue}
                    </span>
                    <div style={{ flex: 1, height: '14px', background: 'var(--gray-100)', borderRadius: '7px', overflow: 'hidden' }}>
                      <div style={{
                        width: `${(d.count / maxIssue) * 100}%`, height: '100%',
                        background: 'linear-gradient(90deg, #7B1FA2, #AB47BC)',
                        borderRadius: '7px', transition: 'width 0.3s',
                      }} />
                    </div>
                    <span style={{ fontSize: '12px', fontWeight: 700, color: '#7B1FA2', minWidth: '24px', textAlign: 'right' }}>{d.count}</span>
                    {d.rejRate !== null && (
                      <span style={{
                        fontSize: '9px', fontWeight: 700, minWidth: '36px', textAlign: 'center',
                        padding: '2px 4px', borderRadius: '4px',
                        background: d.rejRate >= 60 ? '#FFEBEE' : d.rejRate >= 40 ? '#FFF3E0' : '#E8F5E9',
                        color: d.rejRate >= 60 ? '#E53935' : d.rejRate >= 40 ? '#F57C00' : '#43A047',
                      }}>
                        {d.rejRate}%⛔
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
            <div style={{
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              marginTop: '10px', paddingTop: '10px', borderTop: '1px solid var(--gray-100)',
            }}>
              <span style={{ fontSize: '11px', color: 'var(--gray-400)' }}>Promedio</span>
              <span style={{ fontSize: '14px', fontWeight: 800, color: '#7B1FA2' }}>
                {(issueStats.reduce((s, d) => s + d.count, 0) / issueStats.length).toFixed(1)} art/número
              </span>
            </div>
          </div>
        )}
      </div>

      {/* Submissions per Year mini chart */}
      {yearCounts.length > 1 && (
        <div style={{ marginBottom: '24px', padding: '16px', background: 'var(--gray-50)', borderRadius: 'var(--radius-lg)' }}>
          <div style={{ fontSize: '11px', fontWeight: 600, color: 'var(--gray-500)', textTransform: 'uppercase', marginBottom: '12px' }}>
            Todos los Envíos por Año {hasFilters && <span style={{ color: 'var(--primary)' }}>(filtrado)</span>}
          </div>
          <div style={{ display: 'flex', gap: '4px', alignItems: 'flex-end', height: '50px' }}>
            {yearCounts.map(([y, c]) => (
              <div key={y} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '2px' }}>
                <span style={{ fontSize: '10px', fontWeight: 600, color: 'var(--gray-600)' }}>{c}</span>
                <div style={{
                  width: '100%', height: `${Math.max((c / maxYearCount) * 36, 4)}px`,
                  background: 'var(--primary)', borderRadius: '2px 2px 0 0', opacity: 0.6,
                }} />
                <span style={{ fontSize: '9px', color: 'var(--gray-400)' }}>{y.slice(2)}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Review recommendations */}
      {reviewStat && Object.keys(reviewStat.recommendations).length > 0 && (
        <div style={{ marginBottom: '24px', padding: '16px', background: 'var(--gray-50)', borderRadius: 'var(--radius-lg)' }}>
          <div style={{ fontSize: '11px', fontWeight: 600, color: 'var(--gray-500)', textTransform: 'uppercase', marginBottom: '12px' }}>
            Recomendaciones de Pares
          </div>
          <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
            {Object.entries(reviewStat.recommendations).sort(([, a], [, b]) => b - a).map(([rec, count]) => {
              const total = Object.values(reviewStat.recommendations).reduce((s, v) => s + v, 0);
              const pct = Math.round((count / total) * 100);
              const color = rec.includes('Aceptar') ? '#43A047' : rec.includes('modificaciones') ? '#F57C00' : rec.includes('No publicable') ? '#E53935' : '#1565C0';
              return (
                <div key={rec} style={{ background: 'white', border: '1px solid var(--gray-100)', borderRadius: 'var(--radius-md)', padding: '10px 14px', minWidth: '140px' }}>
                  <div style={{ fontSize: '11px', color: 'var(--gray-500)', marginBottom: '4px' }}>{rec}</div>
                  <div style={{ display: 'flex', alignItems: 'baseline', gap: '6px' }}>
                    <span style={{ fontSize: '20px', fontWeight: 800, color }}>{count}</span>
                    <span style={{ fontSize: '11px', color: 'var(--gray-400)' }}>({pct}%)</span>
                  </div>
                  <div style={{ width: '100%', height: '3px', background: 'var(--gray-100)', borderRadius: '2px', marginTop: '6px', overflow: 'hidden' }}>
                    <div style={{ width: `${pct}%`, height: '100%', background: color, borderRadius: '2px' }} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Top viewed */}
      {viewTotals && viewTotals.top5.length > 0 && (
        <div style={{ marginBottom: '24px', padding: '16px', background: 'var(--gray-50)', borderRadius: 'var(--radius-lg)' }}>
          <div style={{ fontSize: '11px', fontWeight: 600, color: 'var(--gray-500)', textTransform: 'uppercase', marginBottom: '12px' }}>Top 5 Más Vistos</div>
          {viewTotals.top5.map((a, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '8px 0', borderBottom: i < 4 ? '1px solid var(--gray-100)' : 'none' }}>
              <span style={{
                width: '24px', height: '24px', borderRadius: '50%',
                background: i === 0 ? '#FFD700' : i === 1 ? '#C0C0C0' : i === 2 ? '#CD7F32' : 'var(--gray-200)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: '11px', fontWeight: 700, color: i < 3 ? 'white' : 'var(--gray-500)', flexShrink: 0,
              }}>{i + 1}</span>
              <span style={{ flex: 1, fontSize: '13px', color: 'var(--gray-700)', lineHeight: 1.4 }}>
                {(a.title || '?').length > 80 ? (a.title || '?').slice(0, 80) + '...' : a.title}
              </span>
              <span style={{ fontSize: '13px', fontWeight: 700, color: '#0097A7', flexShrink: 0 }}>
                {(a.abstract_views || 0).toLocaleString()} <Eye size={12} style={{ marginLeft: '2px', verticalAlign: 'text-bottom' }} />
              </span>
            </div>
          ))}
        </div>
      )}

      {/* ====== SEARCH & DATE FILTERS ====== */}
      <div style={{
        display: 'flex', gap: '12px', marginBottom: '16px', alignItems: 'center', flexWrap: 'wrap',
        padding: '12px 16px', background: 'var(--gray-50)', borderRadius: 'var(--radius-lg)',
      }}>
        <div className="search-bar" style={{ flex: 1, minWidth: '200px' }}>
          <Search size={18} className="search-icon" />
          <input type="text" placeholder="Buscar artículos, palabras clave, DOI..." value={search} onChange={e => setSearch(e.target.value)} />
        </div>

        <select
          value={statusFilter}
          onChange={e => setStatusFilter(e.target.value)}
          style={{
            padding: '6px 10px', borderRadius: 'var(--radius-md)', border: '1px solid var(--gray-200)',
            fontSize: '12px', color: statusFilter === 'all' ? 'var(--gray-500)' : (STATUS_CONFIG[statusFilter]?.color || 'var(--gray-600)'),
            background: 'white', fontWeight: statusFilter !== 'all' ? 700 : 400,
            cursor: 'pointer', minWidth: '130px',
          }}
        >
          <option value="all">Todos los estados</option>
          {Object.entries(STATUS_CONFIG).map(([key, cfg]) => (
            <option key={key} value={key}>{cfg.label} ({statusCounts[key] || 0})</option>
          ))}
        </select>

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Calendar size={14} color="var(--gray-400)" />
          <input
            type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)}
            style={{
              padding: '6px 10px', borderRadius: 'var(--radius-md)', border: '1px solid var(--gray-200)',
              fontSize: '12px', color: 'var(--gray-600)', background: 'white',
            }}
          />
          <span style={{ color: 'var(--gray-400)', fontSize: '12px' }}>→</span>
          <input
            type="date" value={dateTo} onChange={e => setDateTo(e.target.value)}
            style={{
              padding: '6px 10px', borderRadius: 'var(--radius-md)', border: '1px solid var(--gray-200)',
              fontSize: '12px', color: 'var(--gray-600)', background: 'white',
            }}
          />
        </div>

        {hasFilters && (
          <button onClick={clearFilters} style={{
            padding: '5px 10px', fontSize: '11px', fontWeight: 600,
            background: 'var(--error)', color: 'white', border: 'none',
            borderRadius: 'var(--radius-md)', cursor: 'pointer',
          }}>
            ✕ Limpiar
          </button>
        )}

        <span style={{ fontSize: '13px', color: 'var(--gray-400)', fontWeight: 600 }}>
          {filtered.length} / {articles.length}
        </span>
      </div>

      {/* Articles table */}
      <div style={{ overflowX: 'auto' }}>
        <table className="data-table" style={{ fontSize: '13px' }}>
          <thead>
            <tr>
              <th style={{ width: '50%' }}>Título</th>
              <th>Sección</th>
              <th>Estado</th>
              <th>DOI</th>
              <th>Fecha</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {filtered.slice(0, 50).map(a => {
              const isExpanded = expandedArticle === a.id;
              const authors = articleAuthors[a.id] || [];
              const reviews = articleReviews[a.id] || [];
              const cfg = STATUS_CONFIG[a.status] || { color: 'var(--gray-400)' };
              return (
                <>
                  <tr key={a.id} style={{ cursor: 'pointer', borderBottom: isExpanded ? 'none' : undefined }}
                    onClick={() => loadArticleDetails(a.id, a.ojs_id)}
                  >
                    <td style={{ maxWidth: '400px' }}>
                      <div style={{ fontWeight: 600, color: 'var(--gray-800)', lineHeight: 1.4 }}>
                        {a.title.length > 90 ? a.title.slice(0, 90) + '...' : a.title}
                      </div>
                      {a.keywords && (
                        <div style={{ fontSize: '11px', color: 'var(--gray-400)', marginTop: '2px' }}>
                          {a.keywords.length > 60 ? a.keywords.slice(0, 60) + '...' : a.keywords}
                        </div>
                      )}
                    </td>
                    <td>
                      <span style={{ fontSize: '11px', color: 'var(--gray-500)' }}>
                        {a.section === 'Artículos' ? '📄' : a.section === 'Original Artículos' ? '🔬' : '📋'} {a.section || '—'}
                      </span>
                    </td>
                    <td>
                      <span style={{
                        display: 'inline-flex', alignItems: 'center', gap: '4px',
                        padding: '3px 8px', borderRadius: '12px', fontSize: '11px', fontWeight: 600,
                        background: `${cfg.color}15`, color: cfg.color,
                      }}>{a.status}</span>
                    </td>
                    <td>
                      {a.doi ? (
                        <a href={`https://doi.org/${a.doi}`} target="_blank" rel="noopener" onClick={e => e.stopPropagation()}
                          style={{ fontSize: '11px', color: 'var(--primary)', textDecoration: 'none' }}>
                          {a.doi.length > 25 ? '...' + a.doi.slice(-20) : a.doi}
                        </a>
                      ) : <span style={{ color: 'var(--gray-300)' }}>—</span>}
                    </td>
                    <td style={{ fontSize: '12px', color: 'var(--gray-500)', whiteSpace: 'nowrap' }}>
                      {a.submission_date?.substring(0, 10) || '—'}
                    </td>
                    <td>
                      {isExpanded ? <ChevronUp size={16} color="var(--gray-400)" /> : <ChevronDown size={16} color="var(--gray-400)" />}
                    </td>
                  </tr>
                  {isExpanded && (
                    <tr key={`${a.id}-details`}>
                      <td colSpan={6} style={{ background: 'var(--gray-50)', padding: '16px 20px' }}>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
                          <div>
                            <div style={{ fontSize: '11px', fontWeight: 600, color: 'var(--gray-500)', textTransform: 'uppercase', marginBottom: '8px' }}>
                              Autores ({authors.length})
                            </div>
                            {authors.length === 0 && <span style={{ fontSize: '12px', color: 'var(--gray-400)' }}>Cargando...</span>}
                            {authors.map((au, i) => (
                              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
                                <span style={{
                                  width: '20px', height: '20px', borderRadius: '50%',
                                  background: 'var(--primary-50)', color: 'var(--primary)',
                                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                                  fontSize: '10px', fontWeight: 700, flexShrink: 0,
                                }}>{i + 1}</span>
                                <div>
                                  <div style={{ fontSize: '13px', fontWeight: 600 }}>{au.first_name} {au.last_name}</div>
                                  {au.affiliation && <div style={{ fontSize: '11px', color: 'var(--gray-400)' }}>{au.affiliation}</div>}
                                  {au.country && <span style={{ fontSize: '10px', color: 'var(--gray-400)' }}> 🌍 {au.country}</span>}
                                </div>
                              </div>
                            ))}
                          </div>
                          <div>
                            <div style={{ fontSize: '11px', fontWeight: 600, color: 'var(--gray-500)', textTransform: 'uppercase', marginBottom: '8px' }}>
                              Evaluaciones ({reviews.length})
                            </div>
                            {reviews.length === 0 && <span style={{ fontSize: '12px', color: 'var(--gray-400)' }}>Sin evaluaciones</span>}
                            {reviews.map((rv, i) => (
                              <div key={i} style={{ padding: '8px 12px', marginBottom: '6px', background: 'white', borderRadius: 'var(--radius-md)', border: '1px solid var(--gray-100)' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                  <span style={{ fontSize: '13px', fontWeight: 600 }}>{rv.reviewer_first_name} {rv.reviewer_last_name}</span>
                                  {rv.recommendation && (
                                    <span style={{
                                      fontSize: '10px', fontWeight: 600, padding: '2px 6px', borderRadius: '8px',
                                      background: rv.recommendation.includes('Aceptar') ? '#E8F5E9' : rv.recommendation.includes('modificaciones') ? '#FFF3E0' : '#FFEBEE',
                                      color: rv.recommendation.includes('Aceptar') ? '#2E7D32' : rv.recommendation.includes('modificaciones') ? '#E65100' : '#C62828',
                                    }}>{rv.recommendation}</span>
                                  )}
                                </div>
                                <div style={{ fontSize: '11px', color: 'var(--gray-400)', marginTop: '2px' }}>
                                  {rv.reviewer_affiliation || ''} {rv.date_completed ? `· Completada: ${rv.date_completed.substring(0, 10)}` : rv.declined ? '· Declinó' : '· Pendiente'}
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                        {a.ojs_url && (
                          <div style={{ marginTop: '12px' }}>
                            <a href={a.ojs_url} target="_blank" rel="noopener" style={{ fontSize: '12px', color: 'var(--primary)', textDecoration: 'none' }}>
                              🔗 Ver en OJS →
                            </a>
                          </div>
                        )}
                      </td>
                    </tr>
                  )}
                </>
              );
            })}
          </tbody>
        </table>
        {filtered.length > 50 && (
          <p style={{ textAlign: 'center', fontSize: '12px', color: 'var(--gray-400)', padding: '12px' }}>
            Mostrando 50 de {filtered.length} artículos. Usa el buscador para filtrar.
          </p>
        )}
      </div>
    </div>
  );
}
