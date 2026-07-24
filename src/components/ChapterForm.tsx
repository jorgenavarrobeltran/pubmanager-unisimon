'use client';

import { useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import Modal from '@/components/Modal';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onSaved: () => void;
  bookId: string;
}

export default function ChapterForm({ isOpen, onClose, onSaved, bookId }: Props) {
  const [title, setTitle] = useState('');
  const [chapterNumber, setChapterNumber] = useState<number | null>(null);
  const [isbnDigital, setIsbnDigital] = useState('');
  const [isbnPrint, setIsbnPrint] = useState('');
  const [doi, setDoi] = useState('');
  const [startPage, setStartPage] = useState<number | null>(null);
  const [endPage, setEndPage] = useState<number | null>(null);
  const [year, setYear] = useState<number | null>(new Date().getFullYear());
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async () => {
    if (!title.trim()) { setError('El título del capítulo es obligatorio'); return; }
    setSaving(true); setError('');

    const supabase = createClient();
    const { error: err } = await supabase.from('book_chapters').insert({
      book_id: bookId,
      title: title.trim(),
      chapter_number: chapterNumber,
      isbn_digital: isbnDigital || null,
      isbn_print: isbnPrint || null,
      doi: doi || null,
      start_page: startPage,
      end_page: endPage,
      year,
      notes: notes || null,
    });

    if (err) { setError(err.message); setSaving(false); return; }

    // Update book chapter count
    const { count } = await supabase.from('book_chapters').select('id', { count: 'exact', head: true }).eq('book_id', bookId);
    await supabase.from('books').update({ num_chapters: count }).eq('id', bookId);

    setTitle(''); setChapterNumber(null); setIsbnDigital(''); setIsbnPrint('');
    setDoi(''); setStartPage(null); setEndPage(null); setNotes('');
    setSaving(false); onSaved(); onClose();
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Agregar Capítulo" size="md"
      footer={<>
        <button className="btn btn-secondary" onClick={onClose}>Cancelar</button>
        <button className="btn btn-primary" onClick={handleSubmit} disabled={saving}>
          {saving ? 'Guardando...' : 'Agregar Capítulo'}
        </button>
      </>}
    >
      {error && <div style={{ background: '#FFEBEE', color: '#C62828', padding: '10px 14px', borderRadius: 'var(--radius-md)', marginBottom: '16px', fontSize: '13px' }}>{error}</div>}

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
        <div className="form-group" style={{ gridColumn: '1 / -1' }}>
          <label className="form-label">Título del Capítulo *</label>
          <input className="form-input" value={title} onChange={e => setTitle(e.target.value)} placeholder="Título del capítulo" />
        </div>

        <div className="form-group">
          <label className="form-label">N° Capítulo</label>
          <input className="form-input" type="number" value={chapterNumber ?? ''} onChange={e => setChapterNumber(e.target.value ? parseInt(e.target.value) : null)} />
        </div>

        <div className="form-group">
          <label className="form-label">Año</label>
          <input className="form-input" type="number" value={year ?? ''} onChange={e => setYear(e.target.value ? parseInt(e.target.value) : null)} />
        </div>

        <div className="form-group">
          <label className="form-label">ISBN Digital</label>
          <input className="form-input" value={isbnDigital} onChange={e => setIsbnDigital(e.target.value)} placeholder="978-..." />
        </div>

        <div className="form-group">
          <label className="form-label">ISBN Impreso</label>
          <input className="form-input" value={isbnPrint} onChange={e => setIsbnPrint(e.target.value)} placeholder="978-..." />
        </div>

        <div className="form-group">
          <label className="form-label">DOI</label>
          <input className="form-input" value={doi} onChange={e => setDoi(e.target.value)} placeholder="10.17081/..." style={{ gridColumn: '1 / -1' }} />
        </div>

        <div className="form-group">
          <label className="form-label">Pág. inicio</label>
          <input className="form-input" type="number" value={startPage ?? ''} onChange={e => setStartPage(e.target.value ? parseInt(e.target.value) : null)} />
        </div>

        <div className="form-group">
          <label className="form-label">Pág. fin</label>
          <input className="form-input" type="number" value={endPage ?? ''} onChange={e => setEndPage(e.target.value ? parseInt(e.target.value) : null)} />
        </div>

        <div className="form-group" style={{ gridColumn: '1 / -1' }}>
          <label className="form-label">Notas</label>
          <textarea className="form-textarea" value={notes} onChange={e => setNotes(e.target.value)} rows={2} />
        </div>
      </div>
    </Modal>
  );
}
