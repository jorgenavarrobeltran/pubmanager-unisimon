'use client';
import Link from 'next/link';
import { useAuth } from '@/contexts/AuthContext';

export default function SettingsPage() {
  const { profile } = useAuth();

  const cards = [
    { icon: '🏛️', title: 'Facultades', desc: 'Gestionar facultades y departamentos de la universidad.', href: '/settings' },
    { icon: '🏢', title: 'Proveedores', desc: 'Directorio de proveedores de diseño, impresión y diagramación.', href: '/finances' },
    { icon: '👥', title: 'Usuarios', desc: 'Gestionar usuarios y permisos del sistema.', href: '/settings/users', adminOnly: true },
    { icon: '👤', title: 'Directorio de Personas', desc: 'Base centralizada de autores, pares y colaboradores con cédula.', href: '/settings' },
  ];

  return (
    <>
      <div className="page-header">
        <div>
          <h2>Configuración</h2>
          <p>Ajustes del sistema, facultades, proveedores y usuarios</p>
        </div>
      </div>
      <div className="page-content">
        <div className="cards-grid">
          {cards.filter(c => !c.adminOnly || profile?.role === 'admin').map((item, i) => (
            <Link key={i} href={item.href} style={{ textDecoration: 'none', color: 'inherit' }}>
              <div className="card" style={{ cursor: 'pointer', transition: 'transform 0.15s, box-shadow 0.15s' }}
                onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = '0 8px 24px rgba(0,0,0,0.1)'; }}
                onMouseLeave={e => { e.currentTarget.style.transform = 'none'; e.currentTarget.style.boxShadow = 'none'; }}
              >
                <div className="card-body">
                  <span style={{ fontSize: '36px' }}>{item.icon}</span>
                  <h3 style={{ fontSize: '16px', fontWeight: 700, marginTop: '12px' }}>{item.title}</h3>
                  <p style={{ fontSize: '13px', color: 'var(--gray-500)', marginTop: '4px' }}>{item.desc}</p>
                </div>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </>
  );
}
