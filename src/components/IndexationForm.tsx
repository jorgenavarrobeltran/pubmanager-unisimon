'use client';

import { useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import Modal from '@/components/Modal';
import { INDEXERS, SCOPUS_QUARTILES, PUBLINDEX_CATEGORIES } from '@/lib/constants';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onSaved: () => void;
  journalId: string;
}

export default function IndexationForm({ isOpen, onClose, onSaved, journalId }: Props) {
  const [indexer, setIndexer] = useState('publindex');
  const [category, setCategory] = useState('');
  const [subjectCategory, setSubjectCategory] = useState('');
  const [year, setYear] = useState(new Date().getFullYear());
  const [status, setStatus] = useState('vigente');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const categories = indexer === 'scopus' ? SCOPUS_QUARTILES : PUBLINDEX_CATEGORIES;

  const handleSubmit = async () => {
    if (!category) { setError('La categoría es obligatoria'); return; }
    if (!year) { setError('El año es obligatorio'); return; }
    setSaving(true);
    setError('');

    const supabase = createClient();
    const { error: err } = await supabase.from('journal_indexations').insert({
      journal_id: journalId,
      indexer,
      category,
      subject_category: indexer === 'scopus' ? subjectCategory : null,
      year,
      status,
      notes: notes || null,
    });

    if (err) {
      setError(err.message);
      setSaving(false);
      return;
    }

    // Reset form
    setCategory('');
    setSubjectCategory('');
    setNotes('');
    setSaving(false);
    onSaved();
    onClose();
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Agregar Indexación"
      footer={
        <>
          <button className="btn btn-secondary" onClick={onClose}>Cancelar</button>
          <button className="btn btn-primary" onClick={handleSubmit} disabled={saving}>
            {saving ? 'Guardando...' : 'Guardar Indexación'}
          </button>
        </>
      }
    >
      {error && (
        <div style={{ background: '#FFEBEE', color: '#C62828', padding: '10px 14px', borderRadius: 'var(--radius-md)', marginBottom: '16px', fontSize: '13px' }}>
          {error}
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
        <div className="form-group">
          <label className="form-label">Indexador *</label>
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
            {INDEXERS.map(idx => (
              <button
                key={idx.key}
                type="button"
                className={`btn btn-sm ${indexer === idx.key ? 'btn-primary' : 'btn-secondary'}`}
                onClick={() => { setIndexer(idx.key); setCategory(''); }}
                style={indexer === idx.key ? { background: idx.color, borderColor: idx.color } : {}}
              >
                {idx.label}
              </button>
            ))}
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
          <div className="form-group">
            <label className="form-label">Categoría / Cuartil *</label>
            <select className="form-select" value={category} onChange={e => setCategory(e.target.value)}>
              <option value="">— Seleccionar —</option>
              {categories.map(c => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </div>

          <div className="form-group">
            <label className="form-label">Año *</label>
            <input
              className="form-input"
              type="number"
              value={year}
              onChange={e => setYear(parseInt(e.target.value))}
              min={2000}
              max={2030}
            />
          </div>
        </div>

        {indexer === 'scopus' && (
          <div className="form-group">
            <label className="form-label">Subject Category (Scopus)</label>
            <input
              className="form-input"
              value={subjectCategory}
              onChange={e => setSubjectCategory(e.target.value)}
              placeholder="Ej: Applied Psychology, Education, Political Science..."
            />
          </div>
        )}

        <div className="form-group">
          <label className="form-label">Estado</label>
          <select className="form-select" value={status} onChange={e => setStatus(e.target.value)}>
            <option value="vigente">Vigente</option>
            <option value="vencida">Vencida</option>
            <option value="en_tramite">En trámite</option>
            <option value="preliminar">Preliminar</option>
          </select>
        </div>

        <div className="form-group">
          <label className="form-label">Notas</label>
          <textarea
            className="form-textarea"
            value={notes}
            onChange={e => setNotes(e.target.value)}
            placeholder="Observaciones adicionales..."
            rows={2}
          />
        </div>
      </div>
    </Modal>
  );
}
