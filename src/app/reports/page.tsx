'use client';

import { useState } from 'react';
import dynamic from 'next/dynamic';
import { Sparkles, FileText, Download } from 'lucide-react';

const AIReportGenerator = dynamic(() => import('@/components/AIReportGenerator'), { ssr: false });

const REPORTS = [
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
    icon: '💰', title: 'Informe Financiero', aiType: 'finances',
    desc: 'Balance de gastos por categoría, tendencia presupuestal, ejecución y cumplimiento de metas.',
    gradient: 'linear-gradient(135deg, #E65100, #FB8C00)',
  },
  {
    icon: '📊', title: 'Informe Ejecutivo General', aiType: 'executive',
    desc: 'Resumen holístico de toda la gestión editorial: libros, revistas y finanzas en un solo informe.',
    gradient: 'linear-gradient(135deg, #6A1B9A, #AB47BC)',
  },
  {
    icon: '🎯', title: 'Análisis Personalizado', aiType: 'custom',
    desc: 'Escribe tu propia pregunta o tema de análisis y la IA generará un informe a medida.',
    gradient: 'linear-gradient(135deg, #00838F, #26C6DA)',
  },
];

export default function ReportsPage() {
  const [aiOpen, setAiOpen] = useState(false);
  const [selectedType, setSelectedType] = useState('books');

  const openAI = (type: string) => {
    setSelectedType(type);
    setAiOpen(true);
  };

  return (
    <>
      <div className="page-header">
        <div>
          <h2>Informes</h2>
          <p>Generación de informes inteligentes con datos en tiempo real</p>
        </div>
      </div>

      <div className="page-content">
        {/* AI Banner */}
        <div style={{
          background: 'linear-gradient(135deg, #0D1F0D 0%, #1B5E20 50%, #2E7D32 100%)',
          borderRadius: '16px', padding: '28px 32px', marginBottom: '28px',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
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

          <div style={{ position: 'relative', zIndex: 1 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px' }}>
              <div style={{
                width: '32px', height: '32px', borderRadius: '8px',
                background: 'rgba(255,255,255,0.15)', display: 'flex',
                alignItems: 'center', justifyContent: 'center',
              }}>
                <Sparkles size={16} color="#81C784" />
              </div>
              <span style={{ fontSize: '10px', fontWeight: 700, color: '#81C784', textTransform: 'uppercase', letterSpacing: '1.5px' }}>
                Nuevo · Powered by Gemini
              </span>
            </div>
            <h3 style={{ color: '#fff', fontSize: '20px', fontWeight: 800, margin: 0 }}>
              Informes Inteligentes con IA
            </h3>
            <p style={{ color: 'rgba(255,255,255,0.7)', fontSize: '13px', margin: '6px 0 0', maxWidth: '500px', lineHeight: 1.5 }}>
              Analiza tendencias, compara períodos y recibe recomendaciones accionables basadas en datos reales de PubManager.
            </p>
          </div>

          <button
            onClick={() => openAI('executive')}
            style={{
              position: 'relative', zIndex: 1,
              padding: '12px 24px', borderRadius: '10px',
              background: 'rgba(255,255,255,0.15)', border: '1px solid rgba(255,255,255,0.3)',
              color: '#fff', fontSize: '14px', fontWeight: 700,
              cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px',
              backdropFilter: 'blur(10px)', transition: 'all 0.2s',
            }}
            onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.25)'; }}
            onMouseLeave={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.15)'; }}
          >
            <Sparkles size={16} />
            Generar Informe Ejecutivo
          </button>
        </div>

        {/* Report cards grid */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))',
          gap: '16px',
        }}>
          {REPORTS.map((report, i) => (
            <div
              key={i}
              style={{
                background: 'var(--card-bg)', borderRadius: '14px',
                border: '1px solid var(--gray-200)',
                overflow: 'hidden', transition: 'all 0.2s',
                cursor: 'default',
              }}
            >
              {/* Color bar */}
              <div style={{ height: '4px', background: report.gradient }} />

              <div style={{ padding: '20px' }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: '14px' }}>
                  <span style={{ fontSize: '32px', lineHeight: 1 }}>{report.icon}</span>
                  <div style={{ flex: 1 }}>
                    <h3 style={{ fontSize: '15px', fontWeight: 700, color: 'var(--gray-800)', margin: 0 }}>
                      {report.title}
                    </h3>
                    <p style={{ fontSize: '12px', color: 'var(--gray-500)', marginTop: '4px', lineHeight: 1.5 }}>
                      {report.desc}
                    </p>
                  </div>
                </div>

                <div style={{ display: 'flex', gap: '8px', marginTop: '16px' }}>
                  <button
                    onClick={() => openAI(report.aiType)}
                    className="btn btn-sm"
                    style={{
                      flex: 1, background: report.gradient, color: '#fff',
                      border: 'none', display: 'flex', alignItems: 'center',
                      justifyContent: 'center', gap: '6px', fontWeight: 600,
                      borderRadius: '8px', padding: '8px 14px', fontSize: '12px',
                      cursor: 'pointer',
                    }}
                  >
                    <Sparkles size={13} />
                    Generar con IA
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
      />
    </>
  );
}
