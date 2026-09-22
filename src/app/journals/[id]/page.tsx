'use client';

import { useEffect, useState, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import Link from 'next/link';
import { ArrowLeft, ExternalLink, Plus, Pencil, Trash2, TrendingUp, BarChart3, FileText } from 'lucide-react';
import JournalForm from '@/components/JournalForm';
import IndexationForm from '@/components/IndexationForm';
import LinkForm from '@/components/LinkForm';
import MetricForm from '@/components/MetricForm';
import ConfirmDialog from '@/components/ConfirmDialog';
import JournalArticles from '@/components/JournalArticles';

interface JournalDetail {
  id: string;
  name: string;
  type: string;
  issn_print: string | null;
  issn_online: string | null;
  area: string | null;
  specialty: string | null;
  grand_area: string | null;
  ojs_url: string | null;
  google_scholar_url: string | null;
  h_index: number | null;
  editor_name: string | null;
  editor_email: string | null;
  status: string;
  description: string | null;
  faculty_id: string | null;
}

interface Indexation {
  id: string;
  indexer: string;
  category: string;
  subject_category: string | null;
  year: number;
  status: string;
}

interface JournalLink {
  id: string;
  link_type: string;
  url: string;
  label: string | null;
}

interface Metric {
  id: string;
  year: number;
  sjr: number | null;
  h_index: number | null;
  cite_score: number | null;
  impact_factor: number | null;
}

export default function JournalDetailPage() {
  const params = useParams();
  const router = useRouter();
  const journalId = params.id as string;
  const [journal, setJournal] = useState<JournalDetail | null>(null);
  const [indexations, setIndexations] = useState<Indexation[]>([]);
  const [links, setLinks] = useState<JournalLink[]>([]);
  const [metrics, setMetrics] = useState<Metric[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'publindex' | 'scopus'>('scopus');
  const [mainTab, setMainTab] = useState<'overview' | 'articles'>('overview');

  // Modal states
  const [showEditJournal, setShowEditJournal] = useState(false);
  const [showAddIndexation, setShowAddIndexation] = useState(false);
  const [showAddLink, setShowAddLink] = useState(false);
  const [showAddMetric, setShowAddMetric] = useState(false);
  const [deleteIndexation, setDeleteIndexation] = useState<Indexation | null>(null);
  const [deleteLink, setDeleteLink] = useState<JournalLink | null>(null);
  const [deleteMetric, setDeleteMetric] = useState<Metric | null>(null);
  const [deleting, setDeleting] = useState(false);

  const loadData = useCallback(async () => {
    const supabase = createClient();
    const [jRes, iRes, lRes, mRes] = await Promise.all([
      supabase.from('journals').select('*').eq('id', journalId).single(),
      supabase.from('journal_indexations').select('*').eq('journal_id', journalId).order('year', { ascending: true }),
      supabase.from('journal_links').select('*').eq('journal_id', journalId),
      supabase.from('journal_metrics').select('*').eq('journal_id', journalId).order('year', { ascending: true }),
    ]);
    setJournal(jRes.data);
    setIndexations(iRes.data || []);
    setLinks(lRes.data || []);
    setMetrics(mRes.data || []);
    setLoading(false);
  }, [journalId]);

  useEffect(() => { loadData(); }, [loadData]);

  const handleDeleteIndexation = async () => {
    if (!deleteIndexation) return;
    setDeleting(true);
    const supabase = createClient();
    await supabase.from('journal_indexations').delete().eq('id', deleteIndexation.id);
    setDeleting(false);
    setDeleteIndexation(null);
    loadData();
  };

  const handleDeleteLink = async () => {
    if (!deleteLink) return;
    setDeleting(true);
    const supabase = createClient();
    await supabase.from('journal_links').delete().eq('id', deleteLink.id);
    setDeleting(false);
    setDeleteLink(null);
    loadData();
  };

  const handleDeleteMetric = async () => {
    if (!deleteMetric) return;
    setDeleting(true);
    const supabase = createClient();
    await supabase.from('journal_metrics').delete().eq('id', deleteMetric.id);
    setDeleting(false);
    setDeleteMetric(null);
    loadData();
  };

  if (loading || !journal) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '60vh' }}>
        <p style={{ color: 'var(--gray-500)' }}>Cargando revista...</p>
      </div>
    );
  }

  const publindexData = indexations.filter(i => i.indexer === 'publindex');
  const scopusData = indexations.filter(i => i.indexer === 'scopus');
  const otherIndexData = indexations.filter(i => i.indexer !== 'scopus' && i.indexer !== 'publindex');

  // Group scopus by subject_category
  const scopusGroups = new Map<string, Indexation[]>();
  scopusData.forEach(i => {
    const key = i.subject_category || 'General';
    if (!scopusGroups.has(key)) scopusGroups.set(key, []);
    scopusGroups.get(key)!.push(i);
  });

  const quartileColor = (q: string) => {
    const colors: Record<string, string> = {
      Q1: 'var(--q1)', Q2: 'var(--q2)', Q3: 'var(--q3)', Q4: 'var(--q4)',
      A1: 'var(--publindex-a1)', A2: 'var(--publindex-a2)', B: 'var(--publindex-b)', C: 'var(--publindex-c)',
    };
    return colors[q] || 'var(--gray-400)';
  };

  const indexerLabel = (key: string) => {
    const map: Record<string, string> = {
      scopus: 'Scopus', publindex: 'Publindex', latindex: 'Latindex',
      doaj: 'DOAJ', redalyc: 'Redalyc', scielo: 'SciELO', wos: 'WoS',
    };
    return map[key] || key;
  };

  return (
    <>
      <div className="page-header">
        <Link href="/journals" className="flex items-center gap-2" style={{ fontSize: '13px', color: 'var(--gray-500)', textDecoration: 'none', marginBottom: '12px' }}>
          <ArrowLeft size={16} /> Volver a Revistas
        </Link>
        <div className="flex items-center justify-between">
          <div>
            <div className="flex items-center gap-3">
              <h2>{journal.name}</h2>
              <span className={`badge ${journal.type === 'cientifica' ? 'badge-info' : 'badge-neutral'}`}>
                {journal.type === 'cientifica' ? 'Científica' : 'Académica'}
              </span>
            </div>
            <p style={{ fontFamily: 'monospace' }}>
              {journal.issn_online ? `eISSN: ${journal.issn_online}` : ''}
              {journal.issn_print ? ` · Print: ${journal.issn_print}` : ''}
            </p>
          </div>
          <div className="flex gap-2">
            <button className="btn btn-secondary btn-sm" onClick={() => setShowEditJournal(true)}>
              <Pencil size={14} /> Editar
            </button>
            {journal.ojs_url && (
              <a href={journal.ojs_url} target="_blank" rel="noopener" className="btn btn-secondary btn-sm">
                <ExternalLink size={14} /> OJS
              </a>
            )}
          </div>
        </div>
      </div>

      <div className="page-content">
        {/* Main tab navigation */}
        <div style={{ display: 'flex', gap: '4px', marginBottom: '24px', borderBottom: '2px solid var(--gray-100)', paddingBottom: '0' }}>
          <button
            onClick={() => setMainTab('overview')}
            style={{
              padding: '10px 20px', fontSize: '14px', fontWeight: 600,
              background: 'none', cursor: 'pointer',
              color: mainTab === 'overview' ? 'var(--primary)' : 'var(--gray-400)',
              borderTop: 'none', borderLeft: 'none', borderRight: 'none',
              borderBottom: mainTab === 'overview' ? '3px solid var(--primary)' : '3px solid transparent',
              marginBottom: '-2px', transition: 'all 0.15s',
              display: 'flex', alignItems: 'center', gap: '6px',
            }}
          >
            <BarChart3 size={16} /> Perfil
          </button>
          <button
            onClick={() => setMainTab('articles')}
            style={{
              padding: '10px 20px', fontSize: '14px', fontWeight: 600,
              background: 'none', cursor: 'pointer',
              color: mainTab === 'articles' ? 'var(--primary)' : 'var(--gray-400)',
              borderTop: 'none', borderLeft: 'none', borderRight: 'none',
              borderBottom: mainTab === 'articles' ? '3px solid var(--primary)' : '3px solid transparent',
              marginBottom: '-2px', transition: 'all 0.15s',
              display: 'flex', alignItems: 'center', gap: '6px',
            }}
          >
            <FileText size={16} /> Artículos
          </button>
        </div>

        {mainTab === 'articles' && (
          <JournalArticles journalId={journalId} />
        )}

        {mainTab === 'overview' && (
        <>
        {/* Description */}
        {journal.description && (
          <div style={{
            background: 'var(--gray-50)',
            borderRadius: 'var(--radius-md)',
            padding: '16px 20px',
            fontSize: '14px',
            color: 'var(--gray-600)',
            lineHeight: 1.7,
            marginBottom: '24px',
            borderLeft: '4px solid var(--primary)',
          }}>
            {journal.description}
          </div>
        )}

        {/* Info cards */}
        <div className="stats-grid mb-6">
          <div className="stat-card">
            <div className="stat-info">
              <h4>Área</h4>
              <div className="stat-value" style={{ fontSize: '16px' }}>{journal.area || '—'}</div>
              {journal.specialty && <div className="stat-subtitle">{journal.specialty}</div>}
              {journal.grand_area && <div className="stat-subtitle">{journal.grand_area}</div>}
            </div>
          </div>
          <div className="stat-card">
            <div className="stat-info">
              <h4>H-Index</h4>
              <div className="stat-value">{journal.h_index || '—'}</div>
              <div className="stat-subtitle">SCImago</div>
            </div>
          </div>
          <div className="stat-card">
            <div className="stat-info">
              <h4>SJR Actual</h4>
              <div className="stat-value" style={{ fontSize: '22px' }}>
                {metrics.length > 0 ? metrics[metrics.length - 1].sjr?.toFixed(3) || '—' : '—'}
              </div>
              <div className="stat-subtitle">{metrics.length > 0 ? metrics[metrics.length - 1].year : ''}</div>
            </div>
          </div>
          <div className="stat-card">
            <div className="stat-info">
              <h4>Editor(a)</h4>
              <div className="stat-value" style={{ fontSize: '14px' }}>
                {journal.editor_name || '—'}
              </div>
              {journal.editor_email && (
                <div className="stat-subtitle">
                  <a href={`mailto:${journal.editor_email}`} style={{ color: 'var(--primary)', textDecoration: 'none' }}>
                    {journal.editor_email}
                  </a>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Indexation Section */}
        <div className="card mb-6">
          <div className="card-header">
            <div className="flex gap-2">
              <button
                className={`btn btn-sm ${activeTab === 'scopus' ? 'btn-primary' : 'btn-secondary'}`}
                onClick={() => setActiveTab('scopus')}
              >
                Scopus ({scopusData.length})
              </button>
              <button
                className={`btn btn-sm ${activeTab === 'publindex' ? 'btn-primary' : 'btn-secondary'}`}
                onClick={() => setActiveTab('publindex')}
              >
                Publindex ({publindexData.length})
              </button>
            </div>
            <button className="btn btn-primary btn-sm" onClick={() => setShowAddIndexation(true)}>
              <Plus size={14} /> Agregar Indexación
            </button>
          </div>
          <div className="card-body">
            {activeTab === 'scopus' && (
              <>
                {scopusData.length === 0 ? (
                  <div className="empty-state">
                    <div className="empty-icon">🔎</div>
                    <h3>Sin datos de Scopus</h3>
                    <p>Agrega el historial de cuartiles Scopus para esta revista</p>
                    <button className="btn btn-primary btn-sm" onClick={() => setShowAddIndexation(true)}>
                      <Plus size={14} /> Agregar
                    </button>
                  </div>
                ) : (
                  Array.from(scopusGroups.entries()).map(([subject, items]) => (
                    <div key={subject} style={{ marginBottom: '24px' }}>
                      <h4 style={{ fontSize: '13px', fontWeight: 600, color: 'var(--gray-600)', marginBottom: '12px' }}>
                        📊 {subject}
                      </h4>
                      <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                        {items.sort((a, b) => a.year - b.year).map(item => (
                          <div key={item.id} style={{
                            display: 'flex',
                            flexDirection: 'column',
                            alignItems: 'center',
                            gap: '4px',
                            padding: '12px 16px',
                            borderRadius: 'var(--radius-md)',
                            background: 'var(--gray-50)',
                            border: `2px solid ${quartileColor(item.category)}`,
                            minWidth: '80px',
                            position: 'relative',
                            cursor: 'pointer',
                          }}
                            title="Click para eliminar"
                          >
                            <span style={{
                              fontSize: '20px',
                              fontWeight: 800,
                              color: quartileColor(item.category),
                            }}>
                              {item.category}
                            </span>
                            <span style={{ fontSize: '12px', color: 'var(--gray-500)' }}>
                              {item.year}
                            </span>
                            <button
                              onClick={(e) => { e.stopPropagation(); setDeleteIndexation(item); }}
                              style={{
                                position: 'absolute', top: '-6px', right: '-6px',
                                width: '20px', height: '20px', borderRadius: '50%',
                                background: 'var(--error)', color: 'white',
                                border: 'none', cursor: 'pointer',
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                fontSize: '11px', fontWeight: 700,
                                opacity: 0, transition: 'opacity 0.15s',
                              }}
                              onMouseEnter={e => (e.currentTarget.style.opacity = '1')}
                              onMouseLeave={e => (e.currentTarget.style.opacity = '0')}
                            >
                              ✕
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))
                )}
              </>
            )}

            {activeTab === 'publindex' && (
              <>
                {publindexData.length === 0 ? (
                  <div className="empty-state">
                    <div className="empty-icon">📋</div>
                    <h3>Sin datos de Publindex</h3>
                    <p>Agrega el historial de categorización Publindex</p>
                    <button className="btn btn-primary btn-sm" onClick={() => setShowAddIndexation(true)}>
                      <Plus size={14} /> Agregar
                    </button>
                  </div>
                ) : (
                  <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap', alignItems: 'flex-end' }}>
                    {publindexData.sort((a, b) => a.year - b.year).map(item => (
                      <div key={item.id} style={{
                        display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px',
                        position: 'relative', cursor: 'pointer',
                      }}>
                        <div style={{
                          width: '48px',
                          height: item.category === 'A1' ? '72px' : item.category === 'A2' ? '64px' : item.category === 'B' ? '56px' : '40px',
                          background: quartileColor(item.category),
                          borderRadius: '4px 4px 0 0',
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          transition: 'all var(--transition-base)',
                        }}>
                          <span style={{ color: 'white', fontWeight: 700, fontSize: '13px' }}>{item.category}</span>
                        </div>
                        <span style={{ fontSize: '10px', color: 'var(--gray-500)' }}>{item.year}</span>
                        <button
                          onClick={(e) => { e.stopPropagation(); setDeleteIndexation(item); }}
                          style={{
                            position: 'absolute', top: '-8px', right: '-8px',
                            width: '18px', height: '18px', borderRadius: '50%',
                            background: 'var(--error)', color: 'white',
                            border: 'none', cursor: 'pointer',
                            fontSize: '10px', fontWeight: 700,
                            opacity: 0, transition: 'opacity 0.15s',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                          }}
                          onMouseEnter={e => (e.currentTarget.style.opacity = '1')}
                          onMouseLeave={e => (e.currentTarget.style.opacity = '0')}
                        >
                          ✕
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </>
            )}
          </div>
        </div>

        {/* Other indexations table */}
        {otherIndexData.length > 0 && (
          <div className="card mb-6">
            <div className="card-header">
              <h3>📋 Otras Indexaciones</h3>
            </div>
            <div className="card-body" style={{ padding: 0 }}>
              <table className="data-table">
                <thead>
                  <tr><th>Indexador</th><th>Categoría</th><th>Año</th><th>Estado</th><th></th></tr>
                </thead>
                <tbody>
                  {otherIndexData.map(item => (
                    <tr key={item.id}>
                      <td style={{ fontWeight: 600 }}>{indexerLabel(item.indexer)}</td>
                      <td>{item.category || '—'}</td>
                      <td>{item.year}</td>
                      <td>
                        <span className={`badge ${item.status === 'vigente' ? 'badge-success' : 'badge-neutral'}`}>
                          {item.status}
                        </span>
                      </td>
                      <td>
                        <button className="btn btn-ghost btn-icon" onClick={() => setDeleteIndexation(item)}>
                          <Trash2 size={14} color="var(--error)" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* SJR Metrics timeline */}
        <div className="card mb-6">
          <div className="card-header">
            <h3>📈 Evolución de Métricas</h3>
            <button className="btn btn-primary btn-sm" onClick={() => setShowAddMetric(true)}>
              <Plus size={14} /> Agregar Métricas
            </button>
          </div>
          <div className="card-body">
            {metrics.length === 0 ? (
              <div className="empty-state">
                <div className="empty-icon">📈</div>
                <h3>Sin métricas</h3>
                <p>Agrega SJR, CiteScore o Impact Factor por año</p>
                <button className="btn btn-primary btn-sm" onClick={() => setShowAddMetric(true)}>
                  <Plus size={14} /> Agregar
                </button>
              </div>
            ) : (
              <>
                <div style={{ display: 'flex', gap: '16px', alignItems: 'flex-end', height: '120px', marginBottom: '16px' }}>
                  {metrics.map(m => {
                    const maxSjr = Math.max(...metrics.map(x => x.sjr || 0));
                    const barHeight = maxSjr > 0 ? ((m.sjr || 0) / maxSjr) * 100 : 0;
                    return (
                      <div key={m.id} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px', flex: 1, position: 'relative' }}>
                        <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--primary)' }}>
                          {m.sjr?.toFixed(3) || '—'}
                        </span>
                        <div style={{
                          width: '100%', maxWidth: '60px',
                          height: `${Math.max(barHeight, 10)}%`,
                          background: 'linear-gradient(180deg, var(--primary), var(--primary-light))',
                          borderRadius: '4px 4px 0 0',
                          transition: 'height 0.5s ease',
                        }} />
                        <span style={{ fontSize: '11px', color: 'var(--gray-500)' }}>{m.year}</span>
                        <button
                          onClick={() => setDeleteMetric(m)}
                          style={{
                            position: 'absolute', top: '-12px', right: '0',
                            width: '18px', height: '18px', borderRadius: '50%',
                            background: 'var(--error)', color: 'white',
                            border: 'none', cursor: 'pointer', fontSize: '10px',
                            opacity: 0, transition: 'opacity 0.15s',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                          }}
                          onMouseEnter={e => (e.currentTarget.style.opacity = '1')}
                          onMouseLeave={e => (e.currentTarget.style.opacity = '0')}
                        >
                          ✕
                        </button>
                      </div>
                    );
                  })}
                </div>

                {/* Metrics table */}
                <table className="data-table">
                  <thead>
                    <tr><th>Año</th><th>SJR</th><th>CiteScore</th><th>Impact Factor</th><th>H-Index</th></tr>
                  </thead>
                  <tbody>
                    {metrics.map(m => (
                      <tr key={m.id}>
                        <td style={{ fontWeight: 600 }}>{m.year}</td>
                        <td>{m.sjr?.toFixed(3) || '—'}</td>
                        <td>{m.cite_score?.toFixed(1) || '—'}</td>
                        <td>{m.impact_factor?.toFixed(3) || '—'}</td>
                        <td>{m.h_index || '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </>
            )}
          </div>
        </div>

        {/* External Links */}
        <div className="card">
          <div className="card-header">
            <h3>🔗 Enlaces Externos</h3>
            <button className="btn btn-primary btn-sm" onClick={() => setShowAddLink(true)}>
              <Plus size={14} /> Agregar Enlace
            </button>
          </div>
          <div className="card-body">
            {links.length === 0 && !journal.ojs_url ? (
              <div className="empty-state">
                <div className="empty-icon">🔗</div>
                <h3>Sin enlaces</h3>
                <p>Agrega enlaces a SCImago, Scopus, Google Scholar, etc.</p>
                <button className="btn btn-primary btn-sm" onClick={() => setShowAddLink(true)}>
                  <Plus size={14} /> Agregar
                </button>
              </div>
            ) : (
              <div className="flex gap-3" style={{ flexWrap: 'wrap' }}>
                {journal.ojs_url && (
                  <a href={journal.ojs_url} target="_blank" rel="noopener" className="btn btn-secondary btn-sm">
                    <ExternalLink size={14} /> OJS
                  </a>
                )}
                {journal.google_scholar_url && (
                  <a href={journal.google_scholar_url} target="_blank" rel="noopener" className="btn btn-secondary btn-sm">
                    <ExternalLink size={14} /> Google Scholar
                  </a>
                )}
                {links.map(l => (
                  <div key={l.id} style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                    <a href={l.url} target="_blank" rel="noopener" className="btn btn-secondary btn-sm">
                      <ExternalLink size={14} /> {l.label || indexerLabel(l.link_type)}
                    </a>
                    <button className="btn btn-ghost btn-icon" style={{ width: '28px', height: '28px' }} onClick={() => setDeleteLink(l)}>
                      <Trash2 size={12} color="var(--error)" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        </>
        )}
      </div>
      {/* Modals */}
      <JournalForm
        isOpen={showEditJournal}
        onClose={() => setShowEditJournal(false)}
        onSaved={loadData}
        journal={journal}
      />

      <IndexationForm
        isOpen={showAddIndexation}
        onClose={() => setShowAddIndexation(false)}
        onSaved={loadData}
        journalId={journalId}
      />

      <LinkForm
        isOpen={showAddLink}
        onClose={() => setShowAddLink(false)}
        onSaved={loadData}
        journalId={journalId}
      />

      <MetricForm
        isOpen={showAddMetric}
        onClose={() => setShowAddMetric(false)}
        onSaved={loadData}
        journalId={journalId}
      />

      <ConfirmDialog
        isOpen={!!deleteIndexation}
        onClose={() => setDeleteIndexation(null)}
        onConfirm={handleDeleteIndexation}
        loading={deleting}
        title="Eliminar Indexación"
        message={`¿Eliminar ${deleteIndexation?.indexer} ${deleteIndexation?.category} (${deleteIndexation?.year})?`}
      />

      <ConfirmDialog
        isOpen={!!deleteLink}
        onClose={() => setDeleteLink(null)}
        onConfirm={handleDeleteLink}
        loading={deleting}
        title="Eliminar Enlace"
        message={`¿Eliminar el enlace a ${deleteLink?.label || deleteLink?.link_type}?`}
      />

      <ConfirmDialog
        isOpen={!!deleteMetric}
        onClose={() => setDeleteMetric(null)}
        onConfirm={handleDeleteMetric}
        loading={deleting}
        title="Eliminar Métricas"
        message={`¿Eliminar las métricas del año ${deleteMetric?.year}?`}
      />
    </>
  );
}
