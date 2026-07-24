'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import Modal from '@/components/Modal';
import { Search, UserPlus } from 'lucide-react';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onSaved: () => void;
  targetType: 'book' | 'chapter';
  targetId: string;
}

interface Person {
  id: string;
  full_name: string;
  cedula: string | null;
  institution: string | null;
  email: string | null;
}

export default function AuthorAssigner({ isOpen, onClose, onSaved, targetType, targetId }: Props) {
  const [search, setSearch] = useState('');
  const [results, setResults] = useState<Person[]>([]);
  const [searching, setSearching] = useState(false);
  const [role, setRole] = useState('autor');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  // New person form
  const [showNewPerson, setShowNewPerson] = useState(false);
  const [newName, setNewName] = useState('');
  const [newCedula, setNewCedula] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [newInstitution, setNewInstitution] = useState('Universidad Simón Bolívar');

  useEffect(() => {
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
  }, [search]);

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

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={`Agregar ${role === 'par_evaluador' ? 'Par Evaluador' : 'Autor'}`} size="md"
      footer={showNewPerson ? <>
        <button className="btn btn-secondary" onClick={() => setShowNewPerson(false)}>Volver</button>
        <button className="btn btn-primary" onClick={createAndAssign} disabled={saving}>
          {saving ? 'Creando...' : 'Crear y Asignar'}
        </button>
      </> : undefined}
    >
      {error && <div style={{ background: '#FFEBEE', color: '#C62828', padding: '10px 14px', borderRadius: 'var(--radius-md)', marginBottom: '16px', fontSize: '13px' }}>{error}</div>}

      {!showNewPerson ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
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
      ) : (
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
