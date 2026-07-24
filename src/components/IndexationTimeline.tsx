'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';

interface Indexation {
  journal_id: string;
  journal_name: string;
  indexer: string;
  category: string;
  year: number;
  subject_category: string | null;
}

interface Props {
  indexer: 'publindex' | 'scopus';
}

const PUBLINDEX_COLORS: Record<string, { bg: string; fg: string }> = {
  A1: { bg: '#1565C0', fg: '#fff' },
  A2: { bg: '#42A5F5', fg: '#fff' },
  B: { bg: '#FFA726', fg: '#fff' },
  C: { bg: '#EF5350', fg: '#fff' },
};

const SCOPUS_COLORS: Record<string, { bg: string; fg: string }> = {
  Q1: { bg: '#1565C0', fg: '#fff' },
  Q2: { bg: '#43A047', fg: '#fff' },
  Q3: { bg: '#FFA726', fg: '#fff' },
  Q4: { bg: '#EF5350', fg: '#fff' },
};

export default function IndexationTimeline({ indexer }: Props) {
  const [data, setData] = useState<Indexation[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const supabase = createClient();
      const { data: raw } = await supabase
        .from('journal_indexations')
        .select('journal_id, category, year, subject_category, indexer, journals!inner(name)')
        .eq('indexer', indexer)
        .order('year', { ascending: true });

      setData((raw || []).map((r: any) => ({
        journal_id: r.journal_id,
        journal_name: r.journals?.name || '?',
        indexer: r.indexer,
        category: r.category,
        year: r.year,
        subject_category: r.subject_category,
      })));
      setLoading(false);
    }
    load();
  }, [indexer]);

  if (loading) return <p style={{ padding: '20px', color: 'var(--gray-400)', fontSize: '13px' }}>Cargando histórico...</p>;
  if (data.length === 0) return <p style={{ padding: '20px', color: 'var(--gray-400)', fontSize: '13px' }}>Sin datos de {indexer === 'publindex' ? 'Publindex' : 'Scopus'}</p>;

  const colors = indexer === 'publindex' ? PUBLINDEX_COLORS : SCOPUS_COLORS;

  // Get unique years and journals
  const years = [...new Set(data.map(d => d.year))].sort();
  
  // For Scopus, group by journal + subject_category (best quartile per journal per year)
  // For Publindex, just journal
  let rowKeys: { label: string; journalId: string; subLabel?: string }[];
  
  if (indexer === 'scopus') {
    // Group by journal + subject_category
    const groups = new Map<string, { label: string; journalId: string; subLabel: string }>();
    data.forEach(d => {
      const key = `${d.journal_id}|${d.subject_category || 'General'}`;
      if (!groups.has(key)) {
        groups.set(key, {
          label: d.journal_name,
          journalId: d.journal_id,
          subLabel: d.subject_category || 'General',
        });
      }
    });
    rowKeys = [...groups.values()].sort((a, b) => a.label.localeCompare(b.label) || a.subLabel.localeCompare(b.subLabel));
  } else {
    const journals = new Map<string, { label: string; journalId: string }>();
    data.forEach(d => {
      if (!journals.has(d.journal_id)) {
        journals.set(d.journal_id, { label: d.journal_name, journalId: d.journal_id });
      }
    });
    rowKeys = [...journals.values()].sort((a, b) => a.label.localeCompare(b.label));
  }

  // Lookup function
  const getCell = (row: typeof rowKeys[0], year: number): string | null => {
    if (indexer === 'scopus') {
      const match = data.find(d =>
        d.journal_id === row.journalId &&
        d.year === year &&
        (d.subject_category || 'General') === row.subLabel
      );
      return match?.category || null;
    } else {
      const match = data.find(d => d.journal_id === row.journalId && d.year === year);
      return match?.category || null;
    }
  };

  return (
    <div style={{ overflowX: 'auto' }}>
      <table style={{
        width: '100%',
        borderCollapse: 'separate',
        borderSpacing: '2px',
        fontSize: '12px',
      }}>
        <thead>
          <tr>
            <th style={{
              position: 'sticky', left: 0, zIndex: 2,
              background: 'white', padding: '8px 12px',
              textAlign: 'left', fontWeight: 700,
              fontSize: '11px', color: 'var(--gray-500)',
              borderBottom: '2px solid var(--gray-200)',
              minWidth: indexer === 'scopus' ? '220px' : '180px',
            }}>
              {indexer === 'scopus' ? 'Revista / Subject Category' : 'Revista'}
            </th>
            {years.map(y => (
              <th key={y} style={{
                padding: '8px 4px',
                textAlign: 'center',
                fontWeight: 600,
                fontSize: '11px',
                color: 'var(--gray-600)',
                borderBottom: '2px solid var(--gray-200)',
                minWidth: '48px',
              }}>
                {y}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rowKeys.map((row, i) => {
            // Check if this is the first row of a journal group (for Scopus)
            const isFirstInGroup = indexer === 'scopus' && (i === 0 || rowKeys[i - 1].journalId !== row.journalId);
            const groupSize = indexer === 'scopus' ? rowKeys.filter(r => r.journalId === row.journalId).length : 1;

            return (
              <tr key={`${row.journalId}-${row.subLabel || ''}`}>
                <td style={{
                  position: 'sticky', left: 0, zIndex: 1,
                  background: 'white',
                  padding: '6px 12px',
                  borderTop: isFirstInGroup && i > 0 ? '2px solid var(--gray-200)' : undefined,
                }}>
                  {indexer === 'scopus' ? (
                    <div>
                      {isFirstInGroup && (
                        <div style={{ fontWeight: 700, color: 'var(--gray-800)', fontSize: '12px', marginBottom: '2px' }}>
                          {row.label}
                        </div>
                      )}
                      <div style={{ fontSize: '10px', color: 'var(--gray-500)', paddingLeft: isFirstInGroup ? 0 : '0px' }}>
                        ↳ {row.subLabel}
                      </div>
                    </div>
                  ) : (
                    <span style={{ fontWeight: 600, color: 'var(--gray-800)' }}>{row.label}</span>
                  )}
                </td>
                {years.map(y => {
                  const cat = getCell(row, y);
                  const c = cat ? colors[cat] : null;
                  return (
                    <td key={y} style={{
                      padding: '4px',
                      textAlign: 'center',
                      borderTop: isFirstInGroup && i > 0 ? '2px solid var(--gray-200)' : undefined,
                    }}>
                      {cat ? (
                        <div style={{
                          background: c?.bg || 'var(--gray-300)',
                          color: c?.fg || '#fff',
                          borderRadius: '6px',
                          padding: '4px 8px',
                          fontWeight: 800,
                          fontSize: '12px',
                          display: 'inline-block',
                          minWidth: '36px',
                          transition: 'transform 0.15s',
                          cursor: 'default',
                          boxShadow: '0 1px 3px rgba(0,0,0,0.12)',
                        }}
                          title={`${row.label}${row.subLabel ? ` — ${row.subLabel}` : ''}: ${cat} (${y})`}
                          onMouseEnter={e => (e.currentTarget.style.transform = 'scale(1.15)')}
                          onMouseLeave={e => (e.currentTarget.style.transform = 'scale(1)')}
                        >
                          {cat}
                        </div>
                      ) : (
                        <span style={{ color: 'var(--gray-200)', fontSize: '16px' }}>·</span>
                      )}
                    </td>
                  );
                })}
              </tr>
            );
          })}
        </tbody>
      </table>

      {/* Legend */}
      <div style={{
        display: 'flex', gap: '12px', justifyContent: 'center',
        marginTop: '16px', paddingTop: '12px',
        borderTop: '1px solid var(--gray-100)',
      }}>
        {Object.entries(colors).map(([cat, c]) => (
          <div key={cat} style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11px' }}>
            <div style={{
              width: '24px', height: '20px', borderRadius: '4px',
              background: c.bg, color: c.fg,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontWeight: 800, fontSize: '10px',
            }}>
              {cat}
            </div>
            <span style={{ color: 'var(--gray-500)' }}>
              {indexer === 'publindex'
                ? (cat === 'A1' ? 'Más alta' : cat === 'A2' ? 'Alta' : cat === 'B' ? 'Media' : 'Básica')
                : (cat === 'Q1' ? 'Top 25%' : cat === 'Q2' ? 'Top 50%' : cat === 'Q3' ? 'Top 75%' : 'Top 100%')
              }
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
