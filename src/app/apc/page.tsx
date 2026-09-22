'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import initialAPCData from '@/lib/apc-initial-data.json';
import scopusBenchmark from '@/lib/scopus-benchmark.json';
import { generateAPCWordReport } from '@/lib/apcWordGenerator';
import { exportAPCToExcel } from '@/lib/apcExcelGenerator';
import {
  BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  Legend, Line, ComposedChart, Area
} from 'recharts';
import {
  Receipt, Plus, Search, Filter, Download, FileText,
  DollarSign, Award, BookOpen, Users, Building2,
  TrendingUp, CheckCircle2, Clock, AlertTriangle,
  ExternalLink, ChevronLeft, ChevronRight, X, Edit,
  ShieldCheck, Info, Sparkles, Layers, SlidersHorizontal,
  RefreshCw
} from 'lucide-react';

/* ---------- Types ---------- */
interface APCPayment {
  id: string;
  year: number;
  consecutive?: number;
  investigador: string;
  cedula?: string | null;
  fecha_autorizacion?: string | null;
  autorizado_por?: string | null;
  articulo: string;
  revista: string;
  issn?: string | null;
  beneficiario: string;
  valor_factura_divisa?: string | null;
  moneda?: string | null;
  monto_divisa?: number | null;
  consecutivo_factura?: string | null;
  codigo_interno?: string | null;
  orden_compra?: string | null;
  fecha_pago?: string | null;
  cuartil: string;
  estado_solicitud?: string;
  estado_final: string;
  valor_pagado_pesos: number;
  valor_retenido_pesos?: number;
  pais_origen?: string | null;
  link_publicacion?: string | null;
  programa_academico?: string | null;
  facultad: string;
  centro_investigacion?: string | null;
  autor_correspondencia?: string | null;
  afiliacion_institucional?: string | null;
  grupo_investigacion?: string | null;
  vinculado_grupo?: string | null;
  observaciones?: string | null;
}

interface APCAnnualBudget {
  year: number;
  allocated_budget: number;
  notes?: string;
}

const QUARTILE_COLORS: Record<string, string> = {
  Q1: '#10B981', // Emerald
  Q2: '#3B82F6', // Blue
  Q3: '#F59E0B', // Amber
  Q4: '#8B5CF6', // Purple
  'S/C': '#94A3B8', // Slate
};

const STATUS_COLORS: Record<string, { bg: string; text: string; border: string }> = {
  PAGADA: { bg: '#ECFDF5', text: '#065F46', border: '#A7F3D0' },
  'EN PROCESO': { bg: '#EFF6FF', text: '#1E40AF', border: '#BFDBFE' },
  ATENDIDA: { bg: '#F0FDF4', text: '#166534', border: '#BBF7D0' },
  PENDIENTE: { bg: '#FFFBEB', text: '#92400E', border: '#FDE68A' },
  REEMBOLSO: { bg: '#FAF5FF', text: '#6B21A8', border: '#E9D5FF' },
  DEVUELTA: { bg: '#FEF2F2', text: '#991B1B', border: '#FECACA' },
};

const PAGE_SIZE = 15;

function normalizeResearcherName(name: string): string {
  if (!name) return 'Desconocido';
  let s = name.toUpperCase()
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+Y\s+EQUIPO.*/i, '')
    .replace(/\s+EQUIPO.*/i, '')
    .replace(/^DR\.?\s+/i, '')
    .replace(/^DRA\.?\s+/i, '')
    .replace(/\s+/g, ' ')
    .trim();

  if (s.startsWith('VALMORE BERMUDEZ')) return 'Valmore Bermúdez';
  if (s.startsWith('LEONARDO PACHECO')) return 'Leonardo Pacheco Londoño';
  if (s.startsWith('EDUARDO') && s.includes('NAVARRO')) return 'Eduardo Navarro Jiménez';
  if (s.startsWith('ELKIN') && s.includes('NAVARRO')) return 'Elkin Navarro Quiroz';
  if (s.startsWith('INDIANA') && s.includes('ROJAS')) return 'Indiana Luz Rojas Torres';
  if (s.startsWith('ROOSVEL') && s.includes('SOTO')) return 'Roosvel Soto Díaz';
  if (s.startsWith('ANDERSON') && s.includes('DIAZ')) return 'Anderson Díaz Pérez';
  if (s.startsWith('HERNAN') && s.includes('HERNANDEZ')) return 'Hernán Hernández Herrera';
  if (s.startsWith('JUAN DIEGO') && s.includes('HERNANDEZ')) return 'Juan Diego Hernández Lalinde';
  if (s.startsWith('LILIBETH') && s.includes('SANCHEZ')) return 'Lilibeth Sánchez Güette';
  if (s.startsWith('DAVID') && s.includes('MARTINEZ')) return 'David Enrique Martínez Sierra';
  if (s.startsWith('JORGE') && s.includes('DAES')) return 'Jorge Daes';
  if (s.startsWith('MARBEL') && s.includes('GRAVINI')) return 'Marbel Gravini';
  if (s.startsWith('RAFAEL') && s.includes('RADA')) return 'Rafael Rada Donado';
  if (s.startsWith('HERNAN') && s.includes('GUILLEN')) return 'Hernán Felipe Guillén Burgos';

  return s.split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(' ');
}

export default function APCPage() {
  const { profile, hasAccess } = useAuth();
  const supabase = useMemo(() => createClient(), []);

  // Data states
  const [payments, setPayments] = useState<APCPayment[]>(initialAPCData.payments as APCPayment[]);
  const [budgets, setBudgets] = useState<APCAnnualBudget[]>(initialAPCData.budgets as APCAnnualBudget[]);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<'dashboard' | 'top10' | 'tabla' | 'bolsa'>('dashboard');

  // Filters
  const [selectedYear, setSelectedYear] = useState<string>('all'); // 'all' or '2026', '2025', etc.
  const [selectedQuartile, setSelectedQuartile] = useState<string>('all');
  const [selectedStatus, setSelectedStatus] = useState<string>('all');
  const [selectedFaculty, setSelectedFaculty] = useState<string>('all');
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [currentPage, setCurrentPage] = useState<number>(1);

  // Modals
  const [selectedPayment, setSelectedPayment] = useState<APCPayment | null>(null);
  const [showNewModal, setShowNewModal] = useState<boolean>(false);
  const [showBudgetModal, setShowBudgetModal] = useState<boolean>(false);
  const [budgetEditYear, setBudgetEditYear] = useState<number>(2026);
  const [budgetEditAmount, setBudgetEditAmount] = useState<number>(400000000);

  // Load from Supabase if table exists
  const loadSupabaseData = useCallback(async () => {
    try {
      setLoading(true);
      const { data: pData, error: pErr } = await supabase
        .from('apc_payments')
        .select('*')
        .order('year', { ascending: false })
        .order('consecutive', { ascending: true });

      if (!pErr && pData && pData.length > 0) {
        setPayments(pData);
      }

      const { data: bData, error: bErr } = await supabase
        .from('apc_annual_budgets')
        .select('*')
        .order('year', { ascending: false });

      if (!bErr && bData && bData.length > 0) {
        setBudgets(bData);
      }
    } catch (e) {
      console.log('Using local dataset for APC:', e);
    } finally {
      setLoading(false);
    }
  }, [supabase]);

  useEffect(() => {
    loadSupabaseData();
  }, [loadSupabaseData]);

  // Available unique years & faculties
  const availableYears = useMemo(() => {
    const set = new Set<number>();
    payments.forEach(p => set.add(p.year));
    return Array.from(set).sort((a, b) => b - a);
  }, [payments]);

  const availableFaculties = useMemo(() => {
    const set = new Set<string>();
    payments.forEach(p => {
      if (p.facultad) set.add(p.facultad);
    });
    return Array.from(set).sort();
  }, [payments]);

  // Filtered payments by Year (for dashboard metrics)
  const yearFilteredPayments = useMemo(() => {
    if (selectedYear === 'all') return payments;
    const y = parseInt(selectedYear);
    return payments.filter(p => p.year === y);
  }, [payments, selectedYear]);

  // Filtered payments by all controls (for the table)
  const fullyFilteredPayments = useMemo(() => {
    return payments.filter(p => {
      if (selectedYear !== 'all' && p.year !== parseInt(selectedYear)) return false;
      if (selectedQuartile !== 'all' && p.cuartil !== selectedQuartile) return false;
      if (selectedStatus !== 'all' && p.estado_final !== selectedStatus) return false;
      if (selectedFaculty !== 'all' && p.facultad !== selectedFaculty) return false;

      if (searchTerm.trim()) {
        const q = searchTerm.toLowerCase();
        const matchesInv = p.investigador.toLowerCase().includes(q);
        const matchesArt = p.articulo.toLowerCase().includes(q);
        const matchesRev = p.revista.toLowerCase().includes(q);
        const matchesEdi = p.beneficiario.toLowerCase().includes(q);
        const matchesFact = (p.consecutivo_factura || '').toLowerCase().includes(q);
        const matchesISSN = (p.issn || '').toLowerCase().includes(q);
        if (!matchesInv && !matchesArt && !matchesRev && !matchesEdi && !matchesFact && !matchesISSN) {
          return false;
        }
      }
      return true;
    });
  }, [payments, selectedYear, selectedQuartile, selectedStatus, selectedFaculty, searchTerm]);

  // Pagination
  const totalPages = Math.ceil(fullyFilteredPayments.length / PAGE_SIZE) || 1;
  const paginatedPayments = useMemo(() => {
    const start = (currentPage - 1) * PAGE_SIZE;
    return fullyFilteredPayments.slice(start, start + PAGE_SIZE);
  }, [fullyFilteredPayments, currentPage]);

  useEffect(() => {
    setCurrentPage(1);
  }, [selectedYear, selectedQuartile, selectedStatus, selectedFaculty, searchTerm]);

  // Budget calculations for the selected year
  const budgetInfo = useMemo(() => {
    if (selectedYear === 'all') {
      // Sum across all recorded budgets
      const allocated = budgets.reduce((acc, b) => acc + (Number(b.allocated_budget) || 0), 0);
      const executed = payments.reduce((acc, p) => acc + (Number(p.valor_pagado_pesos) || 0), 0);
      const remaining = allocated - executed;
      const pct = allocated > 0 ? Math.round((executed / allocated) * 100) : 0;
      return {
        year: 0,
        allocated_budget: allocated,
        executed_budget: executed,
        remaining_budget: remaining,
        execution_pct: pct
      };
    } else {
      const y = parseInt(selectedYear);
      const b = budgets.find(item => item.year === y);
      const allocated = b ? Number(b.allocated_budget) || 0 : 350000000;
      const executed = yearFilteredPayments.reduce((acc, p) => acc + (Number(p.valor_pagado_pesos) || 0), 0);
      const remaining = allocated - executed;
      const pct = allocated > 0 ? Math.round((executed / allocated) * 100) : 0;
      return {
        year: y,
        allocated_budget: allocated,
        executed_budget: executed,
        remaining_budget: remaining,
        execution_pct: pct
      };
    }
  }, [selectedYear, budgets, payments, yearFilteredPayments]);

  // Metrics calculations for the dashboard
  const stats = useMemo(() => {
    const totalArticles = yearFilteredPayments.length;
    const totalCOP = yearFilteredPayments.reduce((acc, p) => acc + (Number(p.valor_pagado_pesos) || 0), 0);
    const totalRetencionCOP = yearFilteredPayments.reduce((acc, p) => acc + (Number(p.valor_retenido_pesos) || 0), 0);

    let q1 = 0, q2 = 0, q3 = 0, q4 = 0, sc = 0;
    const researchersSet = new Set<string>();
    const facultiesSet = new Set<string>();
    let correspondenciaUnisimon = 0;
    let afiliacionUnisimon = 0;
    let paidWithCOPCount = 0;
    const paidAmounts: number[] = [];
    const q1PaidAmounts: number[] = [];
    let leadTimeDaysSum = 0;
    let leadTimeCount = 0;

    yearFilteredPayments.forEach(p => {
      if (p.cuartil === 'Q1') q1++;
      else if (p.cuartil === 'Q2') q2++;
      else if (p.cuartil === 'Q3') q3++;
      else if (p.cuartil === 'Q4') q4++;
      else sc++;

      if (p.investigador) researchersSet.add(p.investigador.toLowerCase().trim());
      if (p.facultad && p.facultad !== 'Sin Facultad Asignada') facultiesSet.add(p.facultad);
      if (p.autor_correspondencia === 'SI') correspondenciaUnisimon++;
      if (p.afiliacion_institucional === 'SI') afiliacionUnisimon++;
      if (p.valor_pagado_pesos > 0) {
        paidWithCOPCount++;
        paidAmounts.push(p.valor_pagado_pesos);
        if (p.cuartil === 'Q1') q1PaidAmounts.push(p.valor_pagado_pesos);
      }

      if (p.fecha_autorizacion && p.fecha_pago) {
        const d1 = new Date(p.fecha_autorizacion);
        const d2 = new Date(p.fecha_pago);
        if (!isNaN(d1.getTime()) && !isNaN(d2.getTime())) {
          const diff = Math.round((d2.getTime() - d1.getTime()) / (1000 * 60 * 60 * 24));
          if (diff >= 0 && diff < 365) {
            leadTimeDaysSum += diff;
            leadTimeCount++;
          }
        }
      }
    });

    const highImpactCount = q1 + q2;
    const highImpactPct = totalArticles > 0 ? Math.round((highImpactCount / totalArticles) * 100) : 0;
    const avgCostCOP = paidWithCOPCount > 0 ? Math.round(totalCOP / paidWithCOPCount) : 0;
    const minCostCOP = paidAmounts.length > 0 ? Math.min(...paidAmounts) : 0;
    const maxCostCOP = paidAmounts.length > 0 ? Math.max(...paidAmounts) : 0;
    const q1AvgCost = q1PaidAmounts.length > 0 ? Math.round(q1PaidAmounts.reduce((a, b) => a + b, 0) / q1PaidAmounts.length) : 0;
    const avgLeadTimeDays = leadTimeCount > 0 ? Math.round(leadTimeDaysSum / leadTimeCount) : 19;

    return {
      totalArticles,
      totalCOP,
      totalRetencionCOP,
      q1Count: q1,
      q2Count: q2,
      q3Count: q3,
      q4Count: q4,
      scCount: sc,
      highImpactCount,
      highImpactPct,
      uniqueResearchers: researchersSet.size,
      benefitedFaculties: facultiesSet.size,
      correspondenciaUnisimon,
      correspondenciaPct: totalArticles > 0 ? Math.round((correspondenciaUnisimon / totalArticles) * 100) : 0,
      afiliacionUnisimon,
      afiliacionPct: totalArticles > 0 ? Math.round((afiliacionUnisimon / totalArticles) * 100) : 0,
      avgCostCOP,
      minCostCOP,
      maxCostCOP,
      q1AvgCost,
      avgLeadTimeDays,
      leadTimeCount
    };
  }, [yearFilteredPayments]);

  // Ranked Researchers with most requested APC services
  const rankedResearchers = useMemo(() => {
    const map: Record<string, {
      name: string;
      articlesCount: number;
      totalCOP: number;
      avgCOP: number;
      q1Count: number;
      q2Count: number;
      q3Count: number;
      q4Count: number;
      scCount: number;
      faculty: string;
    }> = {};

    yearFilteredPayments.forEach(p => {
      const norm = normalizeResearcherName(p.investigador);
      if (!map[norm]) {
        map[norm] = {
          name: norm,
          articlesCount: 0,
          totalCOP: 0,
          avgCOP: 0,
          q1Count: 0,
          q2Count: 0,
          q3Count: 0,
          q4Count: 0,
          scCount: 0,
          faculty: p.facultad && p.facultad !== 'Sin Facultad Asignada' ? p.facultad : 'Facultad de Ciencias de la Salud'
        };
      }
      map[norm].articlesCount++;
      map[norm].totalCOP += (p.valor_pagado_pesos || 0);
      if (p.cuartil === 'Q1') map[norm].q1Count++;
      else if (p.cuartil === 'Q2') map[norm].q2Count++;
      else if (p.cuartil === 'Q3') map[norm].q3Count++;
      else if (p.cuartil === 'Q4') map[norm].q4Count++;
      else map[norm].scCount++;
    });

    return Object.values(map)
      .map(item => ({
        ...item,
        avgCOP: item.articlesCount > 0 ? Math.round(item.totalCOP / item.articlesCount) : 0
      }))
      .sort((a, b) => b.articlesCount - a.articlesCount || b.totalCOP - a.totalCOP);
  }, [yearFilteredPayments]);

  const top10Researchers = useMemo(() => rankedResearchers.slice(0, 10), [rankedResearchers]);

  // Top Research Groups supported
  const topGroups = useMemo(() => {
    const map: Record<string, { name: string; count: number; totalCOP: number }> = {};
    yearFilteredPayments.forEach(p => {
      const g = p.grupo_investigacion ? p.grupo_investigacion.trim() : null;
      if (!g) return;
      if (!map[g]) map[g] = { name: g, count: 0, totalCOP: 0 };
      map[g].count++;
      map[g].totalCOP += (p.valor_pagado_pesos || 0);
    });
    return Object.values(map)
      .sort((a, b) => b.count - a.count || b.totalCOP - a.totalCOP)
      .slice(0, 6);
  }, [yearFilteredPayments]);

  // Cost by Quartile Bar Chart data
  const quartileCostChartData = useMemo(() => {
    const map: Record<string, { totalCOP: number; paidCount: number; color: string }> = {
      Q1: { totalCOP: 0, paidCount: 0, color: QUARTILE_COLORS.Q1 },
      Q2: { totalCOP: 0, paidCount: 0, color: QUARTILE_COLORS.Q2 },
      Q3: { totalCOP: 0, paidCount: 0, color: QUARTILE_COLORS.Q3 },
      Q4: { totalCOP: 0, paidCount: 0, color: QUARTILE_COLORS.Q4 },
    };

    yearFilteredPayments.forEach(p => {
      const q = p.cuartil;
      if (map[q] && p.valor_pagado_pesos > 0) {
        map[q].totalCOP += p.valor_pagado_pesos;
        map[q].paidCount++;
      }
    });

    return Object.entries(map).map(([cuartil, d]) => ({
      cuartil,
      avgCostM: d.paidCount > 0 ? parseFloat((d.totalCOP / d.paidCount / 1000000).toFixed(2)) : 0,
      avgCostCOP: d.paidCount > 0 ? Math.round(d.totalCOP / d.paidCount) : 0,
      paidCount: d.paidCount,
      color: d.color
    }));
  }, [yearFilteredPayments]);

  // Chart data: Evolution per year (all years)
  const yearlyTrendData = useMemo(() => {
    const map: Record<number, { year: number; articulos: number; inversionM: number }> = {};
    availableYears.forEach(y => {
      map[y] = { year: y, articulos: 0, inversionM: 0 };
    });

    payments.forEach(p => {
      if (map[p.year]) {
        map[p.year].articulos++;
        map[p.year].inversionM += Math.round((p.valor_pagado_pesos || 0) / 1000000);
      }
    });

    return Object.values(map).sort((a, b) => a.year - b.year);
  }, [payments, availableYears]);

  // Chart data: Quartiles breakdown
  const quartileChartData = useMemo(() => {
    return [
      { name: 'Q1 (Top)', value: stats.q1Count, color: QUARTILE_COLORS.Q1 },
      { name: 'Q2 (Alto)', value: stats.q2Count, color: QUARTILE_COLORS.Q2 },
      { name: 'Q3 (Medio)', value: stats.q3Count, color: QUARTILE_COLORS.Q3 },
      { name: 'Q4 (Inicial)', value: stats.q4Count, color: QUARTILE_COLORS.Q4 },
      ...(stats.scCount > 0 ? [{ name: 'S/C', value: stats.scCount, color: QUARTILE_COLORS['S/C'] }] : [])
    ];
  }, [stats]);

  // Chart data: Top Faculties
  const facultyChartData = useMemo(() => {
    const counts: Record<string, { facultad: string; count: number; inversionM: number }> = {};
    yearFilteredPayments.forEach(p => {
      const f = p.facultad || 'Sin Facultad';
      if (!counts[f]) counts[f] = { facultad: f, count: 0, inversionM: 0 };
      counts[f].count++;
      counts[f].inversionM += Math.round((p.valor_pagado_pesos || 0) / 1000000);
    });

    return Object.values(counts)
      .sort((a, b) => b.count - a.count)
      .slice(0, 6);
  }, [yearFilteredPayments]);

  // Chart data: Top Publishers / Beneficiaries
  const topPublishersData = useMemo(() => {
    const counts: Record<string, number> = {};
    yearFilteredPayments.forEach(p => {
      const b = p.beneficiario || 'Otro';
      counts[b] = (counts[b] || 0) + 1;
    });

    return Object.entries(counts)
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);
  }, [yearFilteredPayments]);

  // Currencies breakdown
  const currencyBreakdown = useMemo(() => {
    const counts: Record<string, number> = {};
    yearFilteredPayments.forEach(p => {
      const m = p.moneda || 'Divisa N/D';
      counts[m] = (counts[m] || 0) + 1;
    });
    return Object.entries(counts).sort((a, b) => b[1] - a[1]);
  }, [yearFilteredPayments]);

  // Scopus benchmark calculations: % de publicaciones subsidiadas con el pago APC
  const scopusCoverage = useMemo(() => {
    const scopusTotals = (scopusBenchmark as any).yearlyScopusTotals as Record<string, number>;
    let totalScopus = 0;
    const apcCount = yearFilteredPayments.length;

    if (selectedYear === 'all') {
      totalScopus = (scopusBenchmark as any).totalScopus2020_2026; // 1395
    } else {
      totalScopus = scopusTotals[selectedYear] || 0;
    }

    const pct = totalScopus > 0 ? parseFloat(((apcCount / totalScopus) * 100).toFixed(1)) : 0;

    const yearlyScopusComparison = [2020, 2021, 2022, 2023, 2024, 2025, 2026].map(y => {
      const scopusTotal = scopusTotals[y.toString()] || 0;
      const apcTotal = payments.filter(p => p.year === y).length;
      const coveragePct = scopusTotal > 0 ? parseFloat(((apcTotal / scopusTotal) * 100).toFixed(1)) : 0;
      return {
        year: y.toString(),
        scopusTotal,
        apcTotal,
        coveragePct,
      };
    });

    return {
      totalScopus,
      apcCount,
      pct,
      yearlyScopusComparison
    };
  }, [selectedYear, yearFilteredPayments, payments]);

  // Exports Handlers
  const handleExportWord = async () => {
    await generateAPCWordReport({
      yearFilter: selectedYear,
      budgetInfo: selectedYear !== 'all' ? budgetInfo : undefined,
      stats: {
        totalArticles: stats.totalArticles,
        totalCOP: stats.totalCOP,
        q1Count: stats.q1Count,
        q2Count: stats.q2Count,
        q3Count: stats.q3Count,
        q4Count: stats.q4Count,
        scCount: stats.scCount,
        highImpactPct: stats.highImpactPct,
        avgCostCOP: stats.avgCostCOP
      },
      scopusBenchmark: scopusCoverage,
      payments: fullyFilteredPayments
    });
  };

  const handleExportExcel = () => {
    exportAPCToExcel({
      yearFilter: selectedYear,
      budgetInfo: selectedYear !== 'all' ? budgetInfo : undefined,
      stats: {
        totalArticles: stats.totalArticles,
        totalCOP: stats.totalCOP,
        q1Count: stats.q1Count,
        q2Count: stats.q2Count,
        q3Count: stats.q3Count,
        q4Count: stats.q4Count,
        scCount: stats.scCount,
        highImpactPct: stats.highImpactPct,
        avgCostCOP: stats.avgCostCOP
      },
      scopusBenchmark: scopusCoverage,
      payments: fullyFilteredPayments
    });
  };

  // Save budget handler
  const handleSaveBudget = async () => {
    const updated = budgets.map(b => b.year === budgetEditYear ? { ...b, allocated_budget: budgetEditAmount } : b);
    if (!updated.some(b => b.year === budgetEditYear)) {
      updated.push({ year: budgetEditYear, allocated_budget: budgetEditAmount });
    }
    setBudgets(updated);

    // Try saving in Supabase
    try {
      await supabase.from('apc_annual_budgets').upsert({
        year: budgetEditYear,
        allocated_budget: budgetEditAmount,
        currency: 'COP',
        updated_at: new Date().toISOString()
      }, { onConflict: 'year' });
    } catch (e) {
      console.log('Saved budget locally:', e);
    }

    setShowBudgetModal(false);
  };

  return (
    <div style={{ padding: '28px', maxWidth: '1440px', margin: '0 auto', color: 'var(--text-primary)' }}>
      {/* ─── HEADER BANNER ─── */}
      <div style={{
        background: 'linear-gradient(135deg, #064E24 0%, #09843B 60%, #00838F 100%)',
        borderRadius: '20px',
        padding: '28px 32px',
        color: 'white',
        marginBottom: '24px',
        boxShadow: '0 12px 32px -8px rgba(9, 132, 59, 0.35)',
        display: 'flex',
        flexWrap: 'wrap',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: '24px',
        position: 'relative',
        overflow: 'hidden'
      }}>
        <div style={{ position: 'absolute', right: '-40px', top: '-40px', opacity: 0.1, pointerEvents: 'none' }}>
          <Receipt size={260} />
        </div>

        <div style={{ zIndex: 1, maxWidth: '640px' }}>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', background: 'rgba(255,255,255,0.18)', backdropFilter: 'blur(8px)', padding: '6px 14px', borderRadius: '30px', fontSize: '12px', fontWeight: 600, letterSpacing: '0.5px', marginBottom: '12px', border: '1px solid rgba(255,255,255,0.25)' }}>
            <Receipt size={14} /> FONDO DE APOYO A LA PUBLICACIÓN CIENTÍFICA (APC)
          </div>
          <h1 style={{ fontSize: '30px', fontWeight: 800, margin: '0 0 8px 0', lineHeight: 1.2 }}>
            Control y Gestión de Pagos APC
          </h1>
          <p style={{ fontSize: '14px', color: 'rgba(255,255,255,0.88)', margin: 0, lineHeight: 1.5 }}>
            Monitoreo en tiempo real de la bolsa de presupuesto anual, financiamiento de cargos de procesamiento de artículos y métricas de alto impacto científico para la Universidad Simón Bolívar.
          </p>
        </div>

        {/* Coordinator Card */}
        <div style={{
          zIndex: 1,
          background: 'rgba(255, 255, 255, 0.14)',
          backdropFilter: 'blur(12px)',
          border: '1px solid rgba(255, 255, 255, 0.28)',
          borderRadius: '16px',
          padding: '16px 20px',
          display: 'flex',
          alignItems: 'center',
          gap: '16px',
          minWidth: '320px'
        }}>
          <div style={{
            width: '48px',
            height: '48px',
            borderRadius: '12px',
            background: '#FFFFFF',
            color: '#00838F',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontWeight: 800,
            fontSize: '18px',
            boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
            flexShrink: 0
          }}>
            FP
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '2px' }}>
              <span style={{ fontSize: '10px', textTransform: 'uppercase', letterSpacing: '0.8px', background: '#00838F', color: 'white', padding: '2px 8px', borderRadius: '12px', fontWeight: 700 }}>
                LÍDER DEL MÓDULO
              </span>
            </div>
            <div style={{ fontSize: '15px', fontWeight: 700, color: '#FFFFFF' }}>
              Fernando Alberto Peñaranda
            </div>
            <div style={{ fontSize: '12px', color: 'rgba(255,255,255,0.85)' }}>
              Coordinador de Proyectos
            </div>
            <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.7)', marginTop: '2px' }}>
              fernando.penaranda@unisimon.edu.co
            </div>
          </div>
        </div>
      </div>

      {/* ─── ACTION TOOLBAR & TABS ─── */}
      <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: '16px', marginBottom: '20px' }}>
        {/* Navigation Tabs */}
        <div style={{ display: 'flex', background: 'var(--gray-100)', padding: '4px', borderRadius: '12px', gap: '4px' }}>
          <button
            onClick={() => setActiveTab('dashboard')}
            style={{
              padding: '8px 18px',
              borderRadius: '9px',
              border: 'none',
              cursor: 'pointer',
              fontSize: '13px',
              fontWeight: 600,
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              background: activeTab === 'dashboard' ? 'white' : 'transparent',
              color: activeTab === 'dashboard' ? 'var(--primary)' : 'var(--gray-600)',
              boxShadow: activeTab === 'dashboard' ? '0 2px 8px rgba(0,0,0,0.08)' : 'none',
              transition: 'all 0.15s ease'
            }}
          >
            <TrendingUp size={16} /> Dashboard & Métricas
          </button>
          <button
            onClick={() => setActiveTab('top10')}
            style={{
              padding: '8px 18px',
              borderRadius: '9px',
              border: 'none',
              cursor: 'pointer',
              fontSize: '13px',
              fontWeight: 600,
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              background: activeTab === 'top10' ? 'white' : 'transparent',
              color: activeTab === 'top10' ? 'var(--primary)' : 'var(--gray-600)',
              boxShadow: activeTab === 'top10' ? '0 2px 8px rgba(0,0,0,0.08)' : 'none',
              transition: 'all 0.15s ease'
            }}
          >
            <Award size={16} /> Top 10 Profesores
          </button>
          <button
            onClick={() => setActiveTab('tabla')}
            style={{
              padding: '8px 18px',
              borderRadius: '9px',
              border: 'none',
              cursor: 'pointer',
              fontSize: '13px',
              fontWeight: 600,
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              background: activeTab === 'tabla' ? 'white' : 'transparent',
              color: activeTab === 'tabla' ? 'var(--primary)' : 'var(--gray-600)',
              boxShadow: activeTab === 'tabla' ? '0 2px 8px rgba(0,0,0,0.08)' : 'none',
              transition: 'all 0.15s ease'
            }}
          >
            <BookOpen size={16} /> Registro de Artículos ({fullyFilteredPayments.length})
          </button>
          <button
            onClick={() => setActiveTab('bolsa')}
            style={{
              padding: '8px 18px',
              borderRadius: '9px',
              border: 'none',
              cursor: 'pointer',
              fontSize: '13px',
              fontWeight: 600,
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              background: activeTab === 'bolsa' ? 'white' : 'transparent',
              color: activeTab === 'bolsa' ? 'var(--primary)' : 'var(--gray-600)',
              boxShadow: activeTab === 'bolsa' ? '0 2px 8px rgba(0,0,0,0.08)' : 'none',
              transition: 'all 0.15s ease'
            }}
          >
            <DollarSign size={16} /> Bolsa Presupuestal
          </button>
        </div>

        {/* Actions Buttons */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <button
            onClick={() => {
              setBudgetEditYear(selectedYear === 'all' ? 2026 : parseInt(selectedYear));
              const current = budgets.find(b => b.year === (selectedYear === 'all' ? 2026 : parseInt(selectedYear)));
              setBudgetEditAmount(current ? current.allocated_budget : 400000000);
              setShowBudgetModal(true);
            }}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              padding: '9px 15px',
              borderRadius: '10px',
              border: '1px solid var(--gray-200)',
              background: 'white',
              color: 'var(--gray-700)',
              fontSize: '13px',
              fontWeight: 600,
              cursor: 'pointer',
              transition: 'background 0.15s'
            }}
            onMouseEnter={e => (e.currentTarget.style.background = 'var(--gray-50)')}
            onMouseLeave={e => (e.currentTarget.style.background = 'white')}
          >
            <SlidersHorizontal size={15} color="#00838F" /> Ajustar Bolsa
          </button>

          <button
            onClick={handleExportExcel}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              padding: '9px 15px',
              borderRadius: '10px',
              border: '1px solid #C8E6C9',
              background: '#F1F8F5',
              color: '#1B5E20',
              fontSize: '13px',
              fontWeight: 600,
              cursor: 'pointer',
              transition: 'all 0.15s'
            }}
            onMouseEnter={e => (e.currentTarget.style.background = '#E8F5E9')}
            onMouseLeave={e => (e.currentTarget.style.background = '#F1F8F5')}
          >
            <Download size={15} /> Excel
          </button>

          <button
            onClick={handleExportWord}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              padding: '9px 15px',
              borderRadius: '10px',
              border: '1px solid #BBDEFB',
              background: '#EBF5FE',
              color: '#0D47A1',
              fontSize: '13px',
              fontWeight: 600,
              cursor: 'pointer',
              transition: 'all 0.15s'
            }}
            onMouseEnter={e => (e.currentTarget.style.background = '#E3F2FD')}
            onMouseLeave={e => (e.currentTarget.style.background = '#EBF5FE')}
          >
            <FileText size={15} /> Word
          </button>

          <button
            onClick={() => setShowNewModal(true)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              padding: '9px 18px',
              borderRadius: '10px',
              border: 'none',
              background: 'linear-gradient(135deg, #09843B, #0ca84b)',
              color: 'white',
              fontSize: '13px',
              fontWeight: 700,
              cursor: 'pointer',
              boxShadow: '0 4px 12px rgba(9, 132, 59, 0.25)',
              transition: 'opacity 0.15s'
            }}
            onMouseEnter={e => (e.currentTarget.style.opacity = '0.9')}
            onMouseLeave={e => (e.currentTarget.style.opacity = '1')}
          >
            <Plus size={16} /> + Registrar Pago APC
          </button>
        </div>
      </div>

      {/* ─── YEAR SELECTOR TABS ─── */}
      <div style={{
        background: 'white',
        padding: '12px 18px',
        borderRadius: '14px',
        border: '1px solid var(--gray-200)',
        marginBottom: '24px',
        display: 'flex',
        alignItems: 'center',
        flexWrap: 'wrap',
        gap: '10px'
      }}>
        <span style={{ fontSize: '13px', fontWeight: 700, color: 'var(--gray-700)', display: 'flex', alignItems: 'center', gap: '6px', marginRight: '6px' }}>
          <Filter size={15} color="var(--primary)" /> Periodo Fiscal:
        </span>
        <button
          onClick={() => setSelectedYear('all')}
          style={{
            padding: '6px 14px',
            borderRadius: '20px',
            border: 'none',
            fontSize: '12px',
            fontWeight: 700,
            cursor: 'pointer',
            background: selectedYear === 'all' ? '#09843B' : 'var(--gray-100)',
            color: selectedYear === 'all' ? 'white' : 'var(--gray-700)',
            transition: 'all 0.15s'
          }}
        >
          Histórico Completo (2020 - 2026)
        </button>
        {availableYears.map(yr => (
          <button
            key={yr}
            onClick={() => setSelectedYear(String(yr))}
            style={{
              padding: '6px 14px',
              borderRadius: '20px',
              border: 'none',
              fontSize: '12px',
              fontWeight: 700,
              cursor: 'pointer',
              background: selectedYear === String(yr) ? '#09843B' : 'var(--gray-100)',
              color: selectedYear === String(yr) ? 'white' : 'var(--gray-700)',
              transition: 'all 0.15s'
            }}
          >
            {yr} {yr === 2026 ? ' (Vigente 2026-1)' : ''}
          </button>
        ))}
      </div>

      {/* ─── HERO BUDGET POOL WIDGET (BOLSA ANUAL) ─── */}
      <div style={{
        background: 'white',
        borderRadius: '18px',
        border: '1px solid var(--gray-200)',
        padding: '24px 28px',
        marginBottom: '24px',
        boxShadow: '0 4px 20px rgba(0,0,0,0.04)'
      }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: '12px', marginBottom: '16px' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <h2 style={{ fontSize: '18px', fontWeight: 800, margin: 0, color: 'var(--gray-900)' }}>
                Bolsa de Presupuesto Anual {selectedYear === 'all' ? '(Consolidado 2020-2026)' : `— Vigencia ${selectedYear}`}
              </h2>
              <span style={{
                fontSize: '11px',
                fontWeight: 700,
                padding: '3px 10px',
                borderRadius: '12px',
                background: budgetInfo.execution_pct >= 95 ? '#FEE2E2' : budgetInfo.execution_pct >= 80 ? '#FEF3C7' : '#ECFDF5',
                color: budgetInfo.execution_pct >= 95 ? '#991B1B' : budgetInfo.execution_pct >= 80 ? '#92400E' : '#065F46'
              }}>
                {budgetInfo.execution_pct >= 95 ? '⚠️ Límite Presupuestal' : budgetInfo.execution_pct >= 80 ? '⚡ Alto Consumo' : '✅ Margen Óptimo'}
              </span>
            </div>
            <p style={{ fontSize: '13px', color: 'var(--gray-500)', margin: '4px 0 0 0' }}>
              Asignación presupuestal del Dto. de Publicaciones para el financiamiento de APC de investigadores Unisimón.
            </p>
          </div>

          <div style={{ fontSize: '13px', fontWeight: 700, color: 'var(--primary)' }}>
            Consumo: {budgetInfo.execution_pct}% de la bolsa
          </div>
        </div>

        {/* Progress Bar */}
        <div style={{
          height: '14px',
          borderRadius: '7px',
          background: 'var(--gray-100)',
          overflow: 'hidden',
          marginBottom: '20px',
          position: 'relative'
        }}>
          <div style={{
            height: '100%',
            width: `${Math.min(budgetInfo.execution_pct, 100)}%`,
            background: budgetInfo.execution_pct >= 95 ? 'linear-gradient(90deg, #F59E0B, #EF4444)' : budgetInfo.execution_pct >= 80 ? 'linear-gradient(90deg, #10B981, #F59E0B)' : 'linear-gradient(90deg, #09843B, #10B981)',
            borderRadius: '7px',
            transition: 'width 0.8s cubic-bezier(0.4, 0, 0.2, 1)'
          }} />
        </div>

        {/* 4 Financial Columns */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '20px' }}>
          <div style={{ padding: '16px', background: '#F8FAFC', borderRadius: '12px', borderLeft: '4px solid #64748B' }}>
            <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--gray-500)', textTransform: 'uppercase', letterSpacing: '0.4px' }}>
              Presupuesto Asignado
            </div>
            <div style={{ fontSize: '22px', fontWeight: 800, color: 'var(--gray-800)', marginTop: '4px' }}>
              ${budgetInfo.allocated_budget.toLocaleString('es-CO')} <span style={{ fontSize: '12px', fontWeight: 600 }}>COP</span>
            </div>
            <div style={{ fontSize: '11px', color: 'var(--gray-400)', marginTop: '2px' }}>
              Fondo total presupuestado
            </div>
          </div>

          <div style={{ padding: '16px', background: '#F0FDF4', borderRadius: '12px', borderLeft: '4px solid #09843B' }}>
            <div style={{ fontSize: '12px', fontWeight: 600, color: '#166534', textTransform: 'uppercase', letterSpacing: '0.4px' }}>
              Total Ejecutado en Pesos
            </div>
            <div style={{ fontSize: '22px', fontWeight: 800, color: '#09843B', marginTop: '4px' }}>
              ${budgetInfo.executed_budget.toLocaleString('es-CO')} <span style={{ fontSize: '12px', fontWeight: 600 }}>COP</span>
            </div>
            <div style={{ fontSize: '11px', color: '#166534', marginTop: '2px' }}>
              Desembolsos en facturas APC
            </div>
          </div>

          <div style={{ padding: '16px', background: budgetInfo.remaining_budget >= 0 ? '#EFF6FF' : '#FEF2F2', borderRadius: '12px', borderLeft: `4px solid ${budgetInfo.remaining_budget >= 0 ? '#2563EB' : '#DC2626'}` }}>
            <div style={{ fontSize: '12px', fontWeight: 600, color: budgetInfo.remaining_budget >= 0 ? '#1E40AF' : '#991B1B', textTransform: 'uppercase', letterSpacing: '0.4px' }}>
              Saldo Remanente Disponible
            </div>
            <div style={{ fontSize: '22px', fontWeight: 800, color: budgetInfo.remaining_budget >= 0 ? '#1D4ED8' : '#B91C1C', marginTop: '4px' }}>
              ${budgetInfo.remaining_budget.toLocaleString('es-CO')} <span style={{ fontSize: '12px', fontWeight: 600 }}>COP</span>
            </div>
            <div style={{ fontSize: '11px', color: budgetInfo.remaining_budget >= 0 ? '#1E40AF' : '#991B1B', marginTop: '2px' }}>
              {budgetInfo.remaining_budget >= 0 ? 'Disponible para nuevas solicitudes' : 'Déficit sobrepasado'}
            </div>
          </div>

          <div style={{ padding: '16px', background: '#FAF5FF', borderRadius: '12px', borderLeft: '4px solid #7E22CE' }}>
            <div style={{ fontSize: '12px', fontWeight: 600, color: '#6B21A8', textTransform: 'uppercase', letterSpacing: '0.4px' }}>
              Costo Promedio / Paper
            </div>
            <div style={{ fontSize: '22px', fontWeight: 800, color: '#7E22CE', marginTop: '4px' }}>
              ${stats.avgCostCOP.toLocaleString('es-CO')} <span style={{ fontSize: '12px', fontWeight: 600 }}>COP</span>
            </div>
            <div style={{ fontSize: '11px', color: '#6B21A8', marginTop: '2px' }}>
              Rango: ${stats.minCostCOP > 0 ? (stats.minCostCOP / 1000).toFixed(0) + 'K' : '$0'} a ${(stats.maxCostCOP / 1000000).toFixed(1)}M COP
            </div>
          </div>
        </div>
      </div>

      {/* ─── TAB 1: DASHBOARD & METRICS ─── */}
      {activeTab === 'dashboard' && (
        <>
          {/* Key Metrics Grid 1 */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))', gap: '16px', marginBottom: '16px' }}>
            {/* Metric 1 */}
            <div style={{ background: 'white', padding: '20px', borderRadius: '16px', border: '1px solid var(--gray-200)', boxShadow: '0 2px 8px rgba(0,0,0,0.03)' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' }}>
                <span style={{ fontSize: '12px', fontWeight: 700, color: 'var(--gray-500)', textTransform: 'uppercase' }}>Artículos Financiados</span>
                <div style={{ padding: '8px', borderRadius: '10px', background: '#F1F8F5', color: '#09843B' }}>
                  <BookOpen size={18} />
                </div>
              </div>
              <div style={{ fontSize: '28px', fontWeight: 800, color: 'var(--gray-900)' }}>
                {stats.totalArticles}
              </div>
              <div style={{ fontSize: '12px', color: 'var(--gray-500)', marginTop: '4px' }}>
                {selectedYear === 'all' ? 'En 7 vigencias anuales' : `En vigencia fiscal ${selectedYear}`}
              </div>
            </div>

            {/* Metric 2 */}
            <div style={{ background: 'white', padding: '20px', borderRadius: '16px', border: '1px solid var(--gray-200)', boxShadow: '0 2px 8px rgba(0,0,0,0.03)' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' }}>
                <span style={{ fontSize: '12px', fontWeight: 700, color: 'var(--gray-500)', textTransform: 'uppercase' }}>Alto Impacto (Q1 & Q2)</span>
                <div style={{ padding: '8px', borderRadius: '10px', background: '#ECFDF5', color: '#10B981' }}>
                  <Award size={18} />
                </div>
              </div>
              <div style={{ fontSize: '28px', fontWeight: 800, color: '#10B981' }}>
                {stats.highImpactPct}%
              </div>
              <div style={{ fontSize: '12px', color: 'var(--gray-500)', marginTop: '4px' }}>
                {stats.highImpactCount} artículos en Q1 y Q2
              </div>
            </div>

            {/* Metric 3 */}
            <div style={{ background: 'white', padding: '20px', borderRadius: '16px', border: '1px solid var(--gray-200)', boxShadow: '0 2px 8px rgba(0,0,0,0.03)' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' }}>
                <span style={{ fontSize: '12px', fontWeight: 700, color: 'var(--gray-500)', textTransform: 'uppercase' }}>Liderazgo Unisimón</span>
                <div style={{ padding: '8px', borderRadius: '10px', background: '#EFF6FF', color: '#2563EB' }}>
                  <ShieldCheck size={18} />
                </div>
              </div>
              <div style={{ fontSize: '28px', fontWeight: 800, color: '#2563EB' }}>
                {stats.correspondenciaPct}%
              </div>
              <div style={{ fontSize: '12px', color: 'var(--gray-500)', marginTop: '4px' }}>
                {stats.correspondenciaUnisimon} autoría correspondencia
              </div>
            </div>

            {/* Metric 4 */}
            <div style={{ background: 'white', padding: '20px', borderRadius: '16px', border: '1px solid var(--gray-200)', boxShadow: '0 2px 8px rgba(0,0,0,0.03)' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' }}>
                <span style={{ fontSize: '12px', fontWeight: 700, color: 'var(--gray-500)', textTransform: 'uppercase' }}>Investigadores</span>
                <div style={{ padding: '8px', borderRadius: '10px', background: '#FFF7ED', color: '#EA580C' }}>
                  <Users size={18} />
                </div>
              </div>
              <div style={{ fontSize: '28px', fontWeight: 800, color: '#EA580C' }}>
                {stats.uniqueResearchers}
              </div>
              <div style={{ fontSize: '12px', color: 'var(--gray-500)', marginTop: '4px' }}>
                Autores principales beneficiados
              </div>
            </div>

            {/* Metric 5 */}
            <div style={{ background: 'white', padding: '20px', borderRadius: '16px', border: '1px solid var(--gray-200)', boxShadow: '0 2px 8px rgba(0,0,0,0.03)' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' }}>
                <span style={{ fontSize: '12px', fontWeight: 700, color: 'var(--gray-500)', textTransform: 'uppercase' }}>Facultades Activas</span>
                <div style={{ padding: '8px', borderRadius: '10px', background: '#F5F3FF', color: '#7C3AED' }}>
                  <Building2 size={18} />
                </div>
              </div>
              <div style={{ fontSize: '28px', fontWeight: 800, color: '#7C3AED' }}>
                {stats.benefitedFaculties}
              </div>
              <div style={{ fontSize: '12px', color: 'var(--gray-500)', marginTop: '4px' }}>
                Unidades académicas apoyadas
              </div>
            </div>

            {/* Metric 6: Subsidio en Scopus */}
            <div style={{ background: 'white', padding: '20px', borderRadius: '16px', border: '1px solid var(--gray-200)', boxShadow: '0 2px 8px rgba(0,0,0,0.03)' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' }}>
                <span style={{ fontSize: '12px', fontWeight: 700, color: 'var(--gray-500)', textTransform: 'uppercase' }}>Subsidio en Scopus</span>
                <div style={{ padding: '8px', borderRadius: '10px', background: '#F0F9FF', color: '#0284C7' }}>
                  <TrendingUp size={18} />
                </div>
              </div>
              <div style={{ fontSize: '28px', fontWeight: 800, color: '#0284C7' }}>
                {scopusCoverage.pct}%
              </div>
              <div style={{ fontSize: '12px', color: 'var(--gray-500)', marginTop: '4px' }}>
                {scopusCoverage.apcCount} de {scopusCoverage.totalScopus} papers Scopus
              </div>
            </div>
          </div>

          {/* Strategic Efficiency KPIs Row */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))', gap: '16px', marginBottom: '24px' }}>
            <div style={{ background: '#F8FAFC', padding: '16px 20px', borderRadius: '14px', border: '1px solid #E2E8F0', display: 'flex', alignItems: 'center', gap: '14px' }}>
              <div style={{ width: '42px', height: '42px', borderRadius: '10px', background: '#ECFDF5', color: '#059669', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <Sparkles size={20} />
              </div>
              <div>
                <div style={{ fontSize: '11px', fontWeight: 700, color: 'var(--gray-500)', textTransform: 'uppercase' }}>Costo Medio Q1 (Top)</div>
                <div style={{ fontSize: '18px', fontWeight: 800, color: '#059669', marginTop: '2px' }}>
                  ${(stats.q1AvgCost / 1000000).toFixed(2)}M <span style={{ fontSize: '11px', fontWeight: 600 }}>COP</span>
                </div>
                <div style={{ fontSize: '11px', color: 'var(--gray-500)' }}>Impacto mundial Scopus/WoS</div>
              </div>
            </div>

            <div style={{ background: '#F8FAFC', padding: '16px 20px', borderRadius: '14px', border: '1px solid #E2E8F0', display: 'flex', alignItems: 'center', gap: '14px' }}>
              <div style={{ width: '42px', height: '42px', borderRadius: '10px', background: '#EFF6FF', color: '#2563EB', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <Clock size={20} />
              </div>
              <div>
                <div style={{ fontSize: '11px', fontWeight: 700, color: 'var(--gray-500)', textTransform: 'uppercase' }}>Ciclo Medio de Pago</div>
                <div style={{ fontSize: '18px', fontWeight: 800, color: '#2563EB', marginTop: '2px' }}>
                  {stats.avgLeadTimeDays} <span style={{ fontSize: '12px', fontWeight: 600 }}>días</span>
                </div>
                <div style={{ fontSize: '11px', color: 'var(--gray-500)' }}>Autorización ➔ Giro Tesorería</div>
              </div>
            </div>

            <div style={{ background: '#F8FAFC', padding: '16px 20px', borderRadius: '14px', border: '1px solid #E2E8F0', display: 'flex', alignItems: 'center', gap: '14px' }}>
              <div style={{ width: '42px', height: '42px', borderRadius: '10px', background: '#FEF3C7', color: '#D97706', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <DollarSign size={20} />
              </div>
              <div>
                <div style={{ fontSize: '11px', fontWeight: 700, color: 'var(--gray-500)', textTransform: 'uppercase' }}>Retenciones Fiscales</div>
                <div style={{ fontSize: '18px', fontWeight: 800, color: '#D97706', marginTop: '2px' }}>
                  ${(stats.totalRetencionCOP / 1000000).toFixed(2)}M <span style={{ fontSize: '11px', fontWeight: 600 }}>COP</span>
                </div>
                <div style={{ fontSize: '11px', color: 'var(--gray-500)' }}>Retención en origen a editoriales</div>
              </div>
            </div>

            <div style={{ background: '#F8FAFC', padding: '16px 20px', borderRadius: '14px', border: '1px solid #E2E8F0', display: 'flex', alignItems: 'center', gap: '14px' }}>
              <div style={{ width: '42px', height: '42px', borderRadius: '10px', background: '#F3E8FF', color: '#7E22CE', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <Layers size={20} />
              </div>
              <div>
                <div style={{ fontSize: '11px', fontWeight: 700, color: 'var(--gray-500)', textTransform: 'uppercase' }}>Concentración Top 3</div>
                <div style={{ fontSize: '18px', fontWeight: 800, color: '#7E22CE', marginTop: '2px' }}>
                  68% <span style={{ fontSize: '11px', fontWeight: 600 }}>del volumen</span>
                </div>
                <div style={{ fontSize: '11px', color: 'var(--gray-500)' }}>MDPI, Springer & Frontiers</div>
              </div>
            </div>
          </div>

          {/* ─── TOP 10 PROFESORES & COSTO POR CUARTIL ─── */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(460px, 1fr))', gap: '24px', marginBottom: '24px' }}>
            {/* Panel Top 10 Investigadores */}
            <div style={{ background: 'white', padding: '24px', borderRadius: '18px', border: '1px solid var(--gray-200)', boxShadow: '0 4px 16px rgba(0,0,0,0.03)', minWidth: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
                <div>
                  <h3 style={{ fontSize: '16px', fontWeight: 800, margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span>🏆</span> Top 10 Profesores con Más Solicitudes APC
                  </h3>
                  <span style={{ fontSize: '12px', color: 'var(--gray-500)' }}>
                    Docentes e investigadores líderes en publicación financiada
                  </span>
                </div>
                <button
                  onClick={() => setActiveTab('top10')}
                  style={{
                    background: '#F1F8F5',
                    color: '#09843B',
                    border: 'none',
                    padding: '6px 12px',
                    borderRadius: '8px',
                    fontSize: '12px',
                    fontWeight: 700,
                    cursor: 'pointer'
                  }}
                >
                  Ver Todo el Ranking ↗
                </button>
              </div>

              {/* Top 3 Podium Highlights */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '10px', marginBottom: '16px' }}>
                {top10Researchers.slice(0, 3).map((prof, idx) => {
                  const medals = ['🥇', '🥈', '🥉'];
                  const borderColors = ['#F59E0B', '#94A3B8', '#D97706'];
                  const bgColors = ['#FEF3C7', '#F1F5F9', '#FFEDD5'];
                  return (
                    <div key={prof.name} style={{
                      background: bgColors[idx],
                      border: `1px solid ${borderColors[idx]}`,
                      borderRadius: '12px',
                      padding: '12px',
                      textAlign: 'center'
                    }}>
                      <div style={{ fontSize: '20px' }}>{medals[idx]}</div>
                      <div style={{ fontSize: '13px', fontWeight: 800, color: 'var(--gray-900)', marginTop: '2px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={prof.name}>
                        {prof.name}
                      </div>
                      <div style={{ fontSize: '16px', fontWeight: 800, color: '#09843B', marginTop: '2px' }}>
                        {prof.articlesCount} <span style={{ fontSize: '10px', fontWeight: 600 }}>artículos</span>
                      </div>
                      <div style={{ fontSize: '11px', color: 'var(--gray-600)', marginTop: '2px' }}>
                        ${(prof.totalCOP / 1000000).toFixed(1)}M COP
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Ranking rows 4 to 10 */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {top10Researchers.slice(3, 10).map((prof, idx) => (
                  <div key={prof.name} style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '8px 12px',
                    background: '#F8FAFC',
                    borderRadius: '10px',
                    border: '1px solid #E2E8F0',
                    fontSize: '12px'
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: 0, flex: 1 }}>
                      <span style={{ width: '20px', fontWeight: 800, color: 'var(--gray-400)' }}>#{idx + 4}</span>
                      <div style={{ minWidth: 0, flex: 1 }}>
                        <div style={{ fontWeight: 700, color: 'var(--gray-800)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {prof.name}
                        </div>
                        <div style={{ fontSize: '11px', color: 'var(--gray-500)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {prof.faculty}
                        </div>
                      </div>
                    </div>
                    <div style={{ textAlign: 'right', marginLeft: '12px', flexShrink: 0 }}>
                      <div style={{ fontWeight: 800, color: '#09843B' }}>
                        {prof.articlesCount} papers
                      </div>
                      <div style={{ fontSize: '11px', color: 'var(--gray-500)' }}>
                        ${(prof.totalCOP / 1000000).toFixed(1)}M COP
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Gráfico Costo Promedio por Cuartil */}
            <div style={{ background: 'white', padding: '24px', borderRadius: '18px', border: '1px solid var(--gray-200)', boxShadow: '0 4px 16px rgba(0,0,0,0.03)', minWidth: 0 }}>
              <div style={{ marginBottom: '16px' }}>
                <h3 style={{ fontSize: '16px', fontWeight: 800, margin: 0 }}>Costo Promedio de APC por Cuartil ($M COP)</h3>
                <span style={{ fontSize: '12px', color: 'var(--gray-500)' }}>Relación entre el factor de impacto internacional y el costo del APC</span>
              </div>
              <div style={{ height: '280px', width: '100%', minWidth: 0 }}>
                <ResponsiveContainer width="100%" height="100%" minWidth={0}>
                  <BarChart data={quartileCostChartData} margin={{ top: 10, right: 20, left: -10, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#F1F5F9" />
                    <XAxis dataKey="cuartil" tickLine={false} stroke="#64748B" fontSize={12} />
                    <YAxis tickLine={false} stroke="#64748B" fontSize={11} unit="M" />
                    <Tooltip
                      contentStyle={{ background: 'white', borderRadius: '10px', boxShadow: '0 6px 20px rgba(0,0,0,0.1)', border: '1px solid #E2E8F0', fontSize: '12px' }}
                      formatter={(val: any, name: any, item: any) => [`$${item.payload.avgCostCOP.toLocaleString('es-CO')} COP (${item.payload.paidCount} papers)`, 'Costo Promedio']}
                    />
                    <Bar dataKey="avgCostM" name="Costo Promedio ($M COP)" radius={[6, 6, 0, 0]} barSize={42}>
                      {quartileCostChartData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>

              {/* Cuartil cost callout */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '8px', borderTop: '1px solid var(--gray-100)', paddingTop: '14px', marginTop: '10px', textAlign: 'center' }}>
                {quartileCostChartData.map(c => (
                  <div key={c.cuartil} style={{ background: '#F8FAFC', padding: '8px 4px', borderRadius: '8px', border: '1px solid #E2E8F0' }}>
                    <div style={{ fontSize: '11px', fontWeight: 800, color: c.color }}>{c.cuartil}</div>
                    <div style={{ fontSize: '12px', fontWeight: 800, color: 'var(--gray-900)', marginTop: '2px' }}>
                      ${(c.avgCostCOP / 1000000).toFixed(1)}M
                    </div>
                    <div style={{ fontSize: '10px', color: 'var(--gray-500)' }}>
                      {c.paidCount} papers
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* ─── SCOPUS BENCHMARK: APALANCAMIENTO Y SUBSIDIO APC ─── */}
          <div style={{ background: 'white', padding: '24px 28px', borderRadius: '18px', border: '1px solid var(--gray-200)', boxShadow: '0 4px 16px rgba(0,0,0,0.03)', marginBottom: '24px', minWidth: 0 }}>
            <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: '16px', marginBottom: '20px' }}>
              <div>
                <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', background: '#E0F2FE', color: '#0369A1', padding: '4px 12px', borderRadius: '20px', fontSize: '11px', fontWeight: 700, marginBottom: '6px' }}>
                  <Sparkles size={13} /> BENCHMARK OFICIAL SCOPUS (AF-ID 60106970 / 60112687)
                </div>
                <h3 style={{ fontSize: '18px', fontWeight: 800, margin: 0, color: 'var(--gray-900)' }}>
                  Apalancamiento de APC en la Producción Científica Scopus Unisimón
                </h3>
                <p style={{ fontSize: '13px', color: 'var(--gray-500)', margin: '4px 0 0 0' }}>
                  Porcentaje de artículos y revisiones indexados en Scopus que fueron subsidiados y financiados con la Bolsa de Presupuesto APC.
                </p>
              </div>

              <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                <div style={{ padding: '10px 18px', background: '#F0FDF4', borderRadius: '12px', border: '1px solid #BBF7D0', textAlign: 'center' }}>
                  <div style={{ fontSize: '11px', fontWeight: 700, color: '#166534', textTransform: 'uppercase' }}>Subsidio Global Unisimón</div>
                  <div style={{ fontSize: '24px', fontWeight: 800, color: '#09843B' }}>{scopusCoverage.pct}%</div>
                  <div style={{ fontSize: '11px', color: '#166534' }}>{scopusCoverage.apcCount} de {scopusCoverage.totalScopus} publicaciones</div>
                </div>
              </div>
            </div>

            {/* Chart comparing Scopus Total vs APC Funded */}
            <div style={{ height: '300px', width: '100%', minWidth: 0 }}>
              <ResponsiveContainer width="100%" height="100%" minWidth={0}>
                <ComposedChart data={scopusCoverage.yearlyScopusComparison} margin={{ top: 10, right: 20, left: -10, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#F1F5F9" />
                  <XAxis dataKey="year" tickLine={false} stroke="#64748B" fontSize={12} />
                  <YAxis yAxisId="left" tickLine={false} stroke="#64748B" fontSize={12} />
                  <YAxis yAxisId="right" orientation="right" tickLine={false} stroke="#7C3AED" fontSize={12} unit="%" />
                  <Tooltip
                    contentStyle={{ background: 'white', borderRadius: '10px', boxShadow: '0 6px 20px rgba(0,0,0,0.1)', border: '1px solid #E2E8F0', fontSize: '12px' }}
                    formatter={(val: any, name: any) => [
                      name === 'coveragePct' ? `${val}%` : `${val} papers`,
                      name === 'coveragePct' ? '% Subsidiado con APC' : name === 'scopusTotal' ? 'Total Scopus Unisimón' : 'Artículos Financiados APC'
                    ]}
                  />
                  <Legend wrapperStyle={{ fontSize: '12px' }} />
                  <Bar yAxisId="left" dataKey="scopusTotal" name="Total Scopus Unisimón" fill="#94A3B8" radius={[6, 6, 0, 0]} barSize={26} />
                  <Bar yAxisId="left" dataKey="apcTotal" name="Artículos Financiados APC" fill="#09843B" radius={[6, 6, 0, 0]} barSize={26} />
                  <Line yAxisId="right" type="monotone" dataKey="coveragePct" name="% Subsidiado con APC" stroke="#7C3AED" strokeWidth={3} dot={{ r: 5, fill: '#7C3AED' }} />
                </ComposedChart>
              </ResponsiveContainer>
            </div>

            {/* Yearly Badges Summary */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: '10px', borderTop: '1px solid var(--gray-100)', paddingTop: '16px', marginTop: '16px' }}>
              {scopusCoverage.yearlyScopusComparison.map(item => (
                <div key={item.year} style={{ background: '#F8FAFC', padding: '10px', borderRadius: '10px', border: '1px solid #E2E8F0', textAlign: 'center' }}>
                  <div style={{ fontSize: '12px', fontWeight: 800, color: 'var(--gray-700)' }}>Vigencia {item.year}</div>
                  <div style={{ fontSize: '18px', fontWeight: 800, color: item.coveragePct >= 30 ? '#09843B' : '#0369A1', marginTop: '2px' }}>
                    {item.coveragePct}%
                  </div>
                  <div style={{ fontSize: '11px', color: 'var(--gray-500)', marginTop: '2px' }}>
                    {item.apcTotal} / {item.scopusTotal} papers
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* ─── CHARTS ROW 1 ─── */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(460px, 1fr))', gap: '24px', marginBottom: '24px' }}>
            {/* Chart 1: Historical Evolution (Articles vs Millions COP) */}
            <div style={{ background: 'white', padding: '24px', borderRadius: '18px', border: '1px solid var(--gray-200)', boxShadow: '0 4px 16px rgba(0,0,0,0.03)', minWidth: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
                <div>
                  <h3 style={{ fontSize: '16px', fontWeight: 800, margin: 0 }}>Evolución Interanual de Apoyos APC</h3>
                  <span style={{ fontSize: '12px', color: 'var(--gray-500)' }}>Artículos financiados vs Inversión en Millones COP</span>
                </div>
              </div>
              <div style={{ height: '300px', width: '100%', minWidth: 0 }}>
                <ResponsiveContainer width="100%" height="100%" minWidth={0}>
                  <ComposedChart data={yearlyTrendData} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#F1F5F9" />
                    <XAxis dataKey="year" tickLine={false} stroke="#64748B" fontSize={12} />
                    <YAxis yAxisId="left" tickLine={false} stroke="#64748B" fontSize={12} />
                    <YAxis yAxisId="right" orientation="right" tickLine={false} stroke="#09843B" fontSize={12} />
                    <Tooltip
                      contentStyle={{ background: 'white', borderRadius: '10px', boxShadow: '0 6px 20px rgba(0,0,0,0.1)', border: '1px solid #E2E8F0', fontSize: '12px' }}
                      formatter={(val: any, name: any) => [name === 'inversionM' ? `$${val}M COP` : `${val} papers`, name === 'inversionM' ? 'Inversión' : 'Artículos']}
                    />
                    <Legend wrapperStyle={{ fontSize: '12px' }} />
                    <Bar yAxisId="left" dataKey="articulos" name="Artículos" fill="#3B82F6" radius={[6, 6, 0, 0]} barSize={28} />
                    <Line yAxisId="right" type="monotone" dataKey="inversionM" name="Inversión ($M COP)" stroke="#09843B" strokeWidth={3} dot={{ r: 5, fill: '#09843B' }} />
                  </ComposedChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Chart 2: Quartile Distribution (Donut) */}
            <div style={{ background: 'white', padding: '24px', borderRadius: '18px', border: '1px solid var(--gray-200)', boxShadow: '0 4px 16px rgba(0,0,0,0.03)', minWidth: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
                <div>
                  <h3 style={{ fontSize: '16px', fontWeight: 800, margin: 0 }}>Distribución por Cuartil de Impacto</h3>
                  <span style={{ fontSize: '12px', color: 'var(--gray-500)' }}>Clasificación indexada (Q1, Q2, Q3, Q4)</span>
                </div>
                <span style={{ fontSize: '12px', fontWeight: 700, color: '#10B981', background: '#ECFDF5', padding: '4px 10px', borderRadius: '20px' }}>
                  {stats.highImpactPct}% Q1/Q2
                </span>
              </div>
              <div style={{ height: '300px', width: '100%', minWidth: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <ResponsiveContainer width="100%" height="100%" minWidth={0}>
                  <PieChart>
                    <Pie
                      data={quartileChartData}
                      cx="50%"
                      cy="50%"
                      innerRadius={65}
                      outerRadius={105}
                      paddingAngle={4}
                      dataKey="value"
                    >
                      {quartileChartData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip
                      contentStyle={{ background: 'white', borderRadius: '10px', boxShadow: '0 6px 20px rgba(0,0,0,0.1)', border: '1px solid #E2E8F0', fontSize: '12px' }}
                      formatter={(val: any) => [`${val} artículos (${Math.round((Number(val) / (stats.totalArticles || 1)) * 100)}%)`, 'Cantidad']}
                    />
                    <Legend wrapperStyle={{ fontSize: '12px' }} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>

          {/* ─── CHARTS ROW 2 ─── */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(460px, 1fr))', gap: '24px', marginBottom: '24px' }}>
            {/* Chart 3: Top Faculties */}
            <div style={{ background: 'white', padding: '24px', borderRadius: '18px', border: '1px solid var(--gray-200)', boxShadow: '0 4px 16px rgba(0,0,0,0.03)', minWidth: 0 }}>
              <div style={{ marginBottom: '16px' }}>
                <h3 style={{ fontSize: '16px', fontWeight: 800, margin: 0 }}>Publicaciones por Facultad Beneficiada</h3>
                <span style={{ fontSize: '12px', color: 'var(--gray-500)' }}>Unidades académicas con mayor adjudicación de recursos APC</span>
              </div>
              <div style={{ height: '280px', width: '100%', minWidth: 0 }}>
                <ResponsiveContainer width="100%" height="100%" minWidth={0}>
                  <BarChart data={facultyChartData} layout="vertical" margin={{ top: 5, right: 30, left: 40, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#F1F5F9" />
                    <XAxis type="number" tickLine={false} stroke="#64748B" fontSize={11} />
                    <YAxis dataKey="facultad" type="category" tickLine={false} stroke="#64748B" fontSize={10} width={130} />
                    <Tooltip
                      contentStyle={{ background: 'white', borderRadius: '10px', boxShadow: '0 6px 20px rgba(0,0,0,0.1)', border: '1px solid #E2E8F0', fontSize: '12px' }}
                      formatter={(val: any, name: any) => [name === 'count' ? `${val} artículos` : `$${val}M COP`, name === 'count' ? 'Artículos' : 'Inversión']}
                    />
                    <Bar dataKey="count" name="Artículos" fill="#00838F" radius={[0, 6, 6, 0]} barSize={20} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Chart 4: Top Publishers & Foreign Currencies */}
            <div style={{ background: 'white', padding: '24px', borderRadius: '18px', border: '1px solid var(--gray-200)', boxShadow: '0 4px 16px rgba(0,0,0,0.03)', minWidth: 0 }}>
              <div style={{ marginBottom: '16px' }}>
                <h3 style={{ fontSize: '16px', fontWeight: 800, margin: 0 }}>Principales Casas Editoriales y Divisas</h3>
                <span style={{ fontSize: '12px', color: 'var(--gray-500)' }}>Distribución de proveedores editoriales internacionales</span>
              </div>

              {/* Publisher list with progress bars */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginBottom: '20px' }}>
                {topPublishersData.map((item, idx) => {
                  const maxCount = topPublishersData[0]?.count || 1;
                  const pct = Math.round((item.count / maxCount) * 100);
                  return (
                    <div key={item.name}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', fontWeight: 600, marginBottom: '4px' }}>
                        <span style={{ color: 'var(--gray-800)' }}>{idx + 1}. {item.name}</span>
                        <span style={{ color: 'var(--primary)' }}>{item.count} artículos</span>
                      </div>
                      <div style={{ height: '8px', background: 'var(--gray-100)', borderRadius: '4px', overflow: 'hidden' }}>
                        <div style={{ height: '100%', width: `${pct}%`, background: '#09843B', borderRadius: '4px' }} />
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Currencies Pills */}
              <div style={{ borderTop: '1px solid var(--gray-100)', paddingTop: '14px' }}>
                <span style={{ fontSize: '11px', fontWeight: 700, color: 'var(--gray-500)', textTransform: 'uppercase' }}>
                  Monedas Extranjeras Facturadas:
                </span>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginTop: '8px' }}>
                  {currencyBreakdown.map(([curr, count]) => (
                    <div key={curr} style={{ background: '#F8FAFC', border: '1px solid #E2E8F0', padding: '4px 10px', borderRadius: '8px', fontSize: '12px', fontWeight: 600, color: 'var(--gray-700)' }}>
                      <span style={{ color: '#00838F', fontWeight: 700 }}>{curr}</span>: {count} facturas
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </>
      )}

      {/* ─── TAB: TOP 10 PROFESORES & DEMANDA INSTITUCIONAL ─── */}
      {activeTab === 'top10' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          {/* Header Card */}
          <div style={{
            background: 'white',
            borderRadius: '18px',
            padding: '24px 28px',
            border: '1px solid var(--gray-200)',
            boxShadow: '0 4px 16px rgba(0,0,0,0.03)',
            display: 'flex',
            flexWrap: 'wrap',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '16px'
          }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                <span style={{ background: '#ECFDF5', color: '#09843B', padding: '4px 10px', borderRadius: '12px', fontSize: '11px', fontWeight: 700, letterSpacing: '0.5px' }}>
                  DEMANDA INSTITUCIONAL APC
                </span>
                <span style={{ fontSize: '12px', color: 'var(--gray-500)' }}>
                  Período: {selectedYear === 'all' ? 'Histórico Consolidado 2020 - 2026' : `Vigencia ${selectedYear}`}
                </span>
              </div>
              <h2 style={{ fontSize: '22px', fontWeight: 800, margin: 0, color: 'var(--gray-900)' }}>
                Top Investigadores con Mayor Solicitud de Pagos APC
              </h2>
              <p style={{ fontSize: '13px', color: 'var(--gray-500)', margin: '4px 0 0 0' }}>
                Identificación de líderes de publicación científica, índice de adjudicación presupuestal y calidad por cuartiles Scopus / Web of Science.
              </p>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: '11px', color: 'var(--gray-500)', textTransform: 'uppercase', fontWeight: 700 }}>Total Investigadores</div>
                <div style={{ fontSize: '22px', fontWeight: 800, color: '#09843B' }}>{rankedResearchers.length}</div>
              </div>
              <div style={{ height: '36px', width: '1px', background: 'var(--gray-200)' }} />
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: '11px', color: 'var(--gray-500)', textTransform: 'uppercase', fontWeight: 700 }}>Concentración Top 10</div>
                <div style={{ fontSize: '22px', fontWeight: 800, color: '#00838F' }}>
                  {Math.round((top10Researchers.reduce((acc, r) => acc + r.articlesCount, 0) / (yearFilteredPayments.length || 1)) * 100)}%
                </div>
              </div>
            </div>
          </div>

          {/* Podium (Top 3) */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '20px' }}>
            {top10Researchers.slice(0, 3).map((prof, idx) => {
              const medals = ['🥇', '🥈', '🥉'];
              const titles = ['1er Lugar Institucional', '2do Lugar Institucional', '3er Lugar Institucional'];
              const accents = ['#B45309', '#475569', '#B45309'];
              const bgs = [
                'linear-gradient(145deg, #FEFCE8 0%, #FFFFFF 100%)',
                'linear-gradient(145deg, #F8FAFC 0%, #FFFFFF 100%)',
                'linear-gradient(145deg, #FFFBEB 0%, #FFFFFF 100%)'
              ];
              const borders = ['#FDE047', '#CBD5E1', '#FCD34D'];

              return (
                <div key={prof.name} style={{
                  background: bgs[idx],
                  border: `2px solid ${borders[idx]}`,
                  borderRadius: '18px',
                  padding: '24px',
                  boxShadow: '0 6px 20px rgba(0,0,0,0.04)',
                  position: 'relative',
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'space-between'
                }}>
                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
                      <span style={{ fontSize: '28px' }}>{medals[idx]}</span>
                      <span style={{ fontSize: '11px', fontWeight: 800, color: accents[idx], background: 'white', padding: '4px 10px', borderRadius: '20px', border: `1px solid ${borders[idx]}` }}>
                        {titles[idx]}
                      </span>
                    </div>

                    <h3 style={{ fontSize: '17px', fontWeight: 800, color: 'var(--gray-900)', margin: '0 0 4px 0', lineHeight: 1.3 }}>
                      {prof.name}
                    </h3>
                    <p style={{ fontSize: '12px', color: 'var(--gray-500)', margin: '0 0 16px 0' }}>
                      {prof.faculty}
                    </p>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '16px' }}>
                      <div style={{ background: 'white', padding: '10px', borderRadius: '10px', border: '1px solid #E2E8F0' }}>
                        <div style={{ fontSize: '10px', color: 'var(--gray-500)', textTransform: 'uppercase', fontWeight: 700 }}>Artículos</div>
                        <div style={{ fontSize: '20px', fontWeight: 800, color: '#09843B' }}>{prof.articlesCount}</div>
                        <div style={{ fontSize: '10px', color: 'var(--gray-500)' }}>{prof.q1Count} en Q1 / {prof.q2Count} en Q2</div>
                      </div>
                      <div style={{ background: 'white', padding: '10px', borderRadius: '10px', border: '1px solid #E2E8F0' }}>
                        <div style={{ fontSize: '10px', color: 'var(--gray-500)', textTransform: 'uppercase', fontWeight: 700 }}>Inversión Total</div>
                        <div style={{ fontSize: '16px', fontWeight: 800, color: '#00838F', marginTop: '2px' }}>
                          ${(prof.totalCOP / 1000000).toFixed(1)}M
                        </div>
                        <div style={{ fontSize: '10px', color: 'var(--gray-500)' }}>COP Total</div>
                      </div>
                    </div>

                    <div style={{ background: 'rgba(255,255,255,0.7)', padding: '10px 12px', borderRadius: '10px', border: '1px solid #E2E8F0', display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                      <span style={{ fontSize: '11px', color: 'var(--gray-600)' }}>Promedio por paper:</span>
                      <span style={{ fontSize: '12px', fontWeight: 800, color: 'var(--gray-800)' }}>
                        ${prof.avgCOP.toLocaleString('es-CO')} COP
                      </span>
                    </div>
                  </div>

                  <button
                    onClick={() => {
                      setSearchTerm(prof.name);
                      setActiveTab('tabla');
                      setCurrentPage(1);
                    }}
                    style={{
                      width: '100%',
                      padding: '10px',
                      borderRadius: '10px',
                      background: 'white',
                      border: '1px solid var(--gray-300)',
                      color: 'var(--gray-800)',
                      fontSize: '12px',
                      fontWeight: 700,
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '6px',
                      boxShadow: '0 2px 6px rgba(0,0,0,0.04)',
                      transition: 'all 0.15s ease'
                    }}
                    onMouseEnter={e => {
                      e.currentTarget.style.background = '#09843B';
                      e.currentTarget.style.color = 'white';
                      e.currentTarget.style.borderColor = '#09843B';
                    }}
                    onMouseLeave={e => {
                      e.currentTarget.style.background = 'white';
                      e.currentTarget.style.color = 'var(--gray-800)';
                      e.currentTarget.style.borderColor = 'var(--gray-300)';
                    }}
                  >
                    Ver sus {prof.articlesCount} artículos <ExternalLink size={13} />
                  </button>
                </div>
              );
            })}
          </div>

          {/* Ranking Table & Research Groups Grid */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(460px, 1fr))', gap: '24px' }}>
            {/* Full Top 10 Table */}
            <div style={{ background: 'white', borderRadius: '18px', border: '1px solid var(--gray-200)', boxShadow: '0 4px 16px rgba(0,0,0,0.03)', overflow: 'hidden' }}>
              <div style={{ padding: '20px 24px', borderBottom: '1px solid var(--gray-100)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <h3 style={{ fontSize: '16px', fontWeight: 800, margin: 0 }}>Tabla Detallada de Investigadores Líderes</h3>
                  <span style={{ fontSize: '12px', color: 'var(--gray-500)' }}>Desglose de artículos, impacto indexado e inversión asignada</span>
                </div>
              </div>

              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '13px' }}>
                  <thead>
                    <tr style={{ background: '#F8FAFC', borderBottom: '2px solid var(--gray-200)', color: 'var(--gray-600)', fontSize: '11px', textTransform: 'uppercase' }}>
                      <th style={{ padding: '12px 16px', width: '50px' }}>Rank</th>
                      <th style={{ padding: '12px 16px' }}>Investigador</th>
                      <th style={{ padding: '12px 16px', textAlign: 'center' }}>Papers</th>
                      <th style={{ padding: '12px 16px', textAlign: 'center' }}>Cuartiles</th>
                      <th style={{ padding: '12px 16px', textAlign: 'right' }}>Total Invertido</th>
                      <th style={{ padding: '12px 16px', textAlign: 'right' }}>Promedio / Paper</th>
                      <th style={{ padding: '12px 16px', textAlign: 'center' }}>Acción</th>
                    </tr>
                  </thead>
                  <tbody>
                    {top10Researchers.map((prof, idx) => (
                      <tr key={prof.name} style={{ borderBottom: '1px solid var(--gray-100)', transition: 'background 0.15s' }}>
                        <td style={{ padding: '14px 16px', fontWeight: 800, color: idx < 3 ? '#09843B' : 'var(--gray-500)' }}>
                          #{idx + 1}
                        </td>
                        <td style={{ padding: '14px 16px' }}>
                          <div style={{ fontWeight: 700, color: 'var(--gray-900)' }}>{prof.name}</div>
                          <div style={{ fontSize: '11px', color: 'var(--gray-500)' }}>{prof.faculty}</div>
                        </td>
                        <td style={{ padding: '14px 16px', textAlign: 'center' }}>
                          <span style={{ background: '#ECFDF5', color: '#09843B', fontWeight: 800, padding: '3px 9px', borderRadius: '12px', fontSize: '12px' }}>
                            {prof.articlesCount}
                          </span>
                        </td>
                        <td style={{ padding: '14px 16px', textAlign: 'center' }}>
                          <div style={{ display: 'inline-flex', gap: '4px' }}>
                            {prof.q1Count > 0 && (
                              <span style={{ background: '#DCFCE7', color: '#166534', padding: '2px 6px', borderRadius: '6px', fontSize: '10px', fontWeight: 700 }}>
                                {prof.q1Count} Q1
                              </span>
                            )}
                            {prof.q2Count > 0 && (
                              <span style={{ background: '#DBEAFE', color: '#1E40AF', padding: '2px 6px', borderRadius: '6px', fontSize: '10px', fontWeight: 700 }}>
                                {prof.q2Count} Q2
                              </span>
                            )}
                            {(prof.articlesCount - prof.q1Count - prof.q2Count) > 0 && (
                              <span style={{ background: '#F1F5F9', color: '#475569', padding: '2px 6px', borderRadius: '6px', fontSize: '10px', fontWeight: 700 }}>
                                {prof.articlesCount - prof.q1Count - prof.q2Count} Otros
                              </span>
                            )}
                          </div>
                        </td>
                        <td style={{ padding: '14px 16px', textAlign: 'right', fontWeight: 700, color: 'var(--gray-800)' }}>
                          ${prof.totalCOP.toLocaleString('es-CO')} COP
                        </td>
                        <td style={{ padding: '14px 16px', textAlign: 'right', color: 'var(--gray-600)', fontSize: '12px' }}>
                          ${prof.avgCOP.toLocaleString('es-CO')}
                        </td>
                        <td style={{ padding: '14px 16px', textAlign: 'center' }}>
                          <button
                            onClick={() => {
                              setSearchTerm(prof.name);
                              setActiveTab('tabla');
                              setCurrentPage(1);
                            }}
                            title="Filtrar en el registro de artículos"
                            style={{
                              background: '#F1F8F5',
                              color: '#09843B',
                              border: 'none',
                              padding: '5px 10px',
                              borderRadius: '8px',
                              cursor: 'pointer',
                              fontWeight: 600,
                              fontSize: '11px'
                            }}
                          >
                            Ver artículos ↗
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Research Groups & Strategic Takeaways */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
              {/* Top Research Groups */}
              <div style={{ background: 'white', padding: '24px', borderRadius: '18px', border: '1px solid var(--gray-200)', boxShadow: '0 4px 16px rgba(0,0,0,0.03)' }}>
                <div style={{ marginBottom: '16px' }}>
                  <h3 style={{ fontSize: '16px', fontWeight: 800, margin: 0 }}>Top Grupos de Investigación Financiados</h3>
                  <span style={{ fontSize: '12px', color: 'var(--gray-500)' }}>Colectivos de investigación con mayor absorción de fondos APC</span>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  {topGroups.map((g, idx) => (
                    <div key={g.name} style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '12px 14px',
                      background: '#F8FAFC',
                      borderRadius: '12px',
                      border: '1px solid #E2E8F0'
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', minWidth: 0, flex: 1 }}>
                        <span style={{ width: '24px', height: '24px', borderRadius: '50%', background: '#E2E8F0', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '11px', fontWeight: 800, color: 'var(--gray-700)' }}>
                          {idx + 1}
                        </span>
                        <div style={{ minWidth: 0, flex: 1 }}>
                          <div style={{ fontWeight: 700, fontSize: '12px', color: 'var(--gray-900)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={g.name}>
                            {g.name}
                          </div>
                          <div style={{ fontSize: '11px', color: 'var(--gray-500)' }}>
                            Inversión: ${(g.totalCOP / 1000000).toFixed(1)}M COP
                          </div>
                        </div>
                      </div>
                      <div style={{ textAlign: 'right', marginLeft: '12px', flexShrink: 0 }}>
                        <span style={{ background: '#ECFDF5', color: '#09843B', fontWeight: 800, padding: '4px 10px', borderRadius: '12px', fontSize: '12px' }}>
                          {g.count} artículos
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Strategic Insights */}
              <div style={{ background: 'linear-gradient(135deg, #F0FDF4 0%, #E8F5E9 100%)', padding: '24px', borderRadius: '18px', border: '1px solid #C8E6C9' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
                  <Sparkles size={18} color="#09843B" />
                  <h4 style={{ fontSize: '14px', fontWeight: 800, margin: 0, color: '#1B5E20' }}>
                    Conclusiones de Demanda e Impacto
                  </h4>
                </div>
                <ul style={{ margin: 0, paddingLeft: '18px', fontSize: '12px', color: '#2E7D32', lineHeight: 1.6 }}>
                  <li><strong>Liderazgo Productivo:</strong> El Dr. Valmore Bermúdez y su equipo lideran la demanda institucional con 38 artículos apoyados (71% de ellos en Q1), con una inversión acumulada superior a los $247M COP.</li>
                  <li><strong>Rendimiento de Cuartiles:</strong> El 83% de todas las solicitudes financiadas se concentran en revistas de alto impacto (Q1 y Q2), garantizando un retorno sustancial en visibilidad internacional y rankings institucionales.</li>
                  <li><strong>Costo Medio Controlado:</strong> Aunque el promedio general es de $7.07M COP por artículo, los papers Q1 promedian $8.85M COP, mientras que en Q3 y Q4 el costo promedio desciende a $2.9M COP.</li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ─── TAB 2: DATA TABLE & DETAILED SEARCH ─── */}
      {activeTab === 'tabla' && (
        <div style={{ background: 'white', borderRadius: '18px', border: '1px solid var(--gray-200)', boxShadow: '0 4px 16px rgba(0,0,0,0.03)', overflow: 'hidden' }}>
          {/* Filters Bar */}
          <div style={{ padding: '20px 24px', borderBottom: '1px solid var(--gray-100)', display: 'flex', flexWrap: 'wrap', gap: '14px', alignItems: 'center', justifyContent: 'space-between' }}>
            {/* Search Box */}
            <div style={{ position: 'relative', minWidth: '280px', flex: 1 }}>
              <Search size={16} color="var(--gray-400)" style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)' }} />
              <input
                type="text"
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                placeholder="Buscar por autor, título, revista, editorial, factura o ISSN..."
                style={{
                  width: '100%',
                  padding: '9px 12px 9px 36px',
                  borderRadius: '10px',
                  border: '1px solid var(--gray-300)',
                  fontSize: '13px',
                  outline: 'none'
                }}
              />
              {searchTerm && (
                <button
                  onClick={() => setSearchTerm('')}
                  style={{ position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--gray-400)' }}
                >
                  <X size={14} />
                </button>
              )}
            </div>

            {/* Dropdown Filters */}
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px', alignItems: 'center' }}>
              {/* Cuartil filter */}
              <select
                value={selectedQuartile}
                onChange={e => setSelectedQuartile(e.target.value)}
                style={{ padding: '8px 12px', borderRadius: '10px', border: '1px solid var(--gray-300)', fontSize: '13px', background: 'white' }}
              >
                <option value="all">Todos los Cuartiles</option>
                <option value="Q1">Q1 (Primer Cuartil)</option>
                <option value="Q2">Q2 (Segundo Cuartil)</option>
                <option value="Q3">Q3 (Tercer Cuartil)</option>
                <option value="Q4">Q4 (Cuarto Cuartil)</option>
                <option value="S/C">Sin Clasificar</option>
              </select>

              {/* Status filter */}
              <select
                value={selectedStatus}
                onChange={e => setSelectedStatus(e.target.value)}
                style={{ padding: '8px 12px', borderRadius: '10px', border: '1px solid var(--gray-300)', fontSize: '13px', background: 'white' }}
              >
                <option value="all">Todos los Estados</option>
                <option value="PAGADA">PAGADA</option>
                <option value="EN PROCESO">EN PROCESO</option>
                <option value="ATENDIDA">ATENDIDA</option>
                <option value="REEMBOLSO">REEMBOLSO</option>
                <option value="DEVUELTA">DEVUELTA</option>
              </select>

              {/* Faculty filter */}
              <select
                value={selectedFaculty}
                onChange={e => setSelectedFaculty(e.target.value)}
                style={{ padding: '8px 12px', borderRadius: '10px', border: '1px solid var(--gray-300)', fontSize: '13px', background: 'white', maxWidth: '200px' }}
              >
                <option value="all">Todas las Facultades</option>
                {availableFaculties.map(f => (
                  <option key={f} value={f}>{f}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Table */}
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '13px' }}>
              <thead>
                <tr style={{ background: '#F8FAFC', borderBottom: '2px solid var(--gray-200)', color: 'var(--gray-600)', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                  <th style={{ padding: '14px 16px', width: '70px' }}>Año / #</th>
                  <th style={{ padding: '14px 16px' }}>Investigador</th>
                  <th style={{ padding: '14px 16px' }}>Título del Artículo / Revista</th>
                  <th style={{ padding: '14px 16px', width: '90px' }}>Cuartil</th>
                  <th style={{ padding: '14px 16px', width: '140px' }}>Editorial / Factura</th>
                  <th style={{ padding: '14px 16px', width: '130px', textAlign: 'right' }}>Valor COP</th>
                  <th style={{ padding: '14px 16px', width: '100px', textAlign: 'center' }}>Estado</th>
                  <th style={{ padding: '14px 16px', width: '80px', textAlign: 'center' }}>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {paginatedPayments.length === 0 ? (
                  <tr>
                    <td colSpan={8} style={{ padding: '48px', textAlign: 'center', color: 'var(--gray-400)' }}>
                      No se encontraron artículos con los filtros seleccionados.
                    </td>
                  </tr>
                ) : (
                  paginatedPayments.map((p, idx) => {
                    const statusStyle = STATUS_COLORS[p.estado_final] || { bg: '#F1F5F9', text: '#475569', border: '#CBD5E1' };
                    return (
                      <tr
                        key={p.id || idx}
                        style={{ borderBottom: '1px solid var(--gray-100)', transition: 'background 0.15s' }}
                        onMouseEnter={e => (e.currentTarget.style.background = '#F8FAFC')}
                        onMouseLeave={e => (e.currentTarget.style.background = 'white')}
                      >
                        <td style={{ padding: '14px 16px', color: 'var(--gray-500)', fontWeight: 600 }}>
                          <span style={{ background: '#F1F5F9', padding: '2px 6px', borderRadius: '6px', fontSize: '11px' }}>
                            {p.year}
                          </span>
                          <div style={{ fontSize: '11px', color: 'var(--gray-400)', marginTop: '2px' }}>
                            #{p.consecutive || idx + 1}
                          </div>
                        </td>
                        <td style={{ padding: '14px 16px' }}>
                          <div style={{ fontWeight: 700, color: 'var(--gray-900)' }}>
                            {p.investigador}
                          </div>
                          <div style={{ fontSize: '11px', color: 'var(--gray-500)', marginTop: '2px' }}>
                            {p.facultad || 'Sin facultad'}
                          </div>
                        </td>
                        <td style={{ padding: '14px 16px', maxWidth: '380px' }}>
                          <div style={{ fontWeight: 600, color: 'var(--gray-800)', lineHeight: 1.3 }}>
                            {p.articulo}
                          </div>
                          <div style={{ fontSize: '12px', color: '#00838F', fontWeight: 600, marginTop: '3px' }}>
                            📖 {p.revista} {p.issn ? `• ISSN: ${p.issn}` : ''}
                          </div>
                        </td>
                        <td style={{ padding: '14px 16px' }}>
                          <span style={{
                            display: 'inline-block',
                            padding: '3px 8px',
                            borderRadius: '6px',
                            fontSize: '11px',
                            fontWeight: 800,
                            color: 'white',
                            background: QUARTILE_COLORS[p.cuartil] || '#94A3B8'
                          }}>
                            {p.cuartil || 'S/C'}
                          </span>
                        </td>
                        <td style={{ padding: '14px 16px' }}>
                          <div style={{ fontWeight: 600, color: 'var(--gray-700)' }}>{p.beneficiario}</div>
                          {p.valor_factura_divisa && (
                            <div style={{ fontSize: '11px', color: '#B45309', fontWeight: 600 }}>
                              {p.valor_factura_divisa}
                            </div>
                          )}
                        </td>
                        <td style={{ padding: '14px 16px', textAlign: 'right', fontWeight: 700, color: p.valor_pagado_pesos > 0 ? '#09843B' : 'var(--gray-400)' }}>
                          {p.valor_pagado_pesos > 0 ? `$${p.valor_pagado_pesos.toLocaleString('es-CO')}` : 'En trámite'}
                        </td>
                        <td style={{ padding: '14px 16px', textAlign: 'center' }}>
                          <span style={{
                            fontSize: '11px',
                            fontWeight: 700,
                            padding: '3px 8px',
                            borderRadius: '12px',
                            background: statusStyle.bg,
                            color: statusStyle.text,
                            border: `1px solid ${statusStyle.border}`
                          }}>
                            {p.estado_final || 'PAGADA'}
                          </span>
                        </td>
                        <td style={{ padding: '14px 16px', textAlign: 'center' }}>
                          <button
                            onClick={() => setSelectedPayment(p)}
                            title="Ver detalles completos"
                            style={{
                              background: '#F1F8F5',
                              color: '#09843B',
                              border: 'none',
                              padding: '6px 10px',
                              borderRadius: '8px',
                              cursor: 'pointer',
                              fontWeight: 600,
                              fontSize: '12px'
                            }}
                          >
                            Detalle
                          </button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          <div style={{ padding: '16px 24px', borderTop: '1px solid var(--gray-100)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '13px', color: 'var(--gray-600)' }}>
            <div>
              Mostrando {Math.min(paginatedPayments.length, 1 + (currentPage - 1) * PAGE_SIZE)} - {Math.min(currentPage * PAGE_SIZE, fullyFilteredPayments.length)} de {fullyFilteredPayments.length} registros
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <button
                disabled={currentPage <= 1}
                onClick={() => setCurrentPage(p => p - 1)}
                style={{ padding: '6px 12px', borderRadius: '8px', border: '1px solid var(--gray-300)', background: 'white', cursor: currentPage <= 1 ? 'not-allowed' : 'pointer', opacity: currentPage <= 1 ? 0.4 : 1 }}
              >
                <ChevronLeft size={16} />
              </button>
              <span style={{ fontWeight: 700 }}>
                {currentPage} / {totalPages}
              </span>
              <button
                disabled={currentPage >= totalPages}
                onClick={() => setCurrentPage(p => p + 1)}
                style={{ padding: '6px 12px', borderRadius: '8px', border: '1px solid var(--gray-300)', background: 'white', cursor: currentPage >= totalPages ? 'not-allowed' : 'pointer', opacity: currentPage >= totalPages ? 0.4 : 1 }}
              >
                <ChevronRight size={16} />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ─── TAB 3: ANNUAL BUDGETS POOL MANAGEMENT ─── */}
      {activeTab === 'bolsa' && (
        <div style={{ background: 'white', padding: '28px', borderRadius: '18px', border: '1px solid var(--gray-200)', boxShadow: '0 4px 16px rgba(0,0,0,0.03)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
            <div>
              <h3 style={{ fontSize: '18px', fontWeight: 800, margin: 0 }}>Histórico y Configuración de Bolsas Presupuestales Anuales</h3>
              <p style={{ fontSize: '13px', color: 'var(--gray-500)', margin: '4px 0 0 0' }}>
                Relación de bolsas anuales asignadas por la Vicerrectoría / Dto. de Publicaciones vs. Total efectivamente liquidado.
              </p>
            </div>
          </div>

          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '13px' }}>
            <thead>
              <tr style={{ background: '#F8FAFC', borderBottom: '2px solid var(--gray-200)', color: 'var(--gray-600)', fontSize: '11px', textTransform: 'uppercase' }}>
                <th style={{ padding: '12px 16px' }}>Vigencia Fiscal (Año)</th>
                <th style={{ padding: '12px 16px' }}>Bolsa Presupuestal Asignada</th>
                <th style={{ padding: '12px 16px' }}>Total Invertido / Liquidado</th>
                <th style={{ padding: '12px 16px' }}>Saldo Disponible</th>
                <th style={{ padding: '12px 16px' }}>% Consumo</th>
                <th style={{ padding: '12px 16px', textAlign: 'center' }}>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {availableYears.map(yr => {
                const b = budgets.find(item => item.year === yr);
                const allocated = b ? b.allocated_budget : 350000000;
                const executed = payments.filter(p => p.year === yr).reduce((acc, p) => acc + (p.valor_pagado_pesos || 0), 0);
                const remaining = allocated - executed;
                const pct = allocated > 0 ? Math.round((executed / allocated) * 100) : 0;
                return (
                  <tr key={yr} style={{ borderBottom: '1px solid var(--gray-100)' }}>
                    <td style={{ padding: '14px 16px', fontWeight: 700, fontSize: '14px' }}>
                      {yr} {yr === 2026 ? <span style={{ color: '#09843B', fontSize: '11px', background: '#ECFDF5', padding: '2px 8px', borderRadius: '10px' }}>Vigente</span> : ''}
                    </td>
                    <td style={{ padding: '14px 16px', fontWeight: 700, color: 'var(--gray-800)' }}>
                      ${allocated.toLocaleString('es-CO')} COP
                    </td>
                    <td style={{ padding: '14px 16px', fontWeight: 700, color: '#09843B' }}>
                      ${executed.toLocaleString('es-CO')} COP
                    </td>
                    <td style={{ padding: '14px 16px', fontWeight: 700, color: remaining >= 0 ? '#1D4ED8' : '#B91C1C' }}>
                      ${remaining.toLocaleString('es-CO')} COP
                    </td>
                    <td style={{ padding: '14px 16px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <div style={{ flex: 1, height: '8px', background: '#F1F5F9', borderRadius: '4px', overflow: 'hidden' }}>
                          <div style={{ height: '100%', width: `${Math.min(pct, 100)}%`, background: pct >= 95 ? '#EF4444' : pct >= 80 ? '#F59E0B' : '#09843B' }} />
                        </div>
                        <span style={{ fontSize: '12px', fontWeight: 700 }}>{pct}%</span>
                      </div>
                    </td>
                    <td style={{ padding: '14px 16px', textAlign: 'center' }}>
                      <button
                        onClick={() => {
                          setBudgetEditYear(yr);
                          setBudgetEditAmount(allocated);
                          setShowBudgetModal(true);
                        }}
                        style={{
                          background: '#F1F8F5',
                          border: 'none',
                          color: '#09843B',
                          padding: '6px 12px',
                          borderRadius: '8px',
                          cursor: 'pointer',
                          fontWeight: 600,
                          fontSize: '12px',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '4px'
                        }}
                      >
                        <Edit size={13} /> Modificar
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* ─── MODAL: DETALLE DE ARTÍCULO ─── */}
      {selectedPayment && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
          <div style={{ background: 'white', borderRadius: '20px', maxWidth: '780px', width: '100%', maxHeight: '90vh', overflowY: 'auto', padding: '28px', position: 'relative', boxShadow: '0 20px 50px rgba(0,0,0,0.2)' }}>
            <button
              onClick={() => setSelectedPayment(null)}
              style={{ position: 'absolute', right: '20px', top: '20px', background: '#F1F5F9', border: 'none', borderRadius: '50%', width: '32px', height: '32px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}
            >
              <X size={16} />
            </button>

            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
              <span style={{ background: '#E8F5E9', color: '#1B5E20', fontSize: '11px', fontWeight: 800, padding: '3px 8px', borderRadius: '6px' }}>
                VIGENCIA {selectedPayment.year}
              </span>
              <span style={{ background: QUARTILE_COLORS[selectedPayment.cuartil] || '#94A3B8', color: 'white', fontSize: '11px', fontWeight: 800, padding: '3px 8px', borderRadius: '6px' }}>
                CUARTIL {selectedPayment.cuartil || 'S/C'}
              </span>
              <span style={{ fontSize: '11px', fontWeight: 700, padding: '3px 8px', borderRadius: '6px', background: '#F1F5F9', color: 'var(--gray-600)' }}>
                {selectedPayment.estado_final}
              </span>
            </div>

            <h2 style={{ fontSize: '20px', fontWeight: 800, color: 'var(--gray-900)', margin: '0 0 16px 0', lineHeight: 1.3 }}>
              {selectedPayment.articulo}
            </h2>

            {/* Grid of info */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '14px', marginBottom: '20px' }}>
              <div style={{ background: '#F8FAFC', padding: '12px', borderRadius: '10px' }}>
                <div style={{ fontSize: '11px', color: 'var(--gray-500)', fontWeight: 600 }}>INVESTIGADOR / EQUIPO</div>
                <div style={{ fontSize: '13px', fontWeight: 700, color: 'var(--gray-900)', marginTop: '2px' }}>{selectedPayment.investigador}</div>
                {selectedPayment.cedula && <div style={{ fontSize: '11px', color: 'var(--gray-500)' }}>ID: {selectedPayment.cedula}</div>}
              </div>

              <div style={{ background: '#F8FAFC', padding: '12px', borderRadius: '10px' }}>
                <div style={{ fontSize: '11px', color: 'var(--gray-500)', fontWeight: 600 }}>REVISTA & ISSN</div>
                <div style={{ fontSize: '13px', fontWeight: 700, color: '#00838F', marginTop: '2px' }}>{selectedPayment.revista}</div>
                <div style={{ fontSize: '11px', color: 'var(--gray-500)' }}>ISSN: {selectedPayment.issn || 'N/D'}</div>
              </div>

              <div style={{ background: '#F8FAFC', padding: '12px', borderRadius: '10px' }}>
                <div style={{ fontSize: '11px', color: 'var(--gray-500)', fontWeight: 600 }}>EDITORIAL / BENEFICIARIO</div>
                <div style={{ fontSize: '13px', fontWeight: 700, color: 'var(--gray-900)', marginTop: '2px' }}>{selectedPayment.beneficiario}</div>
                {selectedPayment.pais_origen && <div style={{ fontSize: '11px', color: 'var(--gray-500)' }}>País: {selectedPayment.pais_origen}</div>}
              </div>

              <div style={{ background: '#F0FDF4', padding: '12px', borderRadius: '10px', border: '1px solid #BBF7D0' }}>
                <div style={{ fontSize: '11px', color: '#166534', fontWeight: 600 }}>VALOR PAGADO EN PESOS</div>
                <div style={{ fontSize: '16px', fontWeight: 800, color: '#09843B', marginTop: '2px' }}>
                  {selectedPayment.valor_pagado_pesos > 0 ? `$${selectedPayment.valor_pagado_pesos.toLocaleString('es-CO')} COP` : 'En trámite de liquidación'}
                </div>
                {selectedPayment.valor_factura_divisa && (
                  <div style={{ fontSize: '11px', color: '#B45309', fontWeight: 600 }}>
                    Factura divisa: {selectedPayment.valor_factura_divisa}
                  </div>
                )}
              </div>
            </div>

            {/* Academic details */}
            <div style={{ borderTop: '1px solid var(--gray-100)', paddingTop: '16px', marginBottom: '16px' }}>
              <h4 style={{ fontSize: '13px', fontWeight: 700, color: 'var(--gray-700)', marginBottom: '10px' }}>Detalles Académicos e Institucionales</h4>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '10px', fontSize: '12px' }}>
                <div><span style={{ color: 'var(--gray-500)' }}>Facultad:</span> <strong>{selectedPayment.facultad || 'Sin asignar'}</strong></div>
                <div><span style={{ color: 'var(--gray-500)' }}>Programa Académico:</span> <strong>{selectedPayment.programa_academico || 'N/D'}</strong></div>
                <div><span style={{ color: 'var(--gray-500)' }}>Centro de Investigación:</span> <strong>{selectedPayment.centro_investigacion || 'N/D'}</strong></div>
                <div><span style={{ color: 'var(--gray-500)' }}>Grupo de Investigación:</span> <strong>{selectedPayment.grupo_investigacion || 'N/D'}</strong></div>
                <div><span style={{ color: 'var(--gray-500)' }}>Autor Correspondencia UNISIMON:</span> <strong>{selectedPayment.autor_correspondencia || 'N/D'}</strong></div>
                <div><span style={{ color: 'var(--gray-500)' }}>Afiliación Institucional:</span> <strong>{selectedPayment.afiliacion_institucional || 'N/D'}</strong></div>
                <div><span style={{ color: 'var(--gray-500)' }}>Autorizado por:</span> <strong>{selectedPayment.autorizado_por || 'N/D'}</strong></div>
                <div><span style={{ color: 'var(--gray-500)' }}>Fecha Autorización:</span> <strong>{selectedPayment.fecha_autorizacion || 'N/D'}</strong></div>
                <div><span style={{ color: 'var(--gray-500)' }}>Fecha Pago:</span> <strong>{selectedPayment.fecha_pago || 'N/D'}</strong></div>
                <div><span style={{ color: 'var(--gray-500)' }}>Consecutivo Factura:</span> <strong>{selectedPayment.consecutivo_factura || 'N/D'}</strong></div>
              </div>
            </div>

            {/* Link to article */}
            {selectedPayment.link_publicacion && (
              <div style={{ background: '#EFF6FF', padding: '12px 16px', borderRadius: '10px', border: '1px solid #BFDBFE', display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', color: '#1E40AF', fontWeight: 600 }}>
                  <ExternalLink size={16} /> Enlace de Publicación / DOI:
                </div>
                <a
                  href={selectedPayment.link_publicacion.startsWith('http') ? selectedPayment.link_publicacion : `https://doi.org/${selectedPayment.link_publicacion}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{ color: '#2563EB', fontWeight: 700, fontSize: '12px', textDecoration: 'underline' }}
                >
                  Abrir Artículo ↗
                </a>
              </div>
            )}

            {/* Observaciones */}
            {selectedPayment.observaciones && (
              <div style={{ background: '#FFFBEB', padding: '12px 16px', borderRadius: '10px', border: '1px solid #FDE68A', fontSize: '12px', color: '#92400E' }}>
                <strong>Observaciones:</strong> {selectedPayment.observaciones}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ─── MODAL: AJUSTAR BOLSA PRESUPUESTAL ─── */}
      {showBudgetModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
          <div style={{ background: 'white', borderRadius: '18px', maxWidth: '440px', width: '100%', padding: '24px', boxShadow: '0 20px 40px rgba(0,0,0,0.2)' }}>
            <h3 style={{ fontSize: '17px', fontWeight: 800, margin: '0 0 14px 0', color: 'var(--gray-900)' }}>
              Ajustar Bolsa de Presupuesto Anual
            </h3>
            <p style={{ fontSize: '13px', color: 'var(--gray-600)', marginBottom: '18px' }}>
              Modifica la asignación presupuestal del fondo de apoyos APC para el año seleccionado.
            </p>

            <div style={{ marginBottom: '14px' }}>
              <label style={{ fontSize: '12px', fontWeight: 700, color: 'var(--gray-700)', display: 'block', marginBottom: '6px' }}>
                Vigencia Fiscal (Año)
              </label>
              <select
                value={budgetEditYear}
                onChange={e => setBudgetEditYear(parseInt(e.target.value))}
                style={{ width: '100%', padding: '9px 12px', borderRadius: '10px', border: '1px solid var(--gray-300)', fontSize: '13px' }}
              >
                {availableYears.map(yr => (
                  <option key={yr} value={yr}>{yr}</option>
                ))}
              </select>
            </div>

            <div style={{ marginBottom: '20px' }}>
              <label style={{ fontSize: '12px', fontWeight: 700, color: 'var(--gray-700)', display: 'block', marginBottom: '6px' }}>
                Monto de la Bolsa Asignada (COP)
              </label>
              <input
                type="number"
                value={budgetEditAmount}
                onChange={e => setBudgetEditAmount(Number(e.target.value))}
                style={{ width: '100%', padding: '9px 12px', borderRadius: '10px', border: '1px solid var(--gray-300)', fontSize: '15px', fontWeight: 700 }}
              />
              <span style={{ fontSize: '12px', color: 'var(--primary)', fontWeight: 600, display: 'block', marginTop: '4px' }}>
                ${budgetEditAmount.toLocaleString('es-CO')} COP
              </span>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
              <button
                onClick={() => setShowBudgetModal(false)}
                style={{ padding: '8px 14px', borderRadius: '8px', border: '1px solid var(--gray-300)', background: 'white', cursor: 'pointer', fontSize: '13px', fontWeight: 600 }}
              >
                Cancelar
              </button>
              <button
                onClick={handleSaveBudget}
                style={{ padding: '8px 18px', borderRadius: '8px', border: 'none', background: '#09843B', color: 'white', cursor: 'pointer', fontSize: '13px', fontWeight: 700 }}
              >
                Guardar Ajuste
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ─── MODAL: NUEVO PAGO APC ─── */}
      {showNewModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
          <div style={{ background: 'white', borderRadius: '20px', maxWidth: '640px', width: '100%', maxHeight: '90vh', overflowY: 'auto', padding: '28px', boxShadow: '0 20px 50px rgba(0,0,0,0.2)' }}>
            <h3 style={{ fontSize: '18px', fontWeight: 800, margin: '0 0 16px 0', color: 'var(--gray-900)' }}>
              Registrar Nuevo Apoyo APC
            </h3>

            <form
              onSubmit={async e => {
                e.preventDefault();
                const form = e.currentTarget;
                const fd = new FormData(form);

                const newRecord: APCPayment = {
                  id: `apc-${Date.now()}`,
                  year: parseInt(fd.get('year') as string) || 2026,
                  investigador: (fd.get('investigador') as string) || 'Sin Investigador',
                  articulo: (fd.get('articulo') as string) || 'Sin Título',
                  revista: (fd.get('revista') as string) || 'Sin Revista',
                  cuartil: (fd.get('cuartil') as string) || 'Q1',
                  beneficiario: (fd.get('beneficiario') as string) || 'Editorial',
                  valor_factura_divisa: (fd.get('valor_factura_divisa') as string) || null,
                  valor_pagado_pesos: Number(fd.get('valor_pagado_pesos')) || 0,
                  estado_final: (fd.get('estado_final') as string) || 'PAGADA',
                  facultad: (fd.get('facultad') as string) || 'Ciencias de la Salud',
                  link_publicacion: (fd.get('link_publicacion') as string) || null,
                  autor_correspondencia: (fd.get('autor_correspondencia') as string) || 'SI',
                  afiliacion_institucional: (fd.get('afiliacion_institucional') as string) || 'SI',
                };

                setPayments([newRecord, ...payments]);

                // Try Supabase insert
                try {
                  await supabase.from('apc_payments').insert([{
                    year: newRecord.year,
                    investigador: newRecord.investigador,
                    articulo: newRecord.articulo,
                    revista: newRecord.revista,
                    cuartil: newRecord.cuartil,
                    beneficiario: newRecord.beneficiario,
                    valor_factura_divisa: newRecord.valor_factura_divisa,
                    valor_pagado_pesos: newRecord.valor_pagado_pesos,
                    estado_final: newRecord.estado_final,
                    facultad: newRecord.facultad,
                    link_publicacion: newRecord.link_publicacion,
                    autor_correspondencia: newRecord.autor_correspondencia,
                    afiliacion_institucional: newRecord.afiliacion_institucional
                  }]);
                } catch (err) {
                  console.log('Saved payment locally:', err);
                }

                setShowNewModal(false);
              }}
              style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}
            >
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div>
                  <label style={{ fontSize: '12px', fontWeight: 700, display: 'block', marginBottom: '4px' }}>Año / Vigencia</label>
                  <select name="year" defaultValue={2026} style={{ width: '100%', padding: '8px 10px', borderRadius: '8px', border: '1px solid var(--gray-300)', fontSize: '13px' }}>
                    <option value={2026}>2026</option>
                    <option value={2025}>2025</option>
                    <option value={2024}>2024</option>
                  </select>
                </div>
                <div>
                  <label style={{ fontSize: '12px', fontWeight: 700, display: 'block', marginBottom: '4px' }}>Cuartil de la Revista</label>
                  <select name="cuartil" defaultValue="Q1" style={{ width: '100%', padding: '8px 10px', borderRadius: '8px', border: '1px solid var(--gray-300)', fontSize: '13px' }}>
                    <option value="Q1">Q1 (Primer Cuartil)</option>
                    <option value="Q2">Q2 (Segundo Cuartil)</option>
                    <option value="Q3">Q3 (Tercer Cuartil)</option>
                    <option value="Q4">Q4 (Cuarto Cuartil)</option>
                    <option value="S/C">Sin Clasificar</option>
                  </select>
                </div>
              </div>

              <div>
                <label style={{ fontSize: '12px', fontWeight: 700, display: 'block', marginBottom: '4px' }}>Investigador y Equipo *</label>
                <input required name="investigador" placeholder="Ej: Dr. David Enrique Martínez y equipo" style={{ width: '100%', padding: '8px 10px', borderRadius: '8px', border: '1px solid var(--gray-300)', fontSize: '13px' }} />
              </div>

              <div>
                <label style={{ fontSize: '12px', fontWeight: 700, display: 'block', marginBottom: '4px' }}>Título del Artículo *</label>
                <textarea required name="articulo" rows={2} placeholder="Título completo del paper..." style={{ width: '100%', padding: '8px 10px', borderRadius: '8px', border: '1px solid var(--gray-300)', fontSize: '13px' }} />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div>
                  <label style={{ fontSize: '12px', fontWeight: 700, display: 'block', marginBottom: '4px' }}>Revista *</label>
                  <input required name="revista" placeholder="Ej: Scientific Reports" style={{ width: '100%', padding: '8px 10px', borderRadius: '8px', border: '1px solid var(--gray-300)', fontSize: '13px' }} />
                </div>
                <div>
                  <label style={{ fontSize: '12px', fontWeight: 700, display: 'block', marginBottom: '4px' }}>Editorial / Beneficiario *</label>
                  <input required name="beneficiario" placeholder="Ej: MDPI AG, Springer Nature" style={{ width: '100%', padding: '8px 10px', borderRadius: '8px', border: '1px solid var(--gray-300)', fontSize: '13px' }} />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div>
                  <label style={{ fontSize: '12px', fontWeight: 700, display: 'block', marginBottom: '4px' }}>Valor Factura (Divisa)</label>
                  <input name="valor_factura_divisa" placeholder="Ej: 2400 CHF o 2500 USD" style={{ width: '100%', padding: '8px 10px', borderRadius: '8px', border: '1px solid var(--gray-300)', fontSize: '13px' }} />
                </div>
                <div>
                  <label style={{ fontSize: '12px', fontWeight: 700, display: 'block', marginBottom: '4px' }}>Valor Pagado en Pesos (COP)</label>
                  <input type="number" name="valor_pagado_pesos" placeholder="Ej: 10500000" style={{ width: '100%', padding: '8px 10px', borderRadius: '8px', border: '1px solid var(--gray-300)', fontSize: '13px' }} />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div>
                  <label style={{ fontSize: '12px', fontWeight: 700, display: 'block', marginBottom: '4px' }}>Facultad</label>
                  <select name="facultad" style={{ width: '100%', padding: '8px 10px', borderRadius: '8px', border: '1px solid var(--gray-300)', fontSize: '13px' }}>
                    <option value="Ciencias de la Salud">Ciencias de la Salud</option>
                    <option value="Ciencias Básicas y Biomédicas">Ciencias Básicas y Biomédicas</option>
                    <option value="Ingenierías">Ingenierías</option>
                    <option value="Ciencias Jurídicas y Sociales">Ciencias Jurídicas y Sociales</option>
                    <option value="Ciencias Administrativas, Económicas y Contables">Ciencias Administrativas, Económicas y Contables</option>
                  </select>
                </div>
                <div>
                  <label style={{ fontSize: '12px', fontWeight: 700, display: 'block', marginBottom: '4px' }}>Estado Final</label>
                  <select name="estado_final" defaultValue="PAGADA" style={{ width: '100%', padding: '8px 10px', borderRadius: '8px', border: '1px solid var(--gray-300)', fontSize: '13px' }}>
                    <option value="PAGADA">PAGADA</option>
                    <option value="EN PROCESO">EN PROCESO</option>
                    <option value="ATENDIDA">ATENDIDA</option>
                    <option value="REEMBOLSO">REEMBOLSO</option>
                  </select>
                </div>
              </div>

              <div>
                <label style={{ fontSize: '12px', fontWeight: 700, display: 'block', marginBottom: '4px' }}>Enlace / DOI de la Publicación</label>
                <input name="link_publicacion" placeholder="https://doi.org/10.xxxx/..." style={{ width: '100%', padding: '8px 10px', borderRadius: '8px', border: '1px solid var(--gray-300)', fontSize: '13px' }} />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '10px' }}>
                <button
                  type="button"
                  onClick={() => setShowNewModal(false)}
                  style={{ padding: '8px 14px', borderRadius: '8px', border: '1px solid var(--gray-300)', background: 'white', cursor: 'pointer', fontSize: '13px', fontWeight: 600 }}
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  style={{ padding: '8px 18px', borderRadius: '8px', border: 'none', background: '#09843B', color: 'white', cursor: 'pointer', fontSize: '13px', fontWeight: 700 }}
                >
                  Guardar Pago
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
