'use client';

import { useEffect, useState, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Plus, Pencil, Trash2, Shield, X, UserCheck, UserX, ArrowLeft, Camera } from 'lucide-react';
import Link from 'next/link';

const ROLE_OPTIONS = [
  { value: 'admin', label: '🛡️ Administrador', desc: 'Acceso total al sistema' },
  { value: 'director', label: '👑 Director Editorial', desc: 'Todo excepto configuración' },
  { value: 'editor_revista', label: '📰 Editor de Revista', desc: 'Solo su revista asignada' },
  { value: 'editor_libros', label: '📰📚 Editor + Libros', desc: 'Su revista + módulo de libros' },
  { value: 'coord_libros', label: '📚 Coordinador de Libros', desc: 'Solo módulo de libros' },
  { value: 'asistente', label: '👁️ Asistente', desc: 'Solo lectura en todo' },
];

const ROLE_COLORS: Record<string, { bg: string; color: string }> = {
  admin: { bg: '#FFEBEE', color: '#E53935' },
  director: { bg: '#F3E5F5', color: '#7B1FA2' },
  editor_revista: { bg: '#E3F2FD', color: '#1565C0' },
  editor_libros: { bg: '#E0F2F1', color: '#00897B' },
  coord_libros: { bg: '#FFF3E0', color: '#F57C00' },
  asistente: { bg: '#ECEFF1', color: '#78909C' },
};

export default function UsersPage() {
  const { profile } = useAuth();
  const [users, setUsers] = useState<any[]>([]);
  const [journals, setJournals] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editUser, setEditUser] = useState<any>(null);

  // Form states
  const [email, setEmail] = useState('');
  const [fullName, setFullName] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState('asistente');
  const [journalId, setJournalId] = useState('');
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState('');
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [avatarPreview, setAvatarPreview] = useState('');

  const loadData = useCallback(async () => {
    const supabase = createClient();
    const [uRes, jRes] = await Promise.all([
      supabase.from('user_profiles').select('*').order('created_at', { ascending: false }),
      supabase.from('journals').select('id, name').order('name'),
    ]);
    setUsers(uRes.data || []);
    setJournals(jRes.data || []);
    setLoading(false);
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  const openCreate = () => {
    setEditUser(null);
    setEmail(''); setFullName(''); setPassword(''); setRole('asistente'); setJournalId('');
    setFormError('');
    setAvatarFile(null); setAvatarPreview('');
    setShowModal(true);
  };

  const openEdit = (u: any) => {
    setEditUser(u);
    setEmail(u.email || '');
    setFullName(u.full_name || '');
    setPassword('');
    setRole(u.role || 'asistente');
    setJournalId(u.journal_id || '');
    setFormError('');
    setAvatarFile(null); setAvatarPreview(u.avatar_url || '');
    setShowModal(true);
  };

  const handleSave = async () => {
    setFormError('');
    if (!editUser && (!email.trim() || !password)) {
      setFormError('Email y contraseña son obligatorios');
      return;
    }
    setSaving(true);
    const supabase = createClient();

    // Upload avatar if a new file was selected
    const uploadAvatar = async (userId: string): Promise<string | null> => {
      if (!avatarFile) return null;
      const ext = avatarFile.name.split('.').pop();
      const path = `${userId}.${ext}`;
      const { error } = await supabase.storage.from('avatars').upload(path, avatarFile, { upsert: true });
      if (error) { console.error('Avatar upload error:', error); return null; }
      const { data: urlData } = supabase.storage.from('avatars').getPublicUrl(path);
      return urlData.publicUrl;
    };

    if (editUser) {
      // Update profile
      const avatarUrl = await uploadAvatar(editUser.id);
      const updateData: any = {
        full_name: fullName.trim() || null,
        role,
        journal_id: (role === 'editor_revista' || role === 'editor_libros') ? (journalId || null) : null,
      };
      if (avatarUrl) updateData.avatar_url = avatarUrl;
      await supabase.from('user_profiles').update(updateData).eq('id', editUser.id);
    } else {
      // Create new user via Supabase Auth
      const { data, error } = await supabase.auth.signUp({
        email: email.trim(),
        password,
        options: {
          data: {
            full_name: fullName.trim(),
            role,
          },
        },
      });

      if (error) {
        setSaving(false);
        setFormError(error.message);
        return;
      }

      // Update profile with correct role and journal_id (trigger creates with default)
      if (data.user) {
        // Small delay for trigger
        await new Promise(r => setTimeout(r, 500));
        const avatarUrl = await uploadAvatar(data.user.id);
        const updateData: any = {
          role,
          journal_id: (role === 'editor_revista' || role === 'editor_libros') ? (journalId || null) : null,
          full_name: fullName.trim() || null,
        };
        if (avatarUrl) updateData.avatar_url = avatarUrl;
        await supabase.from('user_profiles').update(updateData).eq('id', data.user.id);
      }
    }

    setSaving(false);
    setShowModal(false);
    loadData();
  };

  const toggleActive = async (u: any) => {
    const supabase = createClient();
    await supabase.from('user_profiles').update({ active: !u.active }).eq('id', u.id);
    loadData();
  };

  // Access check: only admin
  if (profile && profile.role !== 'admin') {
    return (
      <>
        <div className="page-header"><h2>Acceso Denegado</h2></div>
        <div className="page-content">
          <div className="empty-state">
            <div className="empty-icon">🔒</div>
            <h3>Sin permisos</h3>
            <p>Solo los administradores pueden gestionar usuarios.</p>
            <Link href="/" className="btn btn-primary">Ir al Dashboard</Link>
          </div>
        </div>
      </>
    );
  }

  if (loading) return <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '60vh' }}><p style={{ color: 'var(--gray-500)' }}>Cargando usuarios...</p></div>;

  return (
    <>
      <div className="page-header">
        <div className="flex items-center justify-between">
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <Link href="/settings" className="btn btn-ghost btn-icon"><ArrowLeft size={18} /></Link>
            <div>
              <h2>Gestión de Usuarios</h2>
              <p>{users.length} usuarios registrados</p>
            </div>
          </div>
          <button className="btn btn-primary" onClick={openCreate}>
            <Plus size={18} /> Nuevo Usuario
          </button>
        </div>
      </div>

      <div className="page-content">
        <div className="card">
          <div className="card-body" style={{ padding: 0 }}>
            <table className="data-table">
              <thead>
                <tr>
                  <th>Usuario</th>
                  <th>Email</th>
                  <th>Rol</th>
                  <th>Revista</th>
                  <th>Estado</th>
                  <th>Creado</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {users.map(u => (
                  <tr key={u.id} style={{ opacity: u.active ? 1 : 0.5 }}>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        {u.avatar_url ? (
                          <img src={u.avatar_url} alt={u.full_name} style={{
                            width: '36px', height: '36px', borderRadius: '50%', objectFit: 'cover',
                          }} />
                        ) : (
                          <div style={{
                            width: '36px', height: '36px', borderRadius: '50%',
                            background: `${ROLE_COLORS[u.role]?.color || '#78909C'}22`,
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            fontSize: '12px', fontWeight: 700,
                            color: ROLE_COLORS[u.role]?.color || '#78909C',
                          }}>
                            {(u.full_name || u.email || '?').substring(0, 2).toUpperCase()}
                          </div>
                        )}
                        <span style={{ fontWeight: 600 }}>{u.full_name || '—'}</span>
                      </div>
                    </td>
                    <td style={{ fontSize: '13px', color: 'var(--gray-500)' }}>{u.email}</td>
                    <td>
                      <span style={{
                        fontSize: '11px', fontWeight: 600, padding: '3px 10px', borderRadius: '12px',
                        background: ROLE_COLORS[u.role]?.bg || '#ECEFF1',
                        color: ROLE_COLORS[u.role]?.color || '#78909C',
                      }}>
                        {ROLE_OPTIONS.find(r => r.value === u.role)?.label?.replace(/^[^\s]+\s/, '') || u.role}
                      </span>
                    </td>
                    <td style={{ fontSize: '12px', color: 'var(--gray-400)' }}>
                      {(u.role === 'editor_revista' || u.role === 'editor_libros') ? (journals.find(j => j.id === u.journal_id)?.name || '—') : '—'}
                    </td>
                    <td>
                      <span className={`badge ${u.active ? 'badge-success' : 'badge-neutral'}`}>
                        {u.active ? 'Activo' : 'Inactivo'}
                      </span>
                    </td>
                    <td style={{ fontSize: '12px', color: 'var(--gray-400)', whiteSpace: 'nowrap' }}>
                      {u.created_at ? new Date(u.created_at).toLocaleDateString('es-CO') : '—'}
                    </td>
                    <td>
                      <div className="flex gap-1">
                        <button className="btn btn-ghost btn-icon" title="Editar" onClick={() => openEdit(u)}><Pencil size={14} /></button>
                        <button
                          className="btn btn-ghost btn-icon"
                          title={u.active ? 'Desactivar' : 'Activar'}
                          onClick={() => toggleActive(u)}
                        >
                          {u.active ? <UserX size={14} color="#F57C00" /> : <UserCheck size={14} color="#43A047" />}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Create / Edit Modal */}
      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: '500px' }}>
            <div className="modal-header">
              <h3>{editUser ? 'Editar Usuario' : 'Nuevo Usuario'}</h3>
              <button className="btn btn-ghost btn-icon" onClick={() => setShowModal(false)}><X size={18} /></button>
            </div>
            <div className="modal-body">
              {formError && (
                <div style={{ padding: '8px 12px', background: '#FFEBEE', borderRadius: 'var(--radius-md)', marginBottom: '16px', fontSize: '13px', color: '#E53935', fontWeight: 500 }}>
                  {formError}
                </div>
              )}
              {/* Avatar Upload */}
              <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '16px' }}>
                <label style={{ position: 'relative', cursor: 'pointer' }}>
                  <input type="file" accept="image/jpeg,image/png,image/webp" style={{ display: 'none' }}
                    onChange={e => {
                      const file = e.target.files?.[0];
                      if (file) {
                        setAvatarFile(file);
                        setAvatarPreview(URL.createObjectURL(file));
                      }
                    }}
                  />
                  {avatarPreview ? (
                    <img src={avatarPreview} alt="Avatar" style={{
                      width: '80px', height: '80px', borderRadius: '50%', objectFit: 'cover',
                      border: '3px solid var(--gray-100)',
                    }} />
                  ) : (
                    <div style={{
                      width: '80px', height: '80px', borderRadius: '50%',
                      background: 'var(--gray-50)', border: '2px dashed var(--gray-200)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      flexDirection: 'column', gap: '4px',
                    }}>
                      <Camera size={20} color="var(--gray-400)" />
                      <span style={{ fontSize: '10px', color: 'var(--gray-400)' }}>Foto</span>
                    </div>
                  )}
                  <div style={{
                    position: 'absolute', bottom: 0, right: 0,
                    width: '24px', height: '24px', borderRadius: '50%',
                    background: 'var(--primary)', display: 'flex',
                    alignItems: 'center', justifyContent: 'center',
                    border: '2px solid white',
                  }}>
                    <Camera size={12} color="white" />
                  </div>
                </label>
              </div>
              {!editUser && (
                <>
                  <div className="form-group">
                    <label>Email *</label>
                    <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="usuario@email.com" />
                  </div>
                  <div className="form-group">
                    <label>Contraseña *</label>
                    <input type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="Mínimo 6 caracteres" />
                  </div>
                </>
              )}
              <div className="form-group">
                <label>Nombre Completo</label>
                <input type="text" value={fullName} onChange={e => setFullName(e.target.value)} placeholder="Nombre y apellido" />
              </div>
              <div className="form-group">
                <label>Rol *</label>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  {ROLE_OPTIONS.map(r => (
                    <label
                      key={r.value}
                      style={{
                        display: 'flex', alignItems: 'center', gap: '10px',
                        padding: '10px 12px', borderRadius: 'var(--radius-md)', cursor: 'pointer',
                        border: `2px solid ${role === r.value ? (ROLE_COLORS[r.value]?.color || 'var(--primary)') : 'var(--gray-100)'}`,
                        background: role === r.value ? `${ROLE_COLORS[r.value]?.bg || '#F5F5F5'}` : 'white',
                        transition: 'all 0.15s',
                      }}
                    >
                      <input type="radio" name="role" value={r.value} checked={role === r.value} onChange={e => setRole(e.target.value)} style={{ display: 'none' }} />
                      <Shield size={16} color={ROLE_COLORS[r.value]?.color || '#78909C'} />
                      <div>
                        <div style={{ fontSize: '13px', fontWeight: 600 }}>{r.label}</div>
                        <div style={{ fontSize: '11px', color: 'var(--gray-400)' }}>{r.desc}</div>
                      </div>
                    </label>
                  ))}
                </div>
              </div>
              {(role === 'editor_revista' || role === 'editor_libros') && (
                <div className="form-group">
                  <label>Revista Asignada *</label>
                  <select value={journalId} onChange={e => setJournalId(e.target.value)}>
                    <option value="">Seleccionar revista...</option>
                    {journals.map(j => <option key={j.id} value={j.id}>{j.name}</option>)}
                  </select>
                </div>
              )}
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setShowModal(false)}>Cancelar</button>
              <button className="btn btn-primary" onClick={handleSave} disabled={saving}>
                {saving ? 'Guardando...' : editUser ? 'Actualizar' : 'Crear Usuario'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
