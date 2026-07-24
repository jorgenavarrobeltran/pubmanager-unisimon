'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import { X } from 'lucide-react';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onSaved: () => void;
  item?: any;
  defaultYear?: number;
}

const CATEGORIES = [
  { value: 'nomina', label: '👥 Nómina' },
  { value: 'produccion_libros', label: '📚 Producción de Libros' },
  { value: 'produccion_revistas', label: '📰 Producción de Revistas' },
  { value: 'eventos', label: '🎤 Eventos' },
  { value: 'servicios', label: '🔧 Servicios Generales' },
  { value: 'operacion', label: '🏢 Operación' },
  { value: 'otro', label: '📦 Otro' },
];

export default function BudgetForm({ isOpen, onClose, onSaved, item, defaultYear }: Props) {
  const [year, setYear] = useState(defaultYear || new Date().getFullYear());
  const [category, setCategory] = useState('produccion_libros');
  const [plannedAmount, setPlannedAmount] = useState('');
  const [executedAmount, setExecutedAmount] = useState('');
  const [description, setDescription] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (item) {
      setYear(item.year || new Date().getFullYear());
      setCategory(item.category || 'produccion_libros');
      setPlannedAmount(item.planned_amount?.toString() || '');
      setExecutedAmount(item.executed_amount?.toString() || '');
      setDescription(item.description || '');
    } else {
      setYear(defaultYear || new Date().getFullYear());
      setCategory('produccion_libros');
      setPlannedAmount(''); setExecutedAmount('0'); setDescription('');
    }
  }, [item, isOpen, defaultYear]);

  const planned = parseFloat(plannedAmount) || 0;
  const executed = parseFloat(executedAmount) || 0;
  const execPct = planned > 0 ? Math.round((executed / planned) * 100) : 0;

  const formatCOP = (a: number) => new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(a);

  const handleSave = async () => {
    if (!plannedAmount) return;
    setSaving(true);
    const supabase = createClient();
    const data = {
      year,
      category,
      planned_amount: planned,
      executed_amount: executed,
      description: description.trim() || null,
    };
    if (item) {
      await supabase.from('budget_items').update(data).eq('id', item.id);
    } else {
      await supabase.from('budget_items').insert(data);
    }
    setSaving(false);
    onSaved();
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: '480px' }}>
        <div className="modal-header">
          <h3>{item ? 'Editar Partida' : 'Nueva Partida Presupuestal'}</h3>
          <button className="btn btn-ghost btn-icon" onClick={onClose}><X size={18} /></button>
        </div>
        <div className="modal-body">
          <div className="form-row">
            <div className="form-group">
              <label>Año</label>
              <input type="number" value={year} onChange={e => setYear(parseInt(e.target.value))} min={2020} max={2030} />
            </div>
            <div className="form-group">
              <label>Categoría *</label>
              <select value={category} onChange={e => setCategory(e.target.value)}>
                {CATEGORIES.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
              </select>
            </div>
          </div>
          <div className="form-row">
            <div className="form-group">
              <label>Presupuestado (COP) *</label>
              <input type="number" value={plannedAmount} onChange={e => setPlannedAmount(e.target.value)} placeholder="10000000" />
            </div>
            <div className="form-group">
              <label>Ejecutado (COP)</label>
              <input type="number" value={executedAmount} onChange={e => setExecutedAmount(e.target.value)} placeholder="0" />
            </div>
          </div>
          {planned > 0 && (
            <div style={{
              padding: '10px 14px', borderRadius: 'var(--radius-md)', marginBottom: '16px',
              background: execPct > 100 ? '#FFEBEE' : execPct > 80 ? '#FFF3E0' : '#E3F2FD',
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--gray-600)' }}>Ejecución</span>
                <span style={{ fontSize: '14px', fontWeight: 800, color: execPct > 100 ? '#E53935' : execPct > 80 ? '#F57C00' : '#1565C0' }}>
                  {execPct}%
                </span>
              </div>
              <div style={{ width: '100%', height: '6px', background: 'var(--gray-200)', borderRadius: '3px', overflow: 'hidden' }}>
                <div style={{
                  width: `${Math.min(execPct, 100)}%`, height: '100%', borderRadius: '3px',
                  background: execPct > 100 ? '#E53935' : execPct > 80 ? '#F57C00' : '#1565C0',
                  transition: 'width 0.3s',
                }} />
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '4px', fontSize: '11px', color: 'var(--gray-400)' }}>
                <span>{formatCOP(executed)} ejecutado</span>
                <span>{formatCOP(planned - executed)} disponible</span>
              </div>
            </div>
          )}
          <div className="form-group">
            <label>Descripción</label>
            <textarea value={description} onChange={e => setDescription(e.target.value)} rows={2} placeholder="Detalle de la partida..." />
          </div>
        </div>
        <div className="modal-footer">
          <button className="btn btn-secondary" onClick={onClose}>Cancelar</button>
          <button className="btn btn-primary" onClick={handleSave} disabled={saving || !plannedAmount}>
            {saving ? 'Guardando...' : item ? 'Actualizar' : 'Crear Partida'}
          </button>
        </div>
      </div>
    </div>
  );
}
