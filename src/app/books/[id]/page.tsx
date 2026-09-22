'use client';

import { useEffect, useState, useCallback } from 'react';
import { useParams } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import Link from 'next/link';
import { ArrowLeft, Plus, Pencil, Trash2, UserPlus, ChevronRight, GripVertical, ExternalLink } from 'lucide-react';
import { BOOK_STAGES, BOOK_STATUSES, BOOK_TYPES, EDITION_TYPES } from '@/lib/constants';
import BookForm from '@/components/BookForm';
import ChapterForm from '@/components/ChapterForm';
import AuthorAssigner from '@/components/AuthorAssigner';
import ConfirmDialog from '@/components/ConfirmDialog';

interface BookDetail {
  id: string; title: string; subtitle: string | null; book_type: string | null;
  edition_type: string | null; faculty_id: string | null; isbn_digital: string | null;
  isbn_print: string | null; doi: string | null; issn: string | null;
  repository_url: string | null;
  editorial: string | null; current_stage: string; status: string;
  year_published: number | null; page_count: number | null; print_run: number | null;
  format: string | null; project_name: string | null; research_group_code: string | null;
  notes: string | null; num_authors: number | null; num_chapters: number | null;
  deposit_number: string | null; estimated_cost: number | null; final_cost: number | null;
}

interface Chapter {
  id: string; title: string; chapter_number: number | null; isbn_digital: string | null;
  isbn_print: string | null; doi: string | null; start_page: number | null;
  end_page: number | null; year: number | null;
}

interface Author {
  id: string; person_id: string; role: string | null; author_order: number | null;
  full_name: string; cedula: string | null; institution: string | null; email: string | null;
}

export default function BookDetailPage() {
  const params = useParams();
  const bookId = params.id as string;
  const [book, setBook] = useState<BookDetail | null>(null);
  const [chapters, setChapters] = useState<Chapter[]>([]);
  const [authors, setAuthors] = useState<Author[]>([]);
  const [loading, setLoading] = useState(true);

  const [showEditBook, setShowEditBook] = useState(false);
  const [showAddChapter, setShowAddChapter] = useState(false);
  const [editChapter, setEditChapter] = useState<Chapter | null>(null);
  const [showAddAuthor, setShowAddAuthor] = useState(false);
  const [authorTarget, setAuthorTarget] = useState<{ type: 'book' | 'chapter'; id: string } | null>(null);
  const [deleteChapter, setDeleteChapter] = useState<Chapter | null>(null);
  const [deleteAuthor, setDeleteAuthor] = useState<Author | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [expandedChapter, setExpandedChapter] = useState<string | null>(null);
  const [chapterAuthors, setChapterAuthors] = useState<Record<string, Author[]>>({});
  const [dragIdx, setDragIdx] = useState<number | null>(null);
  const [dragOverIdx, setDragOverIdx] = useState<number | null>(null);

  const loadData = useCallback(async () => {
    const supabase = createClient();
    const [bRes, cRes, aRes] = await Promise.all([
      supabase.from('books').select('*').eq('id', bookId).single(),
      supabase.from('book_chapters').select('*').eq('book_id', bookId).order('chapter_number', { ascending: true }),
      supabase.from('book_authors').select('*, people(full_name, cedula, institution, email)').eq('book_id', bookId).order('author_order', { ascending: true }),
    ]);

    setBook(bRes.data);
    setChapters(cRes.data || []);
    setAuthors((aRes.data || []).map((a: any) => ({
      ...a,
      full_name: a.people?.full_name || '?',
      cedula: a.people?.cedula,
      institution: a.people?.institution,
      email: a.people?.email,
    })));
    setLoading(false);
  }, [bookId]);

  useEffect(() => { loadData(); }, [loadData]);

  const loadChapterAuthors = async (chapterId: string) => {
    if (chapterAuthors[chapterId]) return;
    const supabase = createClient();
    const { data } = await supabase.from('chapter_authors')
      .select('*, people(full_name, cedula, institution, email)')
      .eq('chapter_id', chapterId)
      .order('author_order', { ascending: true });

    setChapterAuthors(prev => ({
      ...prev,
      [chapterId]: (data || []).map((a: any) => ({
        ...a, full_name: a.people?.full_name || '?', cedula: a.people?.cedula,
        institution: a.people?.institution, email: a.people?.email,
      })),
    }));
  };

  const handleDeleteChapter = async () => {
    if (!deleteChapter) return;
    setDeleting(true);
    const supabase = createClient();
    await supabase.from('chapter_authors').delete().eq('chapter_id', deleteChapter.id);
    await supabase.from('book_chapters').delete().eq('id', deleteChapter.id);
    const { count } = await supabase.from('book_chapters').select('id', { count: 'exact', head: true }).eq('book_id', bookId);
    await supabase.from('books').update({ num_chapters: count }).eq('id', bookId);
    setDeleting(false); setDeleteChapter(null); loadData();
  };

  const saveChapterOrder = async (reordered: Chapter[]) => {
    const supabase = createClient();
    // Update all chapter_numbers in parallel
    await Promise.all(
      reordered.map((ch, i) =>
        supabase.from('book_chapters').update({ chapter_number: i + 1 }).eq('id', ch.id)
      )
    );
    loadData();
  };

  const handleDragStart = (idx: number) => {
    setDragIdx(idx);
  };

  const handleDragOver = (e: React.DragEvent, idx: number) => {
    e.preventDefault();
    setDragOverIdx(idx);
  };

  const handleDrop = (dropIdx: number) => {
    if (dragIdx === null || dragIdx === dropIdx) {
      setDragIdx(null);
      setDragOverIdx(null);
      return;
    }
    const reordered = [...chapters];
    const [moved] = reordered.splice(dragIdx, 1);
    reordered.splice(dropIdx, 0, moved);
    // Optimistic update
    setChapters(reordered);
    setDragIdx(null);
    setDragOverIdx(null);
    saveChapterOrder(reordered);
  };

  const handleDragEnd = () => {
    setDragIdx(null);
    setDragOverIdx(null);
  };

  const handleDeleteAuthor = async () => {
    if (!deleteAuthor) return;
    setDeleting(true);
    const supabase = createClient();
    await supabase.from('book_authors').delete().eq('id', deleteAuthor.id);
    const { count } = await supabase.from('book_authors').select('id', { count: 'exact', head: true }).eq('book_id', bookId);
    await supabase.from('books').update({ num_authors: count }).eq('id', bookId);
    setDeleting(false); setDeleteAuthor(null); loadData();
  };

  const advanceStage = async (newStage: string) => {
    const supabase = createClient();
    await supabase.from('books').update({ current_stage: newStage }).eq('id', bookId);
    loadData();
  };

  if (loading || !book) {
    return <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '60vh' }}><p style={{ color: 'var(--gray-500)' }}>Cargando libro...</p></div>;
  }

  const stage = BOOK_STAGES.find(s => s.key === book.current_stage);
  const stageIdx = BOOK_STAGES.findIndex(s => s.key === book.current_stage);
  const st = BOOK_STATUSES.find(s => s.key === book.status);
  const typeLabel = BOOK_TYPES.find(t => t.key === book.book_type)?.label || book.book_type;
  const edLabel = EDITION_TYPES.find(t => t.key === book.edition_type)?.label || book.edition_type;

  const formatCOP = (a: number) => new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(a);

  return (
    <>
      <div className="page-header">
        <Link href="/books" className="flex items-center gap-2" style={{ fontSize: '13px', color: 'var(--gray-500)', textDecoration: 'none', marginBottom: '12px' }}>
          <ArrowLeft size={16} /> Volver a Libros
        </Link>
        <div className="flex items-center justify-between">
          <div>
            <div className="flex items-center gap-3">
              <h2 style={{ maxWidth: '600px' }}>{book.title}</h2>
              <span className="badge" style={{ background: `${st?.color}15`, color: st?.color }}>{st?.label}</span>
            </div>
            {book.subtitle && <p style={{ color: 'var(--gray-600)', fontStyle: 'italic' }}>{book.subtitle}</p>}
            <p style={{ fontFamily: 'monospace', fontSize: '12px', color: 'var(--gray-400)', marginTop: '4px' }}>
              {book.isbn_digital ? `ISBN Digital: ${book.isbn_digital}` : ''}
              {book.isbn_print ? ` · ISBN Impreso: ${book.isbn_print}` : ''}
              {book.doi ? ` · DOI: ${book.doi}` : ''}
            </p>
            {book.repository_url && (
              <a
                href={book.repository_url}
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  display: 'inline-flex', alignItems: 'center', gap: '6px',
                  marginTop: '8px', padding: '6px 14px', borderRadius: '6px',
                  background: 'linear-gradient(135deg, #1565C0, #0D47A1)',
                  color: '#fff', fontSize: '12px', fontWeight: 600,
                  textDecoration: 'none', transition: 'all 0.2s',
                }}
                onMouseEnter={e => (e.currentTarget.style.transform = 'translateY(-1px)')}
                onMouseLeave={e => (e.currentTarget.style.transform = 'none')}
              >
                <ExternalLink size={13} />
                {book.repository_url.includes('bonga') ? 'Ver en Bonga (Repositorio)' :
                 book.repository_url.includes('doi.org') ? 'Ver DOI' : 'Ver publicación'}
              </a>
            )}
          </div>
          <button className="btn btn-secondary btn-sm" onClick={() => setShowEditBook(true)}>
            <Pencil size={14} /> Editar
          </button>
        </div>
      </div>

      <div className="page-content">
        {/* Pipeline Progress */}
        <div className="card mb-6">
          <div className="card-header">
            <h3>🔄 Progreso del Libro</h3>
            {stage && <span className="badge badge-info">{stage.icon} {stage.label}</span>}
          </div>
          <div className="card-body">
            <div style={{ display: 'flex', gap: '4px', marginBottom: '12px' }}>
              {BOOK_STAGES.map((s, i) => {
                const isCompleted = i < stageIdx;
                const isActive = i === stageIdx;
                const isPending = i > stageIdx;
                return (
                  <div key={s.key} style={{
                    flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px',
                    cursor: 'pointer',
                  }} onClick={() => advanceStage(s.key)} title={`Mover a: ${s.label}`}>
                    <div style={{
                      width: '100%', height: '8px', borderRadius: '4px',
                      background: isCompleted ? 'var(--primary)' : isActive ? 'var(--accent)' : 'var(--gray-200)',
                      transition: 'all 0.3s',
                    }} />
                    <span style={{
                      fontSize: '18px',
                      filter: isPending ? 'grayscale(1) opacity(0.3)' : 'none',
                    }}>
                      {s.icon}
                    </span>
                    <span style={{
                      fontSize: '9px', textAlign: 'center',
                      color: isActive ? 'var(--primary)' : isCompleted ? 'var(--gray-600)' : 'var(--gray-400)',
                      fontWeight: isActive ? 700 : 400,
                    }}>
                      {s.label.split(' ').slice(0, 2).join(' ')}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Info cards */}
        <div className="stats-grid mb-6">
          <div className="stat-card">
            <div className="stat-info">
              <h4>Tipo</h4>
              <div className="stat-value" style={{ fontSize: '14px' }}>📚 {typeLabel}</div>
              <div className="stat-subtitle">{edLabel}</div>
            </div>
          </div>
          <div className="stat-card">
            <div className="stat-info">
              <h4>Editorial</h4>
              <div className="stat-value" style={{ fontSize: '13px' }}>{book.editorial || '—'}</div>
            </div>
          </div>
          <div className="stat-card">
            <div className="stat-info">
              <h4>Autores</h4>
              <div className="stat-value">{book.num_authors || 0}</div>
            </div>
          </div>
          <div className="stat-card">
            <div className="stat-info">
              <h4>Capítulos</h4>
              <div className="stat-value">{book.num_chapters || 0}</div>
              <div className="stat-subtitle">{book.page_count ? `${book.page_count} pág.` : ''}</div>
            </div>
          </div>
        </div>

        {book.project_name && (
          <div style={{ background: 'var(--gray-50)', borderRadius: 'var(--radius-md)', padding: '12px 16px', fontSize: '13px', color: 'var(--gray-600)', marginBottom: '24px', borderLeft: '4px solid var(--primary)' }}>
            <strong>Proyecto:</strong> {book.project_name}
            {book.research_group_code && <span> · <strong>Grupo:</strong> {book.research_group_code}</span>}
          </div>
        )}

        {/* Authors */}
        <div className="card mb-6">
          <div className="card-header">
            <h3>👥 Autores del Libro</h3>
            <button className="btn btn-primary btn-sm" onClick={() => setAuthorTarget({ type: 'book', id: bookId })}>
              <UserPlus size={14} /> Agregar Autor
            </button>
          </div>
          <div className="card-body" style={{ padding: authors.length === 0 ? undefined : 0 }}>
            {authors.length === 0 ? (
              <div className="empty-state">
                <div className="empty-icon">👤</div>
                <h3>Sin autores asignados</h3>
                <p>Busca personas por nombre o cédula, o crea un nuevo registro.</p>
                <button className="btn btn-primary btn-sm" onClick={() => setAuthorTarget({ type: 'book', id: bookId })}>
                  <UserPlus size={14} /> Agregar
                </button>
              </div>
            ) : (
              <table className="data-table">
                <thead><tr><th>Nombre</th><th>Cédula</th><th>Rol</th><th>Institución</th><th></th></tr></thead>
                <tbody>
                  {authors.map(a => (
                    <tr key={a.id}>
                      <td style={{ fontWeight: 600 }}>{a.full_name}</td>
                      <td style={{ fontFamily: 'monospace', fontSize: '12px', color: 'var(--gray-500)' }}>{a.cedula || '—'}</td>
                      <td><span className="badge badge-neutral">{a.role || 'autor'}</span></td>
                      <td style={{ fontSize: '13px', color: 'var(--gray-500)' }}>{a.institution || '—'}</td>
                      <td>
                        <button className="btn btn-ghost btn-icon" onClick={() => setDeleteAuthor(a)}>
                          <Trash2 size={14} color="var(--error)" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>

        {/* Chapters */}
        <div className="card mb-6">
          <div className="card-header">
            <h3>📑 Capítulos</h3>
            <button className="btn btn-primary btn-sm" onClick={() => setShowAddChapter(true)}>
              <Plus size={14} /> Agregar Capítulo
            </button>
          </div>
          <div className="card-body" style={{ padding: chapters.length === 0 ? undefined : 0 }}>
            {chapters.length === 0 ? (
              <div className="empty-state">
                <div className="empty-icon">📄</div>
                <h3>Sin capítulos</h3>
                <p>Agrega capítulos para libros compilatorios o de memorias.</p>
                <button className="btn btn-primary btn-sm" onClick={() => setShowAddChapter(true)}>
                  <Plus size={14} /> Agregar Capítulo
                </button>
              </div>
            ) : (
              <div>
                {chapters.map((ch, idx) => (
                  <div
                    key={ch.id}
                    draggable
                    onDragStart={() => handleDragStart(idx)}
                    onDragOver={(e) => handleDragOver(e, idx)}
                    onDrop={() => handleDrop(idx)}
                    onDragEnd={handleDragEnd}
                    style={{
                      opacity: dragIdx === idx ? 0.4 : 1,
                      borderTop: dragOverIdx === idx && dragIdx !== null && dragIdx !== idx ? '3px solid var(--primary)' : 'none',
                      transition: 'opacity 0.15s',
                    }}
                  >
                    <div
                      style={{
                        display: 'flex', alignItems: 'center', gap: '12px', padding: '14px 16px',
                        borderBottom: '1px solid var(--gray-100)', cursor: 'pointer',
                        background: expandedChapter === ch.id ? 'var(--gray-50)' : 'white',
                        transition: 'background 0.15s',
                      }}
                      onClick={() => {
                        const newId = expandedChapter === ch.id ? null : ch.id;
                        setExpandedChapter(newId);
                        if (newId) loadChapterAuthors(newId);
                      }}
                    >
                      {/* Drag handle */}
                      <div
                        style={{
                          cursor: 'grab', color: 'var(--gray-300)', display: 'flex',
                          alignItems: 'center', padding: '4px 0',
                        }}
                        title="Arrastra para reordenar"
                        onMouseDown={e => e.stopPropagation()}
                      >
                        <GripVertical size={16} />
                      </div>
                      <ChevronRight size={16} style={{
                        color: 'var(--gray-400)',
                        transform: expandedChapter === ch.id ? 'rotate(90deg)' : 'none',
                        transition: 'transform 0.2s',
                      }} />
                      <span style={{ color: 'var(--gray-400)', fontSize: '13px', fontWeight: 600, minWidth: '40px' }}>
                        {idx + 1 !== (ch.chapter_number ?? idx + 1) ? `Cap. ${idx + 1}` : `Cap. ${ch.chapter_number ?? idx + 1}`}
                      </span>
                      <span style={{ fontWeight: 600, flex: 1 }}>{ch.title}</span>
                      {ch.isbn_digital && <span style={{ fontSize: '11px', fontFamily: 'monospace', color: 'var(--gray-400)' }}>{ch.isbn_digital}</span>}
                      {ch.start_page && ch.end_page && (
                        <span style={{ fontSize: '11px', color: 'var(--gray-400)' }}>pp. {ch.start_page}-{ch.end_page}</span>
                      )}
                      <button className="btn btn-ghost btn-icon" onClick={(e) => { e.stopPropagation(); setEditChapter(ch); }} title="Editar capítulo">
                        <Pencil size={14} color="var(--gray-500)" />
                      </button>
                      <button className="btn btn-ghost btn-icon" onClick={(e) => { e.stopPropagation(); setDeleteChapter(ch); }} title="Eliminar capítulo">
                        <Trash2 size={14} color="var(--error)" />
                      </button>
                    </div>

                    {/* Expanded chapter authors */}
                    {expandedChapter === ch.id && (
                      <div style={{ padding: '12px 16px 12px 52px', background: 'var(--gray-50)', borderBottom: '1px solid var(--gray-100)' }}>
                        <div className="flex items-center justify-between mb-4">
                          <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--gray-500)' }}>Autores del capítulo</span>
                          <button className="btn btn-ghost btn-sm" onClick={() => setAuthorTarget({ type: 'chapter', id: ch.id })}>
                            <UserPlus size={12} /> Agregar
                          </button>
                        </div>
                        {(!chapterAuthors[ch.id] || chapterAuthors[ch.id].length === 0) ? (
                          <p style={{ fontSize: '12px', color: 'var(--gray-400)' }}>Sin autores asignados a este capítulo</p>
                        ) : (
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                            {chapterAuthors[ch.id].map(a => (
                              <div key={a.id} style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px' }}>
                                <span style={{ fontWeight: 500 }}>{a.full_name}</span>
                                {a.cedula && <span style={{ fontSize: '11px', color: 'var(--gray-400)', fontFamily: 'monospace' }}>CC: {a.cedula}</span>}
                                <span className="badge badge-neutral" style={{ fontSize: '10px' }}>{a.role || 'autor'}</span>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Notes */}
        {book.notes && (
          <div className="card">
            <div className="card-header"><h3>📝 Notas</h3></div>
            <div className="card-body">
              <p style={{ fontSize: '14px', color: 'var(--gray-600)', whiteSpace: 'pre-wrap' }}>{book.notes}</p>
            </div>
          </div>
        )}
      </div>

      {/* Modals */}
      <BookForm isOpen={showEditBook} onClose={() => setShowEditBook(false)} onSaved={loadData} book={book} />
      <ChapterForm isOpen={showAddChapter || !!editChapter} onClose={() => { setShowAddChapter(false); setEditChapter(null); }} onSaved={loadData} bookId={bookId} chapter={editChapter} />

      {authorTarget && (
        <AuthorAssigner
          isOpen={true}
          onClose={() => setAuthorTarget(null)}
          onSaved={() => { loadData(); if (authorTarget.type === 'chapter') loadChapterAuthors(authorTarget.id); }}
          targetType={authorTarget.type}
          targetId={authorTarget.id}
          bookId={bookId}
          bookAuthors={authors.map(a => ({
            person_id: a.person_id,
            full_name: a.full_name,
            cedula: a.cedula,
            role: a.role,
            institution: a.institution,
          }))}
        />
      )}

      <ConfirmDialog isOpen={!!deleteChapter} onClose={() => setDeleteChapter(null)} onConfirm={handleDeleteChapter} loading={deleting}
        title="Eliminar Capítulo" message={`¿Eliminar el capítulo "${deleteChapter?.title}"?`} />

      <ConfirmDialog isOpen={!!deleteAuthor} onClose={() => setDeleteAuthor(null)} onConfirm={handleDeleteAuthor} loading={deleting}
        title="Desasignar Autor" message={`¿Desasignar a "${deleteAuthor?.full_name}" de este libro?`} />
    </>
  );
}
