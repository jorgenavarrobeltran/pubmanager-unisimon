'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { FileText, Search, Plus, X, Download, Trash2, FileSpreadsheet, File, User } from 'lucide-react';

interface Policy {
  id: string;
  title: string;
  description: string | null;
  category: string;
  file_url: string;
  file_name: string;
  version: string | null;
  uploaded_by: string | null;
  created_at: string;
  updated_at: string;
}

interface UserProfile {
  id: string;
  full_name: string | null;
  email: string;
}

const CATEGORIES = [
  { value: 'general', label: 'General' },
  { value: 'revistas', label: 'Revistas' },
  { value: 'libros', label: 'Libros' },
  { value: 'administrativo', label: 'Administrativo' },
  { value: 'formatos', label: 'Formatos / Plantillas' },
];

export default function PoliciesPage() {
  const { profile, isReadOnly: checkReadOnly } = useAuth();
  const [policies, setPolicies] = useState<Policy[]>([]);
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterCategory, setFilterCategory] = useState('');

  // Modal
  const [showModal, setShowModal] = useState(false);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('general');
  const [version, setVersion] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);

  const isReadOnly = checkReadOnly('policies');

  const loadData = async () => {
    setLoading(true);
    const supabase = createClient();
    
    const [pRes, uRes] = await Promise.all([
      supabase.from('policies').select('*').order('created_at', { ascending: false }),
      supabase.from('user_profiles').select('id, full_name, email')
    ]);
    
    setPolicies(pRes.data || []);
    setUsers(uRes.data || []);
    setLoading(false);
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      setFile(e.target.files[0]);
    }
  };

  const openNew = () => {
    setTitle('');
    setDescription('');
    setCategory('general');
    setVersion('');
    setFile(null);
    setShowModal(true);
  };

  const handleSave = async () => {
    if (!title.trim() || !file) return;
    setSaving(true);
    const supabase = createClient();

    try {
      // 1. Upload file
      const fileExt = file.name.split('.').pop();
      const fileName = `${Math.random().toString(36).substring(2, 15)}_${Date.now()}.${fileExt}`;
      const filePath = `policies/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('policies_files')
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      // 2. Get public URL
      const { data: publicUrlData } = supabase.storage
        .from('policies_files')
        .getPublicUrl(filePath);

      // 3. Save to DB
      const { error: dbError } = await supabase.from('policies').insert({
        title: title.trim(),
        description: description.trim() || null,
        category,
        file_url: publicUrlData.publicUrl,
        file_name: file.name,
        version: version.trim() || null,
        uploaded_by: profile?.id
      });

      if (dbError) throw dbError;

      setShowModal(false);
      loadData();
    } catch (err: any) {
      alert('Error al guardar: ' + err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (policy: Policy) => {
    if (!confirm(`¿Eliminar permanentemente "${policy.title}"?`)) return;
    
    const supabase = createClient();
    
    // Attempt to delete file from storage (extract path from URL)
    try {
      const pathMatch = policy.file_url.match(/policies_files\/(.*)$/);
      if (pathMatch && pathMatch[1]) {
        await supabase.storage.from('policies_files').remove([pathMatch[1]]);
      }
    } catch (e) {
      console.error('Error deleting file', e);
    }

    // Delete from DB
    await supabase.from('policies').delete().eq('id', policy.id);
    loadData();
  };

  const getFileIcon = (fileName: string) => {
    const ext = fileName.split('.').pop()?.toLowerCase();
    if (ext === 'pdf') return <FileText size={24} color="#E53935" />;
    if (['doc', 'docx'].includes(ext || '')) return <FileText size={24} color="#1E88E5" />;
    if (['xls', 'xlsx'].includes(ext || '')) return <FileSpreadsheet size={24} color="#43A047" />;
    return <File size={24} color="var(--gray-500)" />;
  };

  const getUploaderName = (id: string | null) => {
    if (!id) return 'Sistema';
    const u = users.find(u => u.id === id);
    return u?.full_name || u?.email || 'Desconocido';
  };

  const filteredPolicies = policies.filter(p => {
    if (filterCategory && p.category !== filterCategory) return false;
    if (search && !p.title.toLowerCase().includes(search.toLowerCase()) && 
        !(p.description || '').toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  if (loading) return (
    <div className="page-container" style={{ display: 'flex', justifyContent: 'center', padding: '100px' }}>
      <div className="spinner" />
    </div>
  );

  return (
    <div className="page-container">
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '24px' }}>
        <div>
          <h1 className="page-title" style={{ marginBottom: '4px' }}>Políticas y Documentos</h1>
          <p className="page-subtitle">Repositorio central de normativas, manuales y plantillas.</p>
        </div>
        {!isReadOnly && (
          <button className="btn btn-primary" onClick={openNew}>
            <Plus size={16} /> Subir Documento
          </button>
        )}
      </div>

      {/* Filters */}
      <div style={{ display: 'flex', gap: '12px', marginBottom: '24px', flexWrap: 'wrap' }}>
        <div style={{ position: 'relative', flex: 1, minWidth: '250px', maxWidth: '400px' }}>
          <Search size={16} style={{ position: 'absolute', left: '12px', top: '9px', color: 'var(--gray-400)' }} />
          <input 
            value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Buscar documentos..."
            style={{ width: '100%', padding: '8px 12px 8px 36px', borderRadius: 'var(--radius-md)', border: '1px solid var(--gray-200)', fontSize: '13px' }}
          />
        </div>
        <select 
          value={filterCategory} onChange={e => setFilterCategory(e.target.value)}
          style={{ padding: '8px 12px', borderRadius: 'var(--radius-md)', border: '1px solid var(--gray-200)', fontSize: '13px', background: 'white' }}
        >
          <option value="">Todas las categorías</option>
          {CATEGORIES.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
        </select>
      </div>

      {/* Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '20px' }}>
        {filteredPolicies.map(p => (
          <div key={p.id} className="card" style={{ display: 'flex', flexDirection: 'column', padding: '0', overflow: 'hidden' }}>
            <div style={{ padding: '20px', display: 'flex', gap: '16px', flex: 1 }}>
              <div style={{ 
                width: '48px', height: '48px', borderRadius: 'var(--radius-md)', 
                background: 'var(--gray-50)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 
              }}>
                {getFileIcon(p.file_name)}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <h4 style={{ margin: '0 0 4px', fontSize: '14px', fontWeight: 600, color: 'var(--gray-900)' }}>
                  {p.title}
                </h4>
                {p.version && (
                  <span style={{ display: 'inline-block', fontSize: '11px', padding: '2px 6px', background: 'var(--gray-100)', color: 'var(--gray-600)', borderRadius: '4px', marginBottom: '8px' }}>
                    Versión {p.version}
                  </span>
                )}
                {p.description && (
                  <p style={{ margin: 0, fontSize: '12px', color: 'var(--gray-500)', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                    {p.description}
                  </p>
                )}
              </div>
            </div>
            
            <div style={{ padding: '12px 20px', background: 'var(--gray-50)', borderTop: '1px solid var(--gray-100)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ fontSize: '11px', color: 'var(--gray-500)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                <User size={12} /> {getUploaderName(p.uploaded_by)}
              </div>
              <div style={{ display: 'flex', gap: '4px' }}>
                <a 
                  href={p.file_url} 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="btn btn-ghost btn-icon" 
                  title="Descargar/Ver"
                >
                  <Download size={14} color="var(--primary)" />
                </a>
                {!isReadOnly && (
                  <button className="btn btn-ghost btn-icon" title="Eliminar" onClick={() => handleDelete(p)}>
                    <Trash2 size={14} color="#E53935" />
                  </button>
                )}
              </div>
            </div>
          </div>
        ))}
        {filteredPolicies.length === 0 && (
          <div style={{ gridColumn: '1 / -1', padding: '60px 20px', textAlign: 'center', color: 'var(--gray-500)', background: 'white', borderRadius: 'var(--radius-lg)' }}>
            No se encontraron documentos.
          </div>
        )}
      </div>

      {/* Modal */}
      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: '500px' }}>
            <div className="modal-header">
              <h3>Subir Documento</h3>
              <button className="btn btn-ghost btn-icon" onClick={() => setShowModal(false)}><X size={18} /></button>
            </div>
            <div className="modal-body">
              <div className="form-group">
                <label>Título *</label>
                <input value={title} onChange={e => setTitle(e.target.value)} placeholder="Ej. Lineamiento de Publicación" />
              </div>
              <div className="form-group">
                <label>Descripción</label>
                <textarea value={description} onChange={e => setDescription(e.target.value)} rows={2} placeholder="Breve descripción del documento..." />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div className="form-group">
                  <label>Categoría</label>
                  <select value={category} onChange={e => setCategory(e.target.value)}>
                    {CATEGORIES.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
                  </select>
                </div>
                <div className="form-group">
                  <label>Versión (Opcional)</label>
                  <input value={version} onChange={e => setVersion(e.target.value)} placeholder="Ej. 2026, v1.2" />
                </div>
              </div>
              <div className="form-group">
                <label>Archivo * (PDF, Word, Excel)</label>
                <input 
                  type="file" 
                  accept=".pdf,.doc,.docx,.xls,.xlsx" 
                  onChange={handleFileChange} 
                  style={{ border: '1px dashed var(--gray-300)', padding: '16px', borderRadius: 'var(--radius-md)', width: '100%', background: 'var(--gray-50)' }}
                />
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-ghost" onClick={() => setShowModal(false)}>Cancelar</button>
              <button className="btn btn-primary" onClick={handleSave} disabled={saving || !title.trim() || !file}>
                {saving ? 'Subiendo...' : 'Guardar Documento'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
