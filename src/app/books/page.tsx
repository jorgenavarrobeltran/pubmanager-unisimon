'use client';

import { useEffect, useState, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';
import Link from 'next/link';
import {
  Library, Plus, Search, Trash2, BarChart3, List,
  ChevronLeft, ChevronRight, Users,
} from 'lucide-react';
import { BOOK_STAGES, BOOK_STATUSES, BOOK_TYPES, EDITION_TYPES } from '@/lib/constants';
import BookForm from '@/components/BookForm';
import ConfirmDialog from '@/components/ConfirmDialog';
import dynamic from 'next/dynamic';

const BookStats = dynamic(() => import('@/components/BookStats'), { ssr: false });

interface Book {
  id: string;
  code: string | null;
  title: string;
  isbn_digital: string | null;
  isbn_print: string | null;
  current_stage: string;
  status: string;
  year_published: number | null;
  book_type: string | null;
  edition_type: string | null;
  editorial: string | null;
  format: string | null;
  tipo_minciencias: string | null;
  subtipo_minciencias: string | null;
  num_authors: number | null;
  num_chapters: number | null;
  faculty_name?: string;
}

const PAGE_SIZE = 30;

export default function BooksPage() {
  const [books, setBooks] = useState<Book[]>([]);
  const [chapters, setChapters] = useState<{ id: string; book_id: string }[]>([]);
  const [authorLinks, setAuthorLinks] = useState<{ book_id: string; person_id: string; role: string }[]>([]);
  const [people, setPeople] = useState<Map<string, string>>(new Map());
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [stageFilter, setStageFilter] = useState<string>('all');
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [showForm, setShowForm] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Book | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [activeTab, setActiveTab] = useState<'catalog' | 'stats'>('catalog');
  const [currentPage, setCurrentPage] = useState(1);

  const loadBooks = useCallback(async () => {
    const supabase = createClient();
    // Fetch books (under 1000 so default limit is fine)
    const booksRes = await supabase.from('books').select('*, faculties(name)')
      .order('year_published', { ascending: false, nullsFirst: false });

    // Fetch all chapters (may exceed 1000)
    const allChapters: { id: string; book_id: string }[] = [];
    let chOffset = 0;
    while (true) {
      const { data } = await supabase.from('book_chapters')
        .select('id, book_id').range(chOffset, chOffset + 999);
      if (!data || data.length === 0) break;
      allChapters.push(...data);
      if (data.length < 1000) break;
      chOffset += 1000;
    }

    // Fetch all author links (may exceed 1000)
    const allAuthors: { book_id: string; person_id: string; role: string }[] = [];
    let authOffset = 0;
    while (true) {
      const { data } = await supabase.from('book_authors')
        .select('book_id, person_id, role').range(authOffset, authOffset + 999);
      if (!data || data.length === 0) break;
      allAuthors.push(...data);
      if (data.length < 1000) break;
      authOffset += 1000;
    }

    // Fetch all people (names)
    const allPeople: { id: string; full_name: string }[] = [];
    let pplOffset = 0;
    while (true) {
      const { data } = await supabase.from('people')
        .select('id, full_name').range(pplOffset, pplOffset + 999);
      if (!data || data.length === 0) break;
      allPeople.push(...data);
      if (data.length < 1000) break;
      pplOffset += 1000;
    }
    const peopleMap = new Map(allPeople.map(p => [p.id, p.full_name]));

    setBooks((booksRes.data || []).map((b: any) => ({
      ...b,
      faculty_name: b.faculties?.name || null,
    })));
    setChapters(allChapters);
    setAuthorLinks(allAuthors);
    setPeople(peopleMap);
    setLoading(false);
  }, []);

  useEffect(() => { loadBooks(); }, [loadBooks]);

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    const supabase = createClient();
    const { data: chs } = await supabase.from('book_chapters').select('id').eq('book_id', deleteTarget.id);
    if (chs) {
      for (const ch of chs) {
        await supabase.from('chapter_authors').delete().eq('chapter_id', ch.id);
      }
    }
    await supabase.from('book_chapters').delete().eq('book_id', deleteTarget.id);
    await supabase.from('book_authors').delete().eq('book_id', deleteTarget.id);
    await supabase.from('books').delete().eq('id', deleteTarget.id);
    setDeleting(false); setDeleteTarget(null); loadBooks();
  };

  // Build a map of book_id → author names for search & display
  const bookAuthorsMap = new Map<string, string[]>();
  for (const link of authorLinks) {
    const name = people.get(link.person_id);
    if (name) {
      if (!bookAuthorsMap.has(link.book_id)) bookAuthorsMap.set(link.book_id, []);
      bookAuthorsMap.get(link.book_id)!.push(name);
    }
  }

  const filtered = books.filter(b => {
    const q = search.toLowerCase();
    if (search) {
      const titleMatch = b.title.toLowerCase().includes(q);
      const isbnMatch = b.isbn_digital?.toLowerCase().includes(q) || b.isbn_print?.toLowerCase().includes(q);
      const authorNames = bookAuthorsMap.get(b.id) || [];
      const authorMatch = authorNames.some(n => n.toLowerCase().includes(q));
      if (!titleMatch && !isbnMatch && !authorMatch) return false;
    }
    if (statusFilter !== 'all' && b.status !== statusFilter) return false;
    if (stageFilter !== 'all' && b.current_stage !== stageFilter) return false;
    if (typeFilter !== 'all' && b.book_type !== typeFilter) return false;
    return true;
  });

  // Reset page when filters change
  useEffect(() => { setCurrentPage(1); }, [search, statusFilter, stageFilter, typeFilter]);

  const totalPages = Math.ceil(filtered.length / PAGE_SIZE);
  const paginated = filtered.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

  const stageConfig = (key: string) => BOOK_STAGES.find(s => s.key === key);
  const statusConfig = (key: string) => BOOK_STATUSES.find(s => s.key === key);
  const typeLabel = (key: string) => BOOK_TYPES.find(t => t.key === key)?.label || key;

  // Pipeline stats
  const pipelineStats = BOOK_STAGES.map(stage => ({
    ...stage,
    count: books.filter(b => b.current_stage === stage.key && b.status === 'en_proceso').length,
  }));

  // Status stats
  const statusStats = BOOK_STATUSES.map(s => ({
    ...s,
    count: books.filter(b => b.status === s.key).length,
  }));

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '60vh' }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: '40px', marginBottom: '12px' }}>📖</div>
          <p style={{ color: 'var(--gray-500)' }}>Cargando libros...</p>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="page-header">
        <div className="flex items-center justify-between">
          <div>
            <h2>Libros y Capítulos</h2>
            <p>{books.length} libros · {books.filter(b => b.status === 'publicado').length} publicados · {books.filter(b => b.status === 'en_proceso').length} en proceso</p>
          </div>
          <div className="flex gap-2">
            <button className="btn btn-primary" onClick={() => setShowForm(true)}>
              <Plus size={18} /> Nuevo Libro
            </button>
          </div>
        </div>
      </div>

      {/* Tab bar */}
      <div style={{
        display: 'flex', gap: '0', borderBottom: '2px solid var(--gray-200)',
        margin: '0 24px', position: 'sticky', top: 0, zIndex: 10,
        background: 'var(--background)',
      }}>
        <button
          onClick={() => setActiveTab('catalog')}
          style={{
            padding: '12px 24px', fontSize: '13px', fontWeight: 600,
            color: activeTab === 'catalog' ? 'var(--primary)' : 'var(--gray-500)',
            borderBottom: activeTab === 'catalog' ? '2px solid var(--primary)' : '2px solid transparent',
            background: 'none', border: 'none', cursor: 'pointer',
            display: 'flex', alignItems: 'center', gap: '8px',
            marginBottom: '-2px', transition: 'all 0.2s',
          }}
        >
          <List size={16} /> Catálogo ({books.length})
        </button>
        <button
          onClick={() => setActiveTab('stats')}
          style={{
            padding: '12px 24px', fontSize: '13px', fontWeight: 600,
            color: activeTab === 'stats' ? 'var(--primary)' : 'var(--gray-500)',
            borderBottom: activeTab === 'stats' ? '2px solid var(--primary)' : '2px solid transparent',
            background: 'none', border: 'none', cursor: 'pointer',
            display: 'flex', alignItems: 'center', gap: '8px',
            marginBottom: '-2px', transition: 'all 0.2s',
          }}
        >
          <BarChart3 size={16} /> Estadísticas
        </button>
      </div>

      <div className="page-content">
        {activeTab === 'stats' ? (
          <BookStats books={books} chapters={chapters} authorLinks={authorLinks} />
        ) : (
          <>
            {/* Pipeline overview */}
            <div className="card mb-6">
              <div className="card-header">
                <h3>📊 Pipeline de Publicación</h3>
                <div className="flex gap-2">
                  {statusStats.filter(s => s.count > 0).map(s => (
                    <span key={s.key} className="badge" style={{ background: `${s.color}15`, color: s.color }}>
                      {s.label}: {s.count}
                    </span>
                  ))}
                </div>
              </div>
              <div className="card-body">
                <div className="pipeline-bar" style={{ height: '56px' }}>
                  {pipelineStats.map(stage => (
                    <div
                      key={stage.key}
                      className={`pipeline-step ${stage.count > 0 ? 'active' : 'pending'}`}
                      style={{
                        background: stage.count > 0 ? 'var(--primary)' : undefined,
                        cursor: 'pointer',
                        flexDirection: 'column',
                        gap: '2px',
                      }}
                      onClick={() => setStageFilter(stageFilter === stage.key ? 'all' : stage.key)}
                      title={`${stage.label}: ${stage.count} libros`}
                    >
                      <span style={{ fontSize: '16px' }}>{stage.icon}</span>
                      {stage.count > 0 && <span style={{ fontSize: '13px', fontWeight: 700 }}>{stage.count}</span>}
                    </div>
                  ))}
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '8px' }}>
                  {BOOK_STAGES.map(stage => (
                    <span key={stage.key} style={{
                      fontSize: '9px', color: stageFilter === stage.key ? 'var(--primary)' : 'var(--gray-400)',
                      fontWeight: stageFilter === stage.key ? 700 : 400,
                      textAlign: 'center', flex: 1,
                    }}>
                      {stage.label.split(' ').slice(0, 2).join(' ')}
                    </span>
                  ))}
                </div>
              </div>
            </div>

            {/* Filters */}
            <div className="flex items-center gap-3 mb-6" style={{ flexWrap: 'wrap' }}>
              <div className="search-bar" style={{ flex: 1, maxWidth: '400px' }}>
                <Search size={18} className="search-icon" />
                <input type="text" placeholder="Buscar por título, ISBN o autor..." value={search} onChange={e => setSearch(e.target.value)} />
              </div>
              <div className="flex gap-2" style={{ flexWrap: 'wrap' }}>
                {['all', ...BOOK_STATUSES.map(s => s.key)].map(s => {
                  const count = s === 'all' ? books.length : books.filter(b => b.status === s).length;
                  if (s !== 'all' && count === 0) return null;
                  const label = s === 'all' ? `Todos (${count})` : `${statusConfig(s)?.label} (${count})`;
                  return (
                    <button key={s} className={`btn btn-sm ${statusFilter === s ? 'btn-primary' : 'btn-secondary'}`}
                      onClick={() => setStatusFilter(s)}
                      style={s !== 'all' && statusFilter === s ? { background: statusConfig(s)?.color } : {}}
                    >
                      {label}
                    </button>
                  );
                })}
              </div>
              <select
                value={typeFilter}
                onChange={e => setTypeFilter(e.target.value)}
                style={{
                  padding: '6px 12px', borderRadius: '6px', border: '1px solid var(--gray-300)',
                  fontSize: '12px', color: 'var(--gray-700)', background: 'var(--card-bg)',
                  cursor: 'pointer',
                }}
              >
                <option value="all">Todos los tipos</option>
                {BOOK_TYPES.map(t => (
                  <option key={t.key} value={t.key}>{t.label}</option>
                ))}
              </select>
              {stageFilter !== 'all' && (
                <button className="btn btn-sm btn-ghost" onClick={() => setStageFilter('all')} style={{ color: 'var(--primary)' }}>
                  ✕ Limpiar filtro de etapa
                </button>
              )}
            </div>

            {/* Books table */}
            <div className="card">
              <div className="card-body" style={{ padding: 0 }}>
                {filtered.length === 0 ? (
                  <div className="empty-state">
                    <div className="empty-icon">📖</div>
                    <h3>{books.length === 0 ? 'Sin libros registrados' : 'Sin resultados'}</h3>
                    <p>{books.length === 0 ? 'Agrega tu primer libro o migra los datos del Excel.' : 'Intenta con otra búsqueda o filtro.'}</p>
                    {books.length === 0 && (
                      <button className="btn btn-primary" onClick={() => setShowForm(true)}>
                        <Plus size={16} /> Agregar Libro
                      </button>
                    )}
                  </div>
                ) : (
                  <>
                    <table className="data-table">
                      <thead>
                        <tr>
                          <th>Título</th>
                          <th>Tipo</th>
                          <th>ISBN</th>
                          <th>Etapa</th>
                          <th>Estado</th>
                          <th>Año</th>
                          <th>Autores</th>
                          <th>Caps.</th>
                          <th></th>
                        </tr>
                      </thead>
                      <tbody>
                        {paginated.map(b => {
                          const stage = stageConfig(b.current_stage);
                          const st = statusConfig(b.status);
                          return (
                            <tr key={b.id}>
                              <td style={{ maxWidth: '320px' }}>
                                <Link href={`/books/${b.id}`} style={{ color: 'var(--gray-900)', fontWeight: 600, textDecoration: 'none' }}>
                                  <span className="truncate" style={{ display: 'block' }}>{b.title}</span>
                                </Link>
                                {(() => {
                                  const authors = bookAuthorsMap.get(b.id) || [];
                                  if (authors.length === 0) return b.faculty_name ? <span style={{ fontSize: '11px', color: 'var(--gray-400)' }}>{b.faculty_name}</span> : null;
                                  const display = authors.length <= 2 ? authors.join(', ') : `${authors[0]}, ${authors[1]} +${authors.length - 2}`;
                                  return <span style={{ fontSize: '11px', color: 'var(--gray-400)', display: 'block' }} title={authors.join('\n')}><Users size={10} style={{ verticalAlign: '-1px', marginRight: '3px' }} />{display}</span>;
                                })()}
                              </td>
                              <td>
                                <span className="badge badge-neutral" style={{ fontSize: '11px' }}>
                                  {typeLabel(b.book_type || '')}
                                </span>
                              </td>
                              <td style={{ fontFamily: 'monospace', fontSize: '11px', color: 'var(--gray-500)' }}>
                                {b.isbn_digital || b.isbn_print || '—'}
                              </td>
                              <td>
                                {stage && (
                                  <span className="badge badge-neutral" style={{ fontSize: '11px' }}>
                                    {stage.icon} {stage.label.split(' ').slice(0, 2).join(' ')}
                                  </span>
                                )}
                              </td>
                              <td>
                                <span className="badge" style={{ background: `${st?.color}15`, color: st?.color, fontSize: '11px' }}>
                                  {st?.label || b.status}
                                </span>
                              </td>
                              <td style={{ color: 'var(--gray-600)' }}>{b.year_published || '—'}</td>
                              <td style={{ textAlign: 'center', color: 'var(--gray-600)' }}>
                                <span title={(bookAuthorsMap.get(b.id) || []).join('\n')}>{bookAuthorsMap.get(b.id)?.length || b.num_authors || 0}</span>
                              </td>
                              <td style={{ textAlign: 'center', color: 'var(--gray-600)' }}>{b.num_chapters || 0}</td>
                              <td>
                                <button className="btn btn-ghost btn-icon" onClick={() => setDeleteTarget(b)} title="Eliminar">
                                  <Trash2 size={14} color="var(--error)" />
                                </button>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>

                    {/* Pagination */}
                    {totalPages > 1 && (
                      <div style={{
                        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                        padding: '12px 20px', borderTop: '1px solid var(--gray-200)',
                        fontSize: '12px', color: 'var(--gray-500)',
                      }}>
                        <span>
                          Mostrando {(currentPage - 1) * PAGE_SIZE + 1}–{Math.min(currentPage * PAGE_SIZE, filtered.length)} de {filtered.length} libros
                        </span>
                        <div className="flex gap-1 items-center">
                          <button
                            className="btn btn-ghost btn-icon"
                            onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                            disabled={currentPage === 1}
                            style={{ opacity: currentPage === 1 ? 0.3 : 1 }}
                          >
                            <ChevronLeft size={16} />
                          </button>
                          {Array.from({ length: Math.min(totalPages, 7) }, (_, i) => {
                            let page: number;
                            if (totalPages <= 7) {
                              page = i + 1;
                            } else if (currentPage <= 4) {
                              page = i + 1;
                            } else if (currentPage >= totalPages - 3) {
                              page = totalPages - 6 + i;
                            } else {
                              page = currentPage - 3 + i;
                            }
                            return (
                              <button
                                key={page}
                                className={`btn btn-sm ${currentPage === page ? 'btn-primary' : 'btn-ghost'}`}
                                onClick={() => setCurrentPage(page)}
                                style={{ minWidth: '32px', padding: '4px 8px', fontSize: '12px' }}
                              >
                                {page}
                              </button>
                            );
                          })}
                          <button
                            className="btn btn-ghost btn-icon"
                            onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                            disabled={currentPage === totalPages}
                            style={{ opacity: currentPage === totalPages ? 0.3 : 1 }}
                          >
                            <ChevronRight size={16} />
                          </button>
                        </div>
                      </div>
                    )}
                  </>
                )}
              </div>
            </div>
          </>
        )}
      </div>

      <BookForm isOpen={showForm} onClose={() => setShowForm(false)} onSaved={loadBooks} />

      <ConfirmDialog
        isOpen={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
        loading={deleting}
        title="Eliminar Libro"
        message={`¿Eliminar "${deleteTarget?.title}"? Se eliminarán también todos sus capítulos y asignaciones de autores.`}
      />
    </>
  );
}
