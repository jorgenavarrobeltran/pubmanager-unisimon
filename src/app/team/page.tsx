'use client';

import { useState, useEffect, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Mail, Search, Shield, Clock, Users, BookOpen } from 'lucide-react';
import Image from 'next/image';
import Link from 'next/link';

interface TeamMember {
  id: string;
  full_name: string;
  email: string;
  avatar_url: string | null;
  role: string;
  active: boolean;
  task_count?: number;
}

interface JournalEditor {
  journal_id: string;
  journal_name: string;
  editor_name: string;
  editor_email: string;
}

const ROLE_LABELS: Record<string, string> = {
  vicerrector: 'Vicerrector',
  admin: 'Administrador',
  director: 'Director Editorial',
  editor_revista: 'Editor de Revista',
  editor_libros: 'Editor + Libros',
  coord_libros: 'Coord. de Libros',
  asistente: 'Asistente',
};

const ROLE_COLORS: Record<string, { bg: string, color: string }> = {
  vicerrector: { bg: '#FFF8E1', color: '#F57F17' },
  admin: { bg: '#FFEBEE', color: '#D32F2F' },
  director: { bg: '#F3E5F5', color: '#7B1FA2' },
  editor_revista: { bg: '#E3F2FD', color: '#1565C0' },
  editor_libros: { bg: '#E0F2F1', color: '#00695C' },
  coord_libros: { bg: '#FFF3E0', color: '#E65100' },
  asistente: { bg: '#F5F5F5', color: '#616161' },
};

function MemberCard({ member }: { member: TeamMember }) {
  return (
    <div className="card" style={{ display: 'flex', flexDirection: 'column' }}>
      <div style={{ 
        height: '80px', 
        background: 'linear-gradient(120deg, #E3F2FD 0%, #BBDEFB 100%)',
        borderBottom: '1px solid var(--gray-200)'
      }} />
      
      <div style={{ padding: '0 24px 24px', position: 'relative', flex: '1', display: 'flex', flexDirection: 'column' }}>
        {/* Avatar */}
        <div style={{ 
          position: 'absolute', 
          top: '-40px', 
          left: '24px',
          width: '80px', 
          height: '80px', 
          borderRadius: '50%',
          border: '4px solid white',
          background: 'var(--gray-100)',
          boxShadow: 'var(--shadow-sm)',
          overflow: 'hidden',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 10
        }}>
          {member.avatar_url ? (
            <Image src={member.avatar_url} alt={member.full_name} fill style={{ objectFit: 'cover' }} />
          ) : (
            <span style={{ fontSize: '28px', fontWeight: 'bold', color: 'var(--gray-400)' }}>
              {member.full_name.charAt(0).toUpperCase()}
            </span>
          )}
        </div>
        
        <div style={{ paddingTop: '50px', flex: '1' }}>
          <h3 style={{ fontSize: '18px', fontWeight: '600', color: 'var(--gray-900)', margin: '0' }}>
            {member.full_name}
          </h3>
          
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--gray-500)', fontSize: '13px', marginTop: '4px' }}>
            {member.email.includes('@') && <Mail size={14} />}
            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {member.email}
            </span>
          </div>
          
          <div style={{ marginTop: '16px' }}>
            <span className="badge" style={{ 
              background: ROLE_COLORS[member.role]?.bg || ROLE_COLORS.asistente.bg,
              color: ROLE_COLORS[member.role]?.color || ROLE_COLORS.asistente.color,
              padding: '4px 12px',
              fontSize: '12px'
            }}>
              {ROLE_LABELS[member.role] || member.role}
            </span>
          </div>
        </div>
      </div>

      <div className="card-footer" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <Clock size={16} color="var(--gray-500)" />
          <span style={{ fontSize: '12px', color: 'var(--gray-600)', fontWeight: '500' }}>Tareas Pendientes</span>
        </div>
        <span style={{ 
          fontSize: '16px', 
          fontWeight: '700', 
          color: member.task_count ? 'var(--warning)' : 'var(--success)' 
        }}>
          {member.task_count || 0}
        </span>
      </div>
    </div>
  );
}

function EditorCard({ editor }: { editor: JournalEditor }) {
  return (
    <div className="card" style={{ display: 'flex', flexDirection: 'column' }}>
      <div style={{ 
        height: '80px', 
        background: 'linear-gradient(120deg, #E8F5E9 0%, #C8E6C9 100%)',
        borderBottom: '1px solid var(--gray-200)'
      }} />
      
      <div style={{ padding: '0 24px 24px', position: 'relative', flex: '1', display: 'flex', flexDirection: 'column' }}>
        {/* Avatar */}
        <div style={{ 
          position: 'absolute', 
          top: '-40px', 
          left: '24px',
          width: '80px', 
          height: '80px', 
          borderRadius: '50%',
          border: '4px solid white',
          background: '#E8F5E9',
          boxShadow: 'var(--shadow-sm)',
          overflow: 'hidden',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 10
        }}>
          <span style={{ fontSize: '28px', fontWeight: 'bold', color: '#2E7D32' }}>
            {editor.editor_name.charAt(0).toUpperCase()}
          </span>
        </div>
        
        <div style={{ paddingTop: '50px', flex: '1' }}>
          <h3 style={{ fontSize: '18px', fontWeight: '600', color: 'var(--gray-900)', margin: '0' }}>
            {editor.editor_name}
          </h3>
          
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--gray-500)', fontSize: '13px', marginTop: '4px' }}>
            <Mail size={14} />
            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {editor.editor_email}
            </span>
          </div>
          
          <div style={{ marginTop: '16px' }}>
            <span className="badge" style={{ 
              background: ROLE_COLORS.editor_revista.bg,
              color: ROLE_COLORS.editor_revista.color,
              padding: '4px 12px',
              fontSize: '12px'
            }}>
              Editor(a) en Jefe
            </span>
          </div>
        </div>
      </div>

      <Link href={`/journals/${editor.journal_id}`} style={{ textDecoration: 'none' }}>
        <div className="card-footer" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <BookOpen size={16} color="var(--gray-500)" />
            <span style={{ fontSize: '12px', color: 'var(--gray-600)', fontWeight: '500' }}>Revista</span>
          </div>
          <span style={{ 
            fontSize: '13px', 
            fontWeight: '600', 
            color: 'var(--primary)'
          }}>
            {editor.journal_name}
          </span>
        </div>
      </Link>
    </div>
  );
}

export default function TeamPage() {
  const { hasAccess } = useAuth();
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [editors, setEditors] = useState<JournalEditor[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [roleFilter, setRoleFilter] = useState('');

  const loadData = useCallback(async () => {
    const supabase = createClient();
    
    // Fetch profiles and tasks
    const [profilesRes, tasksRes, journalsRes] = await Promise.all([
      supabase.from('user_profiles').select('*').eq('active', true).order('full_name'),
      supabase.from('tasks').select('assigned_to, status'),
      supabase.from('journals').select('id, name, editor_name, editor_email').order('name')
    ]);

    const profiles = profilesRes.data || [];
    const tasks = tasksRes.data || [];

    // Map task counts per user
    const taskCounts = tasks.reduce((acc: Record<string, number>, t: any) => {
      if (t.assigned_to && t.status !== 'Completada') {
        acc[t.assigned_to] = (acc[t.assigned_to] || 0) + 1;
      }
      return acc;
    }, {});

    const enrichedMembers = profiles.map((p: any) => ({
      ...p,
      task_count: taskCounts[p.id] || 0
    }));

    // Build editor list from journals
    const journalEditors: JournalEditor[] = (journalsRes.data || [])
      .filter((j: any) => j.editor_name && j.editor_name.trim())
      .map((j: any) => ({
        journal_id: j.id,
        journal_name: j.name,
        editor_name: j.editor_name,
        editor_email: j.editor_email || '',
      }));

    setMembers(enrichedMembers);
    setEditors(journalEditors);
    setLoading(false);
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  if (!hasAccess('team')) {
    return (
      <div style={{ display: 'flex', height: '100%', alignItems: 'center', justifyContent: 'center', textAlign: 'center', padding: '40px' }}>
        <div>
          <Shield size={48} color="var(--gray-400)" style={{ margin: '0 auto 16px' }} />
          <h2 style={{ fontSize: '20px', color: 'var(--gray-800)', fontWeight: '600' }}>Acceso Denegado</h2>
          <p style={{ color: 'var(--gray-500)', marginTop: '8px' }}>No tienes permiso para ver el equipo.</p>
        </div>
      </div>
    );
  }

  const filteredMembers = members.filter(m => {
    if (searchTerm && !m.full_name.toLowerCase().includes(searchTerm.toLowerCase())) return false;
    if (roleFilter && m.role !== roleFilter) return false;
    return true;
  });

  const isVicerrector = (m: TeamMember) => {
    const lower = m.full_name.toLowerCase();
    return lower.includes('luis') && lower.includes('ortiz');
  };

  const isDirectora = (m: TeamMember) => {
    return m.full_name.toLowerCase().includes('nataly');
  };

  const isJefatura = (m: TeamMember) => {
    return m.full_name.toLowerCase().includes('jorge navarro');
  };

  const isEquipo = (m: TeamMember) => {
    return !isVicerrector(m) && !isDirectora(m) && !isJefatura(m);
  };

  // Hardcoded leaders that don't have DB accounts but should be displayed
  const hardcodedLeaders: TeamMember[] = [
    {
      id: 'static-luis',
      full_name: 'Dr. Luis Eduardo Ortiz Ospino',
      email: 'luis.ortizo@unisimon.edu.co',
      avatar_url: null,
      role: 'vicerrector',
      active: true,
      task_count: 0
    },
    {
      id: 'static-nataly',
      full_name: 'Dra. Nataly Julieth Galán Freyle',
      email: 'nataly.galan@unisimon.edu.co',
      avatar_url: null,
      role: 'director',
      active: true,
      task_count: 0
    }
  ];

  // We only include hardcoded leaders if there is no search filter or they match the search filter
  const filteredHardcoded = hardcodedLeaders.filter(m => {
    if (searchTerm && !m.full_name.toLowerCase().includes(searchTerm.toLowerCase())) return false;
    if (roleFilter && m.role !== roleFilter) return false;
    return true;
  });

  const getFilteredDb = (filterFn: (m: TeamMember) => boolean) => filteredMembers.filter(filterFn);

  // Helper to combine static + db avoiding duplicates
  const combineSection = (staticMembers: TeamMember[], dbMembers: TeamMember[]) => {
    const combined = [...staticMembers];
    dbMembers.forEach(dbm => {
      if (!combined.find(hm => hm.full_name.toLowerCase().includes(dbm.full_name.toLowerCase()))) {
        combined.push(dbm);
      }
    });
    return combined;
  };

  const vicerrectorMembers = combineSection(filteredHardcoded.filter(isVicerrector), getFilteredDb(isVicerrector));
  const directoraMembers = combineSection(filteredHardcoded.filter(isDirectora), getFilteredDb(isDirectora));
  const jefaturaMembers = getFilteredDb(isJefatura);
  const equipoMembers = getFilteredDb(isEquipo);

  return (
    <>
      <div className="page-header">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <h2 style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Users size={24} color="var(--info)" />
              Equipo Editorial
            </h2>
            <p>Directorio y carga de trabajo del equipo de publicaciones.</p>
          </div>
        </div>
      </div>

      <div className="page-content">
        {/* Filters */}
        <div style={{ 
          display: 'flex', 
          gap: '16px', 
          marginBottom: '24px', 
          background: 'white', 
          padding: '16px', 
          borderRadius: 'var(--radius-lg)',
          boxShadow: 'var(--shadow-sm)',
          border: '1px solid var(--gray-200)',
          flexWrap: 'wrap'
        }}>
          <div className="search-bar" style={{ flex: '1', minWidth: '250px', maxWidth: 'none' }}>
            <Search size={18} className="search-icon" />
            <input
              type="text"
              placeholder="Buscar por nombre..."
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
            />
          </div>
          <select
            className="form-select"
            value={roleFilter}
            onChange={e => setRoleFilter(e.target.value)}
            style={{ minWidth: '200px' }}
          >
            <option value="">Todos los roles</option>
            {Object.entries(ROLE_LABELS).map(([key, label]) => (
              <option key={key} value={key}>{label}</option>
            ))}
          </select>
        </div>

        {loading ? (
          <div className="empty-state">
            <div style={{ animation: 'pulse-glow 1.5s infinite', color: 'var(--primary)' }}>Cargando equipo...</div>
          </div>
        ) : (
          <div>
            {vicerrectorMembers.length > 0 && (
              <div style={{ marginBottom: '40px' }}>
                <h3 style={{ fontSize: '18px', fontWeight: '700', color: 'var(--primary-700)', marginBottom: '16px', paddingBottom: '8px', borderBottom: '2px solid var(--primary-100)' }}>
                  Vicerrectoría de Investigación, Extensión e Innovación
                </h3>
                <div className="cards-grid">
                  {vicerrectorMembers.map(m => <MemberCard key={m.id} member={m} />)}
                </div>
              </div>
            )}

            {directoraMembers.length > 0 && (
              <div style={{ marginBottom: '40px' }}>
                <h3 style={{ fontSize: '18px', fontWeight: '700', color: 'var(--gray-800)', marginBottom: '16px', paddingBottom: '8px', borderBottom: '2px solid var(--gray-200)' }}>
                  Dirección de Investigación
                </h3>
                <div className="cards-grid">
                  {directoraMembers.map(m => <MemberCard key={m.id} member={m} />)}
                </div>
              </div>
            )}

            {jefaturaMembers.length > 0 && (
              <div style={{ marginBottom: '40px' }}>
                <h3 style={{ fontSize: '18px', fontWeight: '700', color: 'var(--gray-800)', marginBottom: '16px', paddingBottom: '8px', borderBottom: '2px solid var(--gray-200)' }}>
                  Jefatura de Publicaciones
                </h3>
                <div className="cards-grid">
                  {jefaturaMembers.map(m => <MemberCard key={m.id} member={m} />)}
                </div>
              </div>
            )}

            {editors.length > 0 && (() => {
              const filteredEditors = editors.filter(e => {
                if (searchTerm && !e.editor_name.toLowerCase().includes(searchTerm.toLowerCase()) && !e.journal_name.toLowerCase().includes(searchTerm.toLowerCase())) return false;
                if (roleFilter && roleFilter !== 'editor_revista') return false;
                return true;
              });
              return filteredEditors.length > 0 ? (
                <div style={{ marginBottom: '40px' }}>
                  <h3 style={{ fontSize: '18px', fontWeight: '700', color: 'var(--gray-800)', marginBottom: '16px', paddingBottom: '8px', borderBottom: '2px solid var(--gray-200)' }}>
                    Editores de Revistas
                  </h3>
                  <div className="cards-grid">
                    {filteredEditors.map(e => <EditorCard key={e.journal_id} editor={e} />)}
                  </div>
                </div>
              ) : null;
            })()}

            {equipoMembers.length > 0 && (
              <div style={{ marginBottom: '40px' }}>
                <h3 style={{ fontSize: '18px', fontWeight: '700', color: 'var(--gray-800)', marginBottom: '16px', paddingBottom: '8px', borderBottom: '2px solid var(--gray-200)' }}>
                  Equipo de Trabajo
                </h3>
                <div className="cards-grid">
                  {equipoMembers.map(m => <MemberCard key={m.id} member={m} />)}
                </div>
              </div>
            )}
            
            {filteredMembers.length === 0 && (
              <div className="empty-state" style={{ background: 'white', borderRadius: 'var(--radius-lg)' }}>
                <Users size={48} color="var(--gray-300)" style={{ marginBottom: '16px' }} />
                <h3 style={{ color: 'var(--gray-700)', fontSize: '16px' }}>No se encontraron miembros de equipo</h3>
              </div>
            )}
          </div>
        )}
      </div>
    </>
  );
}
