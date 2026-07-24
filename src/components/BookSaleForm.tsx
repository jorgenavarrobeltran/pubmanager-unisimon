'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import { X } from 'lucide-react';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onSaved: () => void;
  bookId?: string;
  sale?: any;
}

const CHANNELS = [
  { value: 'directo', label: '🏢 Venta Directa' },
  { value: 'libreria', label: '📚 Librería' },
  { value: 'feria', label: '🎪 Feria del Libro' },
  { value: 'online', label: '🌐 Online' },
];

export default function BookSaleForm({ isOpen, onClose, onSaved, bookId, sale }: Props) {
  const [bId, setBId] = useState(bookId || '');
  const [quantity, setQuantity] = useState('1');
  const [unitPrice, setUnitPrice] = useState('');
  const [buyer, setBuyer] = useState('');
  const [date, setDate] = useState(new Date().toISOString().substring(0, 10));
  const [channel, setChannel] = useState('directo');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const [books, setBooks] = useState<any[]>([]);

  useEffect(() => {
    async function loadBooks() {
      const supabase = createClient();
      const { data } = await supabase.from('books').select('id, title').order('title');
      setBooks(data || []);
    }
    if (isOpen) loadBooks();
  }, [isOpen]);

  useEffect(() => {
    if (sale) {
      setBId(sale.book_id || '');
      setQuantity(sale.quantity?.toString() || '1');
      setUnitPrice(sale.unit_price?.toString() || '');
      setBuyer(sale.buyer || '');
      setDate(sale.date || new Date().toISOString().substring(0, 10));
      setChannel(sale.channel || 'directo');
      setNotes(sale.notes || '');
    } else {
      setBId(bookId || ''); setQuantity('1'); setUnitPrice('');
      setBuyer(''); setDate(new Date().toISOString().substring(0, 10));
      setChannel('directo'); setNotes('');
    }
  }, [sale, isOpen, bookId]);

  const total = (parseInt(quantity) || 0) * (parseFloat(unitPrice) || 0);

  const handleSave = async () => {
    if (!bId || !unitPrice) return;
    setSaving(true);
    const supabase = createClient();
    const data = {
      book_id: bId,
      quantity: parseInt(quantity) || 1,
      unit_price: parseFloat(unitPrice),
      total_amount: total,
      buyer: buyer.trim() || null,
      date,
      channel,
      notes: notes.trim() || null,
    };
    if (sale) {
      await supabase.from('book_sales').update(data).eq('id', sale.id);
    } else {
      await supabase.from('book_sales').insert(data);
    }
    setSaving(false);
    onSaved();
    onClose();
  };

  const formatCOP = (a: number) => new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(a);

  if (!isOpen) return null;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: '500px' }}>
        <div className="modal-header">
          <h3>{sale ? 'Editar Venta' : 'Registrar Venta de Libro'}</h3>
          <button className="btn btn-ghost btn-icon" onClick={onClose}><X size={18} /></button>
        </div>
        <div className="modal-body">
          {!bookId && (
            <div className="form-group">
              <label>Libro *</label>
              <select value={bId} onChange={e => setBId(e.target.value)}>
                <option value="">Seleccionar libro...</option>
                {books.map(b => <option key={b.id} value={b.id}>{b.title}</option>)}
              </select>
            </div>
          )}
          <div className="form-row">
            <div className="form-group">
              <label>Cantidad *</label>
              <input type="number" min="1" value={quantity} onChange={e => setQuantity(e.target.value)} />
            </div>
            <div className="form-group">
              <label>Precio Unitario (COP) *</label>
              <input type="number" value={unitPrice} onChange={e => setUnitPrice(e.target.value)} placeholder="50000" />
            </div>
          </div>
          {total > 0 && (
            <div style={{
              padding: '10px 14px', background: '#E8F5E9', borderRadius: 'var(--radius-md)',
              marginBottom: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            }}>
              <span style={{ fontSize: '13px', color: '#2E7D32', fontWeight: 600 }}>Total</span>
              <span style={{ fontSize: '18px', fontWeight: 800, color: '#2E7D32' }}>{formatCOP(total)}</span>
            </div>
          )}
          <div className="form-row">
            <div className="form-group">
              <label>Comprador</label>
              <input type="text" value={buyer} onChange={e => setBuyer(e.target.value)} placeholder="Nombre del comprador" />
            </div>
            <div className="form-group">
              <label>Canal</label>
              <select value={channel} onChange={e => setChannel(e.target.value)}>
                {CHANNELS.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
              </select>
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
          <button className="btn btn-primary" onClick={handleSave} disabled={saving || !bId || !unitPrice}>
            {saving ? 'Guardando...' : sale ? 'Actualizar' : 'Registrar Venta'}
          </button>
        </div>
      </div>
    </div>
  );
}
