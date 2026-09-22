'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import Modal from '@/components/Modal';
import { Search, UserPlus, Check, Users } from 'lucide-react';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onSaved: () => void;
  targetType: 'book' | 'chapter';
  targetId: string;
  /** When targetType is 'chapter', pass the bookId to pre-load book authors */
  bookId?: string;
  /** Pre-loaded book authors for quick chapter assignment */
  bookAuthors?: BookAuthor[];
}

interface Person {
  id: string;
  full_name: string;
  cedula: string | null;
  institution: string | null;
  email: string | null;
}

export interface BookAuthor {
  person_id: string;
  full_name: string;
  cedula: string | null;
  role: string | null;
  institution: string | null;
}

export default function AuthorAssigner({ isOpen, onClose, onSaved, targetType, targetId, bookId, bookAuthors }: Props) {
  const [search, setSearch] = useState('');
  const [results, setResults] = useState<Person[]>([]);
  const [searching, setSearching] = useState(false);
  const [role, setRole] = useState('autor');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [mode, setMode] = useState<'book_authors' | 'search'>('book_authors');

  // For chapter: track which book authors are selected
  const [selectedBookAuthors, setSelectedBookAuthors] = useState<Set<string>>(new Set());
  const [existingChapterAuthorIds, setExistingChapterAuthorIds] = useState<Set<string>>(new Set());

  // New person form
  const [showNewPerson, setShowNewPerson] = useState(false);
  const [newName, setNewName] = useState('');
  const [newCedula, setNewCedula] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [newInstitution, setNewInstitution] = useState('Universidad Simón Bolívar');

  // When opening for chapter, load existing chapter authors to disable already-assigned ones
  useEffect(() => {
    if (isOpen && targetType === 'chapter') {
      setMode('book_authors');
      loadExistingChapterAuthors();
    } else {
      setMode('search');
    }
    setSelectedBookAuthors(new Set());
    setError('');
  }, [isOpen, targetType, targetId]);

  const loadExistingChapterAuthors = async () => {
    const supabase = createClient();
    const { data } = await supabase
      .from('chapter_authors')
      .select('person_id')
      .eq('chapter_id', targetId);
    setExistingChapterAuthorIds(new Set((data || []).map((a: any) => a.person_id)));
  };

  // Search for people (used in both modes)
  useEffect(() => {
    if (mode !== 'search') return;
    if (search.length >= 2) {
      const timer = setTimeout(async () => {
        setSearching(true);
        const supabase = createClient();
        const { data } = await supabase
          .from('people')
          .select('id, full_name, cedula, institution, email')
          .or(`full_name.ilike.%${search}%,cedula.ilike.%${search}%`)
          .limit(10);
        setResults(data || []);
        setSearching(false);
      }, 300);
      return () => clearTimeout(timer);
    } else {
      setResults([]);
    }
  }, [search, mode]);

  const toggleBookAuthor = (personId: string) => {
    setSelectedBookAuthors(prev => {
      const next = new Set(prev);
      if (next.has(personId)) next.delete(personId);
      else next.add(personId);
      return next;
    });
  };

  const assignSelectedBookAuthors = async () => {
    if (selectedBookAuthors.size === 0) return;
    setSaving(true);
    setError('');
    const supabase = createClient();

    for (const personId of selectedBookAuthors) {
      const bookAuthor = bookAuthors?.find(a => a.person_id === personId);
      const { error: err } = await supabase.from('chapter_authors').insert({
        chapter_id: targetId,
        person_id: personId,
        role: bookAuthor?.role || role,
      });
      if (err && !err.message.includes('duplicate') && !err.message.includes('unique')) {
        setError(err.message);
        setSaving(false);
        return;
      }
    }

    setSaving(false);
    setSelectedBookAuthors(new Set());
    onSaved();
    onClose();
  };

  const assignPerson = async (personId: string) => {
    setSaving(true); setError('');
    const supabase = createClient();
    const table = targetType === 'book' ? 'book_authors' : 'chapter_authors';
    const idField = targetType === 'book' ? 'book_id' : 'chapter_id';

    const { error: err } = await supabase.from(table).insert({
      [idField]: targetId,
      person_id: personId,
      role,
    });

    if (err) {
      if (err.message.includes('duplicate') || err.message.includes('unique')) {
        setError('Esta persona ya está asignada');
      } else {
        setError(err.message);
      }
      setSaving(false); return;
    }

    // Update author count on book
    if (targetType === 'book') {
      const { count } = await supabase.from('book_authors').select('id', { count: 'exact', head: true }).eq('book_id', targetId);
      await supabase.from('books').update({ num_authors: count }).eq('id', targetId);
    }

    setSaving(false); setSearch(''); setResults([]);
    onSaved(); onClose();
  };

  const createAndAssign = async () => {
    if (!newName.trim()) { setError('El nombre es obligatorio'); return; }
    setSaving(true); setError('');
    const supabase = createClient();

    // Check if cedula exists
    if (newCedula) {
      const { data: existing } = await supabase.from('people').select('id, full_name').eq('cedula', newCedula).maybeSingle();
      if (existing) {
        setError(`Ya existe "${existing.full_name}" con la cédula ${newCedula}. Búscala en la lista.`);
        setSaving(false); return;
      }
    }

    const { data: newPerson, error: err } = await supabase.from('people').insert({
      full_name: newName.trim(),
      cedula: newCedula || null,
      email: newEmail || null,
      institution: newInstitution || null,
    }).select('id').single();

    if (err) { setError(err.message); setSaving(false); return; }
    if (newPerson) {
      await assignPerson(newPerson.id);
    }
    setShowNewPerson(false);
    setNewName(''); setNewCedula(''); setNewEmail('');
  };

  const isChapterMode = targetType === 'chapter' && mode === 'book_authors' && bookAuthors && bookAuthors.length > 0;
  const availableBookAuthors = (bookAuthors || []).filter(a => !existingChapterAuthorIds.has(a.person_id));

  return (
    <Modal isOpen={isOpen} onClose={onClose} 
      title={targetType === 'chapter' && mode === 'book_authors' ? 'Asignar autores al capítulo' : `Agregar ${role === 'par_evaluador' ? 'Par Evaluador' : 'Autor'}`} 
      size="md"
      footer={
        showNewPerson ? <>
          <button className="btn btn-secondary" onClick={() => setShowNewPerson(false)}>Volver</button>
          <button className="btn btn-primary" onClick={createAndAssign} disabled={saving}>
            {saving ? 'Creando...' : 'Crear y Asignar'}
          </button>
        </> : isChapterMode ? <>
          <button className="btn btn-ghost btn-sm" onClick={() => setMode('search')}>
            <Search size={14} /> Buscar otra persona
          </button>
          <button className="btn btn-primary" onClick={assignSelectedBookAuthors} disabled={saving || selectedBookAuthors.size === 0}>
            {saving ? 'Asignando...' : `Asignar ${selectedBookAuthors.size > 0 ? `(${selectedBookAuthors.size})` : ''}`}
          </button>
        </> : undefined
      }
    >
      {error && <div style={{ background: '#FFEBEE', color: '#C62828', padding: '10px 14px', borderRadius: 'var(--radius-md)', marginBottom: '16px', fontSize: '13px' }}>{error}</div>}

      {/* ===================== CHAPTER MODE: Show book authors as checkboxes ===================== */}
      {isChapterMode && !showNewPerson && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <div style={{
            padding: '10px 14px', borderRadius: '10px',
            background: '#E3F2FD', border: '1px solid #90CAF920',
            fontSize: '12px', color: '#1565C0', fontWeight: 500,
            display: 'flex', alignItems: 'center', gap: '8px',
          }}>
            <Users size={14} />
            Selecciona los autores del libro que participan en este capítulo
          </div>

          {availableBookAuthors.length === 0 ? (
            <div style={{ padding: '20px', textAlign: 'center', color: '#888' }}>
              <p style={{ fontSize: '13px', fontWeight: 600, marginBottom: '8px' }}>Todos los autores del libro ya están asignados</p>
              <button className="btn btn-ghost btn-sm" onClick={() => setMode('search')}>
                <Search size={14} /> Buscar otra persona
              </button>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', maxHeight: '320px', overflow: 'auto' }}>
              {availableBookAuthors.map(author => {
                const isSelected = selectedBookAuthors.has(author.person_id);
                return (
                  <button
                    key={author.person_id}
                    onClick={() => toggleBookAuthor(author.person_id)}
                    style={{
                      display: 'flex', alignItems: 'center', gap: '12px',
                      padding: '12px 14px', borderRadius: '10px', textAlign: 'left',
                      border: isSelected ? '2px solid var(--primary)' : '1px solid var(--gray-200)',
                      background: isSelected ? '#E8F5E910' : 'white',
                      cursor: 'pointer', transition: 'all 0.15s',
                    }}
                  >
                    <div style={{
                      width: '28px', height: '28px', borderRadius: '8px', flexShrink: 0,
                      background: isSelected ? 'var(--primary)' : 'var(--gray-100)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      transition: 'all 0.15s',
                    }}>
                      {isSelected && <Check size={14} color="white" />}
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: 600, fontSize: '14px', color: '#333' }}>
                        {author.full_name}
                      </div>
                      <div style={{ fontSize: '12px', color: 'var(--gray-500)', marginTop: '2px' }}>
                        {author.cedula ? `CC: ${author.cedula}` : ''}
                        {author.role ? ` · ${author.role}` : ''}
                        {author.institution ? ` · ${author.institution}` : ''}
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          )}

          {/* Show already assigned */}
          {existingChapterAuthorIds.size > 0 && (
            <div style={{ fontSize: '11px', color: '#888', padding: '4px 0' }}>
              ✓ {existingChapterAuthorIds.size} autor(es) ya asignados a este capítulo
            </div>
          )}
        </div>
      )}

      {/* ===================== SEARCH MODE (original behavior) ===================== */}
      {(mode === 'search' || targetType === 'book') && !showNewPerson && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {targetType === 'chapter' && (
            <button className="btn btn-ghost btn-sm" style={{ alignSelf: 'flex-start' }} onClick={() => setMode('book_authors')}>
              ← Volver a autores del libro
            </button>
          )}

          <div className="form-group">
            <label className="form-label">Rol</label>
            <select className="form-select" value={role} onChange={e => setRole(e.target.value)}>
              <option value="autor">Autor</option>
              <option value="compilador">Compilador</option>
              <option value="editor">Editor</option>
              <option value="par_evaluador">Par Evaluador</option>
              <option value="coordinador">Coordinador</option>
            </select>
          </div>

          <div className="form-group">
            <label className="form-label">Buscar persona por nombre o cédula</label>
            <div className="search-bar" style={{ maxWidth: '100%' }}>
              <Search size={18} className="search-icon" />
              <input
                type="text"
                placeholder="Escribe nombre o cédula..."
                value={search}
                onChange={e => setSearch(e.target.value)}
              />
            </div>
          </div>

          {searching && <p style={{ fontSize: '13px', color: 'var(--gray-400)' }}>Buscando...</p>}

          {results.length > 0 && (
            <div style={{ maxHeight: '200px', overflowY: 'auto' }}>
              {results.map(p => (
                <div key={p.id} style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  padding: '10px 14px', borderRadius: 'var(--radius-md)',
                  border: '1px solid var(--gray-200)', marginBottom: '6px',
                  cursor: 'pointer', transition: 'all 0.15s',
                }}
                  onClick={() => assignPerson(p.id)}
                  onMouseEnter={e => (e.currentTarget.style.background = 'var(--gray-50)')}
                  onMouseLeave={e => (e.currentTarget.style.background = '')}
                >
                  <div>
                    <div style={{ fontWeight: 600, fontSize: '14px' }}>{p.full_name}</div>
                    <div style={{ fontSize: '12px', color: 'var(--gray-500)' }}>
                      {p.cedula ? `CC: ${p.cedula}` : ''} {p.institution ? `· ${p.institution}` : ''}
                    </div>
                  </div>
                  <span className="badge badge-success">Asignar</span>
                </div>
              ))}
            </div>
          )}

          {search.length >= 2 && results.length === 0 && !searching && (
            <div style={{ textAlign: 'center', padding: '16px', background: 'var(--gray-50)', borderRadius: 'var(--radius-md)' }}>
              <p style={{ fontSize: '13px', color: 'var(--gray-500)', marginBottom: '12px' }}>
                No se encontraron resultados para &quot;{search}&quot;
              </p>
              <button className="btn btn-primary btn-sm" onClick={() => { setShowNewPerson(true); setNewName(search); }}>
                <UserPlus size={14} /> Crear nueva persona
              </button>
            </div>
          )}

          <div style={{ textAlign: 'center' }}>
            <button className="btn btn-ghost btn-sm" onClick={() => setShowNewPerson(true)}>
              <UserPlus size={14} /> Registrar persona nueva
            </button>
          </div>
        </div>
      )}

      {/* ===================== NEW PERSON FORM ===================== */}
      {showNewPerson && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
          <div className="form-group" style={{ gridColumn: '1 / -1' }}>
            <label className="form-label">Nombre completo *</label>
            <input className="form-input" value={newName} onChange={e => setNewName(e.target.value)} />
          </div>
          <div className="form-group">
            <label className="form-label">Cédula</label>
            <input className="form-input" value={newCedula} onChange={e => setNewCedula(e.target.value)} placeholder="1234567890" />
          </div>
          <div className="form-group">
            <label className="form-label">Email</label>
            <input className="form-input" type="email" value={newEmail} onChange={e => setNewEmail(e.target.value)} />
          </div>
          <div className="form-group" style={{ gridColumn: '1 / -1' }}>
            <label className="form-label">Institución</label>
            <input className="form-input" value={newInstitution} onChange={e => setNewInstitution(e.target.value)} />
          </div>
        </div>
      )}
    </Modal>
  );
}
