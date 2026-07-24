'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import Modal from '@/components/Modal';

import { journalService } from '@/services/journalService';
import { journalValidator } from '@/utils/validators';
import { Alert } from '@/utils/alerts';

interface Faculty {
  id: string;
  name: string;
}

interface JournalFormData {
  name: string;
  type: 'cientifica' | 'academica';
  issn_print: string;
  issn_online: string;
  area: string;
  specialty: string;
  grand_area: string;
  ojs_url: string;
  google_scholar_url: string;
  editor_name: string;
  editor_email: string;
  faculty_id: string;
  description: string;
  h_index: number | null;
}

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onSaved: () => void;
  journal?: any; // existing journal for editing
}

const emptyForm: JournalFormData = {
  name: '', type: 'cientifica', issn_print: '', issn_online: '', area: '',
  specialty: '', grand_area: '', ojs_url: '', google_scholar_url: '',
  editor_name: '', editor_email: '', faculty_id: '', description: '', h_index: null,
};

export default function JournalForm({ isOpen, onClose, onSaved, journal }: Props) {
  const [form, setForm] = useState<JournalFormData>(emptyForm);
  const [faculties, setFaculties] = useState<Faculty[]>([]);
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    async function loadFaculties() {
      const supabase = createClient();
      const { data } = await supabase.from('faculties').select('id, name').order('name');
      setFaculties(data || []);
    }
    loadFaculties();
  }, []);

  useEffect(() => {
    if (journal) {
      setForm({
        name: journal.name || '',
        type: journal.type || 'cientifica',
        issn_print: journal.issn_print || '',
        issn_online: journal.issn_online || '',
        area: journal.area || '',
        specialty: journal.specialty || '',
        grand_area: journal.grand_area || '',
        ojs_url: journal.ojs_url || '',
        google_scholar_url: journal.google_scholar_url || '',
        editor_name: journal.editor_name || '',
        editor_email: journal.editor_email || '',
        faculty_id: journal.faculty_id || '',
        description: journal.description || '',
        h_index: journal.h_index || null,
      });
    } else {
      setForm(emptyForm);
    }
    setErrors({});
  }, [journal, isOpen]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setForm(prev => ({ ...prev, [name]: name === 'h_index' ? (value ? parseInt(value) : null) : value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Call validator before mutating (Rule of IT Skill)
    const validation = journalValidator.validate(form);
    if (!validation.isValid) {
      setErrors(validation.errors);
      return;
    }
    
    setSaving(true);
    setErrors({});

    const payload = {
      ...form,
      faculty_id: form.faculty_id || null,
      h_index: form.h_index || null,
      status: journal?.status || 'activa'
    };

    let result;
    if (journal) {
      result = await journalService.updateJournal(journal.id, payload);
    } else {
      result = await journalService.createJournal(payload);
    }

    if (!result.success) {
      setErrors({ api: result.message || 'Error al guardar la revista' });
      Alert.error('Error al guardar', result.message);
      setSaving(false);
      return;
    }

    Alert.success('Revista guardada correctamente');
    setSaving(false);
    onSaved();
    onClose();
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={journal ? 'Editar Revista' : 'Nueva Revista'}
      size="lg"
      footer={
        <>
          <button className="btn btn-secondary" onClick={onClose}>Cancelar</button>
          <button className="btn btn-primary" onClick={handleSubmit} disabled={saving}>
            {saving ? 'Guardando...' : journal ? 'Guardar Cambios' : 'Crear Revista'}
          </button>
        </>
      }
    >
      {Object.keys(errors).length > 0 && (
        <div style={{ background: '#FFEBEE', color: '#C62828', padding: '10px 14px', borderRadius: 'var(--radius-md)', marginBottom: '16px', fontSize: '13px' }}>
          {Object.values(errors).map((errMsg, idx) => <div key={idx}>{errMsg}</div>)}
        </div>
      )}

      <form onSubmit={handleSubmit} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
        <div className="form-group" style={{ gridColumn: '1 / -1' }}>
          <label className="form-label">Nombre de la Revista *</label>
          <input className="form-input" name="name" value={form.name} onChange={handleChange} placeholder="Ej: Psicogente" required />
        </div>

        <div className="form-group">
          <label className="form-label">Tipo *</label>
          <select className="form-select" name="type" value={form.type} onChange={handleChange}>
            <option value="cientifica">Científica</option>
            <option value="academica">Académica</option>
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
          <label className="form-label">ISSN Impreso</label>
          <input className="form-input" name="issn_print" value={form.issn_print} onChange={handleChange} placeholder="Ej: 0124-0137" />
        </div>

        <div className="form-group">
          <label className="form-label">eISSN (Online)</label>
          <input className="form-input" name="issn_online" value={form.issn_online} onChange={handleChange} placeholder="Ej: 2027-212X" />
        </div>

        <div className="form-group">
          <label className="form-label">Área</label>
          <input className="form-input" name="area" value={form.area} onChange={handleChange} placeholder="Ej: Psicología" />
        </div>

        <div className="form-group">
          <label className="form-label">Especialidad</label>
          <input className="form-input" name="specialty" value={form.specialty} onChange={handleChange} placeholder="Ej: Applied Psychology" />
        </div>

        <div className="form-group">
          <label className="form-label">Gran Área</label>
          <input className="form-input" name="grand_area" value={form.grand_area} onChange={handleChange} placeholder="Ej: Ciencias Sociales" />
        </div>

        <div className="form-group">
          <label className="form-label">H-Index</label>
          <input className="form-input" name="h_index" type="number" value={form.h_index ?? ''} onChange={handleChange} placeholder="Ej: 5" />
        </div>

        <div className="form-group">
          <label className="form-label">Editor(a) en Jefe</label>
          <input className="form-input" name="editor_name" value={form.editor_name} onChange={handleChange} placeholder="Nombre del editor" />
        </div>

        <div className="form-group">
          <label className="form-label">Email del Editor(a)</label>
          <input className="form-input" name="editor_email" type="email" value={form.editor_email} onChange={handleChange} placeholder="editor@unisimon.edu.co" />
        </div>

        <div className="form-group" style={{ gridColumn: '1 / -1' }}>
          <label className="form-label">URL OJS</label>
          <input className="form-input" name="ojs_url" value={form.ojs_url} onChange={handleChange} placeholder="https://revistas.unisimon.edu.co/index.php/..." />
        </div>

        <div className="form-group" style={{ gridColumn: '1 / -1' }}>
          <label className="form-label">URL Google Scholar</label>
          <input className="form-input" name="google_scholar_url" value={form.google_scholar_url} onChange={handleChange} placeholder="https://scholar.google.com/..." />
        </div>

        <div className="form-group" style={{ gridColumn: '1 / -1' }}>
          <label className="form-label">Descripción</label>
          <textarea className="form-textarea" name="description" value={form.description} onChange={handleChange} placeholder="Breve descripción del enfoque y alcance..." rows={3} />
        </div>
      </form>
    </Modal>
  );
}
