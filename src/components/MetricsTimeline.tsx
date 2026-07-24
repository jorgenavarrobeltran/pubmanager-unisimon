'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';

interface MetricRow {
  journal_id: string;
  journal_name: string;
  year: number;
  sjr: number | null;
  cite_score: number | null;
  impact_factor: number | null;
  h_index: number | null;
}

const METRIC_DEFS = [
  { key: 'sjr' as const, label: 'SJR', color: '#1565C0', description: 'SCImago Journal Rank' },
  { key: 'cite_score' as const, label: 'CiteScore', color: '#43A047', description: 'Scopus CiteScore' },
  { key: 'impact_factor' as const, label: 'Impact Factor', color: '#F57C00', description: 'Factor de Impacto' },
  { key: 'h_index' as const, label: 'H-Index', color: '#7B1FA2', description: 'Índice H' },
];

export default function MetricsTimeline() {
  const [data, setData] = useState<MetricRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const supabase = createClient();
      const { data: raw } = await supabase
        .from('journal_metrics')
        .select('journal_id, year, sjr, cite_score, impact_factor, h_index, journals!inner(name)')
        .order('year', { ascending: true });

      setData((raw || []).map((r: any) => ({
        journal_id: r.journal_id,
        journal_name: r.journals?.name || '?',
        year: r.year,
        sjr: r.sjr ? parseFloat(r.sjr) : null,
        cite_score: r.cite_score ? parseFloat(r.cite_score) : null,
        impact_factor: r.impact_factor ? parseFloat(r.impact_factor) : null,
        h_index: r.h_index,
      })));
      setLoading(false);
    }
    load();
  }, []);

  if (loading) return <p style={{ padding: '20px', color: 'var(--gray-400)', fontSize: '13px' }}>Cargando métricas...</p>;
  if (data.length === 0) return (
    <div style={{ padding: '40px', textAlign: 'center' }}>
      <div style={{ fontSize: '48px', marginBottom: '12px' }}>📊</div>
      <h3 style={{ color: 'var(--gray-600)' }}>Sin métricas registradas</h3>
      <p style={{ color: 'var(--gray-400)', fontSize: '13px', marginTop: '4px' }}>
        Agrega métricas (SJR, CiteScore, H-Index) desde el detalle de cada revista.
      </p>
    </div>
  );

  // Group by journal
  const journalMap = new Map<string, { name: string; rows: MetricRow[] }>();
  data.forEach(d => {
    if (!journalMap.has(d.journal_id)) {
      journalMap.set(d.journal_id, { name: d.journal_name, rows: [] });
    }
    journalMap.get(d.journal_id)!.rows.push(d);
  });
  const journals = [...journalMap.entries()].sort(([, a], [, b]) => a.name.localeCompare(b.name));

  // Get all years
  const years = [...new Set(data.map(d => d.year))].sort();

  // Compute global maxes for sparkline scaling
  const maxSjr = Math.max(...data.map(d => d.sjr || 0), 0.01);
  const maxCs = Math.max(...data.map(d => d.cite_score || 0), 0.01);
  const maxIf = Math.max(...data.map(d => d.impact_factor || 0), 0.01);
  const maxH = Math.max(...data.map(d => d.h_index || 0), 1);

  const getMax = (key: string) => {
    switch (key) {
      case 'sjr': return maxSjr;
      case 'cite_score': return maxCs;
      case 'impact_factor': return maxIf;
      case 'h_index': return maxH;
      default: return 1;
    }
  };

  // Mini sparkline as inline SVG
  const Sparkline = ({ values, color, max }: { values: { year: number; val: number }[]; color: string; max: number }) => {
    if (values.length === 0) return <span style={{ color: 'var(--gray-300)', fontSize: '12px' }}>—</span>;

    const w = 120;
    const h = 36;
    const padX = 4;
    const padY = 4;

    const minYear = years[0];
    const maxYear = years[years.length - 1];
    const yearRange = maxYear - minYear || 1;

    const points = values.map(v => ({
      x: padX + ((v.year - minYear) / yearRange) * (w - 2 * padX),
      y: padY + (1 - v.val / max) * (h - 2 * padY),
      val: v.val,
      year: v.year,
    }));

    const linePath = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(' ');
    const areaPath = linePath + ` L ${points[points.length - 1].x.toFixed(1)} ${h} L ${points[0].x.toFixed(1)} ${h} Z`;

    return (
      <svg width={w} height={h} style={{ display: 'block' }}>
        {/* Area fill */}
        <path d={areaPath} fill={color} opacity={0.1} />
        {/* Line */}
        <path d={linePath} fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
        {/* Points */}
        {points.map((p, i) => (
          <g key={i}>
            <circle cx={p.x} cy={p.y} r={3.5} fill="white" stroke={color} strokeWidth={2} />
            <title>{p.year}: {p.val}</title>
          </g>
        ))}
      </svg>
    );
  };

  return (
    <div>
      {journals.map(([jId, { name, rows }]) => (
        <div key={jId} style={{
          marginBottom: '32px',
          paddingBottom: '24px',
          borderBottom: '1px solid var(--gray-100)',
        }}>
          <h4 style={{ fontWeight: 700, fontSize: '15px', color: 'var(--gray-800)', marginBottom: '16px' }}>
            {name}
          </h4>

          {/* Metrics cards row */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: '12px', marginBottom: '16px' }}>
            {METRIC_DEFS.map(md => {
              const vals = rows
                .filter(r => r[md.key] != null)
                .map(r => ({ year: r.year, val: r[md.key] as number }));

              if (vals.length === 0) return null;

              const latest = vals[vals.length - 1];
              const prev = vals.length >= 2 ? vals[vals.length - 2] : null;
              const trend = prev ? latest.val - prev.val : 0;
              const trendPct = prev && prev.val > 0 ? ((trend / prev.val) * 100).toFixed(1) : null;

              return (
                <div key={md.key} style={{
                  background: 'white',
                  border: '1px solid var(--gray-100)',
                  borderRadius: 'var(--radius-lg)',
                  padding: '16px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '8px',
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <span style={{ fontSize: '11px', fontWeight: 600, color: 'var(--gray-500)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                      {md.label}
                    </span>
                    {trendPct && (
                      <span style={{
                        fontSize: '11px',
                        fontWeight: 700,
                        color: trend > 0 ? '#43A047' : trend < 0 ? '#E53935' : 'var(--gray-400)',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '2px',
                      }}>
                        {trend > 0 ? '▲' : trend < 0 ? '▼' : '→'} {Math.abs(parseFloat(trendPct))}%
                      </span>
                    )}
                  </div>
                  <div style={{ display: 'flex', alignItems: 'flex-end', gap: '8px' }}>
                    <span style={{
                      fontSize: '28px',
                      fontWeight: 800,
                      color: md.color,
                      lineHeight: 1,
                    }}>
                      {md.key === 'h_index' ? latest.val : latest.val.toFixed(3)}
                    </span>
                    <span style={{ fontSize: '11px', color: 'var(--gray-400)', marginBottom: '2px' }}>
                      ({latest.year})
                    </span>
                  </div>
                  <Sparkline values={vals} color={md.color} max={getMax(md.key)} />
                </div>
              );
            })}
          </div>

          {/* Year-by-year data table */}
          <div style={{ overflowX: 'auto' }}>
            <table style={{
              width: '100%',
              borderCollapse: 'collapse',
              fontSize: '12px',
            }}>
              <thead>
                <tr>
                  <th style={{ padding: '6px 12px', textAlign: 'left', borderBottom: '2px solid var(--gray-200)', fontWeight: 600, color: 'var(--gray-500)', fontSize: '11px' }}>Año</th>
                  {METRIC_DEFS.map(md => {
                    const hasData = rows.some(r => r[md.key] != null);
                    if (!hasData) return null;
                    return (
                      <th key={md.key} style={{
                        padding: '6px 12px',
                        textAlign: 'right',
                        borderBottom: '2px solid var(--gray-200)',
                        fontWeight: 600,
                        color: md.color,
                        fontSize: '11px',
                      }}>
                        {md.label}
                      </th>
                    );
                  })}
                </tr>
              </thead>
              <tbody>
                {years.map(y => {
                  const row = rows.find(r => r.year === y);
                  if (!row) return null;
                  return (
                    <tr key={y} style={{ borderBottom: '1px solid var(--gray-50)' }}>
                      <td style={{ padding: '8px 12px', fontWeight: 600, color: 'var(--gray-700)' }}>{y}</td>
                      {METRIC_DEFS.map(md => {
                        const hasData = rows.some(r => r[md.key] != null);
                        if (!hasData) return null;
                        const val = row[md.key];
                        return (
                          <td key={md.key} style={{
                            padding: '8px 12px',
                            textAlign: 'right',
                            fontFamily: 'monospace',
                            fontWeight: val != null ? 600 : 400,
                            color: val != null ? 'var(--gray-800)' : 'var(--gray-300)',
                          }}>
                            {val != null ? (md.key === 'h_index' ? val : (val as number).toFixed(3)) : '—'}
                          </td>
                        );
                      })}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      ))}

      {/* Global legend */}
      <div style={{
        display: 'flex', gap: '16px', justifyContent: 'center',
        paddingTop: '12px', borderTop: '1px solid var(--gray-100)',
        flexWrap: 'wrap',
      }}>
        {METRIC_DEFS.map(md => (
          <div key={md.key} style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11px' }}>
            <div style={{
              width: '10px', height: '10px', borderRadius: '50%',
              background: md.color,
            }} />
            <span style={{ color: 'var(--gray-500)' }}>{md.label}: {md.description}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
