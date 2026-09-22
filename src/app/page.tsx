'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { BookOpen, Library, GraduationCap, DollarSign, Award, TrendingUp, ArrowUpRight, ArrowDownRight, Calendar, ExternalLink } from 'lucide-react';
import Link from 'next/link';
import dynamic from 'next/dynamic';
import DashboardTasks from '@/components/DashboardTasks';

const AlertsPanel = dynamic(() => import('@/components/AlertsPanel'), { ssr: false });

interface DashboardData {
  journals: { name: string; type: string; id: string; issn_online?: string; issn_print?: string; }[];
  journalCount: number;
  scientificCount: number;
  academicCount: number;
  scopusCount: number;
  bookCount: number;
  certificateCount: number;
  revenueTarget: number;
  totalIncome: number;
  totalExpenses: number;
  indexations: { journal_name: string; indexer: string; category: string; year: number; subject_category: string }[];
}

export default function DashboardPage() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadDashboard() {
      const supabase = createClient();

      const [
        { data: journals },
        { data: books },
        { data: certificates },
        { data: targets },
        { data: incomes },
        { data: expenses },
        { data: latestIdx },
      ] = await Promise.all([
        supabase.from('journals').select('id, name, type, issn_print, issn_online, area, h_index, status'),
        supabase.from('books').select('id', { count: 'exact', head: true }),
        supabase.from('certificates').select('id', { count: 'exact', head: true }),
        supabase.from('revenue_targets').select('*').eq('year', new Date().getFullYear()).single(),
        supabase.from('external_services').select('amount').in('status', ['facturado', 'pagado']),
        supabase.from('expenses').select('amount'),
        supabase.from('journal_indexations')
          .select('journal_id, indexer, category, year, subject_category, journals!inner(name)')
          .in('indexer', ['scopus', 'publindex'])
          .order('year', { ascending: false })
          .limit(50),
      ]);

      const scientificJournals = journals?.filter((j: any) => j.type === 'cientifica') || [];
      const academicJournals = journals?.filter((j: any) => j.type === 'academica') || [];

      // Count scopus-indexed journals
      const scopusJournalIds = new Set(
        latestIdx?.filter((i: any) => i.indexer === 'scopus').map((i: any) => i.journal_id) || []
      );

      const totalIncome = incomes?.reduce((sum: number, s: any) => sum + (s.amount || 0), 0) || 0;
      const totalExpenses = expenses?.reduce((sum: number, e: any) => sum + (e.amount || 0), 0) || 0;

      const formattedIndexations = latestIdx?.map((i: any) => ({
        journal_name: (i.journals as any)?.name || '',
        indexer: i.indexer,
        category: i.category || '',
        year: i.year,
        subject_category: i.subject_category || '',
      })) || [];

      setData({
        journals: journals || [],
        journalCount: journals?.length || 0,
        scientificCount: scientificJournals.length,
        academicCount: academicJournals.length,
        scopusCount: scopusJournalIds.size,
        bookCount: books?.length || 0,
        certificateCount: certificates?.length || 0,
        revenueTarget: targets?.target_amount || 30000000,
        totalIncome,
        totalExpenses,
        indexations: formattedIndexations,
      });
      setLoading(false);
    }

    loadDashboard();
  }, []);

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '60vh' }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: '40px', marginBottom: '12px', animation: 'pulse-glow 1.5s ease-in-out infinite' }}>📚</div>
          <p style={{ color: 'var(--gray-500)' }}>Cargando dashboard...</p>
        </div>
      </div>
    );
  }

  if (!data) return null;

  const revenuePercent = data.revenueTarget > 0
    ? Math.round((data.totalIncome / data.revenueTarget) * 100)
    : 0;

  // Get best quartile per journal from latest Scopus data
  const bestQuartiles = new Map<string, { quartile: string; trend: string }>();
  const scopus2025 = data.indexations
    .filter(i => i.indexer === 'scopus' && i.year === 2025);
  const scopus2024 = data.indexations
    .filter(i => i.indexer === 'scopus' && i.year === 2024);

  scopus2025.forEach(idx => {
    const current = bestQuartiles.get(idx.journal_name);
    if (!current || idx.category < current.quartile) {
      const prev = scopus2024.find(
        p => p.journal_name === idx.journal_name && p.subject_category === idx.subject_category
      );
      let trend = 'stable';
      if (prev && idx.category < prev.category) trend = 'up';
      if (prev && idx.category > prev.category) trend = 'down';
      bestQuartiles.set(idx.journal_name, { quartile: idx.category, trend });
    }
  });

  // Latest Publindex per journal
  const latestPublindex = new Map<string, string>();
  data.indexations
    .filter(i => i.indexer === 'publindex')
    .sort((a, b) => b.year - a.year)
    .forEach(idx => {
      if (!latestPublindex.has(idx.journal_name)) {
        latestPublindex.set(idx.journal_name, idx.category);
      }
    });

  const formatCOP = (amount: number) =>
    new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(amount);

  return (
    <>
      <div className="page-header">
        <div className="flex items-center justify-between">
          <div>
            <h2>Dashboard</h2>
            <p>Departamento de Publicaciones — Universidad Simón Bolívar</p>
          </div>
          <div className="flex gap-2">
            <span className="badge badge-info" style={{ fontSize: '13px', padding: '6px 14px' }}>
              <Calendar size={14} />
              {new Date().toLocaleDateString('es-CO', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
            </span>
          </div>
        </div>
      </div>

      <div className="page-content">
        {/* Alert: Publindex results */}
        <div style={{
          background: 'linear-gradient(135deg, #E3F2FD, #E8F5E9)',
          borderRadius: 'var(--radius-lg)',
          padding: '16px 24px',
          display: 'flex',
          alignItems: 'center',
          gap: '16px',
          marginBottom: '24px',
          border: '1px solid #81C784',
        }}>
          <span style={{ fontSize: '28px' }}>🎉</span>
          <div>
            <p style={{ fontWeight: 700, color: '#1B5E20', fontSize: '14px' }}>
              Resultados Oficiales Publindex — Convocatoria 977
            </p>
            <p style={{ fontSize: '13px', color: '#2E7D32' }}>
              Se han publicado los resultados finales de la Convocatoria 977 de Publindex. La categorización de las revistas se mantiene ratificada sin cambios frente a los preliminares.
            </p>
          </div>
          <Link href="/journals" className="btn btn-primary btn-sm" style={{ marginLeft: 'auto', flexShrink: 0 }}>
            Ver Revistas
          </Link>
        </div>

        {/* KPI Cards */}
        <div className="stats-grid mb-6">
          <div className="stat-card">
            <div className="stat-icon" style={{ background: '#E8F5E9' }}>
              <BookOpen size={24} color="var(--primary)" />
            </div>
            <div className="stat-info">
              <h4>Revistas</h4>
              <div className="stat-value">{data.journalCount}</div>
              <div className="stat-subtitle">{data.scientificCount} científicas · {data.academicCount} académicas</div>
            </div>
          </div>

          <div className="stat-card">
            <div className="stat-icon" style={{ background: '#FFF3E0' }}>
              <TrendingUp size={24} color="#E65100" />
            </div>
            <div className="stat-info">
              <h4>En Scopus</h4>
              <div className="stat-value">{data.scopusCount}</div>
              <div className="stat-subtitle">de {data.scientificCount} científicas indexadas</div>
            </div>
          </div>

          <div className="stat-card">
            <div className="stat-icon" style={{ background: '#E3F2FD' }}>
              <Library size={24} color="#1565C0" />
            </div>
            <div className="stat-info">
              <h4>Libros</h4>
              <div className="stat-value">{data.bookCount}</div>
              <div className="stat-subtitle">Registrados en el sistema</div>
            </div>
          </div>

          <div className="stat-card">
            <div className="stat-icon" style={{ background: '#F3E5F5' }}>
              <Award size={24} color="#7B1FA2" />
            </div>
            <div className="stat-info">
              <h4>Certificados</h4>
              <div className="stat-value">{data.certificateCount}</div>
              <div className="stat-subtitle">Expedidos este año</div>
            </div>
          </div>
        </div>

        {/* Revenue Progress */}
        <div className="card mb-6">
          <div className="card-header">
            <h3>💰 Meta de Ingresos 2026</h3>
            <span className="badge badge-info">{formatCOP(data.revenueTarget)}</span>
          </div>
          <div className="card-body">
            <div className="flex items-center justify-between mb-4">
              <div>
                <span style={{ fontSize: '13px', color: 'var(--gray-500)' }}>Recaudado</span>
                <div style={{ fontSize: '24px', fontWeight: 800, color: 'var(--primary)' }}>
                  {formatCOP(data.totalIncome)}
                </div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <span style={{ fontSize: '13px', color: 'var(--gray-500)' }}>Gastos</span>
                <div style={{ fontSize: '20px', fontWeight: 700, color: 'var(--error)' }}>
                  {formatCOP(data.totalExpenses)}
                </div>
              </div>
            </div>
            <div style={{
              height: '12px',
              background: 'var(--gray-200)',
              borderRadius: '6px',
              overflow: 'hidden',
              position: 'relative',
            }}>
              <div style={{
                height: '100%',
                width: `${Math.min(revenuePercent, 100)}%`,
                background: revenuePercent >= 100
                  ? 'linear-gradient(90deg, var(--primary), var(--primary-light))'
                  : revenuePercent >= 50
                    ? 'linear-gradient(90deg, var(--accent), var(--accent-light))'
                    : 'linear-gradient(90deg, var(--error), #EF5350)',
                borderRadius: '6px',
                transition: 'width 1s ease-out',
              }} />
            </div>
            <p style={{ fontSize: '12px', color: 'var(--gray-400)', marginTop: '8px', textAlign: 'right' }}>
              {revenuePercent}% de la meta
            </p>
          </div>
        </div>

        {/* Journals Grid */}
        <div className="card">
          <div className="card-header">
            <h3>📚 Estado de Revistas</h3>
            <Link href="/journals" className="btn btn-ghost btn-sm">
              Ver todas <ArrowUpRight size={14} />
            </Link>
          </div>
          <div className="card-body" style={{ padding: 0 }}>
            <table className="data-table">
              <thead>
                <tr>
                  <th>Revista</th>
                  <th>Tipo</th>
                  <th>ISSN</th>
                  <th>Publindex</th>
                  <th>Scopus</th>
                  <th>Tendencia</th>
                </tr>
              </thead>
              <tbody>
                {data.journals.map(j => {
                  const scopusData = bestQuartiles.get(j.name);
                  const publindex = latestPublindex.get(j.name);

                  return (
                    <tr key={j.id}>
                      <td>
                        <Link href={`/journals/${j.id}`} style={{ color: 'var(--gray-900)', fontWeight: 600, textDecoration: 'none' }}>
                          {j.name}
                        </Link>
                      </td>
                      <td>
                        <span className={`badge ${j.type === 'cientifica' ? 'badge-info' : 'badge-neutral'}`}>
                          {j.type === 'cientifica' ? 'Científica' : 'Académica'}
                        </span>
                      </td>
                      <td style={{ fontFamily: 'monospace', fontSize: '12px', color: 'var(--gray-500)' }}>
                        {j.issn_online || j.issn_print || '—'}
                      </td>
                      <td>
                        {publindex ? (
                          <span className={`badge badge-${publindex.toLowerCase()}`}>
                            {publindex}
                          </span>
                        ) : (
                          <span style={{ color: 'var(--gray-400)' }}>—</span>
                        )}
                      </td>
                      <td>
                        {scopusData ? (
                          <span className={`badge badge-${scopusData.quartile.toLowerCase()}`}>
                            {scopusData.quartile}
                          </span>
                        ) : (
                          <span style={{ color: 'var(--gray-400)' }}>—</span>
                        )}
                      </td>
                      <td>
                        {scopusData?.trend === 'up' && (
                          <span className="stat-trend up">
                            <ArrowUpRight size={14} /> Subió
                          </span>
                        )}
                        {scopusData?.trend === 'down' && (
                          <span className="stat-trend down">
                            <ArrowDownRight size={14} /> Bajó
                          </span>
                        )}
                        {scopusData?.trend === 'stable' && (
                          <span style={{ fontSize: '12px', color: 'var(--gray-400)' }}>Estable</span>
                        )}
                        {!scopusData && <span style={{ color: 'var(--gray-400)' }}>—</span>}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* Bottom Section */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(350px, 1fr))', gap: '24px', marginTop: '24px' }}>
          <DashboardTasks />
          <AlertsPanel />
        </div>
      </div>
    </>
  );
}
