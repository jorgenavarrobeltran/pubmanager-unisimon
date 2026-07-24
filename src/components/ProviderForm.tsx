'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import { X } from 'lucide-react';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onSaved: () => void;
  provider?: any;
}

const SERVICE_TYPE_OPTIONS = [
  { value: 'imprenta', label: 'Imprenta' },
  { value: 'diseno', label: 'Diseño' },
  { value: 'correccion', label: 'Corrección de estilo' },
  { value: 'diagramacion', label: 'Diagramación' },
  { value: 'traduccion', label: 'Traducción' },
  { value: 'isbn', label: 'Gestión ISBN' },
  { value: 'doi', label: 'DOI / Crossref' },
  { value: 'hosting', label: 'Hosting OJS' },
  { value: 'otro', label: 'Otro' },
];

export default function ProviderForm({ isOpen, onClose, onSaved, provider }: Props) {
  const [name, setName] = useState('');
  const [nit, setNit] = useState('');
  const [contactName, setContactName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [serviceTypes, setServiceTypes] = useState<string[]>([]);
  const [status, setStatus] = useState('activo');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (provider) {
      setName(provider.name || '');
      setNit(provider.nit || '');
      setContactName(provider.contact_name || '');
      setPhone(provider.phone || '');
      setEmail(provider.email || '');
      setServiceTypes(provider.service_types || []);
      setStatus(provider.status || 'activo');
      setNotes(provider.notes || '');
    } else {
      setName(''); setNit(''); setContactName(''); setPhone('');
      setEmail(''); setServiceTypes([]); setStatus('activo'); setNotes('');
    }
  }, [provider, isOpen]);

  const toggleServiceType = (val: string) => {
    setServiceTypes(prev => prev.includes(val) ? prev.filter(v => v !== val) : [...prev, val]);
  };

  const handleSave = async () => {
    if (!name.trim()) return;
    setSaving(true);
    const supabase = createClient();
    const data = {
      name: name.trim(),
      nit: nit.trim() || null,
      contact_name: contactName.trim() || null,
      phone: phone.trim() || null,
      email: email.trim() || null,
      service_types: serviceTypes,
      status,
      notes: notes.trim() || null,
    };

    if (provider) {
      await supabase.from('providers').update(data).eq('id', provider.id);
    } else {
      await supabase.from('providers').insert(data);
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
          <h3>{provider ? 'Editar Proveedor' : 'Nuevo Proveedor'}</h3>
          <button className="btn btn-ghost btn-icon" onClick={onClose}><X size={18} /></button>
        </div>
        <div className="modal-body">
          <div className="form-group">
            <label>Nombre / Razón Social *</label>
            <input type="text" value={name} onChange={e => setName(e.target.value)} placeholder="Ej: Imprenta Nacional S.A." />
          </div>
          <div className="form-row">
            <div className="form-group">
              <label>NIT / Cédula</label>
              <input type="text" value={nit} onChange={e => setNit(e.target.value)} placeholder="900.123.456-7" />
            </div>
            <div className="form-group">
              <label>Estado</label>
              <select value={status} onChange={e => setStatus(e.target.value)}>
                <option value="activo">Activo</option>
                <option value="inactivo">Inactivo</option>
              </select>
            </div>
          </div>
          <div className="form-group">
            <label>Persona de Contacto</label>
            <input type="text" value={contactName} onChange={e => setContactName(e.target.value)} />
          </div>
          <div className="form-row">
            <div className="form-group">
              <label>Teléfono</label>
              <input type="text" value={phone} onChange={e => setPhone(e.target.value)} />
            </div>
            <div className="form-group">
              <label>Correo</label>
              <input type="email" value={email} onChange={e => setEmail(e.target.value)} />
            </div>
          </div>
          <div className="form-group">
            <label>Tipos de Servicio</label>
            <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
              {SERVICE_TYPE_OPTIONS.map(opt => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => toggleServiceType(opt.value)}
                  style={{
                    padding: '4px 10px', fontSize: '12px', borderRadius: '12px', border: '1px solid',
                    borderColor: serviceTypes.includes(opt.value) ? 'var(--primary)' : 'var(--gray-200)',
                    background: serviceTypes.includes(opt.value) ? 'var(--primary)' : 'white',
                    color: serviceTypes.includes(opt.value) ? 'white' : 'var(--gray-600)',
                    cursor: 'pointer', fontWeight: 600, transition: 'all 0.15s',
                  }}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>
          <div className="form-group">
            <label>Notas</label>
            <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={2} />
          </div>
        </div>
        <div className="modal-footer">
          <button className="btn btn-secondary" onClick={onClose}>Cancelar</button>
          <button className="btn btn-primary" onClick={handleSave} disabled={saving || !name.trim()}>
            {saving ? 'Guardando...' : provider ? 'Actualizar' : 'Crear Proveedor'}
          </button>
        </div>
      </div>
    </div>
  );
}
