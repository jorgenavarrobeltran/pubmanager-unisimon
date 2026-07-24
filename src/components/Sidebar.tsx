'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard,
  ClipboardList,
  BookOpen,
  Library,
  GraduationCap,
  DollarSign,
  Award,
  FileText,
  BarChart3,
  Settings,
  LogOut,
  ChevronDown,
  Users,
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useState } from 'react';

const iconMap: Record<string, React.ComponentType<{ size?: number }>> = {
  LayoutDashboard,
  ClipboardList,
  BookOpen,
  Library,
  GraduationCap,
  DollarSign,
  Award,
  FileText,
  BarChart3,
  Settings,
  Users,
};

// module key must match the key in AuthContext ACCESS_MATRIX
const NAV_ITEMS = [
  { section: 'Principal' },
  { key: 'dashboard', label: 'Dashboard', icon: 'LayoutDashboard', href: '/', module: 'dashboard' },
  { key: 'planner', label: 'Planificador', icon: 'ClipboardList', href: '/planner', module: 'planner' },
  { section: 'Gestión Editorial' },
  { key: 'journals', label: 'Revistas', icon: 'BookOpen', href: '/journals', badge: '8', module: 'journals' },
  { key: 'books', label: 'Libros', icon: 'Library', href: '/books', module: 'books' },
  { key: 'editors-school', label: 'Escuela de Editores', icon: 'GraduationCap', href: '/editors-school', module: 'editors-school' },
  { key: 'team', label: 'Equipo', icon: 'Users', href: '/team', module: 'team' },
  { section: 'Administración' },
  { key: 'finances', label: 'Finanzas', icon: 'DollarSign', href: '/finances', module: 'finances' },
  { key: 'certificates', label: 'Certificados', icon: 'Award', href: '/certificates', module: 'certificates' },
  { key: 'policies', label: 'Políticas', icon: 'FileText', href: '/policies', module: 'policies' },
  { section: 'Reportes' },
  { key: 'reports', label: 'Informes', icon: 'BarChart3', href: '/reports', module: 'reports' },
  { key: 'settings', label: 'Configuración', icon: 'Settings', href: '/settings', module: 'settings' },
];

const ROLE_LABELS: Record<string, string> = {
  admin: 'Administrador',
  director: 'Director Editorial',
  editor_revista: 'Editor de Revista',
  editor_libros: 'Editor + Libros',
  coord_libros: 'Coord. de Libros',
  asistente: 'Asistente',
};

const ROLE_COLORS: Record<string, string> = {
  admin: '#E53935',
  director: '#7B1FA2',
  editor_revista: '#1565C0',
  editor_libros: '#00897B',
  coord_libros: '#F57C00',
  asistente: '#78909C',
};

export default function Sidebar() {
  const pathname = usePathname();
  const { user, profile, hasAccess, signOut, loading } = useAuth();
  const [showUserMenu, setShowUserMenu] = useState(false);

  // Filter nav items based on role — show all while loading
  const visibleItems = NAV_ITEMS.filter(item => {
    if ('section' in item && !('key' in item)) return true; // section headers always show
    if (!profile || loading) return true; // show all while loading
    if ('module' in item && item.module) {
      return hasAccess(item.module);
    }
    return true;
  });

  // Remove consecutive section headers (when all items in section are hidden)
  const filteredItems = visibleItems.filter((item, i) => {
    if ('section' in item && !('key' in item)) {
      const next = visibleItems[i + 1];
      if (!next || ('section' in next && !('key' in next))) return false;
    }
    return true;
  });

  return (
    <aside className="sidebar">
      <div className="sidebar-header">
        <div className="sidebar-logo">PM</div>
        <div className="sidebar-title">
          <h1>PubManager</h1>
          <span>Universidad Simón Bolívar</span>
        </div>
      </div>

      <nav className="sidebar-nav">
        {filteredItems.map((item, i) => {
          if ('section' in item && !('key' in item)) {
            return (
              <div key={`section-${i}`} className="nav-section-label">
                {item.section}
              </div>
            );
          }

          if (!('key' in item) || !item.href) return null;

          const Icon = iconMap[item.icon || ''];
          const isActive =
            item.href === '/'
              ? pathname === '/'
              : pathname.startsWith(item.href);

          return (
            <Link
              key={item.key}
              href={item.href}
              className={`nav-item ${isActive ? 'active' : ''}`}
            >
              {Icon && <Icon size={20} />}
              <span>{item.label}</span>
              {'badge' in item && item.badge && (
                <span className="nav-badge">{item.badge}</span>
              )}
            </Link>
          );
        })}
      </nav>

      {/* User footer — always show if we have a user or profile */}
      <div style={{
        padding: '12px 16px', borderTop: '1px solid var(--gray-100)',
        position: 'relative',
      }}>
        <div
          onClick={() => setShowUserMenu(!showUserMenu)}
          style={{
            display: 'flex', alignItems: 'center', gap: '10px',
            padding: '8px 10px', borderRadius: 'var(--radius-md)',
            cursor: 'pointer', transition: 'background 0.15s',
            background: showUserMenu ? 'var(--gray-50)' : 'transparent',
          }}
          onMouseEnter={e => (e.currentTarget.style.background = 'var(--gray-50)')}
          onMouseLeave={e => { if (!showUserMenu) e.currentTarget.style.background = 'transparent'; }}
        >
          <div style={{
            width: '34px', height: '34px', borderRadius: '10px',
            background: profile
              ? `linear-gradient(135deg, ${ROLE_COLORS[profile.role] || '#78909C'}, ${ROLE_COLORS[profile.role] || '#78909C'}aa)`
              : 'linear-gradient(135deg, #09843B, #0aa64d)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: 'white', fontSize: '14px', fontWeight: 700, flexShrink: 0,
          }}>
            {(profile?.full_name || profile?.email || user?.email || '?').substring(0, 2).toUpperCase()}
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--gray-800)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {profile?.full_name || user?.email?.split('@')[0] || 'Usuario'}
            </div>
            <div style={{
              fontSize: '10px', fontWeight: 600,
              color: profile ? (ROLE_COLORS[profile.role] || '#78909C') : '#09843B',
              textTransform: 'uppercase', letterSpacing: '0.3px',
            }}>
              {profile ? (ROLE_LABELS[profile.role] || profile.role) : 'Cargando...'}
            </div>
          </div>
          <ChevronDown size={14} color="var(--gray-400)" style={{
            transition: 'transform 0.2s',
            transform: showUserMenu ? 'rotate(180deg)' : 'none',
          }} />
        </div>

        {showUserMenu && (
          <div style={{
            position: 'absolute', bottom: '100%', left: '12px', right: '12px',
            background: 'white', borderRadius: 'var(--radius-lg)',
            boxShadow: '0 -8px 32px rgba(0,0,0,0.12)',
            border: '1px solid var(--gray-100)', overflow: 'hidden',
            marginBottom: '4px', zIndex: 50,
          }}>
            <div style={{ padding: '12px 14px', borderBottom: '1px solid var(--gray-50)' }}>
              <div style={{ fontSize: '12px', color: 'var(--gray-400)' }}>{profile?.email || user?.email || ''}</div>
            </div>
            <button
              onClick={signOut}
              style={{
                width: '100%', display: 'flex', alignItems: 'center', gap: '8px',
                padding: '10px 14px', background: 'none', border: 'none',
                cursor: 'pointer', fontSize: '13px', fontWeight: 600,
                color: '#E53935', transition: 'background 0.15s',
              }}
              onMouseEnter={e => (e.currentTarget.style.background = '#FFEBEE')}
              onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
            >
              <LogOut size={16} /> Cerrar Sesión
            </button>
          </div>
        )}
      </div>
    </aside>
  );
}
