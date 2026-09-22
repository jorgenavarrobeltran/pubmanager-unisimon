'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import {
  Handshake, Plus, Search, BarChart3, TrendingUp,
  ChevronLeft, ChevronRight, X, GraduationCap, Building2,
  UserCheck, ClipboardList, Phone, Users, Filter,
  PieChart, BarChart2, Activity,
} from 'lucide-react';

/* ---------- types ---------- */
interface MentoringSession {
  id: string; session_date: string; action: string; contact_method: string | null;
  mentor_name: string; researcher_name: string | null; researcher_email: string | null;
  researcher_faculty: string | null; researcher_category: string | null;
  researcher_projected_category: string | null; researcher_link: string | null;
  researcher_role: string | null; researcher_program: string | null;
  group_name: string | null; group_code: string | null; group_category: string | null;
  platform_status: string | null; observations: string | null; created_at: string;
}
interface Researcher {
  id: string; doc_id: string | null; name: string; email: string | null;
  role: string | null; campus: string | null; program: string | null;
  faculty: string | null; category_2024: string | null; projected_category: string | null;
}
interface ResearchGroup {
  id: string; code: string; name: string; category_2024: string | null;
  mentor_name: string | null; member_count: number;
}

/* ---------- constants ---------- */
const ACTIONS = ['Mentoría completada', 'Invitación enviada', 'Mentoría agendada', 'Cierre'];
const CONTACT_METHODS = ['Llamada', 'Correo', 'WhatsApp', 'Teams', 'Presencial'];
const PLATFORM_STATUSES = ['Sí', 'No aplica', 'Pendiente', 'No permitido por el sistema'];
const RESEARCHER_LINKS = ['Grupo asignado', 'Otro grupo', 'Sin grupo'];

const ACTION_COLORS: Record<string, string> = {
  'Mentoría completada': '#43A047', 'Invitación enviada': '#1E88E5',
  'Mentoría agendada': '#FB8C00', 'Cierre': '#8E24AA',
};

const CONTACT_COLORS: Record<string, string> = {
  'Presencial': '#43A047', 'Teams': '#5C6BC0', 'WhatsApp': '#66BB6A',
  'Llamada': '#FB8C00', 'Correo': '#EF5350', '': '#BDBDBD',
};

const LINK_COLORS: Record<string, string> = {
  'Grupo asignado': '#1E88E5', 'Otro grupo': '#EF5350', 'Sin grupo': '#FB8C00', '': '#BDBDBD',
};

const PLATFORM_COLORS: Record<string, string> = {
  'Sí': '#43A047', 'No aplica': '#78909C', 'Pendiente': '#FB8C00',
  'No permitido por el sistema': '#EF5350', '': '#BDBDBD',
};

const PAGE_SIZE = 20;

/* ---------- helpers ---------- */
/* ChipFilter removed — using inline dropdowns instead */

function DonutChart({ data, colors, size = 160 }: { data: [string, number][]; colors: Record<string, string>; size?: number }) {
  const total = data.reduce((a, b) => a + b[1], 0);
  if (total === 0) return null;
  const r = size / 2; const innerR = r * 0.6; const cx = r; const cy = r;
  let cumAngle = -Math.PI / 2;

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        {data.map(([label, count]) => {
          const angle = (count / total) * 2 * Math.PI;
          const startAngle = cumAngle;
          cumAngle += angle;
          const endAngle = cumAngle;
          const largeArc = angle > Math.PI ? 1 : 0;
          const x1 = cx + r * Math.cos(startAngle); const y1 = cy + r * Math.sin(startAngle);
          const x2 = cx + r * Math.cos(endAngle); const y2 = cy + r * Math.sin(endAngle);
          const ix1 = cx + innerR * Math.cos(endAngle); const iy1 = cy + innerR * Math.sin(endAngle);
          const ix2 = cx + innerR * Math.cos(startAngle); const iy2 = cy + innerR * Math.sin(startAngle);
          const d = `M${x1},${y1} A${r},${r} 0 ${largeArc},1 ${x2},${y2} L${ix1},${iy1} A${innerR},${innerR} 0 ${largeArc},0 ${ix2},${iy2} Z`;
          return <path key={label} d={d} fill={colors[label] || '#ccc'} stroke="white" strokeWidth="2" />;
        })}
        <text x={cx} y={cy - 6} textAnchor="middle" style={{ fontSize: '22px', fontWeight: 800, fill: 'var(--text-primary)' }}>{total}</text>
        <text x={cx} y={cy + 12} textAnchor="middle" style={{ fontSize: '9px', fill: 'var(--gray-500)' }}>total</text>
      </svg>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
        {data.map(([label, count]) => {
          const pct = Math.round((count / total) * 100);
          return (
            <div key={label} style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11px' }}>
              <span style={{ width: '10px', height: '10px', borderRadius: '3px', background: colors[label] || '#ccc', flexShrink: 0 }} />
              <span style={{ color: 'var(--gray-600)' }}>{label || '(en blanco)'}</span>
              <span style={{ fontWeight: 700, marginLeft: 'auto' }}>{pct}%</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function HBar({ label, value, max, color }: { label: string; value: number; max: number; color: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
      <div style={{ flex: '0 0 180px', fontSize: '11px', fontWeight: 500, color: 'var(--gray-700)', textAlign: 'right', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={label}>
        {label}
      </div>
      <div style={{ flex: 1, height: '16px', borderRadius: '4px', background: 'var(--gray-100)', position: 'relative' }}>
        <div style={{ height: '100%', borderRadius: '4px', width: `${(value / max) * 100}%`, background: color, transition: 'width 0.5s ease', minWidth: value > 0 ? '2px' : '0' }} />
      </div>
      <span style={{ flex: '0 0 28px', fontSize: '11px', fontWeight: 700, color: 'var(--text-primary)', textAlign: 'right' }}>{value}</span>
    </div>
  );
}

function StackedBar({ label, segments, max }: { label: string; segments: { value: number; color: string; label: string }[]; max: number }) {
  const total = segments.reduce((a, s) => a + s.value, 0);
  return (
    <div style={{ marginBottom: '8px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', marginBottom: '3px' }}>
        <span style={{ fontWeight: 500 }}>{label}</span>
        <span style={{ fontWeight: 700, color: 'var(--gray-500)' }}>{total}</span>
      </div>
      <div style={{ display: 'flex', height: '14px', borderRadius: '4px', overflow: 'hidden', background: 'var(--gray-100)' }}>
        {segments.map((seg, i) => (
          seg.value > 0 ? (
            <div key={i} title={`${seg.label}: ${seg.value}`}
              style={{ width: `${(seg.value / max) * 100}%`, background: seg.color, transition: 'width 0.4s' }} />
          ) : null
        ))}
      </div>
    </div>
  );
}

/* ========== MAIN PAGE ========== */
export default function MentoriasPage() {
  const { profile, hasAccess, isReadOnly } = useAuth();
  const [activeTab, setActiveTab] = useState<'dashboard' | 'registro' | 'investigadores' | 'grupos'>('dashboard');
  const [sessions, setSessions] = useState<MentoringSession[]>([]);
  const [researchers, setResearchers] = useState<Researcher[]>([]);
  const [groups, setGroups] = useState<ResearchGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [search, setSearch] = useState('');
  const [currentPage, setCurrentPage] = useState(1);

  // Filters (simple dropdowns like Books module)
  const [filterAction, setFilterAction] = useState('all');
  const [filterMentor, setFilterMentor] = useState('all');
  const [filterFaculty, setFilterFaculty] = useState('all');
  const [filterPlatform, setFilterPlatform] = useState('all');

  // Form
  const [formData, setFormData] = useState({
    session_date: new Date().toISOString().split('T')[0], action: 'Mentoría completada',
    contact_method: '', mentor_name: profile?.full_name || '', researcher_name: '',
    researcher_faculty: '', researcher_category: '', researcher_link: '',
    group_name: '', group_code: '', platform_status: 'Pendiente', observations: '',
  });

  const loadData = useCallback(async () => {
    setLoading(true);
    const supabase = createClient();
    const [sR, rR, gR] = await Promise.all([
      supabase.from('mentoring_sessions').select('*').order('session_date', { ascending: false }),
      supabase.from('researchers').select('*').order('name'),
      supabase.from('research_groups').select('*').order('name'),
    ]);
    if (sR.data) setSessions(sR.data);
    if (rR.data) setResearchers(rR.data);
    if (gR.data) setGroups(gR.data);
    setLoading(false);
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  /* ---------- derived data ---------- */
  const mentorNames = useMemo(() => [...new Set(sessions.map(s => s.mentor_name))].sort(), [sessions]);
  const faculties = useMemo(() => [...new Set(sessions.map(s => s.researcher_faculty || '').filter(Boolean))].sort(), [sessions]);
  const platformValues = useMemo(() => [...new Set(sessions.map(s => s.platform_status || ''))].sort(), [sessions]);

  const filteredSessions = useMemo(() => {
    let r = sessions;
    if (filterAction !== 'all') r = r.filter(s => s.action === filterAction);
    if (filterMentor !== 'all') r = r.filter(s => s.mentor_name === filterMentor);
    if (filterFaculty !== 'all') r = r.filter(s => (s.researcher_faculty || '') === filterFaculty);
    if (filterPlatform !== 'all') r = r.filter(s => (s.platform_status || '') === filterPlatform);
    if (search) {
      const q = search.toLowerCase();
      r = r.filter(s => s.researcher_name?.toLowerCase().includes(q) || s.mentor_name.toLowerCase().includes(q) || s.group_name?.toLowerCase().includes(q) || s.observations?.toLowerCase().includes(q));
    }
    return r;
  }, [sessions, filterAction, filterMentor, filterFaculty, filterPlatform, search]);

  /* ---------- KPIs ---------- */
  const kpis = useMemo(() => {
    const s = filteredSessions;
    return {
      totalAcciones: s.length,
      totalMentorias: s.filter(x => x.action === 'Mentoría completada').length,
      totalInvitaciones: s.filter(x => x.action === 'Invitación enviada').length,
      totalAgendadas: s.filter(x => x.action === 'Mentoría agendada').length,
      uniqueResearchers: new Set(s.map(x => x.researcher_name).filter(Boolean)).size,
      uniqueGroups: new Set(s.map(x => x.group_code).filter(Boolean)).size,
      uniqueMentors: new Set(s.map(x => x.mentor_name)).size,
    };
  }, [filteredSessions]);

  /* ---------- chart data ---------- */
  // Acciones por mentor
  const mentorActionStats = useMemo(() => {
    const map: Record<string, number> = {};
    filteredSessions.forEach(s => { map[s.mentor_name] = (map[s.mentor_name] || 0) + 1; });
    return Object.entries(map).sort((a, b) => b[1] - a[1]);
  }, [filteredSessions]);

  // Mentorías por facultad
  const facultyStats = useMemo(() => {
    const map: Record<string, number> = {};
    filteredSessions.forEach(s => {
      const f = s.researcher_faculty || 'Sin facultad';
      map[f] = (map[f] || 0) + 1;
    });
    return Object.entries(map).sort((a, b) => b[1] - a[1]);
  }, [filteredSessions]);

  // Preferencias de contacto
  const contactStats = useMemo(() => {
    const map: Record<string, number> = {};
    filteredSessions.forEach(s => {
      const c = s.contact_method || '';
      map[c] = (map[c] || 0) + 1;
    });
    return Object.entries(map).sort((a, b) => b[1] - a[1]) as [string, number][];
  }, [filteredSessions]);

  // Vínculo con mentor
  const linkStats = useMemo(() => {
    const map: Record<string, number> = {};
    filteredSessions.forEach(s => {
      const l = s.researcher_link || '';
      map[l] = (map[l] || 0) + 1;
    });
    return Object.entries(map).sort((a, b) => b[1] - a[1]) as [string, number][];
  }, [filteredSessions]);

  // Adopción plataforma Metrik (stacked per mentor)
  const platformByMentor = useMemo(() => {
    const map: Record<string, Record<string, number>> = {};
    filteredSessions.forEach(s => {
      if (!map[s.mentor_name]) map[s.mentor_name] = {};
      const ps = s.platform_status || '';
      map[s.mentor_name][ps] = (map[s.mentor_name][ps] || 0) + 1;
    });
    return Object.entries(map).sort((a, b) => {
      const ta = Object.values(a[1]).reduce((x, y) => x + y, 0);
      const tb = Object.values(b[1]).reduce((x, y) => x + y, 0);
      return tb - ta;
    });
  }, [filteredSessions]);

  // Mentorías por grupo
  const groupStats = useMemo(() => {
    const map: Record<string, number> = {};
    filteredSessions.forEach(s => {
      if (s.group_name) map[s.group_name] = (map[s.group_name] || 0) + 1;
    });
    return Object.entries(map).sort((a, b) => b[1] - a[1]);
  }, [filteredSessions]);

  // Idoneidad grupo asignado
  const idoneidad = useMemo(() => {
    const map: Record<string, number> = {};
    filteredSessions.forEach(s => {
      const l = s.researcher_link || '(en blanco)';
      map[l] = (map[l] || 0) + 1;
    });
    return Object.entries(map).sort((a, b) => b[1] - a[1]);
  }, [filteredSessions]);

  // Action breakdown
  const actionStats = useMemo(() => {
    const map: Record<string, number> = {};
    filteredSessions.forEach(s => { map[s.action] = (map[s.action] || 0) + 1; });
    return Object.entries(map).sort((a, b) => b[1] - a[1]);
  }, [filteredSessions]);

  // Pagination
  const totalPages = Math.ceil(filteredSessions.length / PAGE_SIZE);
  const paginatedSessions = filteredSessions.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);
  useEffect(() => { setCurrentPage(1); }, [search, filterAction, filterMentor, filterFaculty, filterPlatform]);

  const clearFilters = () => { setFilterAction('all'); setFilterMentor('all'); setFilterFaculty('all'); setFilterPlatform('all'); setSearch(''); };
  const hasFilters = filterAction !== 'all' || filterMentor !== 'all' || filterFaculty !== 'all' || filterPlatform !== 'all' || search !== '';

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const supabase = createClient();
    const { error } = await supabase.from('mentoring_sessions').insert({ ...formData, created_by: profile?.id });
    if (error) { alert('Error: ' + error.message); return; }
    setShowForm(false);
    setFormData({
      session_date: new Date().toISOString().split('T')[0], action: 'Mentoría completada',
      contact_method: '', mentor_name: profile?.full_name || '', researcher_name: '',
      researcher_faculty: '', researcher_category: '', researcher_link: '',
      group_name: '', group_code: '', platform_status: 'Pendiente', observations: '',
    });
    loadData();
  };

  if (!hasAccess('mentorias')) {
    return <div className="page-container"><h2>Sin acceso</h2></div>;
  }

  const readOnly = isReadOnly('mentorias');

  return (
    <>
      {/* Sticky top bar: header + tabs */}
      <div className="sticky-toolbar">
        {/* Header */}
        <div className="page-header">
          <div className="flex items-center justify-between">
            <div>
              <h2 style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <Handshake size={24} /> Mentorías de Investigación
              </h2>
              <p>Acompañamiento a investigadores y grupos — Universidad Simón Bolívar</p>
            </div>
            {!readOnly && (
              <button className="btn btn-primary" onClick={() => setShowForm(true)}>
                <Plus size={18} /> Nueva Mentoría
              </button>
            )}
          </div>
        </div>

        {/* Tab bar */}
        <div style={{
          display: 'flex', gap: '0', borderBottom: '2px solid var(--gray-200)',
          margin: '0 24px',
        }}>
          {([
            { id: 'dashboard' as const, label: 'Dashboard', icon: <BarChart3 size={16} /> },
            { id: 'registro' as const, label: 'Registro', icon: <ClipboardList size={16} /> },
            { id: 'investigadores' as const, label: 'Investigadores', icon: <GraduationCap size={16} /> },
            { id: 'grupos' as const, label: 'Grupos', icon: <Building2 size={16} /> },
          ] as const).map(tab => (
            <button key={tab.id} onClick={() => setActiveTab(tab.id)}
              style={{
                padding: '12px 24px', fontSize: '13px', fontWeight: 600,
                color: activeTab === tab.id ? 'var(--primary)' : 'var(--gray-500)',
                borderTop: 'none', borderLeft: 'none', borderRight: 'none',
                borderBottom: activeTab === tab.id ? '2px solid var(--primary)' : '2px solid transparent',
                background: 'none', cursor: 'pointer',
                display: 'flex', alignItems: 'center', gap: '8px',
                marginBottom: '-2px', transition: 'all 0.2s',
              }}>
              {tab.icon} {tab.label}
            </button>
          ))}
        </div>
      </div>

      <div className="page-content">
      {loading ? (
        <div style={{ textAlign: 'center', padding: '60px 0', color: 'var(--gray-400)' }}>Cargando datos...</div>
      ) : (
        <>
          {/* ==================== DASHBOARD ==================== */}
          {activeTab === 'dashboard' && (
            <div>
              {/* Filter Row — matching Books module style */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginBottom: '20px' }}>
                <div className="flex items-center gap-3" style={{ flexWrap: 'wrap' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--gray-500)', fontSize: '12px' }}>
                    <Filter size={14} />
                    <span style={{ fontWeight: 600 }}>Filtros:</span>
                  </div>
                  <select value={filterAction} onChange={e => setFilterAction(e.target.value)}
                    style={{ padding: '6px 12px', borderRadius: '6px', border: '1px solid var(--gray-300)', fontSize: '12px', cursor: 'pointer', color: filterAction !== 'all' ? 'var(--primary)' : 'var(--gray-700)', background: filterAction !== 'all' ? 'var(--primary-light, #e8f5e9)' : 'var(--card-bg)', fontWeight: filterAction !== 'all' ? 600 : 400 }}>
                    <option value="all">Todas las acciones</option>
                    {ACTIONS.map(a => <option key={a} value={a}>{a}</option>)}
                  </select>
                  <select value={filterMentor} onChange={e => setFilterMentor(e.target.value)}
                    style={{ padding: '6px 12px', borderRadius: '6px', border: '1px solid var(--gray-300)', fontSize: '12px', cursor: 'pointer', color: filterMentor !== 'all' ? 'var(--primary)' : 'var(--gray-700)', background: filterMentor !== 'all' ? 'var(--primary-light, #e8f5e9)' : 'var(--card-bg)', fontWeight: filterMentor !== 'all' ? 600 : 400 }}>
                    <option value="all">Todos los mentores</option>
                    {mentorNames.map(n => <option key={n} value={n}>{n}</option>)}
                  </select>
                  <select value={filterFaculty} onChange={e => setFilterFaculty(e.target.value)}
                    style={{ padding: '6px 12px', borderRadius: '6px', border: '1px solid var(--gray-300)', fontSize: '12px', cursor: 'pointer', color: filterFaculty !== 'all' ? 'var(--primary)' : 'var(--gray-700)', background: filterFaculty !== 'all' ? 'var(--primary-light, #e8f5e9)' : 'var(--card-bg)', fontWeight: filterFaculty !== 'all' ? 600 : 400 }}>
                    <option value="all">Todas las facultades</option>
                    {faculties.map(f => <option key={f} value={f}>{f}</option>)}
                  </select>
                  <select value={filterPlatform} onChange={e => setFilterPlatform(e.target.value)}
                    style={{ padding: '6px 12px', borderRadius: '6px', border: '1px solid var(--gray-300)', fontSize: '12px', cursor: 'pointer', color: filterPlatform !== 'all' ? 'var(--primary)' : 'var(--gray-700)', background: filterPlatform !== 'all' ? 'var(--primary-light, #e8f5e9)' : 'var(--card-bg)', fontWeight: filterPlatform !== 'all' ? 600 : 400 }}>
                    <option value="all">Registro Metrik</option>
                    {platformValues.map(p => <option key={p} value={p}>{p || '(en blanco)'}</option>)}
                  </select>
                  {(filterAction !== 'all' || filterMentor !== 'all' || filterFaculty !== 'all' || filterPlatform !== 'all') && (
                    <button className="btn btn-sm btn-ghost"
                      onClick={() => { setFilterAction('all'); setFilterMentor('all'); setFilterFaculty('all'); setFilterPlatform('all'); }}
                      style={{ color: 'var(--error)', fontSize: '11px' }}>
                      ✕ Limpiar filtros
                    </button>
                  )}
                </div>
              </div>

                {/* KPI Row */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '16px', marginBottom: '24px' }}>
                  {[
                    { label: 'Total Acciones', value: kpis.totalAcciones, color: '#1565C0', bg: '#E3F2FD' },
                    { label: 'Total Mentorías', value: kpis.totalMentorias, color: '#2E7D32', bg: '#E8F5E9' },
                    { label: 'Total Invitaciones', value: kpis.totalInvitaciones, color: '#E65100', bg: '#FFF3E0' },
                    { label: 'Total Agendadas', value: kpis.totalAgendadas, color: '#7B1FA2', bg: '#F3E5F5' },
                  ].map((kpi, i) => (
                    <div key={i} style={{
                      background: kpi.bg, borderRadius: '12px', padding: '24px', textAlign: 'center',
                      border: `1px solid ${kpi.color}20`,
                    }}>
                      <div style={{ fontSize: '36px', fontWeight: 900, color: kpi.color, lineHeight: 1 }}>{kpi.value}</div>
                      <div style={{ fontSize: '11px', fontWeight: 700, color: kpi.color, marginTop: '8px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>{kpi.label}</div>
                    </div>
                  ))}
                </div>

                {/* Extra KPIs */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '16px', marginBottom: '24px' }}>
                  {[
                    { label: 'Investigadores únicos', value: kpis.uniqueResearchers, icon: <GraduationCap size={22} />, color: '#1E88E5' },
                    { label: 'Grupos atendidos', value: kpis.uniqueGroups, icon: <Building2 size={22} />, color: '#FB8C00' },
                    { label: 'Mentores activos', value: kpis.uniqueMentors, icon: <UserCheck size={22} />, color: '#8E24AA' },
                  ].map((kpi, i) => (
                    <div key={i} style={{
                      background: 'white', borderRadius: '12px', padding: '20px',
                      border: '1px solid var(--gray-200)', display: 'flex', alignItems: 'center', gap: '16px',
                    }}>
                      <div style={{ width: '48px', height: '48px', borderRadius: '12px', background: `${kpi.color}15`, color: kpi.color, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                        {kpi.icon}
                      </div>
                      <div>
                        <div style={{ fontSize: '28px', fontWeight: 800, lineHeight: 1.1 }}>{kpi.value}</div>
                        <div style={{ fontSize: '12px', color: 'var(--gray-500)', fontWeight: 500, marginTop: '2px' }}>{kpi.label}</div>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Row 1: Actions by mentor + Faculty */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', marginBottom: '20px' }}>
                  <div style={{ background: 'white', borderRadius: '12px', padding: '24px', border: '1px solid var(--gray-200)' }}>
                    <div style={{ marginBottom: '20px' }}>
                      <h4 style={{ margin: 0, fontSize: '14px', fontWeight: 700, color: 'var(--gray-800)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <BarChart2 size={16} /> Acciones completadas por Mentor
                      </h4>
                      <p style={{ margin: '4px 0 0', fontSize: '11px', color: 'var(--gray-400)' }}>Distribución de acciones de acompañamiento</p>
                    </div>
                    {mentorActionStats.map(([name, count]) => (
                      <HBar key={name} label={name} value={count} max={mentorActionStats[0]?.[1] || 1} color="#1565C0" />
                    ))}
                  </div>

                  <div style={{ background: 'white', borderRadius: '12px', padding: '24px', border: '1px solid var(--gray-200)' }}>
                    <div style={{ marginBottom: '20px' }}>
                      <h4 style={{ margin: 0, fontSize: '14px', fontWeight: 700, color: 'var(--gray-800)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <Building2 size={16} /> Mentorías por Facultad / Dpto
                      </h4>
                      <p style={{ margin: '4px 0 0', fontSize: '11px', color: 'var(--gray-400)' }}>Distribución por unidad académica</p>
                    </div>
                    {facultyStats.slice(0, 10).map(([fac, count]) => (
                      <HBar key={fac} label={fac} value={count} max={facultyStats[0]?.[1] || 1} color="#43A047" />
                    ))}
                  </div>
                </div>

                {/* Row 2: Contact prefs (donut) + Link (donut) */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', marginBottom: '20px' }}>
                  <div style={{ background: 'white', borderRadius: '12px', padding: '24px', border: '1px solid var(--gray-200)' }}>
                    <div style={{ marginBottom: '20px' }}>
                      <h4 style={{ margin: 0, fontSize: '14px', fontWeight: 700, color: 'var(--gray-800)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <Phone size={16} /> Preferencias de Contacto
                      </h4>
                      <p style={{ margin: '4px 0 0', fontSize: '11px', color: 'var(--gray-400)' }}>Canal de comunicación preferido</p>
                    </div>
                    <DonutChart data={contactStats} colors={CONTACT_COLORS} />
                  </div>

                  <div style={{ background: 'white', borderRadius: '12px', padding: '24px', border: '1px solid var(--gray-200)' }}>
                    <div style={{ marginBottom: '20px' }}>
                      <h4 style={{ margin: 0, fontSize: '14px', fontWeight: 700, color: 'var(--gray-800)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <Users size={16} /> Vínculo con Mentor
                      </h4>
                      <p style={{ margin: '4px 0 0', fontSize: '11px', color: 'var(--gray-400)' }}>Asignación a grupo de investigación</p>
                    </div>
                    <DonutChart data={linkStats} colors={LINK_COLORS} />
                  </div>
                </div>

                {/* Row 3: Platform adoption (stacked) + Idoneidad */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', marginBottom: '20px' }}>
                  <div style={{ background: 'white', borderRadius: '12px', padding: '24px', border: '1px solid var(--gray-200)' }}>
                    <div style={{ marginBottom: '20px' }}>
                      <h4 style={{ margin: 0, fontSize: '14px', fontWeight: 700, color: 'var(--gray-800)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <Activity size={16} /> Adopción Plataforma Metrik
                      </h4>
                      <p style={{ margin: '4px 0 0', fontSize: '11px', color: 'var(--gray-400)' }}>Estado de registro por mentor</p>
                    </div>
                    {(() => {
                      const maxTotal = platformByMentor.reduce((max, [, vals]) => Math.max(max, Object.values(vals).reduce((a, b) => a + b, 0)), 0);
                      return platformByMentor.map(([name, vals]) => (
                        <StackedBar key={name} label={name} max={maxTotal}
                          segments={Object.entries(PLATFORM_COLORS).map(([status, color]) => ({
                            value: vals[status] || 0, color, label: status || '(en blanco)',
                          }))} />
                      ));
                    })()}
                    {/* Legend */}
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px', marginTop: '16px', paddingTop: '12px', borderTop: '1px solid var(--gray-200)' }}>
                      {Object.entries(PLATFORM_COLORS).map(([label, color]) => (
                        <span key={label} style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '10px', color: 'var(--gray-500)' }}>
                          <span style={{ width: '10px', height: '10px', borderRadius: '3px', background: color }} />
                          {label || '(en blanco)'}
                        </span>
                      ))}
                    </div>
                  </div>

                  <div style={{ background: 'white', borderRadius: '12px', padding: '24px', border: '1px solid var(--gray-200)' }}>
                    <div style={{ marginBottom: '20px' }}>
                      <h4 style={{ margin: 0, fontSize: '14px', fontWeight: 700, color: 'var(--gray-800)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <PieChart size={16} /> Idoneidad Grupo Asignado
                      </h4>
                      <p style={{ margin: '4px 0 0', fontSize: '11px', color: 'var(--gray-400)' }}>Concordancia mentor-grupo</p>
                    </div>
                    {idoneidad.map(([label, count]) => (
                      <HBar key={label} label={label || '(en blanco)'} value={count} max={idoneidad[0]?.[1] || 1}
                        color={LINK_COLORS[label] || '#78909C'} />
                    ))}
                  </div>
                </div>

                {/* Row 4: Mentoring by Research Group (full width) */}
                <div style={{ background: 'white', borderRadius: '12px', padding: '24px', border: '1px solid var(--gray-200)' }}>
                  <div style={{ marginBottom: '20px' }}>
                    <h4 style={{ margin: 0, fontSize: '14px', fontWeight: 700, color: 'var(--gray-800)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <GraduationCap size={16} /> Mentorías por Grupo de Investigación
                    </h4>
                    <p style={{ margin: '4px 0 0', fontSize: '11px', color: 'var(--gray-400)' }}>Sesiones por grupo de investigación asignado</p>
                  </div>
                  {groupStats.map(([name, count]) => (
                    <HBar key={name} label={name} value={count} max={groupStats[0]?.[1] || 1} color="#1565C0" />
                  ))}
                  {groupStats.length === 0 && (
                    <div style={{ fontSize: '12px', color: 'var(--gray-400)', textAlign: 'center', padding: '20px' }}>
                      No hay datos de grupos
                    </div>
                  )}
                </div>
            </div>
          )}

          {/* ==================== REGISTRO ==================== */}
          {activeTab === 'registro' && (
            <div>
              <div className="flex items-center gap-3" style={{ flexWrap: 'wrap', marginBottom: '16px' }}>
                <div className="search-bar" style={{ flex: 1, maxWidth: '350px' }}>
                  <Search size={18} className="search-icon" />
                  <input type="text" placeholder="Buscar por investigador, mentor, grupo..." value={search} onChange={e => setSearch(e.target.value)} />
                </div>
                <span style={{ fontSize: '12px', color: 'var(--gray-500)' }}>{filteredSessions.length} registros</span>
              </div>
              <div className="card">
                <div style={{ overflowX: 'auto' }}>
                  <table className="data-table">
                    <thead><tr><th>Fecha</th><th>Acción</th><th>Medio</th><th>Mentor</th><th>Investigador</th><th>Categoría</th><th>Facultad</th><th>Grupo</th><th>Metrik</th><th>Observaciones</th></tr></thead>
                    <tbody>
                      {paginatedSessions.map(s => (
                        <tr key={s.id}>
                          <td style={{ whiteSpace: 'nowrap', fontSize: '12px' }}>{s.session_date ? new Date(s.session_date + 'T12:00:00').toLocaleDateString('es-CO') : '—'}</td>
                          <td><span style={{ padding: '2px 8px', borderRadius: '12px', fontSize: '10px', fontWeight: 600, background: `${ACTION_COLORS[s.action] || '#999'}20`, color: ACTION_COLORS[s.action] || '#999' }}>{s.action}</span></td>
                          <td style={{ fontSize: '11px' }}>{s.contact_method || '—'}</td>
                          <td style={{ fontSize: '12px', fontWeight: 500 }}>{s.mentor_name}</td>
                          <td style={{ fontSize: '12px' }}>{s.researcher_name || '—'}</td>
                          <td style={{ fontSize: '11px', color: 'var(--gray-500)' }}>{s.researcher_category || '—'}</td>
                          <td style={{ fontSize: '11px', color: 'var(--gray-500)' }}>{s.researcher_faculty || '—'}</td>
                          <td style={{ fontSize: '11px', color: 'var(--gray-500)' }}>{s.group_name || '—'}</td>
                          <td><span style={{ padding: '2px 6px', borderRadius: '10px', fontSize: '9px', fontWeight: 600, background: `${PLATFORM_COLORS[s.platform_status || ''] || '#ccc'}20`, color: PLATFORM_COLORS[s.platform_status || ''] || '#999' }}>{s.platform_status || '—'}</span></td>
                          <td style={{ fontSize: '11px', color: 'var(--gray-500)', maxWidth: '180px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s.observations || '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {totalPages > 1 && (
                  <div className="flex items-center justify-between" style={{ padding: '12px 16px', borderTop: '1px solid var(--gray-200)' }}>
                    <span style={{ fontSize: '12px', color: 'var(--gray-500)' }}>Página {currentPage} de {totalPages}</span>
                    <div className="flex gap-2">
                      <button className="btn btn-sm btn-secondary" disabled={currentPage === 1} onClick={() => setCurrentPage(p => p - 1)}><ChevronLeft size={14} /></button>
                      <button className="btn btn-sm btn-secondary" disabled={currentPage === totalPages} onClick={() => setCurrentPage(p => p + 1)}><ChevronRight size={14} /></button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ==================== INVESTIGADORES ==================== */}
          {activeTab === 'investigadores' && (
            <div>
              <div className="flex items-center gap-3" style={{ marginBottom: '16px' }}>
                <div className="search-bar" style={{ flex: 1, maxWidth: '400px' }}>
                  <Search size={18} className="search-icon" />
                  <input type="text" placeholder="Buscar investigador..." value={search} onChange={e => setSearch(e.target.value)} />
                </div>
                <span style={{ fontSize: '12px', color: 'var(--gray-500)' }}>
                  {researchers.filter(r => !search || r.name.toLowerCase().includes(search.toLowerCase()) || r.email?.toLowerCase().includes(search.toLowerCase())).length} investigadores
                </span>
              </div>
              <div className="card">
                <div style={{ overflowX: 'auto' }}>
                  <table className="data-table">
                    <thead><tr><th>Nombre</th><th>Correo</th><th>Rol</th><th>Programa</th><th>Facultad</th><th>Sede</th><th>Categoría</th></tr></thead>
                    <tbody>
                      {researchers
                        .filter(r => !search || r.name.toLowerCase().includes(search.toLowerCase()) || r.email?.toLowerCase().includes(search.toLowerCase()))
                        .slice(0, 50)
                        .map(r => (
                          <tr key={r.id}>
                            <td style={{ fontWeight: 500, fontSize: '12px' }}>{r.name}</td>
                            <td style={{ fontSize: '11px', color: 'var(--gray-500)' }}>{r.email || '—'}</td>
                            <td style={{ fontSize: '11px' }}>{r.role || '—'}</td>
                            <td style={{ fontSize: '11px' }}>{r.program || '—'}</td>
                            <td style={{ fontSize: '11px' }}>{r.faculty || '—'}</td>
                            <td style={{ fontSize: '11px' }}>{r.campus || '—'}</td>
                            <td><span style={{ padding: '2px 8px', borderRadius: '12px', fontSize: '10px', fontWeight: 600, background: r.category_2024?.includes('Senior') ? '#E8F5E9' : r.category_2024?.includes('Asociado') ? '#E3F2FD' : '#FFF3E0', color: r.category_2024?.includes('Senior') ? '#2E7D32' : r.category_2024?.includes('Asociado') ? '#1565C0' : '#E65100' }}>{r.category_2024 || 'N/A'}</span></td>
                          </tr>
                        ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* ==================== GRUPOS ==================== */}
          {activeTab === 'grupos' && (
            <div>
              <div className="flex items-center gap-3" style={{ marginBottom: '16px' }}>
                <span style={{ fontSize: '12px', color: 'var(--gray-500)' }}>{groups.length} grupos de investigación</span>
              </div>
              <div className="card">
                <div style={{ overflowX: 'auto' }}>
                  <table className="data-table">
                    <thead><tr><th>Código</th><th>Grupo</th><th>Categoría</th><th>Mentor</th><th>Integrantes</th></tr></thead>
                    <tbody>
                      {groups.map(g => (
                        <tr key={g.id}>
                          <td style={{ fontSize: '11px', fontFamily: 'monospace', color: 'var(--gray-500)' }}>{g.code}</td>
                          <td style={{ fontWeight: 500, fontSize: '12px' }}>{g.name}</td>
                          <td><span style={{ padding: '2px 10px', borderRadius: '12px', fontSize: '11px', fontWeight: 700, background: g.category_2024 === 'A1' ? '#E8F5E9' : g.category_2024 === 'A' ? '#E3F2FD' : g.category_2024 === 'B' ? '#FFF3E0' : '#F5F5F5', color: g.category_2024 === 'A1' ? '#1B5E20' : g.category_2024 === 'A' ? '#0D47A1' : g.category_2024 === 'B' ? '#E65100' : '#757575' }}>{g.category_2024 || '—'}</span></td>
                          <td style={{ fontSize: '12px' }}>{g.mentor_name || '—'}</td>
                          <td style={{ fontSize: '12px', textAlign: 'center' }}>{g.member_count || '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}
        </>
      )}

      {/* ==================== MODAL ==================== */}
      {showForm && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
          onClick={() => setShowForm(false)}>
          <div className="card" style={{ width: '620px', maxHeight: '90vh', overflow: 'auto', padding: '28px' }}
            onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between" style={{ marginBottom: '20px' }}>
              <h2 style={{ fontSize: '18px', fontWeight: 700 }}>Nueva Mentoría</h2>
              <button className="btn btn-sm btn-ghost" onClick={() => setShowForm(false)}><X size={18} /></button>
            </div>
            <form onSubmit={handleSubmit}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div>
                  <label style={{ fontSize: '12px', fontWeight: 600, marginBottom: '4px', display: 'block' }}>Fecha *</label>
                  <input type="date" required value={formData.session_date} onChange={e => setFormData({ ...formData, session_date: e.target.value })}
                    style={{ width: '100%', padding: '8px', borderRadius: '6px', border: '1px solid var(--gray-300)', fontSize: '13px' }} />
                </div>
                <div>
                  <label style={{ fontSize: '12px', fontWeight: 600, marginBottom: '4px', display: 'block' }}>Acción *</label>
                  <select required value={formData.action} onChange={e => setFormData({ ...formData, action: e.target.value })}
                    style={{ width: '100%', padding: '8px', borderRadius: '6px', border: '1px solid var(--gray-300)', fontSize: '13px' }}>
                    {ACTIONS.map(a => <option key={a} value={a}>{a}</option>)}
                  </select>
                </div>
                <div>
                  <label style={{ fontSize: '12px', fontWeight: 600, marginBottom: '4px', display: 'block' }}>Medio de contacto</label>
                  <select value={formData.contact_method} onChange={e => setFormData({ ...formData, contact_method: e.target.value })}
                    style={{ width: '100%', padding: '8px', borderRadius: '6px', border: '1px solid var(--gray-300)', fontSize: '13px' }}>
                    <option value="">Seleccionar...</option>
                    {CONTACT_METHODS.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
                <div>
                  <label style={{ fontSize: '12px', fontWeight: 600, marginBottom: '4px', display: 'block' }}>Mentor *</label>
                  <select required value={formData.mentor_name} onChange={e => setFormData({ ...formData, mentor_name: e.target.value })}
                    style={{ width: '100%', padding: '8px', borderRadius: '6px', border: '1px solid var(--gray-300)', fontSize: '13px' }}>
                    <option value="">Seleccionar...</option>
                    {mentorNames.map(n => <option key={n} value={n}>{n}</option>)}
                  </select>
                </div>
                <div style={{ gridColumn: '1 / -1' }}>
                  <label style={{ fontSize: '12px', fontWeight: 600, marginBottom: '4px', display: 'block' }}>Investigador *</label>
                  <input type="text" required list="researchers-list" value={formData.researcher_name}
                    onChange={e => {
                      const val = e.target.value;
                      setFormData(prev => ({ ...prev, researcher_name: val }));
                      const r = researchers.find(x => x.name === val);
                      if (r) setFormData(prev => ({ ...prev, researcher_name: r.name, researcher_faculty: r.faculty || '', researcher_category: r.category_2024 || '' }));
                    }}
                    placeholder="Escribir nombre..."
                    style={{ width: '100%', padding: '8px', borderRadius: '6px', border: '1px solid var(--gray-300)', fontSize: '13px' }} />
                  <datalist id="researchers-list">{researchers.map(r => <option key={r.id} value={r.name} />)}</datalist>
                </div>
                <div>
                  <label style={{ fontSize: '12px', fontWeight: 600, marginBottom: '4px', display: 'block' }}>Vínculo</label>
                  <select value={formData.researcher_link} onChange={e => setFormData({ ...formData, researcher_link: e.target.value })}
                    style={{ width: '100%', padding: '8px', borderRadius: '6px', border: '1px solid var(--gray-300)', fontSize: '13px' }}>
                    <option value="">Seleccionar...</option>
                    {RESEARCHER_LINKS.map(l => <option key={l} value={l}>{l}</option>)}
                  </select>
                </div>
                <div>
                  <label style={{ fontSize: '12px', fontWeight: 600, marginBottom: '4px', display: 'block' }}>Grupo</label>
                  <select value={formData.group_code}
                    onChange={e => { const g = groups.find(x => x.code === e.target.value); setFormData({ ...formData, group_code: e.target.value, group_name: g?.name || '' }); }}
                    style={{ width: '100%', padding: '8px', borderRadius: '6px', border: '1px solid var(--gray-300)', fontSize: '13px' }}>
                    <option value="">Seleccionar...</option>
                    {groups.map(g => <option key={g.id} value={g.code}>{g.name}</option>)}
                  </select>
                </div>
                <div>
                  <label style={{ fontSize: '12px', fontWeight: 600, marginBottom: '4px', display: 'block' }}>Registro en plataforma</label>
                  <select value={formData.platform_status} onChange={e => setFormData({ ...formData, platform_status: e.target.value })}
                    style={{ width: '100%', padding: '8px', borderRadius: '6px', border: '1px solid var(--gray-300)', fontSize: '13px' }}>
                    {PLATFORM_STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>
                <div style={{ gridColumn: '1 / -1' }}>
                  <label style={{ fontSize: '12px', fontWeight: 600, marginBottom: '4px', display: 'block' }}>Observaciones</label>
                  <textarea value={formData.observations} onChange={e => setFormData({ ...formData, observations: e.target.value })}
                    rows={3} placeholder="Notas adicionales..."
                    style={{ width: '100%', padding: '8px', borderRadius: '6px', border: '1px solid var(--gray-300)', fontSize: '13px', resize: 'vertical' }} />
                </div>
              </div>
              <div className="flex justify-end gap-2" style={{ marginTop: '20px' }}>
                <button type="button" className="btn btn-secondary" onClick={() => setShowForm(false)}>Cancelar</button>
                <button type="submit" className="btn btn-primary"><Plus size={16} /> Registrar</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
    </>
  );
}
