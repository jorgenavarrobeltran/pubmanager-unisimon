'use client';

import { useMemo, useState } from 'react';
import {
  BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  Legend, AreaChart, Area, ComposedChart, Line,
} from 'recharts';
import { BOOK_TYPES } from '@/lib/constants';
import { Calendar } from 'lucide-react';

/* ─── Types ─── */
interface BookForStats {
  id: string;
  title: string;
  book_type: string | null;
  status: string;
  year_published: number | null;
  format: string | null;
  editorial: string | null;
  tipo_minciencias: string | null;
  subtipo_minciencias: string | null;
  num_authors: number | null;
  num_chapters: number | null;
  isbn_digital: string | null;
  isbn_print: string | null;
}
interface ChapterForStats { id: string; book_id: string; }
interface AuthorLinkForStats { book_id: string; person_id: string; role: string; }
interface BookStatsProps {
  books: BookForStats[];
  chapters: ChapterForStats[];
  authorLinks: AuthorLinkForStats[];
}

/* ─── Constants ─── */
const COLORS = [
  '#1B5E20', '#2E7D32', '#388E3C', '#43A047', '#4CAF50',
  '#66BB6A', '#81C784', '#A5D6A7', '#C8E6C9', '#E8F5E9',
];
const TYPE_COLORS: Record<string, string> = {
  libro_completo: '#1B5E20', libro_compilatorio: '#43A047',
  memorias: '#81C784', cartilla_manual: '#C8E6C9',
};
const FORMAT_COLORS: Record<string, string> = {
  digital: '#1565C0', impreso: '#E65100', ambos: '#6A1B9A', sin_datos: '#9E9E9E',
};
const FORMAT_LABELS: Record<string, string> = {
  digital: 'Digital', impreso: 'Impreso', ambos: 'Digital + Impreso', sin_datos: 'Sin datos',
};
const TIPO_MINC_LABELS: Record<string, string> = {
  'Nuevo Conocimiento': 'Nuevo Conocimiento',
  'Divulgación Pública de la Ciencia': 'Divulgación',
  'Formación': 'Formación', 'Extensión': 'Extensión',
};

const PERIOD_PRESETS = [
  { label: 'Últimos 3 años', years: 3 },
  { label: 'Últimos 5 años', years: 5 },
  { label: 'Últimos 10 años', years: 10 },
  { label: 'Todo el histórico', years: 0 },
];

/* ─── Shared UI ─── */
function StatCard({ label, value, sub, icon, color }: { label: string; value: string | number; sub?: string; icon: string; color?: string }) {
  return (
    <div style={{
      background: 'var(--card-bg)', borderRadius: '12px', padding: '20px',
      border: '1px solid var(--gray-200)', flex: 1, minWidth: '150px',
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <div style={{ fontSize: '11px', color: 'var(--gray-500)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '6px' }}>{label}</div>
          <div style={{ fontSize: '28px', fontWeight: 800, color: color || 'var(--gray-900)', lineHeight: 1.1 }}>{value}</div>
          {sub && <div style={{ fontSize: '12px', color: 'var(--gray-400)', marginTop: '4px' }}>{sub}</div>}
        </div>
        <span style={{ fontSize: '24px', opacity: 0.8 }}>{icon}</span>
      </div>
    </div>
  );
}

function ChartCard({ title, children, subtitle }: { title: string; children: React.ReactNode; subtitle?: string }) {
  return (
    <div style={{
      background: 'var(--card-bg)', borderRadius: '12px', padding: '20px',
      border: '1px solid var(--gray-200)',
    }}>
      <div style={{ marginBottom: '16px' }}>
        <h4 style={{ margin: 0, fontSize: '14px', fontWeight: 700, color: 'var(--gray-800)' }}>{title}</h4>
        {subtitle && <p style={{ margin: '2px 0 0', fontSize: '11px', color: 'var(--gray-400)' }}>{subtitle}</p>}
      </div>
      {children}
    </div>
  );
}

const ttStyle = { backgroundColor: 'rgba(0,0,0,0.88)', border: 'none', borderRadius: '8px', padding: '10px 14px', boxShadow: '0 8px 32px rgba(0,0,0,0.2)' };
function CustomTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div style={ttStyle}>
      <p style={{ color: '#fff', fontSize: '12px', fontWeight: 700 }}>{label}</p>
      {payload.map((e: any, i: number) => (
        <p key={i} style={{ color: e.color || '#aaa', fontSize: '11px' }}>
          {e.name}: <strong style={{ color: '#fff' }}>{e.value}</strong>
        </p>
      ))}
    </div>
  );
}

/* ─── Table styles ─── */
const thStyle: React.CSSProperties = {
  padding: '10px 14px', textAlign: 'right', fontSize: '12px', fontWeight: 700,
  color: 'var(--gray-600)', borderBottom: '2px solid var(--gray-200)',
  background: 'var(--gray-50)', position: 'sticky', top: 0,
};
const tdStyle: React.CSSProperties = {
  padding: '10px 14px', textAlign: 'right', fontSize: '13px',
  color: 'var(--gray-700)', borderBottom: '1px solid var(--gray-100)',
};
const tfStyle: React.CSSProperties = {
  padding: '10px 14px', textAlign: 'right', fontSize: '13px',
  fontWeight: 800, color: 'var(--primary)', borderTop: '2px solid var(--gray-300)',
  background: 'var(--gray-50)',
};

/* ─── Main component ─── */
export default function BookStats({ books, chapters, authorLinks }: BookStatsProps) {
  const currentYear = new Date().getFullYear();
  const [periodYears, setPeriodYears] = useState(5);
  const [customFrom, setCustomFrom] = useState<number | null>(null);
  const [customTo, setCustomTo] = useState<number | null>(null);

  const yearRange = useMemo(() => {
    if (customFrom !== null && customTo !== null) return { from: customFrom, to: customTo };
    if (periodYears === 0) {
      const years = books.filter(b => b.status === 'publicado').map(b => b.year_published).filter((y): y is number => y !== null);
      return { from: years.length > 0 ? Math.min(...years) : 2012, to: currentYear };
    }
    return { from: currentYear - periodYears + 1, to: currentYear };
  }, [periodYears, customFrom, customTo, books, currentYear]);

  const stats = useMemo(() => {
    const allPublished = books.filter(b => b.status === 'publicado');
    const published = allPublished.filter(b => b.year_published && b.year_published >= yearRange.from && b.year_published <= yearRange.to);
    const publishedIds = new Set(published.map(b => b.id));

    const filteredChapters = chapters.filter(ch => publishedIds.has(ch.book_id));
    const filteredAuthors = authorLinks.filter(al => publishedIds.has(al.book_id));
    const uniqueAuthors = new Set(filteredAuthors.map(a => a.person_id)).size;

    // Build yearly map
    const yearMap = new Map<number, { books: number; chapters: number; authors: Set<string>; completo: number; compilatorio: number; memorias: number; cartilla: number; isbnCount: number }>();
    for (let y = yearRange.from; y <= yearRange.to; y++) {
      yearMap.set(y, { books: 0, chapters: 0, authors: new Set(), completo: 0, compilatorio: 0, memorias: 0, cartilla: 0, isbnCount: 0 });
    }
    for (const b of published) {
      const y = yearMap.get(b.year_published!)!;
      y.books++;
      if (b.book_type === 'libro_completo') y.completo++;
      if (b.book_type === 'libro_compilatorio') y.compilatorio++;
      if (b.book_type === 'memorias') y.memorias++;
      if (b.book_type === 'cartilla_manual') y.cartilla++;
      if (b.isbn_digital || b.isbn_print) y.isbnCount++;
    }
    for (const ch of filteredChapters) {
      const book = published.find(b => b.id === ch.book_id);
      if (book?.year_published && yearMap.has(book.year_published)) {
        yearMap.get(book.year_published)!.chapters++;
      }
    }
    for (const al of filteredAuthors) {
      const book = published.find(b => b.id === al.book_id);
      if (book?.year_published && yearMap.has(book.year_published)) {
        yearMap.get(book.year_published)!.authors.add(al.person_id);
      }
    }

    const yearlyData = Array.from(yearMap.entries())
      .sort(([a], [b]) => a - b)
      .map(([year, d]) => ({
        year: year.toString(),
        libros: d.books,
        capítulos: d.chapters,
        autores: d.authors.size,
        completo: d.completo,
        compilatorio: d.compilatorio,
        memorias: d.memorias,
        cartilla: d.cartilla,
        isbn: d.isbnCount,
      }));

    // Cumulative
    let cum = 0;
    const cumulativeData = yearlyData.map(d => { cum += d.libros; return { ...d, acumulado: cum }; });

    // Type distribution (filtered period)
    const typeData = BOOK_TYPES.map(t => ({
      name: t.label,
      value: published.filter(b => b.book_type === t.key).length,
      key: t.key,
    })).filter(d => d.value > 0);

    // Format distribution (filtered period)
    const fmtCounts = new Map<string, number>();
    for (const b of published) { const f = b.format || 'sin_datos'; fmtCounts.set(f, (fmtCounts.get(f) || 0) + 1); }
    const formatData = Array.from(fmtCounts.entries())
      .map(([key, value]) => ({ name: FORMAT_LABELS[key] || key, value, key }))
      .sort((a, b) => b.value - a.value);

    // Minciencias
    const mincCounts = new Map<string, number>();
    for (const b of published) { if (b.tipo_minciencias) mincCounts.set(b.tipo_minciencias, (mincCounts.get(b.tipo_minciencias) || 0) + 1); }
    const mincData = Array.from(mincCounts.entries())
      .map(([key, value]) => ({ name: TIPO_MINC_LABELS[key] || key, value }))
      .sort((a, b) => b.value - a.value);

    const subtipoCounts = new Map<string, number>();
    for (const b of published) { if (b.subtipo_minciencias) subtipoCounts.set(b.subtipo_minciencias, (subtipoCounts.get(b.subtipo_minciencias) || 0) + 1); }
    const subtipoData = Array.from(subtipoCounts.entries())
      .map(([key, value]) => ({ name: key.length > 35 ? key.slice(0, 35) + '…' : key, value }))
      .sort((a, b) => b.value - a.value).slice(0, 10);

    // Roles
    const roleCounts = new Map<string, number>();
    for (const al of filteredAuthors) roleCounts.set(al.role, (roleCounts.get(al.role) || 0) + 1);
    const roleData = Array.from(roleCounts.entries()).map(([k, v]) => ({ name: k, value: v })).sort((a, b) => b.value - a.value);

    // ISBN
    const hasAnyIsbn = published.filter(b => b.isbn_digital || b.isbn_print).length;
    const hasBothIsbn = published.filter(b => b.isbn_digital && b.isbn_print).length;

    // Summary table totals
    const totals = yearlyData.reduce((acc, d) => ({
      libros: acc.libros + d.libros,
      capítulos: acc.capítulos + d.capítulos,
      autores: acc.autores + d.autores,
      completo: acc.completo + d.completo,
      compilatorio: acc.compilatorio + d.compilatorio,
      memorias: acc.memorias + d.memorias,
      cartilla: acc.cartilla + d.cartilla,
      isbn: acc.isbn + d.isbn,
    }), { libros: 0, capítulos: 0, autores: 0, completo: 0, compilatorio: 0, memorias: 0, cartilla: 0, isbn: 0 });

    const avgBooks = yearlyData.length > 0 ? (totals.libros / yearlyData.length).toFixed(1) : '0';

    return {
      published, filteredChapters, uniqueAuthors, yearlyData, cumulativeData,
      typeData, formatData, mincData, subtipoData, roleData,
      hasAnyIsbn, hasBothIsbn, totals, avgBooks,
    };
  }, [books, chapters, authorLinks, yearRange]);

  const handlePreset = (years: number) => {
    setPeriodYears(years);
    setCustomFrom(null);
    setCustomTo(null);
  };

  const allYears = useMemo(() => {
    const yrs = books.filter(b => b.status === 'publicado').map(b => b.year_published).filter((y): y is number => y !== null);
    const min = yrs.length > 0 ? Math.min(...yrs) : 2012;
    const max = yrs.length > 0 ? Math.max(...yrs) : currentYear;
    return Array.from({ length: max - min + 1 }, (_, i) => min + i);
  }, [books, currentYear]);

  return (
    <div>
      {/* ─── Period filter bar ─── */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '20px',
        padding: '12px 16px', background: 'var(--card-bg)', borderRadius: '10px',
        border: '1px solid var(--gray-200)', flexWrap: 'wrap',
      }}>
        <Calendar size={16} style={{ color: 'var(--gray-500)' }} />
        <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--gray-600)', marginRight: '4px' }}>Período:</span>
        {PERIOD_PRESETS.map(p => (
          <button
            key={p.years}
            onClick={() => handlePreset(p.years)}
            style={{
              padding: '5px 14px', borderRadius: '6px', fontSize: '12px', fontWeight: 600,
              border: 'none', cursor: 'pointer', transition: 'all 0.15s',
              background: periodYears === p.years && customFrom === null ? 'var(--primary)' : 'var(--gray-100)',
              color: periodYears === p.years && customFrom === null ? '#fff' : 'var(--gray-600)',
            }}
          >
            {p.label}
          </button>
        ))}
        <div style={{ width: '1px', height: '24px', background: 'var(--gray-200)', margin: '0 4px' }} />
        <span style={{ fontSize: '11px', color: 'var(--gray-500)' }}>Personalizado:</span>
        <select
          value={customFrom ?? ''}
          onChange={e => {
            const v = e.target.value ? parseInt(e.target.value) : null;
            setCustomFrom(v);
            if (v !== null && (customTo === null || customTo < v)) setCustomTo(currentYear);
          }}
          style={{
            padding: '4px 8px', borderRadius: '6px', border: '1px solid var(--gray-300)',
            fontSize: '12px', color: 'var(--gray-700)', background: 'var(--card-bg)', cursor: 'pointer',
          }}
        >
          <option value="">Desde</option>
          {allYears.map(y => <option key={y} value={y}>{y}</option>)}
        </select>
        <span style={{ fontSize: '11px', color: 'var(--gray-400)' }}>–</span>
        <select
          value={customTo ?? ''}
          onChange={e => {
            const v = e.target.value ? parseInt(e.target.value) : null;
            setCustomTo(v);
            if (v !== null && (customFrom === null || customFrom > v)) setCustomFrom(v);
          }}
          style={{
            padding: '4px 8px', borderRadius: '6px', border: '1px solid var(--gray-300)',
            fontSize: '12px', color: 'var(--gray-700)', background: 'var(--card-bg)', cursor: 'pointer',
          }}
        >
          <option value="">Hasta</option>
          {allYears.map(y => <option key={y} value={y}>{y}</option>)}
        </select>
        <div style={{ marginLeft: 'auto', fontSize: '11px', color: 'var(--gray-400)', fontWeight: 500 }}>
          Mostrando: <strong style={{ color: 'var(--gray-700)' }}>{yearRange.from}–{yearRange.to}</strong>
        </div>
      </div>

      {/* ─── KPI Row ─── */}
      <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', marginBottom: '24px' }}>
        <StatCard icon="📚" label="Libros Publicados" value={stats.published.length}
          sub={`${yearRange.from} – ${yearRange.to}`} color="var(--primary)" />
        <StatCard icon="📖" label="Capítulos" value={stats.filteredChapters.length}
          sub={`∅ ${stats.published.length > 0 ? (stats.filteredChapters.length / stats.published.length).toFixed(1) : '0'} por libro`} />
        <StatCard icon="👥" label="Autores Únicos" value={stats.uniqueAuthors}
          sub={`en el período`} />
        <StatCard icon="📊" label="Promedio Anual" value={stats.avgBooks}
          sub={`${yearRange.to - yearRange.from + 1} años`} />
        <StatCard icon="🔗" label="ISBN Registrados" value={stats.hasAnyIsbn}
          sub={`${stats.hasBothIsbn} con ambos`} />
      </div>

      {/* ─── Summary Table ─── */}
      <div style={{
        background: 'var(--card-bg)', borderRadius: '12px',
        border: '1px solid var(--gray-200)', marginBottom: '24px', overflow: 'hidden',
      }}>
        <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--gray-200)' }}>
          <h4 style={{ margin: 0, fontSize: '14px', fontWeight: 700, color: 'var(--gray-800)' }}>
            📋 Resumen de Producción por Año
          </h4>
          <p style={{ margin: '2px 0 0', fontSize: '11px', color: 'var(--gray-400)' }}>
            Detalle anual de libros, capítulos y autores ({yearRange.from}–{yearRange.to})
          </p>
        </div>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: '700px' }}>
            <thead>
              <tr>
                <th style={{ ...thStyle, textAlign: 'left', position: 'sticky', left: 0, zIndex: 1 }}>Año</th>
                <th style={thStyle}>Libros</th>
                <th style={thStyle}>Capítulos</th>
                <th style={thStyle}>Autores</th>
                <th style={{ ...thStyle, borderLeft: '2px solid var(--gray-200)' }}>Completo</th>
                <th style={thStyle}>Compilatorio</th>
                <th style={thStyle}>Memorias</th>
                <th style={thStyle}>Cartilla</th>
                <th style={{ ...thStyle, borderLeft: '2px solid var(--gray-200)' }}>ISBN</th>
              </tr>
            </thead>
            <tbody>
              {stats.yearlyData.map((d, i) => (
                <tr key={d.year} style={{ background: i % 2 === 0 ? 'transparent' : 'var(--gray-50)' }}>
                  <td style={{ ...tdStyle, textAlign: 'left', fontWeight: 700, color: 'var(--primary)', position: 'sticky', left: 0, background: i % 2 === 0 ? 'var(--card-bg)' : 'var(--gray-50)' }}>
                    {d.year}
                  </td>
                  <td style={{ ...tdStyle, fontWeight: 700, fontSize: '14px', color: 'var(--gray-900)' }}>{d.libros || '—'}</td>
                  <td style={tdStyle}>{d.capítulos || '—'}</td>
                  <td style={tdStyle}>{d.autores || '—'}</td>
                  <td style={{ ...tdStyle, borderLeft: '2px solid var(--gray-100)' }}>{d.completo || '—'}</td>
                  <td style={tdStyle}>{d.compilatorio || '—'}</td>
                  <td style={tdStyle}>{d.memorias || '—'}</td>
                  <td style={tdStyle}>{d.cartilla || '—'}</td>
                  <td style={{ ...tdStyle, borderLeft: '2px solid var(--gray-100)' }}>{d.isbn || '—'}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr>
                <td style={{ ...tfStyle, textAlign: 'left' }}>Total</td>
                <td style={{ ...tfStyle, fontSize: '14px' }}>{stats.totals.libros}</td>
                <td style={tfStyle}>{stats.totals.capítulos}</td>
                <td style={tfStyle}>{stats.totals.autores}</td>
                <td style={{ ...tfStyle, borderLeft: '2px solid var(--gray-200)' }}>{stats.totals.completo}</td>
                <td style={tfStyle}>{stats.totals.compilatorio}</td>
                <td style={tfStyle}>{stats.totals.memorias}</td>
                <td style={tfStyle}>{stats.totals.cartilla}</td>
                <td style={{ ...tfStyle, borderLeft: '2px solid var(--gray-200)' }}>{stats.totals.isbn}</td>
              </tr>
              <tr>
                <td style={{ ...tfStyle, textAlign: 'left', color: 'var(--gray-500)', fontWeight: 600, fontSize: '11px' }}>Promedio/año</td>
                <td style={{ ...tfStyle, color: 'var(--gray-500)', fontWeight: 600, fontSize: '12px' }}>{stats.avgBooks}</td>
                <td style={{ ...tfStyle, color: 'var(--gray-500)', fontWeight: 600, fontSize: '12px' }}>{stats.yearlyData.length > 0 ? (stats.totals.capítulos / stats.yearlyData.length).toFixed(1) : '—'}</td>
                <td style={{ ...tfStyle, color: 'var(--gray-500)', fontWeight: 600, fontSize: '12px' }}>{stats.yearlyData.length > 0 ? (stats.totals.autores / stats.yearlyData.length).toFixed(0) : '—'}</td>
                <td colSpan={4} style={{ ...tfStyle, color: 'var(--gray-400)', fontWeight: 500, fontSize: '11px', borderLeft: '2px solid var(--gray-200)' }}></td>
                <td style={{ ...tfStyle, color: 'var(--gray-500)', fontWeight: 600, fontSize: '12px', borderLeft: '2px solid var(--gray-200)' }}>{stats.yearlyData.length > 0 ? (stats.totals.isbn / stats.yearlyData.length).toFixed(1) : '—'}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>

      {/* ─── Row 1: Timeline + Type pie ─── */}
      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '16px', marginBottom: '16px' }}>
        <ChartCard title="📈 Producción de Libros por Año" subtitle="Libros publicados y tendencia acumulada">
          <ResponsiveContainer width="100%" height={300}>
            <ComposedChart data={stats.cumulativeData} margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--gray-200)" />
              <XAxis dataKey="year" fontSize={11} tick={{ fill: 'var(--gray-500)' }} />
              <YAxis yAxisId="left" fontSize={11} tick={{ fill: 'var(--gray-500)' }} />
              <YAxis yAxisId="right" orientation="right" fontSize={11} tick={{ fill: 'var(--gray-400)' }} />
              <Tooltip content={<CustomTooltip />} />
              <Legend wrapperStyle={{ fontSize: '11px' }} />
              <Bar yAxisId="left" dataKey="libros" name="Libros" fill="#2E7D32" radius={[4, 4, 0, 0]} />
              <Line yAxisId="right" type="monotone" dataKey="acumulado" name="Acumulado" stroke="#FF8F00" strokeWidth={2} dot={{ r: 3 }} />
            </ComposedChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title="📊 Tipo de Libro" subtitle="Distribución en el período">
          <ResponsiveContainer width="100%" height={300}>
            <PieChart>
              <Pie data={stats.typeData} dataKey="value" nameKey="name" cx="50%" cy="50%"
                innerRadius={55} outerRadius={95} paddingAngle={3} strokeWidth={0}>
                {stats.typeData.map((entry, i) => (
                  <Cell key={entry.key} fill={TYPE_COLORS[entry.key] || COLORS[i % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip content={<CustomTooltip />} />
              <Legend wrapperStyle={{ fontSize: '10px' }} />
            </PieChart>
          </ResponsiveContainer>
        </ChartCard>
      </div>

      {/* ─── Row 2: Chapters + Authors per year ─── */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '16px' }}>
        <ChartCard title="📖 Capítulos por Año" subtitle="Producción de capítulos de libro">
          <ResponsiveContainer width="100%" height={260}>
            <AreaChart data={stats.yearlyData} margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
              <defs>
                <linearGradient id="gradChapters" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#1B5E20" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#1B5E20" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--gray-200)" />
              <XAxis dataKey="year" fontSize={11} tick={{ fill: 'var(--gray-500)' }} />
              <YAxis fontSize={11} tick={{ fill: 'var(--gray-500)' }} />
              <Tooltip content={<CustomTooltip />} />
              <Area type="monotone" dataKey="capítulos" name="Capítulos" stroke="#1B5E20" fill="url(#gradChapters)" strokeWidth={2} />
            </AreaChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title="👥 Autores Participantes por Año" subtitle="Autores únicos por período">
          <ResponsiveContainer width="100%" height={260}>
            <AreaChart data={stats.yearlyData} margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
              <defs>
                <linearGradient id="gradAuthors" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#1565C0" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#1565C0" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--gray-200)" />
              <XAxis dataKey="year" fontSize={11} tick={{ fill: 'var(--gray-500)' }} />
              <YAxis fontSize={11} tick={{ fill: 'var(--gray-500)' }} />
              <Tooltip content={<CustomTooltip />} />
              <Area type="monotone" dataKey="autores" name="Autores" stroke="#1565C0" fill="url(#gradAuthors)" strokeWidth={2} />
            </AreaChart>
          </ResponsiveContainer>
        </ChartCard>
      </div>

      {/* ─── Row 3: Stacked types + format pie ─── */}
      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '16px', marginBottom: '16px' }}>
        <ChartCard title="📚 Tipos de Libro por Año" subtitle="Composición anual de la producción">
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={stats.yearlyData} margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--gray-200)" />
              <XAxis dataKey="year" fontSize={11} tick={{ fill: 'var(--gray-500)' }} />
              <YAxis fontSize={11} tick={{ fill: 'var(--gray-500)' }} />
              <Tooltip content={<CustomTooltip />} />
              <Legend wrapperStyle={{ fontSize: '10px' }} />
              <Bar dataKey="completo" name="Completo" stackId="a" fill="#1B5E20" />
              <Bar dataKey="compilatorio" name="Compilatorio" stackId="a" fill="#43A047" />
              <Bar dataKey="memorias" name="Memorias" stackId="a" fill="#81C784" />
              <Bar dataKey="cartilla" name="Cartilla" stackId="a" fill="#C8E6C9" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title="💿 Formato de Publicación" subtitle="Digital, Impreso o Ambos">
          <ResponsiveContainer width="100%" height={280}>
            <PieChart>
              <Pie data={stats.formatData} dataKey="value" nameKey="name" cx="50%" cy="50%"
                innerRadius={50} outerRadius={90} paddingAngle={3} strokeWidth={0}>
                {stats.formatData.map((entry, i) => (
                  <Cell key={entry.key} fill={FORMAT_COLORS[entry.key] || COLORS[i % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip content={<CustomTooltip />} />
              <Legend wrapperStyle={{ fontSize: '10px' }} />
            </PieChart>
          </ResponsiveContainer>
        </ChartCard>
      </div>

      {/* ─── Row 4: Minciencias + Subtipo ─── */}
      {(stats.mincData.length > 0 || stats.subtipoData.length > 0) && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '16px' }}>
          {stats.mincData.length > 0 && (
            <ChartCard title="🏛️ Tipo Minciencias" subtitle="Clasificación por tipo de producto">
              <ResponsiveContainer width="100%" height={260}>
                <BarChart data={stats.mincData} layout="vertical" margin={{ top: 5, right: 20, bottom: 5, left: 80 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--gray-200)" />
                  <XAxis type="number" fontSize={11} tick={{ fill: 'var(--gray-500)' }} />
                  <YAxis type="category" dataKey="name" fontSize={11} tick={{ fill: 'var(--gray-600)' }} width={75} />
                  <Tooltip content={<CustomTooltip />} />
                  <Bar dataKey="value" name="Libros" fill="#2E7D32" radius={[0, 6, 6, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </ChartCard>
          )}

          {stats.subtipoData.length > 0 && (
            <ChartCard title="📋 Subtipo Minciencias" subtitle="Top 10 subclasificaciones">
              <ResponsiveContainer width="100%" height={260}>
                <BarChart data={stats.subtipoData} layout="vertical" margin={{ top: 5, right: 20, bottom: 5, left: 120 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--gray-200)" />
                  <XAxis type="number" fontSize={11} tick={{ fill: 'var(--gray-500)' }} />
                  <YAxis type="category" dataKey="name" fontSize={10} tick={{ fill: 'var(--gray-600)' }} width={115} />
                  <Tooltip content={<CustomTooltip />} />
                  <Bar dataKey="value" name="Libros" fill="#43A047" radius={[0, 6, 6, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </ChartCard>
          )}
        </div>
      )}

      {/* ─── Row 5: Roles ─── */}
      {stats.roleData.length > 0 && (
        <div style={{ marginBottom: '16px' }}>
          <ChartCard title="🎭 Roles de Autoría" subtitle="Distribución de roles en el período">
            <ResponsiveContainer width="100%" height={220}>
              <PieChart>
                <Pie data={stats.roleData} dataKey="value" nameKey="name" cx="50%" cy="50%"
                  innerRadius={45} outerRadius={80} paddingAngle={3} strokeWidth={0}>
                  {stats.roleData.map((_, i) => (
                    <Cell key={i} fill={COLORS[i % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip content={<CustomTooltip />} />
                <Legend wrapperStyle={{ fontSize: '10px' }} />
              </PieChart>
            </ResponsiveContainer>
          </ChartCard>
        </div>
      )}
    </div>
  );
}
