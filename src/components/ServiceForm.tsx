'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import { X } from 'lucide-react';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onSaved: () => void;
  service?: any;
}

const SERVICE_TYPES = [
  { value: 'diagramacion', label: 'Diagramación' },
  { value: 'edicion', label: 'Edición / Corrección' },
  { value: 'formacion', label: 'Formación / Capacitación' },
  { value: 'asesoria', label: 'Asesoría Editorial' },
  { value: 'otro', label: 'Otro' },
];

const STATUS_OPTIONS = [
  { value: 'cotizado', label: '📝 Cotizado' },
  { value: 'en_proceso', label: '🔄 En Proceso' },
  { value: 'facturado', label: '📄 Facturado' },
  { value: 'pagado', label: '✅ Pagado' },
];

export default function ServiceForm({ isOpen, onClose, onSaved, service }: Props) {
  const [serviceType, setServiceType] = useState('diagramacion');
  const [clientName, setClientName] = useState('');
  const [description, setDescription] = useState('');
  const [amount, setAmount] = useState('');
  const [invoiceNumber, setInvoiceNumber] = useState('');
  const [date, setDate] = useState(new Date().toISOString().substring(0, 10));
  const [status, setStatus] = useState('cotizado');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (service) {
      setServiceType(service.service_type || 'diagramacion');
      setClientName(service.client_name || '');
      setDescription(service.description || '');
      setAmount(service.amount?.toString() || '');
      setInvoiceNumber(service.invoice_number || '');
      setDate(service.date || new Date().toISOString().substring(0, 10));
      setStatus(service.status || 'cotizado');
      setNotes(service.notes || '');
    } else {
      setServiceType('diagramacion'); setClientName(''); setDescription('');
      setAmount(''); setInvoiceNumber('');
      setDate(new Date().toISOString().substring(0, 10));
      setStatus('cotizado'); setNotes('');
    }
  }, [service, isOpen]);

  const handleSave = async () => {
    if (!clientName.trim() || !amount) return;
    setSaving(true);
    const supabase = createClient();
    const data = {
      service_type: serviceType,
      client_name: clientName.trim(),
      description: description.trim() || null,
      amount: parseFloat(amount),
      invoice_number: invoiceNumber.trim() || null,
      date,
      status,
      notes: notes.trim() || null,
    };
    if (service) {
      await supabase.from('external_services').update(data).eq('id', service.id);
    } else {
      await supabase.from('external_services').insert(data);
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
          <h3>{service ? 'Editar Servicio' : 'Nuevo Servicio Externo'}</h3>
          <button className="btn btn-ghost btn-icon" onClick={onClose}><X size={18} /></button>
        </div>
        <div className="modal-body">
          <div className="form-row">
            <div className="form-group">
              <label>Tipo de Servicio *</label>
              <select value={serviceType} onChange={e => setServiceType(e.target.value)}>
                {SERVICE_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
              </select>
            </div>
            <div className="form-group">
              <label>Estado</label>
              <select value={status} onChange={e => setStatus(e.target.value)}>
                {STATUS_OPTIONS.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
              </select>
            </div>
          </div>
          <div className="form-group">
            <label>Cliente / Institución *</label>
            <input type="text" value={clientName} onChange={e => setClientName(e.target.value)} placeholder="Ej: Universidad del Norte" />
          </div>
          <div className="form-group">
            <label>Descripción del servicio</label>
            <textarea value={description} onChange={e => setDescription(e.target.value)} rows={2} placeholder="Detalle del servicio prestado..." />
          </div>
          <div className="form-row">
            <div className="form-group">
              <label>Monto (COP) *</label>
              <input type="number" value={amount} onChange={e => setAmount(e.target.value)} placeholder="5000000" />
            </div>
            <div className="form-group">
              <label>N° Factura</label>
              <input type="text" value={invoiceNumber} onChange={e => setInvoiceNumber(e.target.value)} placeholder="FAC-001" />
            </div>
          </div>
          <div className="form-group">
            <label>Fecha</label>
            <input type="date" value={date} onChange={e => setDate(e.target.value)} />
          </div>
          <div className="form-group">
            <label>Notas</label>
            <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={2} />
          </div>
        </div>
        <div className="modal-footer">
          <button className="btn btn-secondary" onClick={onClose}>Cancelar</button>
          <button className="btn btn-primary" onClick={handleSave} disabled={saving || !clientName.trim() || !amount}>
            {saving ? 'Guardando...' : service ? 'Actualizar' : 'Registrar Servicio'}
          </button>
        </div>
      </div>
    </div>
  );
}
