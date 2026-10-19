'use client';

import { useState, useEffect, useCallback } from 'react';
import { Award, Plus, Search, Download, FileText, Calendar, Trash2, Eye, Filter, RefreshCw, FileSpreadsheet, Mail, ClipboardList, User, BarChart3, Pencil, Save, Inbox } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import CertificateForm from '@/components/CertificateForm';
import FormsImportModal from '@/components/FormsImportModal';
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
  requester_name: string | null;
  requester_email: string | null;
  request_channel: 'correo' | 'formulario' | null;
  status: string;
  issue_date: string;
  created_at: string;
}

export default function CertificatesPage() {
  const { hasAccess } = useAuth();
  const [certificates, setCertificates] = useState<Certificate[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [prefillCert, setPrefillCert] = useState<Certificate | null>(null);
  const [showFormsImport, setShowFormsImport] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterCategory, setFilterCategory] = useState<string>('all');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [stats, setStats] = useState<Record<string, number>>({});
  const [deleteTarget, setDeleteTarget] = useState<Certificate | null>(null);
  const [showReport, setShowReport] = useState(false);
  const [editTarget, setEditTarget] = useState<Certificate | null>(null);
  const [editData, setEditData] = useState<{ requester_name: string; requester_email: string; request_channel: string }>({ requester_name: '', requester_email: '', request_channel: '' });
  const [showRequest, setShowRequest] = useState(false);
  const [reqData, setReqData] = useState({
    requester_name: '', requester_email: '', request_channel: '' as string,
    publication_type: 'libro' as string, recipient_name: '', title_reference: '', description: '',
  });
  const [savingReq, setSavingReq] = useState(false);

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

  // Status config
  const STATUS_CONFIG: Record<string, { label: string; bg: string; color: string; icon: string }> = {
    solicitado: { label: 'Solicitado', bg: '#FFF3E0', color: '#E65100', icon: '📥' },
    generado: { label: 'Generado', bg: '#E3F2FD', color: '#1565C0', icon: '📄' },
    en_firma: { label: 'En firma', bg: '#F3E5F5', color: '#7B1FA2', icon: '✍️' },
    atendido: { label: 'Atendido', bg: '#E8F5E9', color: '#2E7D32', icon: '✅' },
    rechazado: { label: 'Rechazado', bg: '#FFEBEE', color: '#C62828', icon: '❌' },
    expedido: { label: 'Expedido', bg: '#E8F5E9', color: '#2E7D32', icon: '✅' },
  };

  const handleStatusChange = async (certId: string, newStatus: string) => {
    const { error } = await supabase.from('certificates').update({ status: newStatus }).eq('id', certId);
    if (!error) {
      setCertificates(prev => prev.map(c => c.id === certId ? { ...c, status: newStatus } : c));
    }
  };

  const filtered = certificates.filter(c => {
    const matchesSearch = !searchQuery || 
      c.recipient_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      c.title_reference?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      c.generated_data?.capitulo_titulo?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      c.description?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      c.requester_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      c.requester_email?.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesFilter = filterCategory === 'all' || c.document_category === filterCategory;
    const matchesStatus = filterStatus === 'all' || c.status === filterStatus;
    return matchesSearch && matchesFilter && matchesStatus;
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

  const openEdit = (cert: Certificate) => {
    setEditTarget(cert);
    setEditData({
      requester_name: cert.requester_name || '',
      requester_email: cert.requester_email || '',
      request_channel: cert.request_channel || '',
    });
  };

  const handleEditSave = async () => {
    if (!editTarget) return;
    const { error } = await supabase.from('certificates').update({
      requester_name: editData.requester_name || null,
      requester_email: editData.requester_email || null,
      request_channel: editData.request_channel || null,
    }).eq('id', editTarget.id);
    if (!error) {
      setCertificates(prev => prev.map(c => c.id === editTarget.id ? {
        ...c,
        requester_name: editData.requester_name || null,
        requester_email: editData.requester_email || null,
        request_channel: (editData.request_channel || null) as any,
      } : c));
    }
    setEditTarget(null);
  };

  const handleSaveRequest = async () => {
    if (!reqData.requester_name.trim()) return;
    setSavingReq(true);
    const { error } = await supabase.from('certificates').insert({
      certificate_type: reqData.publication_type === 'capitulo' ? 'aval-capitulo' : 'aval-libro',
      recipient_name: reqData.recipient_name || reqData.requester_name,
      title_reference: reqData.title_reference || null,
      description: reqData.description || null,
      document_category: 'aval',
      publication_type: reqData.publication_type,
      requester_name: reqData.requester_name,
      requester_email: reqData.requester_email || null,
      request_channel: reqData.request_channel || null,
      status: 'solicitado',
    });
    setSavingReq(false);
    if (!error) {
      setShowRequest(false);
      setReqData({ requester_name: '', requester_email: '', request_channel: '', publication_type: 'libro', recipient_name: '', title_reference: '', description: '' });
      fetchCertificates();
    }
  };

  const handleRegenerate = async (cert: Certificate) => {
    if (cert.certificate_type && cert.generated_data) {
      const data: Record<string, any> = { ...cert.generated_data };

      // Ensure multi-chapter templates have their chapters populated
      if (
        (cert.certificate_type.includes('varios-capitulos') || cert.certificate_type.includes('capitulos')) &&
        (!data.capitulos || !Array.isArray(data.capitulos) || data.capitulos.length === 0)
      ) {
        const bookTitle = data.libro_titulo || cert.title_reference;
        if (bookTitle) {
          try {
            const { data: books } = await supabase
              .from('books')
              .select('id')
              .ilike('title', bookTitle.trim())
              .limit(1);

            const bookId = books?.[0]?.id;
            if (bookId) {
              const { data: chapters } = await supabase
                .from('book_chapters')
                .select('id, title, chapter_number, start_page, end_page')
                .eq('book_id', bookId)
                .order('chapter_number');

              if (chapters && chapters.length > 0) {
                const chIds = chapters.map((c: any) => c.id);
                const { data: authors } = await supabase
                  .from('chapter_authors')
                  .select('chapter_id, author_order, people(full_name)')
                  .in('chapter_id', chIds)
                  .order('author_order');

                data.capitulos = chapters.map((ch: any, idx: number) => {
                  const chAutores = (authors || [])
                    .filter((a: any) => a.chapter_id === ch.id)
                    .map((a: any) => a.people?.full_name)
                    .filter(Boolean)
                    .join(', ');
                  const pags = ch.start_page && ch.end_page ? `${ch.start_page}-${ch.end_page}` : (ch.start_page ? `${ch.start_page}` : '');
                  return {
                    cap_numero: String(ch.chapter_number || idx + 1),
                    cap_titulo: ch.title,
                    cap_autores: chAutores || data.autores || '',
                    paginas: pags,
                    paginas_str: pags ? ` (${pags})` : '',
                  };
                });
              }
            }
          } catch (e) {
            console.error('Error fetching chapters for regenerate:', e);
          }
        }
      }

      await generateCertificate(cert.certificate_type, data, cert.consecutive_number);
      // Auto-update status to 'generado' if still 'solicitado'
      if (cert.status === 'solicitado') {
        handleStatusChange(cert.id, 'generado');
      }
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

  // Compute report data for Libros & Capítulos
  const getReportData = () => {
    const rows = [
      { label: 'Libros', filter: (c: Certificate) => c.publication_type === 'libro' },
      { label: 'Capítulos', filter: (c: Certificate) => c.publication_type === 'capitulo' },
    ];
    return rows.map(r => {
      const items = certificates.filter(r.filter);
      return {
        label: r.label,
        total: items.length,
        atendidas: items.filter(c => c.status === 'atendido' || c.status === 'expedido').length,
        en_proceso: items.filter(c => c.status === 'generado' || c.status === 'en_firma').length,
        pendientes: items.filter(c => c.status === 'solicitado').length,
        rechazadas: items.filter(c => c.status === 'rechazado').length,
      };
    });
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
            <div style={{ display: 'flex', gap: '10px' }}>
              <button
                className="btn btn-secondary"
                onClick={() => setShowRequest(true)}
                style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
              >
                <Inbox size={18} color="#E65100" /> Registrar Solicitud
              </button>
              <button
                className="btn btn-secondary"
                onClick={() => setShowReport(!showReport)}
                style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
              >
                <BarChart3 size={18} /> {showReport ? 'Ocultar Reporte' : 'Reporte'}
              </button>
              <button
                className="btn btn-secondary"
                onClick={() => setShowFormsImport(true)}
                style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
              >
                <FileSpreadsheet size={18} color="#2E7D32" /> Importar de Forms
              </button>
              <button
                className="btn btn-primary"
                onClick={() => setShowForm(true)}
                style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
              >
                <Plus size={18} /> Nuevo Certificado
              </button>
            </div>
          )}
        </div>
      </div>

      <div className="page-content">
        {/* Report Summary Table */}
        {showReport && (
          <div className="card mb-4">
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '14px' }}>
              <BarChart3 size={18} color="#1565C0" />
              <span style={{ fontSize: '15px', fontWeight: 700, color: '#1a1a1a' }}>Reporte de Seguimiento</span>
            </div>
            <div style={{ overflow: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
                <thead>
                  <tr style={{ background: '#f8f9fa', borderBottom: '2px solid #ddd' }}>
                    <th style={{ padding: '10px 16px', textAlign: 'left', fontWeight: 700, color: '#333' }}>Productos</th>
                    <th style={{ padding: '10px 16px', textAlign: 'center', fontWeight: 700, color: '#333' }}>Total solicitudes</th>
                    <th style={{ padding: '10px 16px', textAlign: 'center', fontWeight: 700, color: '#2E7D32' }}>Atendidas</th>
                    <th style={{ padding: '10px 16px', textAlign: 'center', fontWeight: 700, color: '#7B1FA2' }}>En proceso</th>
                    <th style={{ padding: '10px 16px', textAlign: 'center', fontWeight: 700, color: '#E65100' }}>Pendientes</th>
                    <th style={{ padding: '10px 16px', textAlign: 'center', fontWeight: 700, color: '#C62828' }}>Rechazadas</th>
                  </tr>
                </thead>
                <tbody>
                  {getReportData().map(row => (
                    <tr key={row.label} style={{ borderBottom: '1px solid #eee' }}>
                      <td style={{ padding: '10px 16px', fontWeight: 600, color: '#333' }}>{row.label}</td>
                      <td style={{ padding: '10px 16px', textAlign: 'center', fontWeight: 600 }}>{row.total}</td>
                      <td style={{ padding: '10px 16px', textAlign: 'center', color: '#2E7D32', fontWeight: 600 }}>{row.atendidas}</td>
                      <td style={{ padding: '10px 16px', textAlign: 'center', color: '#7B1FA2', fontWeight: 600 }}>{row.en_proceso}</td>
                      <td style={{ padding: '10px 16px', textAlign: 'center', color: '#E65100', fontWeight: 600 }}>{row.pendientes}</td>
                      <td style={{ padding: '10px 16px', textAlign: 'center', color: '#C62828', fontWeight: 600 }}>{row.rechazadas}</td>
                    </tr>
                  ))}
                  {/* Totals row */}
                  {(() => {
                    const data = getReportData();
                    const totals = {
                      total: data.reduce((s, r) => s + r.total, 0),
                      atendidas: data.reduce((s, r) => s + r.atendidas, 0),
                      en_proceso: data.reduce((s, r) => s + r.en_proceso, 0),
                      pendientes: data.reduce((s, r) => s + r.pendientes, 0),
                      rechazadas: data.reduce((s, r) => s + r.rechazadas, 0),
                    };
                    return (
                      <tr style={{ borderTop: '2px solid #333', background: '#f8f9fa' }}>
                        <td style={{ padding: '10px 16px', fontWeight: 800, color: '#111' }}>TOTAL</td>
                        <td style={{ padding: '10px 16px', textAlign: 'center', fontWeight: 800 }}>{totals.total}</td>
                        <td style={{ padding: '10px 16px', textAlign: 'center', fontWeight: 800, color: '#2E7D32' }}>{totals.atendidas}</td>
                        <td style={{ padding: '10px 16px', textAlign: 'center', fontWeight: 800, color: '#7B1FA2' }}>{totals.en_proceso}</td>
                        <td style={{ padding: '10px 16px', textAlign: 'center', fontWeight: 800, color: '#E65100' }}>{totals.pendientes}</td>
                        <td style={{ padding: '10px 16px', textAlign: 'center', fontWeight: 800, color: '#C62828' }}>{totals.rechazadas}</td>
                      </tr>
                    );
                  })()}
                </tbody>
              </table>
            </div>
          </div>
        )}

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
            <select
              value={filterStatus}
              onChange={e => setFilterStatus(e.target.value)}
              style={{
                padding: '10px 14px', borderRadius: '10px', border: '1px solid #ddd',
                fontSize: '13px', background: 'white', cursor: 'pointer', outline: 'none',
              }}
            >
              <option value="all">Todos los estados</option>
              {Object.entries(STATUS_CONFIG).map(([key, cfg]) => (
                <option key={key} value={key}>{cfg.icon} {cfg.label}</option>
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
                    <th style={{ padding: '12px 16px', textAlign: 'left', fontWeight: 600, color: '#555', fontSize: '11px', textTransform: 'uppercase' }}>Solicitante</th>
                    <th style={{ padding: '12px 16px', textAlign: 'left', fontWeight: 600, color: '#555', fontSize: '11px', textTransform: 'uppercase' }}>Estado</th>
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
                      <td style={{ padding: '12px 16px' }}>
                        {cert.requester_name ? (
                          <div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '12px', fontWeight: 500, color: '#333' }}>
                              <User size={11} color="#888" /> {cert.requester_name}
                            </div>
                            {cert.requester_email && (
                              <div style={{ fontSize: '10px', color: '#888', marginTop: '2px' }}>{cert.requester_email}</div>
                            )}
                            {cert.request_channel && (
                              <span style={{
                                display: 'inline-flex', alignItems: 'center', gap: '3px',
                                marginTop: '3px', padding: '1px 6px', borderRadius: '8px', fontSize: '10px', fontWeight: 600,
                                background: cert.request_channel === 'formulario' ? '#E8F5E9' : '#E3F2FD',
                                color: cert.request_channel === 'formulario' ? '#2E7D32' : '#1565C0',
                              }}>
                                {cert.request_channel === 'formulario' ? <ClipboardList size={9} /> : <Mail size={9} />}
                                {cert.request_channel === 'formulario' ? 'Formulario' : 'Correo'}
                              </span>
                            )}
                          </div>
                        ) : (
                          <span style={{ color: '#ccc', fontSize: '11px' }}>—</span>
                        )}
                      </td>
                      <td style={{ padding: '12px 16px' }}>
                        {hasAccess('certificates') ? (
                          <select
                            value={cert.status}
                            onChange={e => handleStatusChange(cert.id, e.target.value)}
                            style={{
                              padding: '4px 8px', borderRadius: '8px', fontSize: '11px', fontWeight: 600,
                              border: '1px solid #ddd', cursor: 'pointer', outline: 'none',
                              background: STATUS_CONFIG[cert.status]?.bg || '#f5f5f5',
                              color: STATUS_CONFIG[cert.status]?.color || '#666',
                            }}
                          >
                            {Object.entries(STATUS_CONFIG).map(([key, cfg]) => (
                              <option key={key} value={key}>{cfg.icon} {cfg.label}</option>
                            ))}
                          </select>
                        ) : (
                          <span style={{
                            display: 'inline-flex', alignItems: 'center', gap: '3px',
                            padding: '2px 8px', borderRadius: '8px', fontSize: '11px', fontWeight: 600,
                            background: STATUS_CONFIG[cert.status]?.bg || '#f5f5f5',
                            color: STATUS_CONFIG[cert.status]?.color || '#666',
                          }}>
                            {STATUS_CONFIG[cert.status]?.icon} {STATUS_CONFIG[cert.status]?.label || cert.status}
                          </span>
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
                          {hasAccess('certificates') && cert.status === 'solicitado' && (
                            <button
                              onClick={() => { setPrefillCert(cert); setShowForm(true); }}
                              title="Generar certificado"
                              style={{
                                background: '#E3F2FD', border: 'none', borderRadius: '8px',
                                padding: '6px 8px', cursor: 'pointer', color: '#1565C0',
                              }}
                            >
                              <FileText size={14} />
                            </button>
                          )}
                          {hasAccess('certificates') && (
                            <button
                              onClick={() => openEdit(cert)}
                              title="Editar solicitud"
                              style={{
                                background: '#FFF3E0', border: 'none', borderRadius: '8px',
                                padding: '6px 8px', cursor: 'pointer', color: '#E65100',
                              }}
                            >
                              <Pencil size={14} />
                            </button>
                          )}
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
          onClose={() => { setShowForm(false); setPrefillCert(null); }}
          onGenerated={() => { setShowForm(false); setPrefillCert(null); fetchCertificates(); }}
          prefillData={prefillCert ? {
            solicitudId: prefillCert.id,
            consecutive_number: prefillCert.consecutive_number,
            recipientName: prefillCert.recipient_name,
            titleReference: prefillCert.title_reference || '',
            description: prefillCert.description || '',
            certificateType: prefillCert.certificate_type,
            publicationType: prefillCert.publication_type || 'libro',
            documentCategory: prefillCert.document_category || undefined,
            requesterName: prefillCert.requester_name || '',
            requesterEmail: prefillCert.requester_email || '',
            requestChannel: prefillCert.request_channel || '',
          } : undefined}
        />
      )}

      {/* Microsoft Forms Import Modal */}
      {showFormsImport && (
        <FormsImportModal
          onClose={() => setShowFormsImport(false)}
          onImportComplete={() => {
            fetchCertificates();
          }}
        />
      )}

      {/* Request Registration Modal */}
      {showRequest && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(4px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          zIndex: 1000, padding: '20px',
        }}>
          <div style={{
            background: 'white', borderRadius: '16px', width: '100%', maxWidth: '560px',
            boxShadow: '0 20px 60px rgba(0,0,0,0.2)',
          }}>
            {/* Header */}
            <div style={{
              padding: '20px 24px', borderBottom: '1px solid #eee',
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            }}>
              <div>
                <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 700, color: '#1a1a1a', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Inbox size={18} color="#E65100" /> Registrar Solicitud
                </h3>
                <div style={{ fontSize: '12px', color: '#666', marginTop: '4px' }}>
                  Registra una solicitud de certificado para atenderla después
                </div>
              </div>
              <button onClick={() => setShowRequest(false)} style={{ border: 'none', background: '#f5f5f5', borderRadius: '8px', padding: '8px', cursor: 'pointer' }}>
                ✕
              </button>
            </div>

            {/* Body */}
            <div style={{ padding: '24px', display: 'grid', gap: '14px' }}>
              {/* Requester info */}
              <div style={{ padding: '14px 16px', borderRadius: '10px', background: '#FFF3E0', border: '1px solid #FFE0B2' }}>
                <div style={{ fontSize: '12px', fontWeight: 700, color: '#E65100', marginBottom: '10px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <User size={14} /> ¿Quién solicita?
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '11px', fontWeight: 600, color: '#555', marginBottom: '3px' }}>
                      Nombre del profesor <span style={{ color: '#E53935' }}>*</span>
                    </label>
                    <input
                      type="text"
                      value={reqData.requester_name}
                      onChange={e => setReqData(prev => ({ ...prev, requester_name: e.target.value }))}
                      placeholder="Nombre completo"
                      style={{
                        width: '100%', padding: '9px 12px', borderRadius: '8px',
                        border: '1px solid #ddd', fontSize: '13px', outline: 'none',
                        boxSizing: 'border-box',
                      }}
                    />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '11px', fontWeight: 600, color: '#555', marginBottom: '3px' }}>
                      Correo
                    </label>
                    <input
                      type="email"
                      value={reqData.requester_email}
                      onChange={e => setReqData(prev => ({ ...prev, requester_email: e.target.value }))}
                      placeholder="correo@unisimon.edu.co"
                      style={{
                        width: '100%', padding: '9px 12px', borderRadius: '8px',
                        border: '1px solid #ddd', fontSize: '13px', outline: 'none',
                        boxSizing: 'border-box',
                      }}
                    />
                  </div>
                </div>
                <div style={{ marginTop: '8px' }}>
                  <label style={{ display: 'block', fontSize: '11px', fontWeight: 600, color: '#555', marginBottom: '3px' }}>
                    Medio de solicitud
                  </label>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    {(['correo', 'formulario'] as const).map(ch => (
                      <button
                        key={ch}
                        type="button"
                        onClick={() => setReqData(prev => ({ ...prev, request_channel: prev.request_channel === ch ? '' : ch }))}
                        style={{
                          display: 'flex', alignItems: 'center', gap: '5px',
                          padding: '6px 14px', borderRadius: '8px', fontSize: '12px', fontWeight: 600,
                          border: reqData.request_channel === ch ? '2px solid var(--primary)' : '1px solid #ddd',
                          background: reqData.request_channel === ch ? '#E8F5E9' : 'white',
                          color: reqData.request_channel === ch ? '#2E7D32' : '#666',
                          cursor: 'pointer',
                        }}
                      >
                        {ch === 'correo' ? <Mail size={13} /> : <ClipboardList size={13} />}
                        {ch === 'correo' ? 'Correo' : 'Formulario'}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* What is being requested */}
              <div style={{ padding: '14px 16px', borderRadius: '10px', background: '#FAFAFA', border: '1px solid #eee' }}>
                <div style={{ fontSize: '12px', fontWeight: 700, color: '#666', marginBottom: '10px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <FileText size={14} color="#888" /> ¿Qué solicita?
                </div>
                <div style={{ marginBottom: '10px' }}>
                  <label style={{ display: 'block', fontSize: '11px', fontWeight: 600, color: '#555', marginBottom: '3px' }}>
                    Tipo de producto
                  </label>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    {([{ key: 'libro', label: '📚 Libro' }, { key: 'capitulo', label: '📑 Capítulo' }] as const).map(opt => (
                      <button
                        key={opt.key}
                        type="button"
                        onClick={() => setReqData(prev => ({ ...prev, publication_type: opt.key }))}
                        style={{
                          padding: '7px 16px', borderRadius: '8px', fontSize: '12px', fontWeight: 600,
                          border: reqData.publication_type === opt.key ? '2px solid var(--primary)' : '1px solid #ddd',
                          background: reqData.publication_type === opt.key ? '#E8F5E9' : 'white',
                          color: reqData.publication_type === opt.key ? '#2E7D32' : '#666',
                          cursor: 'pointer',
                        }}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                </div>
                <div style={{ marginBottom: '10px' }}>
                  <label style={{ display: 'block', fontSize: '11px', fontWeight: 600, color: '#555', marginBottom: '3px' }}>
                    Destinatario del certificado <span style={{ fontSize: '10px', color: '#aaa' }}>(si es diferente al solicitante)</span>
                  </label>
                  <input
                    type="text"
                    value={reqData.recipient_name}
                    onChange={e => setReqData(prev => ({ ...prev, recipient_name: e.target.value }))}
                    placeholder="Dejar vacío si es el mismo profesor"
                    style={{
                      width: '100%', padding: '9px 12px', borderRadius: '8px',
                      border: '1px solid #ddd', fontSize: '13px', outline: 'none',
                      boxSizing: 'border-box',
                    }}
                  />
                </div>
                <div style={{ marginBottom: '10px' }}>
                  <label style={{ display: 'block', fontSize: '11px', fontWeight: 600, color: '#555', marginBottom: '3px' }}>
                    Título del libro o publicación
                  </label>
                  <input
                    type="text"
                    value={reqData.title_reference}
                    onChange={e => setReqData(prev => ({ ...prev, title_reference: e.target.value }))}
                    placeholder="Título de la obra"
                    style={{
                      width: '100%', padding: '9px 12px', borderRadius: '8px',
                      border: '1px solid #ddd', fontSize: '13px', outline: 'none',
                      boxSizing: 'border-box',
                    }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '11px', fontWeight: 600, color: '#555', marginBottom: '3px' }}>
                    Notas / Observaciones
                  </label>
                  <textarea
                    rows={2}
                    value={reqData.description}
                    onChange={e => setReqData(prev => ({ ...prev, description: e.target.value }))}
                    placeholder="Cualquier detalle adicional de la solicitud..."
                    style={{
                      width: '100%', padding: '9px 12px', borderRadius: '8px',
                      border: '1px solid #ddd', fontSize: '13px', outline: 'none',
                      boxSizing: 'border-box', resize: 'vertical',
                    }}
                  />
                </div>
              </div>
            </div>

            {/* Footer */}
            <div style={{
              padding: '16px 24px', borderTop: '1px solid #eee',
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            }}>
              <div style={{ fontSize: '11px', color: '#888', display: 'flex', alignItems: 'center', gap: '4px' }}>
                📥 Se registrará como <span style={{ fontWeight: 700, color: '#E65100' }}>Solicitado</span>
              </div>
              <div style={{ display: 'flex', gap: '10px' }}>
                <button
                  onClick={() => setShowRequest(false)}
                  style={{
                    padding: '9px 18px', borderRadius: '10px',
                    border: '1px solid #ddd', background: 'white',
                    fontSize: '13px', fontWeight: 600, cursor: 'pointer', color: '#555',
                  }}
                >
                  Cancelar
                </button>
                <button
                  onClick={handleSaveRequest}
                  disabled={!reqData.requester_name.trim() || savingReq}
                  style={{
                    display: 'flex', alignItems: 'center', gap: '6px',
                    padding: '9px 20px', borderRadius: '10px',
                    border: 'none',
                    background: reqData.requester_name.trim() ? 'var(--primary)' : '#ccc',
                    color: 'white', fontSize: '13px', fontWeight: 700,
                    cursor: reqData.requester_name.trim() ? 'pointer' : 'not-allowed',
                    boxShadow: reqData.requester_name.trim() ? '0 4px 12px rgba(9,132,59,0.3)' : 'none',
                  }}
                >
                  <Inbox size={14} /> {savingReq ? 'Guardando...' : 'Registrar Solicitud'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Edit Modal */}
      {editTarget && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(4px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          zIndex: 1000, padding: '20px',
        }}>
          <div style={{
            background: 'white', borderRadius: '16px', width: '100%', maxWidth: '520px',
            boxShadow: '0 20px 60px rgba(0,0,0,0.2)',
          }}>
            {/* Header */}
            <div style={{
              padding: '20px 24px', borderBottom: '1px solid #eee',
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            }}>
              <div>
                <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 700, color: '#1a1a1a', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Pencil size={18} color="#E65100" /> Editar Certificado
                </h3>
                <div style={{ fontSize: '12px', color: '#666', marginTop: '4px' }}>
                  {editTarget.recipient_name} — {editTarget.title_reference || 'Sin título'}
                </div>
              </div>
              <button onClick={() => setEditTarget(null)} style={{ border: 'none', background: '#f5f5f5', borderRadius: '8px', padding: '8px', cursor: 'pointer' }}>
                ✕
              </button>
            </div>

            {/* Body */}
            <div style={{ padding: '24px', display: 'grid', gap: '16px' }}>
              <div style={{
                padding: '12px 14px', borderRadius: '10px',
                background: '#FAFAFA', border: '1px solid #eee',
              }}>
                <div style={{ fontSize: '12px', fontWeight: 700, color: '#666', marginBottom: '10px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <User size={14} color="#888" /> Datos de solicitud
                </div>
                <div style={{ display: 'grid', gap: '10px' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '11px', fontWeight: 600, color: '#555', marginBottom: '3px' }}>
                      Profesor solicitante
                    </label>
                    <input
                      type="text"
                      value={editData.requester_name}
                      onChange={e => setEditData(prev => ({ ...prev, requester_name: e.target.value }))}
                      placeholder="Nombre del profesor"
                      style={{
                        width: '100%', padding: '9px 12px', borderRadius: '8px',
                        border: '1px solid #ddd', fontSize: '13px', outline: 'none',
                        boxSizing: 'border-box',
                      }}
                    />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '11px', fontWeight: 600, color: '#555', marginBottom: '3px' }}>
                      Correo del solicitante
                    </label>
                    <input
                      type="email"
                      value={editData.requester_email}
                      onChange={e => setEditData(prev => ({ ...prev, requester_email: e.target.value }))}
                      placeholder="correo@unisimon.edu.co"
                      style={{
                        width: '100%', padding: '9px 12px', borderRadius: '8px',
                        border: '1px solid #ddd', fontSize: '13px', outline: 'none',
                        boxSizing: 'border-box',
                      }}
                    />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '11px', fontWeight: 600, color: '#555', marginBottom: '3px' }}>
                      Medio de solicitud
                    </label>
                    <div style={{ display: 'flex', gap: '8px' }}>
                      {(['correo', 'formulario'] as const).map(ch => (
                        <button
                          key={ch}
                          type="button"
                          onClick={() => setEditData(prev => ({ ...prev, request_channel: prev.request_channel === ch ? '' : ch }))}
                          style={{
                            display: 'flex', alignItems: 'center', gap: '5px',
                            padding: '7px 16px', borderRadius: '8px', fontSize: '12px', fontWeight: 600,
                            border: editData.request_channel === ch ? '2px solid var(--primary)' : '1px solid #ddd',
                            background: editData.request_channel === ch ? '#E8F5E9' : 'white',
                            color: editData.request_channel === ch ? '#2E7D32' : '#666',
                            cursor: 'pointer', transition: 'all 0.15s',
                          }}
                        >
                          {ch === 'correo' ? <Mail size={13} /> : <ClipboardList size={13} />}
                          {ch === 'correo' ? 'Correo' : 'Formulario'}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Footer */}
            <div style={{
              padding: '16px 24px', borderTop: '1px solid #eee',
              display: 'flex', justifyContent: 'flex-end', gap: '10px',
            }}>
              <button
                onClick={() => setEditTarget(null)}
                style={{
                  padding: '9px 18px', borderRadius: '10px',
                  border: '1px solid #ddd', background: 'white',
                  fontSize: '13px', fontWeight: 600, cursor: 'pointer', color: '#555',
                }}
              >
                Cancelar
              </button>
              <button
                onClick={handleEditSave}
                style={{
                  display: 'flex', alignItems: 'center', gap: '6px',
                  padding: '9px 20px', borderRadius: '10px',
                  border: 'none', background: 'var(--primary)',
                  color: 'white', fontSize: '13px', fontWeight: 700, cursor: 'pointer',
                  boxShadow: '0 4px 12px rgba(9,132,59,0.3)',
                }}
              >
                <Save size={14} /> Guardar
              </button>
            </div>
          </div>
        </div>
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
