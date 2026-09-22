'use client';

import { useState } from 'react';
import dynamic from 'next/dynamic';
import { Sparkles, FileText, Download, Calendar, Receipt } from 'lucide-react';

const AIReportGenerator = dynamic(() => import('@/components/AIReportGenerator'), { ssr: false });

const REPORTS = [
  {
    icon: '🧾', title: 'Informe de Pagos APC', aiType: 'apc',
    desc: 'Monitoreo de la bolsa de presupuesto anual, financiamiento de cargos de procesamiento de artículos, métricas de alto impacto (Q1/Q2), costos promedio y ranking de autores beneficiarios.',
    gradient: 'linear-gradient(135deg, #064E24, #09843B)',
    leader: 'Fernando Alberto Peñaranda',
  },
  {
    icon: '📚', title: 'Informe de Libros', aiType: 'books',
    desc: 'Producción de libros y capítulos por año, tipo, formato. Tendencias, comparaciones anuales y recomendaciones.',
    gradient: 'linear-gradient(135deg, #1B5E20, #2E7D32)',
  },
  {
    icon: '📰', title: 'Informe de Revistas', aiType: 'journals',
    desc: 'Estado de indexación, cuartiles Scopus, categorías Publindex, periodicidad y visibilidad.',
    gradient: 'linear-gradient(135deg, #1565C0, #1E88E5)',
  },
  {
    icon: '🎓', title: 'Informe de Mentorías', aiType: 'mentoring',
    desc: 'Acompañamiento a investigadores: sesiones por mentor, facultad, adopción de plataforma y vínculos grupales.',
    gradient: 'linear-gradient(135deg, #00695C, #26A69A)',
  },
  {
    icon: '💰', title: 'Informe Financiero', aiType: 'finances',
    desc: 'Balance de gastos por categoría, tendencia presupuestal, ejecución y cumplimiento de metas.',
    gradient: 'linear-gradient(135deg, #E65100, #FB8C00)',
  },
  {
    icon: '📜', title: 'Informe de Certificados', aiType: 'certificates',
    desc: 'Certificados generados por tipo, libro, período. Estadísticas de emisión y destinatarios.',
    gradient: 'linear-gradient(135deg, #4E342E, #8D6E63)',
  },
  {
    icon: '👥', title: 'Informe de Equipo Editorial', aiType: 'team',
    desc: 'Estructura de talento humano, distribución de roles, asignación de revistas a editores y capacidad operativa.',
    gradient: 'linear-gradient(135deg, #00838F, #00ACC1)',
  },
  {
    icon: '🏫', title: 'Informe Escuela de Editores', aiType: 'editors_school',
    desc: 'Progreso de formación editorial: módulos completados, asistencia y evaluaciones.',
    gradient: 'linear-gradient(135deg, #283593, #5C6BC0)',
  },
  {
    icon: '📊', title: 'Informe Ejecutivo General', aiType: 'executive',
    desc: 'Resumen holístico de toda la gestión editorial: libros, revistas, mentorías, certificados, equipo y finanzas en un solo informe.',
    gradient: 'linear-gradient(135deg, #6A1B9A, #AB47BC)',
  },
  {
    icon: '🎯', title: 'Análisis Personalizado', aiType: 'custom',
    desc: 'Escribe tu propia pregunta o tema de análisis y la IA generará un informe a medida.',
    gradient: 'linear-gradient(135deg, #37474F, #546E7A)',
  },
];

export default function ReportsPage() {
  const [aiOpen, setAiOpen] = useState(false);
  const [selectedType, setSelectedType] = useState('apc');
  const [selectedPeriod, setSelectedPeriod] = useState<number>(1); // Default: 1 (año en curso)

  const openAI = (type: string, periodYears: number = 1) => {
    setSelectedType(type);
    setSelectedPeriod(periodYears);
    setAiOpen(true);
  };

  return (
    <>
      <div className="page-header">
        <div>
          <h2>Informes</h2>
          <p>Generación de informes inteligentes con datos en tiempo real y asistencia de IA</p>
        </div>
      </div>

      <div className="page-content">
        {/* AI Banner */}
        <div style={{
          background: 'linear-gradient(135deg, #0D1F0D 0%, #1B5E20 50%, #2E7D32 100%)',
          borderRadius: '16px', padding: '28px 32px', marginBottom: '28px',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          flexWrap: 'wrap', gap: '20px',
          position: 'relative', overflow: 'hidden',
        }}>
          {/* Decorative circles */}
          <div style={{
            position: 'absolute', top: '-40px', right: '-20px',
            width: '200px', height: '200px', borderRadius: '50%',
            background: 'rgba(255,255,255,0.05)',
          }} />
          <div style={{
            position: 'absolute', bottom: '-60px', right: '80px',
            width: '160px', height: '160px', borderRadius: '50%',
            background: 'rgba(255,255,255,0.03)',
          }} />

          <div style={{ position: 'relative', zIndex: 1, maxWidth: '580px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px' }}>
              <div style={{
                width: '32px', height: '32px', borderRadius: '8px',
                background: 'rgba(255,255,255,0.15)', display: 'flex',
                alignItems: 'center', justifyContent: 'center',
              }}>
                <Sparkles size={16} color="#81C784" />
              </div>
              <span style={{ fontSize: '10px', fontWeight: 700, color: '#81C784', textTransform: 'uppercase', letterSpacing: '1.5px' }}>
                Actualizado · Informes con IA y Año en Curso
              </span>
            </div>
            <h3 style={{ color: '#fff', fontSize: '22px', fontWeight: 800, margin: 0 }}>
              Informes Inteligentes con IA
            </h3>
            <p style={{ color: 'rgba(255,255,255,0.8)', fontSize: '13px', margin: '6px 0 0', lineHeight: 1.5 }}>
              Genera balances ejecutivos, diagnósticos institucionales y proyecciones estratégicas para la vigencia actual o históricos multianuales.
            </p>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', zIndex: 1, minWidth: '260px' }}>
            <button
              onClick={() => openAI('executive', 1)}
              style={{
                padding: '11px 20px', borderRadius: '10px',
                background: 'white', color: '#1B5E20',
                border: 'none', fontSize: '13px', fontWeight: 700,
                cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
                boxShadow: '0 4px 14px rgba(0,0,0,0.15)', transition: 'all 0.2s',
              }}
              onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-1px)'; }}
              onMouseLeave={e => { e.currentTarget.style.transform = 'translateY(0)'; }}
            >
              <Sparkles size={16} color="#1B5E20" />
              Informe Ejecutivo: Año en Curso (2026)
            </button>

            <button
              onClick={() => openAI('executive', 0)}
              style={{
                padding: '9px 16px', borderRadius: '10px',
                background: 'rgba(255,255,255,0.15)', border: '1px solid rgba(255,255,255,0.3)',
                color: '#fff', fontSize: '12px', fontWeight: 600,
                cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px',
                backdropFilter: 'blur(10px)', transition: 'all 0.2s',
              }}
              onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.25)'; }}
              onMouseLeave={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.15)'; }}
            >
              <Calendar size={13} />
              Informe Ejecutivo Histórico Completo
            </button>
          </div>
        </div>

        {/* Report cards grid */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))',
          gap: '18px',
        }}>
          {REPORTS.map((report, i) => (
            <div
              key={i}
              style={{
                background: 'var(--card-bg)', borderRadius: '14px',
                border: '1px solid var(--gray-200)',
                overflow: 'hidden', transition: 'all 0.2s',
                display: 'flex', flexDirection: 'column',
                boxShadow: '0 2px 8px rgba(0,0,0,0.02)',
              }}
            >
              {/* Color bar */}
              <div style={{ height: '4px', background: report.gradient }} />

              <div style={{ padding: '20px', flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
                <div>
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: '14px' }}>
                    <span style={{ fontSize: '32px', lineHeight: 1 }}>{report.icon}</span>
                    <div style={{ flex: 1 }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '6px' }}>
                        <h3 style={{ fontSize: '15px', fontWeight: 700, color: 'var(--gray-800)', margin: 0 }}>
                          {report.title}
                        </h3>
                        {report.aiType === 'apc' && (
                          <span style={{ fontSize: '9px', fontWeight: 800, background: '#DCFCE7', color: '#166534', padding: '2px 6px', borderRadius: '10px' }}>
                            NUEVO
                          </span>
                        )}
                      </div>
                      <p style={{ fontSize: '12px', color: 'var(--gray-500)', marginTop: '6px', lineHeight: 1.5 }}>
                        {report.desc}
                      </p>
                    </div>
                  </div>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginTop: '18px' }}>
                  {/* Option 1: Año en curso */}
                  <button
                    onClick={() => openAI(report.aiType, 1)}
                    style={{
                      background: report.gradient, color: '#fff',
                      border: 'none', display: 'flex', alignItems: 'center',
                      justifyContent: 'center', gap: '6px', fontWeight: 700,
                      borderRadius: '8px', padding: '8px 14px', fontSize: '12px',
                      cursor: 'pointer', transition: 'opacity 0.15s',
                    }}
                    onMouseEnter={e => { e.currentTarget.style.opacity = '0.9'; }}
                    onMouseLeave={e => { e.currentTarget.style.opacity = '1'; }}
                  >
                    <Sparkles size={13} />
                    Generar Año en Curso (2026)
                  </button>

                  {/* Option 2: Histórico o multianual */}
                  <button
                    onClick={() => openAI(report.aiType, 0)}
                    style={{
                      background: 'var(--gray-50)', color: 'var(--gray-700)',
                      border: '1px solid var(--gray-200)', display: 'flex', alignItems: 'center',
                      justifyContent: 'center', gap: '6px', fontWeight: 600,
                      borderRadius: '8px', padding: '6px 12px', fontSize: '11px',
                      cursor: 'pointer', transition: 'background 0.15s',
                    }}
                    onMouseEnter={e => { e.currentTarget.style.background = 'var(--gray-100)'; }}
                    onMouseLeave={e => { e.currentTarget.style.background = 'var(--gray-50)'; }}
                  >
                    <Calendar size={12} />
                    Histórico / Período Personalizado
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      <AIReportGenerator
        isOpen={aiOpen}
        onClose={() => setAiOpen(false)}
        initialType={selectedType}
        initialPeriodYears={selectedPeriod}
      />
    </>
  );
}
