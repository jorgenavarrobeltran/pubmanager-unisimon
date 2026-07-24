'use client';

import { useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import Modal from '@/components/Modal';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onSaved: () => void;
  journalId: string;
}

const LINK_TYPES = [
  { key: 'scimago', label: 'SCImago' },
  { key: 'scopus', label: 'Scopus' },
  { key: 'google_scholar', label: 'Google Scholar' },
  { key: 'publindex', label: 'Publindex' },
  { key: 'latindex', label: 'Latindex' },
  { key: 'doaj', label: 'DOAJ' },
  { key: 'redalyc', label: 'Redalyc' },
  { key: 'scielo', label: 'SciELO' },
  { key: 'wos', label: 'Web of Science' },
  { key: 'otro', label: 'Otro' },
];

export default function LinkForm({ isOpen, onClose, onSaved, journalId }: Props) {
  const [linkType, setLinkType] = useState('scimago');
  const [url, setUrl] = useState('');
  const [label, setLabel] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async () => {
    if (!url.trim()) { setError('La URL es obligatoria'); return; }
    setSaving(true);
    setError('');

    const supabase = createClient();
    const { error: err } = await supabase.from('journal_links').insert({
      journal_id: journalId,
      link_type: linkType,
      url: url.trim(),
      label: label.trim() || null,
    });

    if (err) {
      setError(err.message);
      setSaving(false);
      return;
    }

    setUrl('');
    setLabel('');
    setSaving(false);
    onSaved();
    onClose();
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Agregar Enlace Externo"
      size="sm"
      footer={
        <>
          <button className="btn btn-secondary" onClick={onClose}>Cancelar</button>
          <button className="btn btn-primary" onClick={handleSubmit} disabled={saving}>
            {saving ? 'Guardando...' : 'Agregar Enlace'}
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
          <label className="form-label">Tipo de enlace</label>
          <select className="form-select" value={linkType} onChange={e => setLinkType(e.target.value)}>
            {LINK_TYPES.map(lt => <option key={lt.key} value={lt.key}>{lt.label}</option>)}
          </select>
        </div>

        <div className="form-group">
          <label className="form-label">URL *</label>
          <input
            className="form-input"
            value={url}
            onChange={e => setUrl(e.target.value)}
            placeholder="https://..."
          />
        </div>

        <div className="form-group">
          <label className="form-label">Etiqueta (opcional)</label>
          <input
            className="form-input"
            value={label}
            onChange={e => setLabel(e.target.value)}
            placeholder="Ej: Psicogente en SCImago"
          />
        </div>
      </div>
    </Modal>
  );
}
