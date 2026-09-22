'use client';

import { useState, useEffect, useCallback } from 'react';
import { Award, Plus, Search, Download, FileText, Calendar, Trash2, Eye, Filter, RefreshCw } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import CertificateForm from '@/components/CertificateForm';
import ConfirmDialog from '@/components/ConfirmDialog';
import { CATEGORY_LABELS, CATEGORY_COLORS, type CertificateCategory } from '@/lib/certificateTemplateMap';
import { generateCertificate } from '@/lib/certificateGenerator';

interface Certificate {
  id: string;
  certificate_type: string;
  consecutive_number: number;
  recipient_name: string;
  recipient_cedula: string | null;
  title_reference: string | null;
  description: string | null;
  document_category: CertificateCategory | null;
  publication_type: string | null;
  editorial_type: string | null;
  template_file: string | null;
  generated_data: Record<string, string> | null;
  status: string;
  issue_date: string;
  created_at: string;
}

export default function CertificatesPage() {
  const { hasAccess } = useAuth();
  const [certificates, setCertificates] = useState<Certificate[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterCategory, setFilterCategory] = useState<string>('all');
  const [stats, setStats] = useState<Record<string, number>>({});
  const [deleteTarget, setDeleteTarget] = useState<Certificate | null>(null);

  const supabase = createClient();

  const fetchCertificates = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('certificates')
      .select('*')
      .order('created_at', { ascending: false });

    if (!error && data) {
      setCertificates(data);
      // Compute stats
      const s: Record<string, number> = {};
      (Object.keys(CATEGORY_LABELS) as CertificateCategory[]).forEach(cat => {
        s[cat] = data.filter((c: any) => c.document_category === cat).length;
      });
      s.total = data.length;
      setStats(s);
    }
    setLoading(false);
  }, []);

  useEffect(() => { fetchCertificates(); }, [fetchCertificates]);

  const filtered = certificates.filter(c => {
    const matchesSearch = !searchQuery || 
      c.recipient_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      c.title_reference?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      c.generated_data?.capitulo_titulo?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      c.description?.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesFilter = filterCategory === 'all' || c.document_category === filterCategory;
    return matchesSearch && matchesFilter;
  });

  const handleDelete = async () => {
    if (!deleteTarget) return;
    const { error } = await supabase.from('certificates').delete().eq('id', deleteTarget.id);
    if (error) {
      console.error('Error deleting certificate:', error);
      alert(`Error al eliminar: ${error.message}`);
    }
    setDeleteTarget(null);
    fetchCertificates();
  };

  const handleRegenerate = async (cert: Certificate) => {
    if (cert.certificate_type && cert.generated_data) {
      await generateCertificate(cert.certificate_type, cert.generated_data);
    }
  };

  const getCategoryBadge = (cat: CertificateCategory | null) => {
    if (!cat || !CATEGORY_COLORS[cat]) return null;
    const info = CATEGORY_COLORS[cat];
    return (
      <span style={{
        display: 'inline-flex', alignItems: 'center', gap: '4px',
        padding: '3px 10px', borderRadius: '20px', fontSize: '11px',
        fontWeight: 600, background: info.bg, color: info.color,
      }}>
        {info.icon} {CATEGORY_LABELS[cat]}
      </span>
    );
  };

  return (
    <>
      <div className="page-header">
        <div className="flex items-center justify-between">
          <div>
            <h2>Certificados</h2>
            <p>Generación y registro de certificados para libros, capítulos y evaluaciones</p>
          </div>
          {hasAccess('certificates') && (
            <button className="btn btn-primary" onClick={() => setShowForm(true)}>
              <Plus size={18} /> Nuevo Certificado
            </button>
          )}
        </div>
      </div>

      <div className="page-content">
        {/* Stats Grid */}
        <div className="stats-grid mb-6">
          {(Object.keys(CATEGORY_LABELS) as CertificateCategory[]).map(cat => {
            const info = CATEGORY_COLORS[cat];
            return (
              <div key={cat} className="stat-card" onClick={() => setFilterCategory(filterCategory === cat ? 'all' : cat)} style={{ cursor: 'pointer', border: filterCategory === cat ? `2px solid ${info.color}` : undefined }}>
                <div className="stat-icon" style={{ background: info.bg }}>
                  <span style={{ fontSize: '22px' }}>{info.icon}</span>
                </div>
                <div className="stat-info">
                  <h4>{CATEGORY_LABELS[cat]}</h4>
                  <div className="stat-value">{stats[cat] || 0}</div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Search and Filter Bar */}
        <div className="card mb-4">
          <div style={{ display: 'flex', gap: '12px', alignItems: 'center', flexWrap: 'wrap' }}>
            <div style={{ flex: 1, minWidth: '200px', position: 'relative' }}>
              <Search size={16} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#999' }} />
              <input
                type="text"
                placeholder="Buscar por destinatario, libro, capítulo..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                style={{
                  width: '100%', padding: '10px 12px 10px 36px', borderRadius: '10px',
                  border: '1px solid #ddd', fontSize: '13px', outline: 'none',
                  boxSizing: 'border-box',
                }}
              />
            </div>
            <select
              value={filterCategory}
              onChange={e => setFilterCategory(e.target.value)}
              style={{
                padding: '10px 14px', borderRadius: '10px', border: '1px solid #ddd',
                fontSize: '13px', background: 'white', cursor: 'pointer', outline: 'none',
              }}
            >
              <option value="all">Todas las categorías</option>
              {(Object.keys(CATEGORY_LABELS) as CertificateCategory[]).map(cat => (
                <option key={cat} value={cat}>{CATEGORY_LABELS[cat]}</option>
              ))}
            </select>
            <button onClick={fetchCertificates} className="btn btn-secondary" style={{ padding: '10px 14px' }}>
              <RefreshCw size={16} />
            </button>
          </div>
        </div>

        {/* Certificates Table */}
        <div className="card">
          {loading ? (
            <div style={{ padding: '40px', textAlign: 'center', color: '#888' }}>
              <RefreshCw size={24} style={{ animation: 'spin 1s linear infinite', margin: '0 auto 12px' }} />
              <p>Cargando certificados...</p>
            </div>
          ) : filtered.length === 0 ? (
            <div className="empty-state">
              <div className="empty-icon">📜</div>
              <h3>{certificates.length === 0 ? 'Sin certificados' : 'Sin resultados'}</h3>
              <p>
                {certificates.length === 0
                  ? 'Genera tu primer certificado usando los templates institucionales de la USB.'
                  : 'No se encontraron certificados con los filtros actuales.'}
              </p>
              {certificates.length === 0 && hasAccess('certificates') && (
                <button className="btn btn-primary" onClick={() => setShowForm(true)}>
                  <Plus size={16} /> Generar Certificado
                </button>
              )}
            </div>
          ) : (
            <div style={{ overflow: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
                <thead>
                  <tr style={{ borderBottom: '2px solid #eee' }}>
                    <th style={{ padding: '12px 16px', textAlign: 'left', fontWeight: 600, color: '#555', fontSize: '11px', textTransform: 'uppercase' }}>#</th>
                    <th style={{ padding: '12px 16px', textAlign: 'left', fontWeight: 600, color: '#555', fontSize: '11px', textTransform: 'uppercase' }}>Categoría</th>
                    <th style={{ padding: '12px 16px', textAlign: 'left', fontWeight: 600, color: '#555', fontSize: '11px', textTransform: 'uppercase' }}>Destinatario</th>
                    <th style={{ padding: '12px 16px', textAlign: 'left', fontWeight: 600, color: '#555', fontSize: '11px', textTransform: 'uppercase' }}>Publicación</th>
                    <th style={{ padding: '12px 16px', textAlign: 'left', fontWeight: 600, color: '#555', fontSize: '11px', textTransform: 'uppercase' }}>Fecha</th>
                    <th style={{ padding: '12px 16px', textAlign: 'right', fontWeight: 600, color: '#555', fontSize: '11px', textTransform: 'uppercase' }}>Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((cert, i) => (
                    <tr key={cert.id} style={{
                      borderBottom: '1px solid #f0f0f0',
                      transition: 'background 0.15s',
                    }}
                    onMouseOver={e => (e.currentTarget.style.background = '#fafafa')}
                    onMouseOut={e => (e.currentTarget.style.background = 'transparent')}
                    >
                      <td style={{ padding: '12px 16px', color: '#999', fontWeight: 500 }}>
                        {cert.consecutive_number || i + 1}
                      </td>
                      <td style={{ padding: '12px 16px' }}>
                        {getCategoryBadge(cert.document_category)}
                      </td>
                      <td style={{ padding: '12px 16px' }}>
                        <div style={{ fontWeight: 600, color: '#333' }}>{cert.recipient_name}</div>
                        {cert.description && (
                          <div style={{ fontSize: '11px', color: '#888', marginTop: '2px' }}>{cert.description}</div>
                        )}
                      </td>
                      <td style={{ padding: '12px 16px' }}>
                        <div style={{ color: '#333', maxWidth: '220px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {cert.title_reference || cert.generated_data?.libro_titulo || '—'}
                        </div>
                        {cert.generated_data?.capitulo_titulo && (
                          <div style={{ fontSize: '11px', color: '#888', marginTop: '2px', maxWidth: '220px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            Cap: {cert.generated_data.capitulo_titulo}
                          </div>
                        )}
                      </td>
                      <td style={{ padding: '12px 16px', color: '#666', whiteSpace: 'nowrap' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                          <Calendar size={12} />
                          {new Date(cert.created_at).toLocaleDateString('es-CO')}
                        </div>
                      </td>
                      <td style={{ padding: '12px 16px', textAlign: 'right' }}>
                        <div style={{ display: 'flex', gap: '6px', justifyContent: 'flex-end' }}>
                          {cert.generated_data && (
                            <button
                              onClick={() => handleRegenerate(cert)}
                              title="Descargar de nuevo"
                              style={{
                                background: '#E8F5E9', border: 'none', borderRadius: '8px',
                                padding: '6px 8px', cursor: 'pointer', color: '#2E7D32',
                              }}
                            >
                              <Download size={14} />
                            </button>
                          )}
                          {hasAccess('certificates') && (
                            <button
                              onClick={() => setDeleteTarget(cert)}
                              title="Eliminar"
                              style={{
                                background: '#FFEBEE', border: 'none', borderRadius: '8px',
                                padding: '6px 8px', cursor: 'pointer', color: '#C62828',
                              }}
                            >
                              <Trash2 size={14} />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* Certificate Form Modal */}
      {showForm && (
        <CertificateForm
          onClose={() => setShowForm(false)}
          onGenerated={() => { setShowForm(false); fetchCertificates(); }}
        />
      )}

      {/* Delete Confirmation */}
      {deleteTarget && (
        <ConfirmDialog
          isOpen={!!deleteTarget}
          title="Eliminar certificado"
          message={`¿Estás seguro de eliminar el certificado para "${deleteTarget.recipient_name}"? Esta acción no se puede deshacer.`}
          onConfirm={handleDelete}
          onClose={() => setDeleteTarget(null)}
        />
      )}
    </>
  );
}
