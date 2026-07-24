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

export default function MetricForm({ isOpen, onClose, onSaved, journalId }: Props) {
  const [year, setYear] = useState(new Date().getFullYear());
  const [sjr, setSjr] = useState('');
  const [citeScore, setCiteScore] = useState('');
  const [impactFactor, setImpactFactor] = useState('');
  const [hIndex, setHIndex] = useState('');
  const [source, setSource] = useState('scopus');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async () => {
    if (!year) { setError('El año es obligatorio'); return; }
    setSaving(true);
    setError('');

    const supabase = createClient();
    const { error: err } = await supabase.from('journal_metrics').insert({
      journal_id: journalId,
      year,
      sjr: sjr ? parseFloat(sjr) : null,
      cite_score: citeScore ? parseFloat(citeScore) : null,
      impact_factor: impactFactor ? parseFloat(impactFactor) : null,
      h_index: hIndex ? parseInt(hIndex) : null,
      source,
    });

    if (err) {
      setError(err.message);
      setSaving(false);
      return;
    }

    setSjr(''); setCiteScore(''); setImpactFactor(''); setHIndex('');
    setSaving(false);
    onSaved();
    onClose();
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Agregar Métricas"
      size="sm"
      footer={
        <>
          <button className="btn btn-secondary" onClick={onClose}>Cancelar</button>
          <button className="btn btn-primary" onClick={handleSubmit} disabled={saving}>
            {saving ? 'Guardando...' : 'Guardar Métricas'}
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
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
          <div className="form-group">
            <label className="form-label">Año *</label>
            <input className="form-input" type="number" value={year} onChange={e => setYear(parseInt(e.target.value))} min={2000} max={2030} />
          </div>
          <div className="form-group">
            <label className="form-label">Fuente</label>
            <select className="form-select" value={source} onChange={e => setSource(e.target.value)}>
              <option value="scopus">Scopus</option>
              <option value="google_scholar">Google Scholar</option>
              <option value="wos">Web of Science</option>
            </select>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
          <div className="form-group">
            <label className="form-label">SJR</label>
            <input className="form-input" type="number" step="0.001" value={sjr} onChange={e => setSjr(e.target.value)} placeholder="0.296" />
          </div>
          <div className="form-group">
            <label className="form-label">CiteScore</label>
            <input className="form-input" type="number" step="0.1" value={citeScore} onChange={e => setCiteScore(e.target.value)} placeholder="1.2" />
          </div>
          <div className="form-group">
            <label className="form-label">Impact Factor</label>
            <input className="form-input" type="number" step="0.001" value={impactFactor} onChange={e => setImpactFactor(e.target.value)} placeholder="0.5" />
          </div>
          <div className="form-group">
            <label className="form-label">H-Index</label>
            <input className="form-input" type="number" value={hIndex} onChange={e => setHIndex(e.target.value)} placeholder="5" />
          </div>
        </div>
      </div>
    </Modal>
  );
}
