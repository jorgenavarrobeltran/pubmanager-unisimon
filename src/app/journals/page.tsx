'use client';

import { useState } from 'react';
import Link from 'next/link';
import { BookOpen, Plus, Search, Trash2, BarChart3, LayoutGrid, TrendingUp } from 'lucide-react';
import JournalForm from '@/components/JournalForm';
import IndexationTimeline from '@/components/IndexationTimeline';
import MetricsTimeline from '@/components/MetricsTimeline';
import { JournalProvider, useJournals } from '@/contexts/JournalContext';
import { useJournalsBoard } from '@/hooks/journals/useJournalsBoard';

function JournalsPageContent() {
  const board = useJournalsBoard();
  const [filter, setFilter] = useState<'all' | 'cientifica' | 'academica'>('all');
  const [view, setView] = useState<'cards' | 'timeline' | 'metrics'>('cards');
  const [timelineTab, setTimelineTab] = useState<'publindex' | 'scopus'>('publindex');

  const filtered = board.filteredJournals.filter(j => {
    if (filter !== 'all' && j.type !== filter) return false;
    return true;
  });

  const scientificCount = board.journals.filter(j => j.type === 'cientifica').length;
  const academicCount = board.journals.filter(j => j.type === 'academica').length;
  const scopusCount = board.journals.filter(j => j.scopus_quartile).length;

  if (board.isListLoading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '60vh' }}>
        <p style={{ color: 'var(--gray-500)' }}>Cargando revistas...</p>
      </div>
    );
  }

  return (
    <>
      <div className="page-header">
        <div className="flex items-center justify-between">
          <div>
            <h2>Revistas</h2>
            <p>{scientificCount} científicas · {academicCount} académicas · {scopusCount} en Scopus</p>
          </div>
          <button className="btn btn-primary" onClick={board.handleOpenCreate}>
            <Plus size={18} /> Nueva Revista
          </button>
        </div>
      </div>

      <div className="page-content">
        {/* View Toggle + Filters */}
        <div className="flex items-center gap-3 mb-6" style={{ flexWrap: 'wrap' }}>
          <div className="flex gap-1" style={{ background: 'var(--gray-100)', borderRadius: 'var(--radius-md)', padding: '3px' }}>
            <button
              className={`btn btn-sm ${view === 'cards' ? 'btn-primary' : 'btn-ghost'}`}
              onClick={() => setView('cards')}
              style={view === 'cards' ? {} : { background: 'transparent' }}
            >
              <LayoutGrid size={14} /> Revistas
            </button>
            <button
              className={`btn btn-sm ${view === 'timeline' ? 'btn-primary' : 'btn-ghost'}`}
              onClick={() => setView('timeline')}
              style={view === 'timeline' ? {} : { background: 'transparent' }}
            >
              <BarChart3 size={14} /> Histórico
            </button>
            <button
              className={`btn btn-sm ${view === 'metrics' ? 'btn-primary' : 'btn-ghost'}`}
              onClick={() => setView('metrics')}
              style={view === 'metrics' ? {} : { background: 'transparent' }}
            >
              <TrendingUp size={14} /> Métricas
            </button>
          </div>
          {view === 'cards' && (
            <>
              <div className="search-bar">
                <Search size={18} className="search-icon" />
                <input
                  type="text"
                  placeholder="Buscar revistas..."
                  value={board.searchTerm}
                  onChange={e => board.setSearchTerm(e.target.value)}
                />
              </div>
              <div className="flex gap-2">
                {(['all', 'cientifica', 'academica'] as const).map(f => (
                  <button key={f} className={`btn btn-sm ${filter === f ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setFilter(f)}>
                    {f === 'all' ? `Todas (${board.journals.length})` : f === 'cientifica' ? `Científicas (${scientificCount})` : `Académicas (${academicCount})`}
                  </button>
                ))}
              </div>
            </>
          )}
          {view === 'timeline' && (
            <div className="flex gap-2">
              <button
                className={`btn btn-sm ${timelineTab === 'publindex' ? 'btn-primary' : 'btn-secondary'}`}
                onClick={() => setTimelineTab('publindex')}
                style={timelineTab === 'publindex' ? { background: '#E65100' } : {}}
              >
                📋 Publindex
              </button>
              <button
                className={`btn btn-sm ${timelineTab === 'scopus' ? 'btn-primary' : 'btn-secondary'}`}
                onClick={() => setTimelineTab('scopus')}
                style={timelineTab === 'scopus' ? { background: '#F57C00' } : {}}
              >
                🔬 Scopus
              </button>
            </div>
          )}
        </div>

        {/* Timeline View */}
        {view === 'timeline' && (
          <div className="card mb-6">
            <div className="card-header">
              <h3>
                {timelineTab === 'publindex' ? '📋 Histórico Publindex — Todas las Revistas' : '🔬 Histórico Scopus — Cuartiles por Subject Category'}
              </h3>
            </div>
            <div className="card-body" style={{ padding: '16px' }}>
              <IndexationTimeline indexer={timelineTab} />
            </div>
          </div>
        )}

        {/* Metrics View */}
        {view === 'metrics' && (
          <div className="card mb-6">
            <div className="card-header">
              <h3>📊 Evolución de Métricas — Todas las Revistas</h3>
            </div>
            <div className="card-body" style={{ padding: '16px' }}>
              <MetricsTimeline />
            </div>
          </div>
        )}

        {/* Journal cards grid */}
        {view === 'cards' && <div className="cards-grid">
          {filtered.map(j => (
            <div key={j.id} className="journal-card" style={{ position: 'relative' }}>
              <Link href={`/journals/${j.id}`} style={{ textDecoration: 'none', color: 'inherit' }}>
                <div className="flex items-center gap-3" style={{ marginBottom: '12px' }}>
                  <div style={{
                    width: '44px',
                    height: '44px',
                    borderRadius: 'var(--radius-md)',
                    background: j.type === 'cientifica'
                      ? 'linear-gradient(135deg, var(--primary-50), var(--primary-100))'
                      : 'linear-gradient(135deg, #FFF3E0, #FFE0B2)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0,
                  }}>
                    <BookOpen size={22} color={j.type === 'cientifica' ? 'var(--primary)' : '#E65100'} />
                  </div>
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <div className="journal-name">{j.name}</div>
                    <div className="journal-issn">
                      {j.issn_online ? `eISSN: ${j.issn_online}` : ''}
                      {j.issn_print ? ` · Print: ${j.issn_print}` : ''}
                    </div>
                  </div>
                </div>

                <div className="journal-area">{j.area || ''}</div>

                <div className="journal-badges">
                  <span className={`badge ${j.type === 'cientifica' ? 'badge-info' : 'badge-neutral'}`}>
                    {j.type === 'cientifica' ? 'Científica' : 'Académica'}
                  </span>
                  {j.scopus_quartile && (
                    <span className={`badge badge-${j.scopus_quartile.toLowerCase()}`}>
                      Scopus {j.scopus_quartile}
                    </span>
                  )}
                  {j.publindex_category && (
                    <span className={`badge badge-${j.publindex_category.toLowerCase()}`}>
                      Publindex {j.publindex_category}
                    </span>
                  )}
                  {j.h_index && (
                    <span className="badge badge-neutral">H-Index: {j.h_index}</span>
                  )}
                </div>
              </Link>

              {/* Delete button */}
              <button
                className="btn btn-ghost btn-icon"
                style={{ position: 'absolute', top: '12px', right: '12px', opacity: 0.3 }}
                onClick={(e) => { e.preventDefault(); e.stopPropagation(); board.handleDelete(j.id); }}
                title="Eliminar revista"
                onMouseEnter={e => (e.currentTarget.style.opacity = '1')}
                onMouseLeave={e => (e.currentTarget.style.opacity = '0.3')}
              >
                <Trash2 size={16} color="var(--error)" />
              </button>
            </div>
          ))}
        </div>}
      </div>

      {/* Create journal modal */}
      <JournalForm
        isOpen={board.isFormOpen}
        onClose={() => board.setIsFormOpen(false)}
        onSaved={board.loadJournals}
      />
    </>
  );
}

export default function JournalsPage() {
  return (
    <JournalProvider>
      <JournalsPageContent />
    </JournalProvider>
  );
}
