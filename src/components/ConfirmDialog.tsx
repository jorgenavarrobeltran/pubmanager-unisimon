'use client';

import Modal from '@/components/Modal';
import { AlertTriangle } from 'lucide-react';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  message: string;
  loading?: boolean;
}

export default function ConfirmDialog({ isOpen, onClose, onConfirm, title, message, loading }: Props) {
  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={title}
      size="sm"
      footer={
        <>
          <button className="btn btn-secondary" onClick={onClose} disabled={loading}>Cancelar</button>
          <button
            className="btn"
            style={{ background: 'var(--error)', color: 'white' }}
            onClick={onConfirm}
            disabled={loading}
          >
            {loading ? 'Eliminando...' : 'Eliminar'}
          </button>
        </>
      }
    >
      <div style={{ display: 'flex', gap: '16px', alignItems: 'flex-start' }}>
        <div style={{
          width: '48px', height: '48px', borderRadius: '50%',
          background: '#FFEBEE', display: 'flex', alignItems: 'center',
          justifyContent: 'center', flexShrink: 0,
        }}>
          <AlertTriangle size={24} color="var(--error)" />
        </div>
        <p style={{ fontSize: '14px', color: 'var(--gray-600)', lineHeight: 1.6 }}>
          {message}
        </p>
      </div>
    </Modal>
  );
}
