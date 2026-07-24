'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import { X } from 'lucide-react';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onSaved: () => void;
  entityType?: 'book' | 'journal';
  entityId?: string;
  cost?: any;
}

const BOOK_COST_TYPES = [
  { value: 'imprenta', label: '🏭 Imprenta' },
  { value: 'isbn', label: '📖 ISBN' },
  { value: 'diseno', label: '🎨 Diseño / Diagramación' },
  { value: 'correccion', label: '✏️ Corrección de estilo' },
  { value: 'otro', label: '📦 Otro' },
];

const JOURNAL_COST_TYPES = [
  { value: 'doi', label: '🔗 DOI / Crossref' },
  { value: 'apc', label: '💳 APC' },
  { value: 'hosting_ojs', label: '🖥️ Hosting OJS' },
  { value: 'diseno', label: '🎨 Diseño / Diagramación' },
  { value: 'correccion', label: '✏️ Corrección de estilo' },
  { value: 'otro', label: '📦 Otro' },
];

export default function ProductionCostForm({ isOpen, onClose, onSaved, entityType, entityId, cost }: Props) {
  const [eType, setEType] = useState<'book' | 'journal'>(entityType || 'book');
  const [eId, setEId] = useState(entityId || '');
  const [costType, setCostType] = useState('imprenta');
  const [description, setDescription] = useState('');
  const [amount, setAmount] = useState('');
  const [date, setDate] = useState(new Date().toISOString().substring(0, 10));
  const [providerId, setProviderId] = useState('');
  const [invoiceNumber, setInvoiceNumber] = useState('');
  const [saving, setSaving] = useState(false);

  const [books, setBooks] = useState<any[]>([]);
  const [journals, setJournals] = useState<any[]>([]);
  const [providers, setProviders] = useState<any[]>([]);

  useEffect(() => {
    async function loadOptions() {
      const supabase = createClient();
      const [bRes, jRes, pRes] = await Promise.all([
        supabase.from('books').select('id, title').order('title'),
        supabase.from('journals').select('id, name').order('name'),
        supabase.from('providers').select('id, name').eq('status', 'activo').order('name'),
      ]);
      setBooks(bRes.data || []);
      setJournals(jRes.data || []);
      setProviders(pRes.data || []);
    }
    if (isOpen) loadOptions();
  }, [isOpen]);

  useEffect(() => {
    if (cost) {
      setEType(cost.entity_type || 'book');
      setEId(cost.entity_id || '');
      setCostType(cost.cost_type || 'imprenta');
      setDescription(cost.description || '');
      setAmount(cost.amount?.toString() || '');
      setDate(cost.date || new Date().toISOString().substring(0, 10));
      setProviderId(cost.provider_id || '');
      setInvoiceNumber(cost.invoice_number || '');
    } else {
      setEType(entityType || 'book');
      setEId(entityId || '');
      setCostType(entityType === 'journal' ? 'doi' : 'imprenta');
      setDescription(''); setAmount('');
      setDate(new Date().toISOString().substring(0, 10));
      setProviderId(''); setInvoiceNumber('');
    }
  }, [cost, isOpen, entityType, entityId]);

  const costTypes = eType === 'journal' ? JOURNAL_COST_TYPES : BOOK_COST_TYPES;

  const handleSave = async () => {
    if (!eId || !amount) return;
    setSaving(true);
    const supabase = createClient();
    const data = {
      entity_type: eType,
      entity_id: eId,
      cost_type: costType,
      description: description.trim() || null,
      amount: parseFloat(amount),
      date,
      provider_id: providerId || null,
      invoice_number: invoiceNumber.trim() || null,
    };
    if (cost) {
      await supabase.from('production_costs').update(data).eq('id', cost.id);
    } else {
      await supabase.from('production_costs').insert(data);
    }
    setSaving(false);
    onSaved();
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: '540px' }}>
        <div className="modal-header">
          <h3>{cost ? 'Editar Costo' : 'Nuevo Costo de Producción'}</h3>
          <button className="btn btn-ghost btn-icon" onClick={onClose}><X size={18} /></button>
        </div>
        <div className="modal-body">
          {!entityId && (
            <div className="form-row">
              <div className="form-group">
                <label>Tipo</label>
                <select value={eType} onChange={e => { setEType(e.target.value as any); setEId(''); setCostType(e.target.value === 'journal' ? 'doi' : 'imprenta'); }}>
                  <option value="book">📚 Libro</option>
                  <option value="journal">📰 Revista</option>
                </select>
              </div>
              <div className="form-group">
                <label>{eType === 'book' ? 'Libro' : 'Revista'} *</label>
                <select value={eId} onChange={e => setEId(e.target.value)}>
                  <option value="">Seleccionar...</option>
                  {(eType === 'book' ? books : journals).map(item => (
                    <option key={item.id} value={item.id}>{item.title || item.name}</option>
                  ))}
                </select>
              </div>
            </div>
          )}
          <div className="form-row">
            <div className="form-group">
              <label>Tipo de Costo *</label>
              <select value={costType} onChange={e => setCostType(e.target.value)}>
                {costTypes.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
              </select>
            </div>
            <div className="form-group">
              <label>Monto (COP) *</label>
              <input type="number" value={amount} onChange={e => setAmount(e.target.value)} placeholder="1500000" />
            </div>
          </div>
          <div className="form-group">
            <label>Descripción</label>
            <input type="text" value={description} onChange={e => setDescription(e.target.value)} placeholder="Ej: Impresión 500 ejemplares tapa dura" />
          </div>
          <div className="form-row">
            <div className="form-group">
              <label>Proveedor</label>
              <select value={providerId} onChange={e => setProviderId(e.target.value)}>
                <option value="">Sin proveedor</option>
                {providers.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </div>
            <div className="form-group">
              <label>N° Factura</label>
              <input type="text" value={invoiceNumber} onChange={e => setInvoiceNumber(e.target.value)} />
            </div>
          </div>
          <div className="form-group">
            <label>Fecha</label>
            <input type="date" value={date} onChange={e => setDate(e.target.value)} />
          </div>
        </div>
        <div className="modal-footer">
          <button className="btn btn-secondary" onClick={onClose}>Cancelar</button>
          <button className="btn btn-primary" onClick={handleSave} disabled={saving || !eId || !amount}>
            {saving ? 'Guardando...' : cost ? 'Actualizar' : 'Registrar Costo'}
          </button>
        </div>
      </div>
    </div>
  );
}
