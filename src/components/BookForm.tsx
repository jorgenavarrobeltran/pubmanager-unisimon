'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import Modal from '@/components/Modal';
import { BOOK_TYPES, EDITION_TYPES, BOOK_STAGES, BOOK_STATUSES } from '@/lib/constants';

interface Faculty { id: string; name: string; }

interface BookFormData {
  title: string;
  subtitle: string;
  book_type: string;
  edition_type: string;
  faculty_id: string;
  isbn_digital: string;
  isbn_print: string;
  doi: string;
  issn: string;
  repository_url: string;
  editorial: string;
  current_stage: string;
  status: string;
  year_published: number | null;
  page_count: number | null;
  print_run: number | null;
  format: string;
  project_name: string;
  research_group_code: string;
  notes: string;
}

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onSaved: () => void;
  book?: any;
}

const emptyForm: BookFormData = {
  title: '', subtitle: '', book_type: 'libro_completo', edition_type: 'propio',
  faculty_id: '', isbn_digital: '', isbn_print: '', doi: '', issn: '', repository_url: '',
  editorial: 'Ediciones Universidad Simón Bolívar', current_stage: 'propuesta',
  status: 'en_proceso', year_published: null, page_count: null, print_run: null,
  format: 'digital', project_name: '', research_group_code: '', notes: '',
};

export default function BookForm({ isOpen, onClose, onSaved, book }: Props) {
  const [form, setForm] = useState<BookFormData>(emptyForm);
  const [faculties, setFaculties] = useState<Faculty[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    async function load() {
      const supabase = createClient();
      const { data } = await supabase.from('faculties').select('id, name').order('name');
      setFaculties(data || []);
    }
    load();
  }, []);

  useEffect(() => {
    if (book) {
      setForm({
        title: book.title || '', subtitle: book.subtitle || '',
        book_type: book.book_type || 'libro_completo', edition_type: book.edition_type || 'propio',
        faculty_id: book.faculty_id || '', isbn_digital: book.isbn_digital || '',
        isbn_print: book.isbn_print || '', doi: book.doi || '', issn: book.issn || '',
        repository_url: book.repository_url || '',
        editorial: book.editorial || 'Ediciones Universidad Simón Bolívar',
        current_stage: book.current_stage || 'propuesta', status: book.status || 'en_proceso',
        year_published: book.year_published || null, page_count: book.page_count || null,
        print_run: book.print_run || null, format: book.format || 'digital',
        project_name: book.project_name || '', research_group_code: book.research_group_code || '',
        notes: book.notes || '',
      });
    } else {
      setForm(emptyForm);
    }
  }, [book, isOpen]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    const numFields = ['year_published', 'page_count', 'print_run'];
    setForm(prev => ({ ...prev, [name]: numFields.includes(name) ? (value ? parseInt(value) : null) : value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.title.trim()) { setError('El título es obligatorio'); return; }
    setSaving(true); setError('');

    const supabase = createClient();
    const payload = { ...form, faculty_id: form.faculty_id || null };

    const result = book
      ? await supabase.from('books').update(payload).eq('id', book.id)
      : await supabase.from('books').insert(payload);

    if (result.error) { setError(result.error.message); setSaving(false); return; }
    setSaving(false); onSaved(); onClose();
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={book ? 'Editar Libro' : 'Nuevo Libro'} size="lg"
      footer={<>
        <button className="btn btn-secondary" onClick={onClose}>Cancelar</button>
        <button className="btn btn-primary" onClick={handleSubmit} disabled={saving}>
          {saving ? 'Guardando...' : book ? 'Guardar Cambios' : 'Crear Libro'}
        </button>
      </>}
    >
      {error && <div style={{ background: '#FFEBEE', color: '#C62828', padding: '10px 14px', borderRadius: 'var(--radius-md)', marginBottom: '16px', fontSize: '13px' }}>{error}</div>}

      <form onSubmit={handleSubmit} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
        <div className="form-group" style={{ gridColumn: '1 / -1' }}>
          <label className="form-label">Título *</label>
          <input className="form-input" name="title" value={form.title} onChange={handleChange} placeholder="Título del libro" required />
        </div>

        <div className="form-group" style={{ gridColumn: '1 / -1' }}>
          <label className="form-label">Subtítulo</label>
          <input className="form-input" name="subtitle" value={form.subtitle} onChange={handleChange} placeholder="Subtítulo (opcional)" />
        </div>

        <div className="form-group">
          <label className="form-label">Tipo de libro</label>
          <select className="form-select" name="book_type" value={form.book_type} onChange={handleChange}>
            {BOOK_TYPES.map(t => <option key={t.key} value={t.key}>{t.label}</option>)}
          </select>
        </div>

        <div className="form-group">
          <label className="form-label">Tipo de edición</label>
          <select className="form-select" name="edition_type" value={form.edition_type} onChange={handleChange}>
            {EDITION_TYPES.map(t => <option key={t.key} value={t.key}>{t.label}</option>)}
          </select>
        </div>

        <div className="form-group">
          <label className="form-label">Facultad</label>
          <select className="form-select" name="faculty_id" value={form.faculty_id} onChange={handleChange}>
            <option value="">— Sin asignar —</option>
            {faculties.map(f => <option key={f.id} value={f.id}>{f.name}</option>)}
          </select>
        </div>

        <div className="form-group">
          <label className="form-label">Editorial</label>
          <input className="form-input" name="editorial" value={form.editorial} onChange={handleChange} />
        </div>

        <div className="form-group">
          <label className="form-label">ISBN Digital</label>
          <input className="form-input" name="isbn_digital" value={form.isbn_digital} onChange={handleChange} placeholder="978-..." />
        </div>

        <div className="form-group">
          <label className="form-label">ISBN Impreso</label>
          <input className="form-input" name="isbn_print" value={form.isbn_print} onChange={handleChange} placeholder="978-..." />
        </div>

        <div className="form-group">
          <label className="form-label">DOI</label>
          <input className="form-input" name="doi" value={form.doi} onChange={handleChange} placeholder="10.17081/..." />
        </div>

        <div className="form-group">
          <label className="form-label">ISSN (si aplica)</label>
          <input className="form-input" name="issn" value={form.issn} onChange={handleChange} />
        </div>

        <div className="form-group" style={{ gridColumn: '1 / -1' }}>
          <label className="form-label">🔗 Enlace Repositorio / Bonga</label>
          <input className="form-input" name="repository_url" value={form.repository_url} onChange={handleChange} placeholder="https://bonga.unisimon.edu.co/handle/..." />
        </div>

        <div className="form-group">
          <label className="form-label">Etapa actual</label>
          <select className="form-select" name="current_stage" value={form.current_stage} onChange={handleChange}>
            {BOOK_STAGES.map(s => <option key={s.key} value={s.key}>{s.icon} {s.label}</option>)}
          </select>
        </div>

        <div className="form-group">
          <label className="form-label">Estado</label>
          <select className="form-select" name="status" value={form.status} onChange={handleChange}>
            {BOOK_STATUSES.map(s => <option key={s.key} value={s.key}>{s.label}</option>)}
          </select>
        </div>

        <div className="form-group">
          <label className="form-label">Año publicación</label>
          <input className="form-input" name="year_published" type="number" value={form.year_published ?? ''} onChange={handleChange} placeholder="2026" />
        </div>

        <div className="form-group">
          <label className="form-label">Formato</label>
          <select className="form-select" name="format" value={form.format} onChange={handleChange}>
            <option value="digital">Digital</option>
            <option value="impreso">Impreso</option>
            <option value="ambos">Digital + Impreso</option>
          </select>
        </div>

        <div className="form-group">
          <label className="form-label">Páginas</label>
          <input className="form-input" name="page_count" type="number" value={form.page_count ?? ''} onChange={handleChange} />
        </div>

        <div className="form-group">
          <label className="form-label">Tiraje</label>
          <input className="form-input" name="print_run" type="number" value={form.print_run ?? ''} onChange={handleChange} />
        </div>

        <div className="form-group" style={{ gridColumn: '1 / -1' }}>
          <label className="form-label">Proyecto / Convocatoria</label>
          <input className="form-input" name="project_name" value={form.project_name} onChange={handleChange} placeholder="Nombre del proyecto de investigación" />
        </div>

        <div className="form-group" style={{ gridColumn: '1 / -1' }}>
          <label className="form-label">Notas</label>
          <textarea className="form-textarea" name="notes" value={form.notes} onChange={handleChange} rows={2} />
        </div>
      </form>
    </Modal>
  );
}
