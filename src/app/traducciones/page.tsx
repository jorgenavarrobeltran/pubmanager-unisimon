'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import initialData from '@/lib/translations-initial-data.json';
import {
  exportTranslationsToExcel,
  type TranslationOrder,
  type TranslationDeposit,
} from '@/lib/translationsExcelGenerator';
import {
  BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Legend, Line, ComposedChart, Area, AreaChart,
} from 'recharts';
import {
  Languages, Plus, Search, Download, DollarSign, FileText, Clock, Wallet,
  TrendingUp, BookOpen, ChevronLeft, ChevronRight, X, AlertTriangle,
  CheckCircle2, Users, Mail, PiggyBank, Type, Info, RefreshCw, Award, Layers, Building2,
  ArrowDownRight, ArrowUpRight, CalendarClock, Receipt,
} from 'lucide-react';

/* ---------- Constants ---------- */
const SERVICE_COLORS: Record<string, string> = {
  'Traducción + Edición': '#3B82F6',
  'Corrección de estilo': '#10B981',
  'Edición sustantiva': '#8B5CF6',
  'Servicios varios': '#F59E0B',
};
const STATUS_STYLES: Record<string, { bg: string; text: string; border: string }> = {
  'Completado': { bg: '#ECFDF5', text: '#065F46', border: '#A7F3D0' },
  'En proceso': { bg: '#EFF6FF', text: '#1E40AF', border: '#BFDBFE' },
  'Cancelado': { bg: '#FEF2F2', text: '#991B1B', border: '#FECACA' },
  'Sin estado': { bg: '#F8FAFC', text: '#475569', border: '#E2E8F0' },
};
const SERVICES = Object.keys(SERVICE_COLORS);
const STATUSES = ['Completado', 'En proceso', 'Cancelado'];
const QUARTILE_COLORS: Record<string, string> = { Q1: '#10B981', Q2: '#3B82F6', Q3: '#F59E0B', Q4: '#8B5CF6', 'S/C': '#94A3B8' };
const QUARTILES = ['Q1', 'Q2', 'Q3', 'Q4'];
const PAGE_SIZE = 15;
const LOW_BALANCE_USD = 10000;

const usd = (n: number, digits = 0) =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: digits, maximumFractionDigits: digits }).format(n || 0);
const num = (n: number) => new Intl.NumberFormat('es-CO').format(n || 0);
const fmtDate = (d: string | null) => {
  if (!d) return '—';
  const [y, m, day] = d.split('-').map(Number);
  return new Date(y, m - 1, day).toLocaleDateString('es-CO', { day: '2-digit', month: 'short', year: 'numeric' });
};

const EMPTY_ORDER = {
  assignment_number: '', service: 'Traducción + Edición', status: 'En proceso',
  confirmed_on: new Date().toISOString().slice(0, 10), delivered_on: '',
  word_count: '', fee_usd: '', requested_by: '', researcher_email: '',
  researcher_team: '', manuscript_title: '', journal: '', quartile: '', facultad: '', notes: '', charged_to_deposit: true,
};

// Agrupa variantes del mismo investigador (tildes, guiones, orden de apellidos, "y equipo")
const researcherKey = (name: string) =>
  name.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/\by equipo\b|\bequipo\b/g, '').replace(/[^a-z\s]/g, ' ')
    .split(/\s+/).filter(Boolean).sort().join(' ');
const shortFaculty = (f: string) => f.replace(/^Facultad de /, '').replace(/^Departamento de /, 'Depto. ').replace(/^Centro de /, 'Centro ');

function QuartileTag({ q }: { q?: string | null }) {
  const k = q || 'S/C';
  return <span className="tr-q" style={{ ['--c' as string]: QUARTILE_COLORS[k] || '#94A3B8' }}>{k}</span>;
}

/* ---------- Small UI pieces ---------- */
function KpiCard({ icon, label, value, sub, color }: { icon: React.ReactNode; label: string; value: string; sub?: React.ReactNode; color: string }) {
  return (
    <div className="tr-card tr-kpi" style={{ ['--accent' as string]: color }}>
      <div className="tr-kpi-icon">{icon}</div>
      <div style={{ minWidth: 0 }}>
        <div className="tr-kpi-label">{label}</div>
        <div className="tr-kpi-value">{value}</div>
        {sub && <div className="tr-kpi-sub">{sub}</div>}
      </div>
    </div>
  );
}

function Badge({ status }: { status: string }) {
  const s = STATUS_STYLES[status] || STATUS_STYLES['Sin estado'];
  return <span className="tr-badge" style={{ background: s.bg, color: s.text, borderColor: s.border }}>{status}</span>;
}

/* ---------- Page ---------- */
export default function TraduccionesPage() {
  const { accessLevel } = useAuth();
  const canEdit = accessLevel('traducciones') === 'full';
  const supabase = useMemo(() => createClient(), []);

  const [orders, setOrders] = useState<TranslationOrder[]>(initialData.orders as TranslationOrder[]);
  const [deposits, setDeposits] = useState<TranslationDeposit[]>(initialData.deposits as TranslationDeposit[]);
  const [source, setSource] = useState<'local' | 'supabase'>('local');
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<'dashboard' | 'tabla' | 'deposito'>('deposito');

  const [selectedYear, setSelectedYear] = useState('all');
  const [selectedService, setSelectedService] = useState('all');
  const [selectedStatus, setSelectedStatus] = useState('all');
  const [selectedRequester, setSelectedRequester] = useState('all');
  const [selectedFaculty, setSelectedFaculty] = useState('all');
  const [selectedQuartile, setSelectedQuartile] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [ledgerScope, setLedgerScope] = useState<'paquete' | 'todo'>('paquete');
  const [ledgerPage, setLedgerPage] = useState(1);

  const [selectedOrder, setSelectedOrder] = useState<TranslationOrder | null>(null);
  const [showOrderModal, setShowOrderModal] = useState(false);
  const [showDepositModal, setShowDepositModal] = useState(false);
  const [orderForm, setOrderForm] = useState({ ...EMPTY_ORDER });
  const [depositForm, setDepositForm] = useState({ deposit_date: new Date().toISOString().slice(0, 10), amount_usd: '', withholding_tax_usd: '0', notes: '' });
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  /* ----- Load from Supabase (fallback: local historical dataset) ----- */
  const loadSupabaseData = useCallback(async () => {
    try {
      setLoading(true);
      const { data: oData, error: oErr } = await supabase.from('translation_orders').select('*').order('confirmed_on', { ascending: false });
      if (!oErr && oData && oData.length > 0) {
        setOrders(oData.map((o: any) => ({ ...o, fee_usd: Number(o.fee_usd) || 0 })) as TranslationOrder[]);
        setSource('supabase');
      }
      const { data: dData, error: dErr } = await supabase.from('translation_deposits').select('*').order('deposit_date', { ascending: true });
      if (!dErr && dData && dData.length > 0) {
        setDeposits(dData.map((d: any) => ({ ...d, amount_usd: Number(d.amount_usd), withholding_tax_usd: Number(d.withholding_tax_usd), received_usd: Number(d.received_usd) })) as TranslationDeposit[]);
      }
    } catch (e) {
      console.log('Usando dataset local de Traducciones:', e);
    } finally {
      setLoading(false);
    }
  }, [supabase]);

  useEffect(() => { loadSupabaseData(); }, [loadSupabaseData]);
  useEffect(() => { if (toast) { const t = setTimeout(() => setToast(null), 3500); return () => clearTimeout(t); } }, [toast]);

  /* ----- Derived lists ----- */
  const sortedOrders = useMemo(
    () => [...orders].sort((a, b) => (b.confirmed_on || '').localeCompare(a.confirmed_on || '') || b.assignment_number.localeCompare(a.assignment_number)),
    [orders]
  );
  const availableYears = useMemo(() => Array.from(new Set(orders.map(o => o.year).filter(Boolean) as number[])).sort((a, b) => b - a), [orders]);
  const requesters = useMemo(() => Array.from(new Set(orders.map(o => o.requested_by).filter(Boolean) as string[])).sort(), [orders]);
  const faculties = useMemo(() => Array.from(new Set(orders.map(o => o.facultad).filter(Boolean) as string[])).sort(), [orders]);
  const journals = useMemo(() => Array.from(new Set(orders.map(o => o.journal).filter(Boolean) as string[])).sort(), [orders]);

  const yearOrders = useMemo(
    () => selectedYear === 'all' ? orders : orders.filter(o => o.year === parseInt(selectedYear)),
    [orders, selectedYear]
  );

  const filteredOrders = useMemo(() => {
    const q = searchTerm.trim().toLowerCase();
    return sortedOrders.filter(o => {
      if (selectedYear !== 'all' && o.year !== parseInt(selectedYear)) return false;
      if (selectedService !== 'all' && o.service !== selectedService) return false;
      if (selectedStatus !== 'all' && o.status !== selectedStatus) return false;
      if (selectedRequester !== 'all' && o.requested_by !== selectedRequester) return false;
      if (selectedFaculty !== 'all' && (o.facultad || '') !== (selectedFaculty === 'none' ? '' : selectedFaculty)) return false;
      if (selectedQuartile !== 'all' && (o.quartile || 'S/C') !== selectedQuartile) return false;
      if (q) {
        const hay = [o.assignment_number, o.requested_by, o.researcher_email, o.researcher_team, o.inquiry_number, o.manuscript_title, o.journal, o.facultad, o.notes]
          .filter(Boolean).join(' ').toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [sortedOrders, selectedYear, selectedService, selectedStatus, selectedRequester, selectedFaculty, selectedQuartile, searchTerm]);

  useEffect(() => { setCurrentPage(1); }, [selectedYear, selectedService, selectedStatus, selectedRequester, selectedFaculty, selectedQuartile, searchTerm]);
  const totalPages = Math.max(1, Math.ceil(filteredOrders.length / PAGE_SIZE));
  const pageOrders = filteredOrders.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

  /* ----- Balance (always historical: the deposit is cumulative) ----- */
  const balance = useMemo(() => {
    const dep = deposits.reduce((a, d) => a + (Number(d.received_usd) || 0), 0);
    const used = orders.reduce((a, o) => a + (o.charged_to_deposit ? Number(o.fee_usd) || 0 : 0), 0);
    const available = dep - used;

    // Consumo promedio mensual de los últimos 12 meses
    const latest = orders.reduce((m, o) => (o.confirmed_on && o.confirmed_on > m ? o.confirmed_on : m), '');
    const ref = latest ? new Date(latest) : new Date();
    const from = new Date(ref); from.setFullYear(from.getFullYear() - 1);
    const last12 = orders.filter(o => o.charged_to_deposit && o.confirmed_on && new Date(o.confirmed_on) > from)
      .reduce((a, o) => a + o.fee_usd, 0);
    const monthlyBurn = last12 / 12;
    const monthsLeft = monthlyBurn > 0 ? available / monthlyBurn : Infinity;

    return {
      deposits: Math.round(dep * 100) / 100,
      utilized: Math.round(used * 100) / 100,
      available: Math.round(available * 100) / 100,
      pctUsed: dep > 0 ? Math.round((used / dep) * 100) : 0,
      monthlyBurn,
      monthsLeft,
      last12,
    };
  }, [orders, deposits]);

  /* ----- Paquete prepagado vigente (última recarga) ----- */
  const packageInfo = useMemo(() => {
    const deps = [...deposits].sort((a, b) => a.deposit_date.localeCompare(b.deposit_date));
    const last = deps[deps.length - 1];
    if (!last) return null;
    const charged = orders.filter(o => o.charged_to_deposit && (Number(o.fee_usd) || 0) > 0);
    const prevDeposits = deps.slice(0, -1).reduce((a, d) => a + (Number(d.received_usd) || 0), 0);
    const usedBefore = charged.filter(o => (o.confirmed_on || '') < last.deposit_date).reduce((a, o) => a + Number(o.fee_usd), 0);
    const since = charged.filter(o => (o.confirmed_on || '') >= last.deposit_date)
      .sort((a, b) => (b.confirmed_on || '').localeCompare(a.confirmed_on || '') || b.assignment_number.localeCompare(a.assignment_number, undefined, { numeric: true }));
    const carry = Math.round((prevDeposits - usedBefore) * 100) / 100;
    const received = Number(last.received_usd) || 0;
    const startBalance = received + carry;
    const consumed = Math.round(since.reduce((a, o) => a + Number(o.fee_usd), 0) * 100) / 100;
    const remaining = Math.round((startBalance - consumed) * 100) / 100;
    const now = new Date();
    const months = Math.max(1, (now.getTime() - new Date(`${last.deposit_date}T00:00:00`).getTime()) / (86400000 * 30.44));
    const monthlyAvg = consumed / months;
    const monthsLeft = monthlyAvg > 0 ? Math.max(0, remaining / monthlyAvg) : Infinity;
    const exhaust = isFinite(monthsLeft) ? new Date(now.getTime() + monthsLeft * 30.44 * 86400000) : null;
    return {
      last, received, carry, startBalance, consumed, remaining, count: since.length,
      pct: startBalance > 0 ? Math.min(100, Math.round(((startBalance - remaining) / startBalance) * 1000) / 10) : 100,
      monthlyAvg, monthsLeft,
      exhaustLabel: exhaust ? exhaust.toLocaleDateString('es-CO', { month: 'long', year: 'numeric' }) : null,
      lastOrder: since[0] || null,
    };
  }, [orders, deposits]);

  /* ----- Balance de un año específico (filtro de año) ----- */
  const yearInfo = useMemo(() => {
    if (selectedYear === 'all') return null;
    const y = selectedYear;
    const start = `${y}-01-01`, end = `${y}-12-31`;
    const today = new Date();
    const isCurrent = parseInt(y, 10) === today.getFullYear();
    const charged = orders.filter(o => o.charged_to_deposit && (Number(o.fee_usd) || 0) > 0 && o.confirmed_on);
    const sumDep = (arr: TranslationDeposit[]) => arr.reduce((a, d) => a + (Number(d.received_usd) || 0), 0);
    const sumFee = (arr: TranslationOrder[]) => arr.reduce((a, o) => a + Number(o.fee_usd), 0);
    const r2 = (n: number) => Math.round(n * 100) / 100;
    const opening = r2(sumDep(deposits.filter(d => d.deposit_date < start)) - sumFee(charged.filter(o => (o.confirmed_on as string) < start)));
    const yDeps = deposits.filter(d => d.deposit_date >= start && d.deposit_date <= end).sort((a, b) => a.deposit_date.localeCompare(b.deposit_date));
    const yOrders = charged.filter(o => (o.confirmed_on as string) >= start && (o.confirmed_on as string) <= end);
    const recharged = r2(sumDep(yDeps));
    const consumed = r2(sumFee(yOrders));
    const closing = r2(opening + recharged - consumed);
    const availableInYear = opening + recharged;

    const MONTHS = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
    const lastMonth = isCurrent ? today.getMonth() : 11;
    let running = opening;
    const monthly = MONTHS.slice(0, lastMonth + 1).map((mes, i) => {
      const k = `${y}-${String(i + 1).padStart(2, '0')}`;
      const rec = sumDep(yDeps.filter(d => d.deposit_date.startsWith(k)));
      const os = yOrders.filter(o => (o.confirmed_on as string).startsWith(k));
      const con = sumFee(os);
      running += rec - con;
      return { mes, consumo: Math.round(con), recarga: Math.round(rec), saldo: Math.round(running), servicios: os.length };
    });
    const peak = monthly.reduce((m, r) => (r.consumo > (m?.consumo ?? 0) ? r : m), null as null | (typeof monthly)[number]);
    const activeMonths = Math.max(1, monthly.length);
    const pkg = [...deposits].filter(d => d.deposit_date <= end).sort((a, b) => b.deposit_date.localeCompare(a.deposit_date))[0] || null;
    return {
      y, isCurrent, opening, recharged, consumed, closing, yDeps, count: yOrders.length,
      pct: availableInYear > 0 ? Math.min(100, Math.round((consumed / availableInYear) * 1000) / 10) : 100,
      monthly, peak, monthlyAvg: consumed / activeMonths, pkg,
      closeLabel: isCurrent ? `Saldo a la fecha (${fmtDate(today.toISOString().slice(0, 10))})` : `Saldo al cierre de ${y}`,
    };
  }, [selectedYear, orders, deposits]);

  /* ----- Cierre anual: saldo inicial / recargas / consumo / saldo final por año ----- */
  const yearClosings = useMemo(() => {
    const charged = orders.filter(o => o.charged_to_deposit && (Number(o.fee_usd) || 0) > 0 && o.confirmed_on);
    const years = Array.from(new Set([
      ...deposits.map(d => d.deposit_date.slice(0, 4)),
      ...charged.map(o => (o.confirmed_on as string).slice(0, 4)),
    ])).sort();
    const nowY = String(new Date().getFullYear());
    let running = 0;
    const rows = years.map(y => {
      const recharged = deposits.filter(d => d.deposit_date.startsWith(y)).reduce((a, d) => a + (Number(d.received_usd) || 0), 0);
      const os = charged.filter(o => (o.confirmed_on as string).startsWith(y));
      const consumed = os.reduce((a, o) => a + Number(o.fee_usd), 0);
      const opening = running;
      running = opening + recharged - consumed;
      const r2 = (n: number) => Math.round(n * 100) / 100;
      return { y, opening: r2(opening), recharged: r2(recharged), consumed: r2(consumed), closing: r2(running), count: os.length, current: y === nowY };
    });
    return rows.reverse();
  }, [orders, deposits]);
  /* ----- Extracto: recargas (+) y servicios (−) con saldo corrido ----- */
  const ledger = useMemo(() => {
    type Row = { key: string; date: string; kind: 'dep' | 'svc'; ref: string; detail: string; sub: string; amount: number; balance: number; order?: TranslationOrder };
    const events: Omit<Row, 'balance'>[] = [
      ...deposits.map(d => ({
        key: `d-${d.id}`, date: d.deposit_date, kind: 'dep' as const, ref: 'Recarga ENAGO',
        detail: d.notes || 'Compra de paquete prepagado', sub: d.withholding_tax_usd ? `Retención ${usd(d.withholding_tax_usd, 2)}` : '',
        amount: Number(d.received_usd) || 0,
      })),
      ...orders.filter(o => o.charged_to_deposit && (Number(o.fee_usd) || 0) > 0).map(o => ({
        key: `o-${o.id}`, date: o.confirmed_on || '', kind: 'svc' as const, ref: o.assignment_number,
        detail: o.researcher_team || o.researcher_email || 'Investigador sin registrar',
        sub: [o.service, o.word_count ? `${num(o.word_count)} palabras` : ''].filter(Boolean).join(' · '),
        amount: -Number(o.fee_usd), order: o,
      })),
    ].sort((a, b) => a.date.localeCompare(b.date) || (a.kind === b.kind ? a.ref.localeCompare(b.ref, undefined, { numeric: true }) : a.kind === 'dep' ? -1 : 1));
    let running = 0;
    const rows: Row[] = events.map(e => { running += e.amount; return { ...e, balance: Math.round(running * 100) / 100 }; });
    return rows.reverse();
  }, [orders, deposits]);

  const ledgerRows = useMemo(
    () => (yearInfo ? ledger.filter(r => r.date.startsWith(yearInfo.y))
      : ledgerScope === 'paquete' && packageInfo ? ledger.filter(r => r.date >= packageInfo.last.deposit_date) : ledger),
    [ledger, ledgerScope, packageInfo, yearInfo]
  );
  useEffect(() => { setLedgerPage(1); }, [ledgerScope, selectedYear]);
  const LEDGER_SIZE = 20;
  const ledgerPages = Math.max(1, Math.ceil(ledgerRows.length / LEDGER_SIZE));
  const ledgerPageRows = ledgerRows.slice((ledgerPage - 1) * LEDGER_SIZE, ledgerPage * LEDGER_SIZE);

  /* ----- Period stats ----- */
  const stats = useMemo(() => {
    const active = yearOrders.filter(o => o.status !== 'Cancelado');
    const totalUSD = active.reduce((a, o) => a + (o.fee_usd || 0), 0);
    const priced = active.filter(o => o.fee_usd > 0 && o.word_count);
    const pricedWords = priced.reduce((a, o) => a + (o.word_count || 0), 0);
    const pricedUSD = priced.reduce((a, o) => a + o.fee_usd, 0);
    const totalWords = active.reduce((a, o) => a + (o.word_count || 0), 0);
    const ta = active.filter(o => o.turnaround_days != null && o.turnaround_days >= 0 && o.turnaround_days < 120);
    const inProgress = yearOrders.filter(o => o.status === 'En proceso').length;
    const researchers = new Set(active.map(o => (o.researcher_team ? researcherKey(o.researcher_team) : o.researcher_email)).filter(Boolean)).size;
    const withQ = active.filter(o => o.quartile);
    const highImpact = withQ.filter(o => o.quartile === 'Q1' || o.quartile === 'Q2').length;
    return {
      totalOrders: active.length,
      totalUSD: Math.round(totalUSD * 100) / 100,
      totalWords,
      avgCostPerWord: pricedWords > 0 ? Number((pricedUSD / pricedWords).toFixed(4)) : 0,
      avgTicket: priced.length ? pricedUSD / priced.length : 0,
      avgTurnaround: ta.length ? Math.round(ta.reduce((a, o) => a + (o.turnaround_days || 0), 0) / ta.length) : 0,
      avgWords: active.length ? Math.round(totalWords / active.length) : 0,
      inProgress,
      researchers,
      withArticle: active.filter(o => o.manuscript_title).length,
      highImpact,
      highImpactPct: withQ.length ? Math.round((highImpact / withQ.length) * 100) : 0,
      withQuartile: withQ.length,
    };
  }, [yearOrders]);

  /* ----- Chart data ----- */
  const yearlyTrend = useMemo(() => {
    const map: Record<number, { year: string; encargos: number; usd: number; palabrasK: number }> = {};
    orders.forEach(o => {
      if (!o.year || o.status === 'Cancelado') return;
      map[o.year] ??= { year: String(o.year), encargos: 0, usd: 0, palabrasK: 0 };
      map[o.year].encargos++;
      map[o.year].usd += o.fee_usd || 0;
      map[o.year].palabrasK += (o.word_count || 0) / 1000;
    });
    return Object.values(map).sort((a, b) => a.year.localeCompare(b.year)).map(r => ({ ...r, usd: Math.round(r.usd), palabrasK: Math.round(r.palabrasK) }));
  }, [orders]);

  const serviceData = useMemo(() => {
    const map: Record<string, { name: string; value: number; usd: number; words: number; pricedWords: number; pricedUsd: number }> = {};
    yearOrders.forEach(o => {
      if (o.status === 'Cancelado') return;
      map[o.service] ??= { name: o.service, value: 0, usd: 0, words: 0, pricedWords: 0, pricedUsd: 0 };
      const m = map[o.service];
      m.value++; m.usd += o.fee_usd; m.words += o.word_count || 0;
      if (o.fee_usd > 0 && o.word_count) { m.pricedWords += o.word_count; m.pricedUsd += o.fee_usd; }
    });
    return Object.values(map).sort((a, b) => b.value - a.value).map(s => ({
      ...s,
      color: SERVICE_COLORS[s.name] || '#94A3B8',
      centsPerWord: s.pricedWords ? Number(((s.pricedUsd / s.pricedWords) * 100).toFixed(2)) : 0,
    }));
  }, [yearOrders]);

  const topRequesters = useMemo(() => {
    const map: Record<string, { name: string; count: number; usd: number; words: number }> = {};
    yearOrders.forEach(o => {
      if (o.status === 'Cancelado') return;
      const k = o.requested_by || 'Sin registrar';
      map[k] ??= { name: k, count: 0, usd: 0, words: 0 };
      map[k].count++; map[k].usd += o.fee_usd; map[k].words += o.word_count || 0;
    });
    return Object.values(map).sort((a, b) => b.count - a.count).slice(0, 8);
  }, [yearOrders]);

  const topResearchers = useMemo(() => {
    const map: Record<string, { name: string; count: number; usd: number; q12: number; faculty: string | null }> = {};
    yearOrders.forEach(o => {
      if (o.status === 'Cancelado') return;
      const label = o.researcher_team || o.researcher_email;
      if (!label) return;
      const k = o.researcher_team ? researcherKey(o.researcher_team) : label;
      map[k] ??= { name: label, count: 0, usd: 0, q12: 0, faculty: null };
      const m = map[k];
      if (label.length > m.name.length && o.researcher_team) m.name = label;
      m.count++; m.usd += o.fee_usd;
      if (o.quartile === 'Q1' || o.quartile === 'Q2') m.q12++;
      if (!m.faculty && o.facultad) m.faculty = o.facultad;
    });
    return Object.values(map).sort((a, b) => b.count - a.count || b.usd - a.usd).slice(0, 10);
  }, [yearOrders]);

  const quartileData = useMemo(() => {
    const map: Record<string, { name: string; value: number; usd: number }> = {};
    yearOrders.forEach(o => {
      if (o.status === 'Cancelado' || !o.manuscript_title && !o.quartile) return;
      const k = o.quartile || 'S/C';
      map[k] ??= { name: k, value: 0, usd: 0 };
      map[k].value++; map[k].usd += o.fee_usd;
    });
    return ['Q1', 'Q2', 'Q3', 'Q4', 'S/C'].filter(k => map[k]).map(k => ({ ...map[k], color: QUARTILE_COLORS[k] }));
  }, [yearOrders]);

  const facultyData = useMemo(() => {
    const map: Record<string, { name: string; short: string; count: number; usd: number }> = {};
    yearOrders.forEach(o => {
      if (o.status === 'Cancelado' || !o.facultad) return;
      map[o.facultad] ??= { name: o.facultad, short: shortFaculty(o.facultad), count: 0, usd: 0 };
      map[o.facultad].count++; map[o.facultad].usd += o.fee_usd;
    });
    return Object.values(map).sort((a, b) => b.count - a.count).map(f => ({ ...f, usd: Math.round(f.usd) }));
  }, [yearOrders]);

  const balanceTimeline = useMemo(() => {
    const events: { date: string; delta: number }[] = [
      ...deposits.map(d => ({ date: d.deposit_date, delta: Number(d.received_usd) || 0 })),
      ...orders.filter(o => o.charged_to_deposit && o.confirmed_on).map(o => ({ date: o.confirmed_on as string, delta: -o.fee_usd })),
    ].sort((a, b) => a.date.localeCompare(b.date));
    const monthly: Record<string, { mes: string; saldo: number; consumo: number; deposito: number }> = {};
    let running = 0;
    events.forEach(e => {
      running += e.delta;
      const k = e.date.slice(0, 7);
      monthly[k] ??= { mes: k, saldo: 0, consumo: 0, deposito: 0 };
      monthly[k].saldo = Math.round(running);
      if (e.delta < 0) monthly[k].consumo += -e.delta; else monthly[k].deposito += e.delta;
    });
    return Object.values(monthly).map(m => ({ ...m, consumo: Math.round(m.consumo) }));
  }, [orders, deposits]);

  /* ----- Actions ----- */
  const handleExport = () => {
    exportTranslationsToExcel({ yearFilter: selectedYear, stats, balance, orders: filteredOrders, deposits });
  };

  const openNewOrder = () => {
    const nums = orders.map(o => parseInt(o.assignment_number.replace(/\D/g, ''), 10)).filter(n => !isNaN(n));
    const next = nums.length ? Math.max(...nums) + 1 : 1;
    setOrderForm({ ...EMPTY_ORDER, assignment_number: `UNISIL-${next}` });
    setShowOrderModal(true);
  };

  const handleSaveOrder = async () => {
    if (!orderForm.assignment_number.trim()) { setToast('El número de asignación es obligatorio.'); return; }
    if (orders.some(o => o.id === orderForm.assignment_number.trim())) { setToast('Ya existe un encargo con ese número de asignación.'); return; }
    setSaving(true);
    const confirmed = orderForm.confirmed_on || null;
    const delivered = orderForm.delivered_on || null;
    const turnaround = confirmed && delivered ? Math.round((new Date(delivered).getTime() - new Date(confirmed).getTime()) / 86400000) : null;
    const fee = parseFloat(String(orderForm.fee_usd)) || 0;
    const record: TranslationOrder = {
      id: orderForm.assignment_number.trim(),
      assignment_number: orderForm.assignment_number.trim(),
      provider: 'ENAGO',
      membership_id: 'UNISIL',
      year: confirmed ? parseInt(confirmed.slice(0, 4), 10) : new Date().getFullYear(),
      fee_usd: fee,
      quoted_off_deposit_usd: null,
      charged_to_deposit: orderForm.charged_to_deposit && orderForm.status !== 'Cancelado' && fee > 0,
      confirmed_on: confirmed,
      delivered_on: delivered,
      turnaround_days: turnaround != null && turnaround >= 0 ? turnaround : null,
      service: orderForm.service,
      word_count: parseInt(String(orderForm.word_count), 10) || null,
      status: orderForm.status,
      inquiry_number: null,
      priority: 'Standard',
      requested_by: orderForm.requested_by.trim() || null,
      researcher_email: orderForm.researcher_email.trim().toLowerCase() || null,
      researcher_team: orderForm.researcher_team.trim() || null,
      manuscript_title: orderForm.manuscript_title.trim() || null,
      journal: orderForm.journal.trim() || null,
      quartile: orderForm.quartile || null,
      facultad: orderForm.facultad.trim() || null,
      notes: orderForm.notes.trim() || null,
    };
    try {
      const { error } = await supabase.from('translation_orders').insert(record);
      setToast(error ? 'Guardado localmente (la tabla translation_orders aún no existe en Supabase).' : 'Encargo registrado correctamente.');
    } catch {
      setToast('Guardado localmente.');
    }
    setOrders(prev => [record, ...prev]);
    setSaving(false);
    setShowOrderModal(false);
  };

  const handleSaveDeposit = async () => {
    const amount = parseFloat(depositForm.amount_usd) || 0;
    if (amount <= 0) { setToast('Indique un monto válido.'); return; }
    setSaving(true);
    const tax = parseFloat(depositForm.withholding_tax_usd) || 0;
    const record: TranslationDeposit = {
      id: `DEP-${depositForm.deposit_date}`,
      provider: 'ENAGO',
      deposit_date: depositForm.deposit_date,
      year: parseInt(depositForm.deposit_date.slice(0, 4), 10),
      amount_usd: amount,
      withholding_tax_usd: tax,
      received_usd: amount - tax,
      notes: depositForm.notes.trim() || null,
    };
    try {
      const { error } = await supabase.from('translation_deposits').upsert(record, { onConflict: 'id' });
      setToast(error ? 'Depósito guardado localmente (tabla no disponible en Supabase).' : 'Depósito registrado correctamente.');
    } catch {
      setToast('Depósito guardado localmente.');
    }
    setDeposits(prev => [...prev.filter(d => d.id !== record.id), record].sort((a, b) => a.deposit_date.localeCompare(b.deposit_date)));
    setSaving(false);
    setShowDepositModal(false);
  };

  const lowBalance = balance.available < LOW_BALANCE_USD;

  /* ---------- Render ---------- */
  return (
    <div className="tr-page">
      <style>{STYLES}</style>

      {/* ─── HEADER ─── */}
      <header className="tr-hero">
        <div className="tr-hero-bg"><Languages size={280} /></div>
        <div className="tr-hero-main">
          <div className="tr-pill"><Languages size={14} /> TRADUCCIÓN Y EDICIÓN CIENTÍFICA · PROVEEDOR ENAGO</div>
          <h1>Módulo de Traducciones</h1>
          <p>Control de encargos de traducción, corrección de estilo y edición sustantiva contratados con ENAGO, y seguimiento del depósito prepagado de la Universidad Simón Bolívar (membresía UNISIL).</p>
          <div className="tr-hero-chips">
            <span><Wallet size={13} /> Saldo {usd(balance.available, 2)}</span>
            <span><FileText size={13} /> {orders.length} encargos históricos</span>
            <span className={source === 'supabase' ? 'ok' : ''}>
              {loading ? <RefreshCw size={13} className="spin" /> : <Info size={13} />}
              {source === 'supabase' ? 'Datos en línea (Supabase)' : `Histórico: ${initialData.source_file}`}
            </span>
          </div>
        </div>
        <div className="tr-leader">
          <div className="tr-leader-avatar">FP</div>
          <div>
            <span className="tr-leader-tag">LÍDER DEL MÓDULO</span>
            <div className="tr-leader-name">Fernando Alberto Peñaranda</div>
            <div className="tr-leader-role">Coordinador de Proyectos</div>
            <div className="tr-leader-mail">fernando.penaranda@unisimon.edu.co</div>
          </div>
        </div>
      </header>

      {/* ─── TOOLBAR ─── */}
      <div className="tr-toolbar">
        <div className="tr-tabs" role="tablist">
          {([
            ['deposito', <PiggyBank key="i" size={16} />, 'Paquete prepagado & Saldo'],
            ['dashboard', <TrendingUp key="i" size={16} />, 'Dashboard & Métricas'],
            ['tabla', <BookOpen key="i" size={16} />, `Registro de Encargos (${filteredOrders.length})`],
          ] as const).map(([key, icon, label]) => (
            <button key={key} id={`tab-${key}`} role="tab" aria-selected={activeTab === key}
              className={activeTab === key ? 'active' : ''} onClick={() => setActiveTab(key)}>
              {icon} {label}
            </button>
          ))}
        </div>
        <div className="tr-actions">
          <select id="filter-year" className="tr-select" value={selectedYear} onChange={e => setSelectedYear(e.target.value)}>
            <option value="all">Todos los años</option>
            {availableYears.map(y => <option key={y} value={y}>{y}</option>)}
          </select>
          <button id="btn-export-excel" className="tr-btn" onClick={handleExport}><Download size={15} /> Excel</button>
          {canEdit && (
            <>
              <button id="btn-new-deposit" className="tr-btn" onClick={() => setShowDepositModal(true)}><PiggyBank size={15} /> Registrar depósito</button>
              <button id="btn-new-order" className="tr-btn primary" onClick={openNewOrder}><Plus size={15} /> Nuevo encargo</button>
            </>
          )}
        </div>
      </div>

      {lowBalance && (
        <div className="tr-alert">
          <AlertTriangle size={18} />
          <div>
            <strong>Saldo del depósito por debajo de {usd(LOW_BALANCE_USD)}.</strong> Con el consumo promedio de los últimos 12 meses ({usd(balance.monthlyBurn)} / mes) alcanza para ~{isFinite(balance.monthsLeft) ? balance.monthsLeft.toFixed(1) : '∞'} meses. Considere gestionar una nueva recarga con ENAGO.
          </div>
        </div>
      )}

      {/* ─── DASHBOARD ─── */}
      {activeTab === 'dashboard' && (
        <div className="tr-fade">
          <div className="tr-kpis">
            <KpiCard color="#2563EB" icon={<FileText size={20} />} label="Encargos atendidos" value={num(stats.totalOrders)}
              sub={<>{stats.inProgress > 0 ? `${stats.inProgress} en proceso · ` : ''}{stats.researchers} investigadores identificados</>} />
            <KpiCard color="#059669" icon={<DollarSign size={20} />} label="Inversión del periodo" value={usd(stats.totalUSD)}
              sub={`Ticket promedio ${usd(stats.avgTicket)}`} />
            <KpiCard color="#7C3AED" icon={<Type size={20} />} label="Palabras procesadas" value={num(stats.totalWords)}
              sub={`${num(stats.avgWords)} palabras / manuscrito`} />
            <KpiCard color="#0891B2" icon={<TrendingUp size={20} />} label="Costo por palabra" value={`${(stats.avgCostPerWord * 100).toFixed(1)} ¢`}
              sub="USD promedio ponderado" />
            <KpiCard color="#EA580C" icon={<Clock size={20} />} label="Tiempo de entrega" value={`${stats.avgTurnaround} días`}
              sub="Confirmación → entrega" />
            <KpiCard color={lowBalance ? '#DC2626' : '#0D9488'} icon={<Wallet size={20} />} label="Saldo disponible" value={usd(balance.available)}
              sub={<div className="tr-progress"><div style={{ width: `${Math.min(100, balance.pctUsed)}%` }} /><span>{balance.pctUsed}% utilizado</span></div>} />
          </div>

          <div className="tr-grid-2">
            <section className="tr-card">
              <h3>Evolución anual de encargos e inversión</h3>
              <p className="tr-muted">Encargos (barras) e inversión en USD (línea) por año de confirmación</p>
              <ResponsiveContainer width="100%" height={290}>
                <ComposedChart data={yearlyTrend} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                  <defs>
                    <linearGradient id="trBar" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#3B82F6" stopOpacity={0.95} />
                      <stop offset="100%" stopColor="#6366F1" stopOpacity={0.6} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#EEF2F7" vertical={false} />
                  <XAxis dataKey="year" tick={{ fontSize: 12 }} />
                  <YAxis yAxisId="l" tick={{ fontSize: 11 }} />
                  <YAxis yAxisId="r" orientation="right" tick={{ fontSize: 11 }} tickFormatter={v => `$${Math.round(v / 1000)}k`} />
                  <Tooltip formatter={(v: any, n: any) => (n === 'Inversión USD' ? usd(Number(v)) : num(Number(v)))} />
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                  <Bar yAxisId="l" dataKey="encargos" name="Encargos" fill="url(#trBar)" radius={[6, 6, 0, 0]} />
                  <Line yAxisId="r" type="monotone" dataKey="usd" name="Inversión USD" stroke="#10B981" strokeWidth={3} dot={{ r: 4 }} />
                </ComposedChart>
              </ResponsiveContainer>
            </section>

            <section className="tr-card">
              <h3>Distribución por tipo de servicio</h3>
              <p className="tr-muted">Número de encargos en el periodo seleccionado</p>
              <ResponsiveContainer width="100%" height={210}>
                <PieChart>
                  <Pie data={serviceData} dataKey="value" nameKey="name" innerRadius={55} outerRadius={88} paddingAngle={3}>
                    {serviceData.map(s => <Cell key={s.name} fill={s.color} />)}
                  </Pie>
                  <Tooltip formatter={(v: any) => `${v} encargos`} />
                </PieChart>
              </ResponsiveContainer>
              <div className="tr-legend">
                {serviceData.map(s => (
                  <div key={s.name}>
                    <span className="dot" style={{ background: s.color }} />
                    <span className="name">{s.name}</span>
                    <span className="val">{s.value}</span>
                    <span className="sub">{s.centsPerWord}¢/pal.</span>
                  </div>
                ))}
              </div>
            </section>
          </div>

          <div className="tr-grid-2">
            <section className="tr-card">
              <h3><Users size={17} /> Gestores Unisimón con más encargos</h3>
              <p className="tr-muted">Personal que tramitó los encargos ante ENAGO</p>
              <ResponsiveContainer width="100%" height={Math.max(220, topRequesters.length * 38)}>
                <BarChart data={topRequesters} layout="vertical" margin={{ left: 10, right: 30 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#EEF2F7" horizontal={false} />
                  <XAxis type="number" tick={{ fontSize: 11 }} />
                  <YAxis type="category" dataKey="name" width={170} tick={{ fontSize: 12 }} />
                  <Tooltip formatter={(v: any, n: any) => (n === 'Encargos' ? v : usd(Number(v)))} />
                  <Bar dataKey="count" name="Encargos" fill="#6366F1" radius={[0, 6, 6, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </section>

            <section className="tr-card">
              <h3><Award size={17} /> Investigadores con más encargos</h3>
              <p className="tr-muted">Equipo de investigadores solicitante (registro interno, desde 2024)</p>
              {topResearchers.length === 0 ? (
                <div className="tr-empty">No hay investigadores registrados en este periodo.</div>
              ) : (
                <ol className="tr-rank">
                  {topResearchers.map((r, i) => (
                    <li key={r.name} onClick={() => { setSearchTerm(r.name); setActiveTab('tabla'); }} title="Ver encargos">
                      <span className={`pos p${i + 1}`}>{i + 1}</span>
                      <span className="who" title={r.name}>
                        {r.name}
                        {r.faculty && <small>{shortFaculty(r.faculty)}</small>}
                      </span>
                      <span className="cnt">{r.count} encargo{r.count !== 1 ? 's' : ''}{r.q12 > 0 && <em> · {r.q12} Q1/Q2</em>}</span>
                      <span className="amt">{usd(r.usd)}</span>
                    </li>
                  ))}
                </ol>
              )}
            </section>
          </div>

          <div className="tr-grid-2">
            <section className="tr-card">
              <h3><Layers size={17} /> Cuartil de la revista destino</h3>
              <p className="tr-muted">
                {stats.withQuartile > 0
                  ? <>{stats.highImpactPct}% de los manuscritos con cuartil van a revistas Q1/Q2 ({stats.highImpact} de {stats.withQuartile})</>
                  : 'Sin información de cuartil en este periodo'}
              </p>
              {quartileData.length > 0 && (
                <ResponsiveContainer width="100%" height={240}>
                  <BarChart data={quartileData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#EEF2F7" vertical={false} />
                    <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                    <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
                    <Tooltip formatter={(v: any, n: any) => (n === 'Encargos' ? `${v} encargos` : usd(Number(v)))} />
                    <Bar dataKey="value" name="Encargos" radius={[8, 8, 0, 0]}>
                      {quartileData.map(q => <Cell key={q.name} fill={q.color} />)}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              )}
            </section>

            <section className="tr-card">
              <h3><Building2 size={17} /> Encargos por facultad</h3>
              <p className="tr-muted">Facultad registrada en el registro interno</p>
              {facultyData.length === 0 ? (
                <div className="tr-empty">Sin información de facultad en este periodo.</div>
              ) : (
                <ResponsiveContainer width="100%" height={Math.max(220, facultyData.length * 42)}>
                  <BarChart data={facultyData} layout="vertical" margin={{ left: 10, right: 30 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#EEF2F7" horizontal={false} />
                    <XAxis type="number" allowDecimals={false} tick={{ fontSize: 11 }} />
                    <YAxis type="category" dataKey="short" width={200} tick={{ fontSize: 11.5 }} />
                    <Tooltip formatter={(v: any, n: any) => (n === 'Encargos' ? v : usd(Number(v)))} labelFormatter={(_l: any, p: any) => p?.[0]?.payload?.name || ''} />
                    <Bar dataKey="count" name="Encargos" fill="#0EA5E9" radius={[0, 6, 6, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </section>
          </div>
        </div>
      )}

      {/* ─── TABLE ─── */}
      {activeTab === 'tabla' && (
        <section className="tr-card tr-fade">
          <div className="tr-filters">
            <div className="tr-search">
              <Search size={16} />
              <input id="search-orders" placeholder="Buscar por investigador, artículo, revista, asignación, inquiry…" value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
              {searchTerm && <button className="tr-clear" onClick={() => setSearchTerm('')} aria-label="Limpiar búsqueda"><X size={14} /></button>}
            </div>
            <select id="filter-service" className="tr-select" value={selectedService} onChange={e => setSelectedService(e.target.value)}>
              <option value="all">Todos los servicios</option>
              {SERVICES.map(s => <option key={s}>{s}</option>)}
            </select>
            <select id="filter-faculty" className="tr-select" value={selectedFaculty} onChange={e => setSelectedFaculty(e.target.value)}>
              <option value="all">Todas las facultades</option>
              {faculties.map(s => <option key={s} value={s}>{shortFaculty(s)}</option>)}
              <option value="none">Sin facultad</option>
            </select>
            <select id="filter-quartile" className="tr-select" value={selectedQuartile} onChange={e => setSelectedQuartile(e.target.value)}>
              <option value="all">Todos los cuartiles</option>
              {QUARTILES.map(s => <option key={s}>{s}</option>)}
              <option value="S/C">Sin cuartil</option>
            </select>
            <select id="filter-status" className="tr-select" value={selectedStatus} onChange={e => setSelectedStatus(e.target.value)}>
              <option value="all">Todos los estados</option>
              {STATUSES.map(s => <option key={s}>{s}</option>)}
            </select>
            <select id="filter-requester" className="tr-select" value={selectedRequester} onChange={e => setSelectedRequester(e.target.value)}>
              <option value="all">Todos los gestores</option>
              {requesters.map(s => <option key={s}>{s}</option>)}
            </select>
          </div>

          <div className="tr-table-wrap">
            <table className="tr-table">
              <thead>
                <tr>
                  <th>Asignación</th><th>Investigador(es) / Artículo</th><th>Revista</th><th>Servicio</th>
                  <th>Confirmado</th><th className="r">Palabras</th><th className="r">Valor USD</th><th>Estado</th>
                </tr>
              </thead>
              <tbody>
                {pageOrders.map(o => (
                  <tr key={o.id} onClick={() => setSelectedOrder(o)}>
                    <td className="mono">{o.assignment_number}{o.notes && <span className="tr-note-dot" title={o.notes} />}</td>
                    <td className="tr-cell-main">
                      <div className="t1" title={o.researcher_team || ''}>{o.researcher_team || <span className="tr-muted">{o.researcher_email || 'Sin registrar'}</span>}</div>
                      {o.manuscript_title && <div className="t2" title={o.manuscript_title}>{o.manuscript_title}</div>}
                      {o.facultad && <div className="t3">{shortFaculty(o.facultad)}</div>}
                    </td>
                    <td className="tr-cell-journal">
                      {o.journal || o.quartile ? (<><QuartileTag q={o.quartile} /> <span title={o.journal || ''}>{o.journal || '—'}</span></>) : <span className="tr-muted">—</span>}
                    </td>
                    <td>
                      <span className="tr-svc" style={{ ['--c' as string]: SERVICE_COLORS[o.service] || '#94A3B8' }}>{o.service}</span>
                      {o.requested_by && <div className="tr-muted small" style={{ margin: '2px 0 0' }}>{o.requested_by}</div>}
                    </td>
                    <td>{fmtDate(o.confirmed_on)}{o.turnaround_days != null && <span className="tr-days">{o.turnaround_days}d</span>}</td>
                    <td className="r">{o.word_count ? num(o.word_count) : '—'}</td>
                    <td className="r strong">{o.fee_usd ? usd(o.fee_usd, 2) : <span className="tr-muted">{o.quoted_off_deposit_usd ? `(${usd(o.quoted_off_deposit_usd, 2)})` : '—'}</span>}</td>
                    <td><Badge status={o.status} /></td>
                  </tr>
                ))}
                {pageOrders.length === 0 && (
                  <tr><td colSpan={8}><div className="tr-empty">No hay encargos que coincidan con los filtros.</div></td></tr>
                )}
              </tbody>
            </table>
          </div>

          <div className="tr-pager">
            <span>{filteredOrders.length} encargos · {usd(filteredOrders.reduce((a, o) => a + o.fee_usd, 0), 2)}</span>
            <div>
              <button id="page-prev" disabled={currentPage === 1} onClick={() => setCurrentPage(p => p - 1)}><ChevronLeft size={16} /></button>
              <span>Página {currentPage} de {totalPages}</span>
              <button id="page-next" disabled={currentPage === totalPages} onClick={() => setCurrentPage(p => p + 1)}><ChevronRight size={16} /></button>
            </div>
          </div>
        </section>
      )}

      {/* ─── DEPOSIT ─── */}
      {activeTab === 'deposito' && (
        <div className="tr-fade">
          {yearInfo && (
            <section className="tr-card tr-pkg year">
              <div className="tr-pkg-head">
                <div>
                  <span className="tr-pkg-tag"><CalendarClock size={12} /> BALANCE DEL DEPÓSITO · AÑO {yearInfo.y}</span>
                  <h3>Del 1 de enero al {yearInfo.isCurrent ? 'día de hoy' : `31 de diciembre de ${yearInfo.y}`}</h3>
                  <p className="tr-muted">
                    {yearInfo.pkg ? <>Paquete aplicable: compra del <b>{fmtDate(yearInfo.pkg.deposit_date)}</b> por {usd(yearInfo.pkg.received_usd, 2)}. </> : null}
                    Seleccione “Todos los años” para ver el paquete vigente.
                  </p>
                </div>
                <div className={`tr-pkg-balance ${yearInfo.closing < LOW_BALANCE_USD ? 'low' : ''}`}>
                  <span>{yearInfo.closeLabel}</span>
                  <strong>{usd(yearInfo.closing, 2)}</strong>
                  <small>{yearInfo.pct}% de lo disponible en el año se consumió</small>
                </div>
              </div>
              <div className="tr-pkg-bar" title={`${yearInfo.pct}% consumido`}><div style={{ width: `${yearInfo.pct}%` }} /></div>
              <div className="tr-pkg-flow">
                <div className={yearInfo.opening < 0 ? 'neg' : ''}><span>Saldo al 1 de enero de {yearInfo.y}</span><strong>{usd(yearInfo.opening, 2)}</strong></div>
                <div className="pos"><span>Recargas en {yearInfo.y} ({yearInfo.yDeps.length})</span><strong>+ {usd(yearInfo.recharged, 2)}</strong></div>
                <div className="neg"><span>Consumido en {yearInfo.y} ({yearInfo.count} servicios)</span><strong>− {usd(yearInfo.consumed, 2)}</strong></div>
                <div className="total"><span>{yearInfo.closeLabel}</span><strong>= {usd(yearInfo.closing, 2)}</strong></div>
              </div>
              <div className="tr-pkg-foot">
                <span><TrendingUp size={14} /> Consumo promedio en {yearInfo.y}: <b>{usd(yearInfo.monthlyAvg)}/mes</b></span>
                {yearInfo.peak && <span><AlertTriangle size={14} /> Mes de mayor consumo: <b>{yearInfo.peak.mes}</b> · {usd(yearInfo.peak.consumo)} ({yearInfo.peak.servicios} servicios)</span>}
                {yearInfo.yDeps.map(d => <span key={d.id}><PiggyBank size={14} /> Recarga del {fmtDate(d.deposit_date)}: <b>{usd(d.received_usd, 2)}</b></span>)}
              </div>
            </section>
          )}

          {!yearInfo && packageInfo && (
            <section className="tr-card tr-pkg">
              <div className="tr-pkg-head">
                <div>
                  <span className="tr-pkg-tag"><PiggyBank size={12} /> PAQUETE PREPAGADO VIGENTE</span>
                  <h3>Compra del {fmtDate(packageInfo.last.deposit_date)} · {usd(packageInfo.received, 2)}</h3>
                  <p className="tr-muted">Cada servicio confirmado con ENAGO se descuenta de este paquete. El saldo se recalcula automáticamente al registrar un encargo o una nueva recarga.</p>
                </div>
                <div className={`tr-pkg-balance ${packageInfo.remaining < LOW_BALANCE_USD ? 'low' : ''}`}>
                  <span>Saldo disponible</span>
                  <strong>{usd(packageInfo.remaining, 2)}</strong>
                  <small>{packageInfo.pct}% del paquete consumido</small>
                </div>
              </div>
              <div className="tr-pkg-bar" title={`${packageInfo.pct}% consumido`}><div style={{ width: `${packageInfo.pct}%` }} /></div>
              <div className="tr-pkg-flow">
                <div><span>Valor del paquete</span><strong>{usd(packageInfo.received, 2)}</strong></div>
                <div className={packageInfo.carry < 0 ? 'neg' : 'pos'}>
                  <span>{packageInfo.carry < 0 ? 'Saldo negativo del paquete anterior' : 'Saldo a favor del paquete anterior'}</span>
                  <strong>{packageInfo.carry < 0 ? '− ' : '+ '}{usd(Math.abs(packageInfo.carry), 2)}</strong>
                </div>
                <div className="neg"><span>Servicios descontados ({packageInfo.count})</span><strong>− {usd(packageInfo.consumed, 2)}</strong></div>
                <div className="total"><span>Saldo disponible</span><strong>= {usd(packageInfo.remaining, 2)}</strong></div>
              </div>
              <div className="tr-pkg-foot">
                <span><TrendingUp size={14} /> Consumo promedio desde la compra: <b>{usd(packageInfo.monthlyAvg)}/mes</b></span>
                {packageInfo.exhaustLabel && (
                  <span><CalendarClock size={14} /> Proyección de agotamiento: <b>{packageInfo.exhaustLabel}</b> (≈ {packageInfo.monthsLeft.toFixed(1)} meses)</span>
                )}
                {packageInfo.lastOrder && (
                  <span><Receipt size={14} /> Último descuento: <b>{packageInfo.lastOrder.assignment_number}</b> · {fmtDate(packageInfo.lastOrder.confirmed_on)} · {usd(packageInfo.lastOrder.fee_usd, 2)}</span>
                )}
              </div>
            </section>
          )}

          {!yearInfo && (
          <div className="tr-kpis three">
            <KpiCard color="#2563EB" icon={<PiggyBank size={20} />} label="Total depositado (histórico)" value={usd(balance.deposits, 2)} sub={`${deposits.length} paquetes comprados a ENAGO`} />
            <KpiCard color="#7C3AED" icon={<DollarSign size={20} />} label="Total utilizado (histórico)" value={usd(balance.utilized, 2)} sub={`${balance.pctUsed}% de lo depositado`} />
            <KpiCard color={lowBalance ? '#DC2626' : '#059669'} icon={<Wallet size={20} />} label="Saldo disponible" value={usd(balance.available, 2)}
              sub={isFinite(balance.monthsLeft) ? `≈ ${balance.monthsLeft.toFixed(1)} meses al ritmo actual (${usd(balance.monthlyBurn)}/mes)` : 'Sin consumo reciente'} />
          </div>
          )}

          {yearInfo ? (
            <section className="tr-card">
              <h3>Consumo y saldo mes a mes · {yearInfo.y}</h3>
              <p className="tr-muted">Barras: valor descontado del depósito en cada mes · Línea: saldo al cierre del mes (USD)</p>
              <ResponsiveContainer width="100%" height={320}>
                <ComposedChart data={yearInfo.monthly} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#EEF2F7" vertical={false} />
                  <XAxis dataKey="mes" tick={{ fontSize: 12 }} />
                  <YAxis tick={{ fontSize: 11 }} tickFormatter={v => `$${Math.round(v / 1000)}k`} />
                  <Tooltip formatter={(v: any, n: any) => [usd(Number(v)), n]} />
                  <Legend />
                  <Bar dataKey="consumo" name="Consumido" fill="#F87171" radius={[6, 6, 0, 0]} />
                  <Bar dataKey="recarga" name="Recarga" fill="#34D399" radius={[6, 6, 0, 0]} />
                  <Line type="monotone" dataKey="saldo" name="Saldo al cierre del mes" stroke="#0284C7" strokeWidth={2.5} dot={{ r: 3 }} />
                </ComposedChart>
              </ResponsiveContainer>
            </section>
          ) : (
          <section className="tr-card">
            <h3>Evolución del saldo del depósito</h3>
            <p className="tr-muted">Saldo al cierre de cada mes (USD), considerando recargas y encargos descontados</p>
            <ResponsiveContainer width="100%" height={320}>
              <AreaChart data={balanceTimeline} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="trArea" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#0EA5E9" stopOpacity={0.45} />
                    <stop offset="100%" stopColor="#0EA5E9" stopOpacity={0.02} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#EEF2F7" vertical={false} />
                <XAxis dataKey="mes" tick={{ fontSize: 11 }} minTickGap={24} />
                <YAxis tick={{ fontSize: 11 }} tickFormatter={v => `$${Math.round(v / 1000)}k`} />
                <Tooltip formatter={(v: any, n: any) => [usd(Number(v)), n]} />
                <Area type="monotone" dataKey="saldo" name="Saldo" stroke="#0284C7" strokeWidth={2.5} fill="url(#trArea)" />
              </AreaChart>
            </ResponsiveContainer>
          </section>
          )}

          <section className="tr-card" style={{ marginTop: 16, marginBottom: 16 }}>
            <div className="tr-ledger-head">
              <div>
                <h3><Receipt size={17} /> Extracto de movimientos del depósito{yearInfo ? ` · ${yearInfo.y}` : ''}</h3>
                <p className="tr-muted">Cada servicio descontado y cada recarga, con el saldo resultante después del movimiento. Haga clic en un servicio para ver su detalle.</p>
              </div>
              {yearInfo ? (
                <button id="ledger-clear-year" className="tr-btn" onClick={() => setSelectedYear('all')}><X size={14} /> Ver todos los años</button>
              ) : (
              <div className="tr-seg" role="tablist">
                <button id="ledger-scope-pkg" className={ledgerScope === 'paquete' ? 'active' : ''} onClick={() => setLedgerScope('paquete')}>
                  Paquete vigente{packageInfo ? ` (desde ${fmtDate(packageInfo.last.deposit_date)})` : ''}
                </button>
                <button id="ledger-scope-all" className={ledgerScope === 'todo' ? 'active' : ''} onClick={() => setLedgerScope('todo')}>Todo el histórico</button>
              </div>
              )}
            </div>
            <div className="tr-table-wrap">
              <table className="tr-table compact">
                <thead>
                  <tr><th>Fecha</th><th>Movimiento</th><th>Referencia</th><th>Detalle</th><th className="r">Descuento</th><th className="r">Recarga</th><th className="r">Saldo</th></tr>
                </thead>
                <tbody>
                  {ledgerPageRows.map(r => (
                    <tr key={r.key} className={r.kind === 'dep' ? 'static tr-led-dep' : ''} onClick={() => r.order && setSelectedOrder(r.order)}>
                      <td>{fmtDate(r.date)}</td>
                      <td>
                        {r.kind === 'dep'
                          ? <span className="tr-mov in"><ArrowUpRight size={13} /> Recarga</span>
                          : <span className="tr-mov out"><ArrowDownRight size={13} /> Servicio</span>}
                      </td>
                      <td className="mono">{r.ref}</td>
                      <td className="tr-cell-main"><div className="t1" title={r.detail}>{r.detail}</div>{r.sub && <div className="t2">{r.sub}</div>}</td>
                      <td className="r">{r.amount < 0 ? <span className="tr-neg">− {usd(-r.amount, 2)}</span> : ''}</td>
                      <td className="r">{r.amount > 0 ? <span className="tr-pos">+ {usd(r.amount, 2)}</span> : ''}</td>
                      <td className={`r strong ${r.balance < 0 ? 'tr-neg' : ''}`}>{usd(r.balance, 2)}</td>
                    </tr>
                  ))}
                  {ledgerPageRows.length === 0 && (
                    <tr><td colSpan={7}><div className="tr-empty">Sin movimientos.</div></td></tr>
                  )}
                </tbody>
              </table>
            </div>
            <div className="tr-pager">
              <span>{ledgerRows.length} movimientos · {yearInfo ? <>{yearInfo.closeLabel.toLowerCase()} <b>{usd(yearInfo.closing, 2)}</b></> : <>saldo actual <b>{usd(balance.available, 2)}</b></>}</span>
              <div>
                <button id="ledger-prev" disabled={ledgerPage === 1} onClick={() => setLedgerPage(p => p - 1)}><ChevronLeft size={16} /></button>
                <span>Página {ledgerPage} de {ledgerPages}</span>
                <button id="ledger-next" disabled={ledgerPage === ledgerPages} onClick={() => setLedgerPage(p => p + 1)}><ChevronRight size={16} /></button>
              </div>
            </div>
          </section>

          <section className="tr-card" style={{ marginBottom: 16 }}>
            <h3><CalendarClock size={17} /> Cierre anual del depósito</h3>
            <p className="tr-muted">Saldo con el que inició y cerró cada año. Haga clic en un año para ver su detalle.</p>
            <div className="tr-table-wrap">
              <table className="tr-table compact">
                <thead><tr><th>Año</th><th className="r">Saldo al 1 de enero</th><th className="r">Recargas</th><th className="r">Consumido</th><th className="r">Servicios</th><th className="r">Saldo al cierre</th></tr></thead>
                <tbody>
                  {yearClosings.map(r => (
                    <tr key={r.y} className={selectedYear === r.y ? 'tr-row-sel' : ''} onClick={() => setSelectedYear(r.y)}>
                      <td className="mono">{r.y}{r.current && <span className="tr-days">en curso</span>}</td>
                      <td className={`r ${r.opening < 0 ? 'tr-neg' : ''}`}>{usd(r.opening, 2)}</td>
                      <td className="r">{r.recharged ? <span className="tr-pos">+ {usd(r.recharged, 2)}</span> : '—'}</td>
                      <td className="r"><span className="tr-neg">− {usd(r.consumed, 2)}</span></td>
                      <td className="r">{r.count}</td>
                      <td className={`r strong ${r.closing < 0 ? 'tr-neg' : ''}`}>{usd(r.closing, 2)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          <div className="tr-grid-2">
            <section className="tr-card">
              <h3>Recargas al depósito</h3>
              <table className="tr-table compact">
                <thead><tr><th>Fecha</th><th className="r">Monto</th><th className="r">Retención</th><th className="r">Recibido</th></tr></thead>
                <tbody>
                  {[...deposits].reverse().map(d => (
                    <tr key={d.id} className="static">
                      <td>{fmtDate(d.deposit_date)}{d.notes && <div className="tr-muted small">{d.notes}</div>}</td>
                      <td className="r">{usd(d.amount_usd, 2)}</td>
                      <td className="r">{usd(d.withholding_tax_usd, 2)}</td>
                      <td className="r strong">{usd(d.received_usd, 2)}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot><tr><td>Total</td><td /><td /><td className="r strong">{usd(balance.deposits, 2)}</td></tr></tfoot>
              </table>
            </section>

            <section className="tr-card">
              <h3>Consumo anual del depósito</h3>
              <ResponsiveContainer width="100%" height={260}>
                <BarChart data={yearlyTrend}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#EEF2F7" vertical={false} />
                  <XAxis dataKey="year" tick={{ fontSize: 12 }} />
                  <YAxis tick={{ fontSize: 11 }} tickFormatter={v => `$${Math.round(v / 1000)}k`} />
                  <Tooltip formatter={(v: any) => usd(Number(v))} />
                  <Bar dataKey="usd" name="Consumo USD" radius={[6, 6, 0, 0]}>
                    {yearlyTrend.map((r, i) => <Cell key={i} fill={(selectedYear === 'all' ? i === yearlyTrend.length - 1 : r.year === selectedYear) ? '#0EA5E9' : '#93C5FD'} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
              <p className="tr-muted small"><Info size={12} /> Encargos no descontados del depósito (pagados por separado o no confirmados) se excluyen del saldo.</p>
            </section>
          </div>
        </div>
      )}

      {/* ─── DETAIL MODAL ─── */}
      {selectedOrder && (
        <div className="tr-overlay" onClick={() => setSelectedOrder(null)}>
          <div className="tr-modal" onClick={e => e.stopPropagation()} role="dialog" aria-label="Detalle del encargo">
            <div className="tr-modal-head">
              <div>
                <div className="tr-muted small">Encargo ENAGO</div>
                <h2 className="mono">{selectedOrder.assignment_number}</h2>
              </div>
              <Badge status={selectedOrder.status} />
              <button id="btn-close-detail" className="tr-icon-btn" onClick={() => setSelectedOrder(null)}><X size={18} /></button>
            </div>
            <div className="tr-detail-grid">
              {([
                ['Servicio', selectedOrder.service],
                ['Valor', selectedOrder.fee_usd ? usd(selectedOrder.fee_usd, 2) : (selectedOrder.quoted_off_deposit_usd ? `${usd(selectedOrder.quoted_off_deposit_usd, 2)} (fuera del depósito)` : '—')],
                ['Palabras', selectedOrder.word_count ? num(selectedOrder.word_count) : '—'],
                ['Costo por palabra', selectedOrder.fee_usd && selectedOrder.word_count ? `${((selectedOrder.fee_usd / selectedOrder.word_count) * 100).toFixed(2)} ¢` : '—'],
                ['Confirmado', fmtDate(selectedOrder.confirmed_on)],
                ['Entregado', fmtDate(selectedOrder.delivered_on)],
                ['Tiempo de entrega', selectedOrder.turnaround_days != null ? `${selectedOrder.turnaround_days} días` : '—'],
                ['Descontado del depósito', selectedOrder.charged_to_deposit ? 'Sí' : 'No'],
                ['Gestionado por', selectedOrder.requested_by || '—'],
                ['Correo investigador / supervisor', selectedOrder.researcher_email || '—'],
                ['N° Inquiry', selectedOrder.inquiry_number || '—'],
                ['Prioridad', selectedOrder.priority || '—'],
                ['Equipo de investigadores', selectedOrder.researcher_team || '—'],
                ['Artículo', selectedOrder.manuscript_title || '—'],
                ['Revista', selectedOrder.journal || '—'],
                ['Cuartil', selectedOrder.quartile || 'Sin cuartil'],
                ['Facultad', selectedOrder.facultad || '—'],
              ] as [string, string][]).map(([k, v]) => (
                <div key={k}><span>{k}</span><strong>{v}</strong></div>
              ))}
            </div>
            {selectedOrder.notes && <div className="tr-notes"><Info size={15} /> {selectedOrder.notes}</div>}
          </div>
        </div>
      )}

      {/* ─── NEW ORDER MODAL ─── */}
      {showOrderModal && (
        <div className="tr-overlay" onClick={() => setShowOrderModal(false)}>
          <div className="tr-modal" onClick={e => e.stopPropagation()} role="dialog" aria-label="Nuevo encargo">
            <div className="tr-modal-head">
              <div><div className="tr-muted small">Registrar</div><h2>Nuevo encargo ENAGO</h2></div>
              <button id="btn-close-order" className="tr-icon-btn" onClick={() => setShowOrderModal(false)}><X size={18} /></button>
            </div>
            <div className="tr-form">
              <label>N° de asignación<input id="f-assignment" value={orderForm.assignment_number} onChange={e => setOrderForm({ ...orderForm, assignment_number: e.target.value })} /></label>
              <label>Servicio<select id="f-service" value={orderForm.service} onChange={e => setOrderForm({ ...orderForm, service: e.target.value })}>{SERVICES.map(s => <option key={s}>{s}</option>)}</select></label>
              <label>Fecha de confirmación<input id="f-confirmed" type="date" value={orderForm.confirmed_on} onChange={e => setOrderForm({ ...orderForm, confirmed_on: e.target.value })} /></label>
              <label>Fecha de entrega<input id="f-delivered" type="date" value={orderForm.delivered_on} onChange={e => setOrderForm({ ...orderForm, delivered_on: e.target.value })} /></label>
              <label>Número de palabras<input id="f-words" type="number" min="0" value={orderForm.word_count} onChange={e => setOrderForm({ ...orderForm, word_count: e.target.value })} /></label>
              <label>Valor (USD)<input id="f-fee" type="number" min="0" step="0.01" value={orderForm.fee_usd} onChange={e => setOrderForm({ ...orderForm, fee_usd: e.target.value })} /></label>
              <label>Estado<select id="f-status" value={orderForm.status} onChange={e => setOrderForm({ ...orderForm, status: e.target.value })}>{STATUSES.map(s => <option key={s}>{s}</option>)}</select></label>
              <label>Gestionado por<input id="f-requester" list="requesters-list" value={orderForm.requested_by} onChange={e => setOrderForm({ ...orderForm, requested_by: e.target.value })} /></label>
              <datalist id="requesters-list">{requesters.map(r => <option key={r} value={r} />)}</datalist>
              <label className="full">Correo del investigador<input id="f-email" type="email" value={orderForm.researcher_email} onChange={e => setOrderForm({ ...orderForm, researcher_email: e.target.value })} /></label>
              <label className="full">Equipo de investigadores solicitante<input id="f-team" value={orderForm.researcher_team} onChange={e => setOrderForm({ ...orderForm, researcher_team: e.target.value })} /></label>
              <label className="full">Nombre del artículo<input id="f-title" value={orderForm.manuscript_title} onChange={e => setOrderForm({ ...orderForm, manuscript_title: e.target.value })} /></label>
              <label>Revista<input id="f-journal" list="journals-list" value={orderForm.journal} onChange={e => setOrderForm({ ...orderForm, journal: e.target.value })} /></label>
              <datalist id="journals-list">{journals.map(j => <option key={j} value={j} />)}</datalist>
              <label>Cuartil de la revista<select id="f-quartile" value={orderForm.quartile} onChange={e => setOrderForm({ ...orderForm, quartile: e.target.value })}><option value="">Sin cuartil</option>{QUARTILES.map(q => <option key={q}>{q}</option>)}</select></label>
              <label className="full">Facultad<input id="f-faculty" list="faculties-list" value={orderForm.facultad} onChange={e => setOrderForm({ ...orderForm, facultad: e.target.value })} /></label>
              <datalist id="faculties-list">{faculties.map(f => <option key={f} value={f} />)}</datalist>
              <label className="full">Observaciones<textarea id="f-notes" rows={2} value={orderForm.notes} onChange={e => setOrderForm({ ...orderForm, notes: e.target.value })} /></label>
              <label className="full check"><input id="f-charged" type="checkbox" checked={orderForm.charged_to_deposit} onChange={e => setOrderForm({ ...orderForm, charged_to_deposit: e.target.checked })} /> Descontar del paquete prepagado</label>
              {orderForm.charged_to_deposit && (() => {
                const fee = parseFloat(String(orderForm.fee_usd)) || 0;
                const after = Math.round((balance.available - fee) * 100) / 100;
                return (
                  <div className={`tr-preview ${after < 0 ? 'bad' : after < LOW_BALANCE_USD ? 'warn' : ''}`}>
                    <div><span>Saldo actual</span><strong>{usd(balance.available, 2)}</strong></div>
                    <div><span>Este servicio</span><strong>− {usd(fee, 2)}</strong></div>
                    <div><span>Saldo después del descuento</span><strong>{usd(after, 2)}</strong></div>
                    {after < 0 && <p><AlertTriangle size={14} /> Saldo insuficiente: el paquete no cubre este servicio. Se requiere una nueva recarga con ENAGO.</p>}
                  </div>
                );
              })()}
            </div>
            <div className="tr-modal-foot">
              <button className="tr-btn" onClick={() => setShowOrderModal(false)}>Cancelar</button>
              <button id="btn-save-order" className="tr-btn primary" disabled={saving} onClick={handleSaveOrder}><CheckCircle2 size={15} /> {saving ? 'Guardando…' : 'Guardar encargo'}</button>
            </div>
          </div>
        </div>
      )}

      {/* ─── NEW DEPOSIT MODAL ─── */}
      {showDepositModal && (
        <div className="tr-overlay" onClick={() => setShowDepositModal(false)}>
          <div className="tr-modal narrow" onClick={e => e.stopPropagation()} role="dialog" aria-label="Registrar depósito">
            <div className="tr-modal-head">
              <div><div className="tr-muted small">Recarga</div><h2>Registrar depósito a ENAGO</h2></div>
              <button id="btn-close-deposit" className="tr-icon-btn" onClick={() => setShowDepositModal(false)}><X size={18} /></button>
            </div>
            <div className="tr-form">
              <label className="full">Fecha<input id="d-date" type="date" value={depositForm.deposit_date} onChange={e => setDepositForm({ ...depositForm, deposit_date: e.target.value })} /></label>
              <label>Monto (USD)<input id="d-amount" type="number" min="0" step="0.01" value={depositForm.amount_usd} onChange={e => setDepositForm({ ...depositForm, amount_usd: e.target.value })} /></label>
              <label>Retención (USD)<input id="d-tax" type="number" min="0" step="0.01" value={depositForm.withholding_tax_usd} onChange={e => setDepositForm({ ...depositForm, withholding_tax_usd: e.target.value })} /></label>
              <label className="full">Notas<textarea id="d-notes" rows={2} value={depositForm.notes} onChange={e => setDepositForm({ ...depositForm, notes: e.target.value })} /></label>
            </div>
            <div className="tr-modal-foot">
              <button className="tr-btn" onClick={() => setShowDepositModal(false)}>Cancelar</button>
              <button id="btn-save-deposit" className="tr-btn primary" disabled={saving} onClick={handleSaveDeposit}><CheckCircle2 size={15} /> {saving ? 'Guardando…' : 'Guardar depósito'}</button>
            </div>
          </div>
        </div>
      )}

      {toast && <div className="tr-toast"><CheckCircle2 size={16} /> {toast}</div>}
    </div>
  );
}

/* ---------- Scoped styles ---------- */
const STYLES = `
.tr-page{padding:28px;max-width:1440px;margin:0 auto;color:var(--text-primary,#0F172A)}
.tr-hero{position:relative;overflow:hidden;display:flex;flex-wrap:wrap;gap:24px;align-items:center;justify-content:space-between;
  padding:30px 32px;border-radius:22px;color:#fff;margin-bottom:22px;
  background:radial-gradient(1200px 400px at 85% -20%,rgba(56,189,248,.45),transparent 60%),linear-gradient(135deg,#1E1B4B 0%,#3730A3 45%,#0E7490 100%);
  box-shadow:0 16px 40px -12px rgba(55,48,163,.45)}
.tr-hero-bg{position:absolute;right:-50px;top:-60px;opacity:.09;pointer-events:none;animation:trFloat 12s ease-in-out infinite}
.tr-hero-main{z-index:1;max-width:680px}
.tr-hero h1{font-size:31px;font-weight:800;margin:0 0 8px;line-height:1.15;letter-spacing:-.4px}
.tr-hero p{font-size:14px;line-height:1.55;color:rgba(255,255,255,.86);margin:0}
.tr-pill{display:inline-flex;align-items:center;gap:8px;padding:6px 14px;border-radius:30px;font-size:11.5px;font-weight:700;letter-spacing:.6px;margin-bottom:12px;
  background:rgba(255,255,255,.16);border:1px solid rgba(255,255,255,.25);backdrop-filter:blur(8px)}
.tr-hero-chips{display:flex;flex-wrap:wrap;gap:8px;margin-top:16px}
.tr-hero-chips span{display:inline-flex;align-items:center;gap:6px;font-size:12px;padding:5px 11px;border-radius:999px;background:rgba(15,23,42,.28);border:1px solid rgba(255,255,255,.18)}
.tr-hero-chips span.ok{background:rgba(16,185,129,.28)}
.tr-leader{z-index:1;display:flex;gap:16px;align-items:center;min-width:320px;padding:16px 20px;border-radius:16px;
  background:rgba(255,255,255,.13);border:1px solid rgba(255,255,255,.26);backdrop-filter:blur(12px)}
.tr-leader-avatar{width:50px;height:50px;border-radius:14px;background:#fff;color:#3730A3;display:flex;align-items:center;justify-content:center;font-weight:800;font-size:18px;box-shadow:0 6px 14px rgba(0,0,0,.18)}
.tr-leader-tag{font-size:10px;letter-spacing:.8px;background:#0E7490;padding:2px 8px;border-radius:12px;font-weight:700}
.tr-leader-name{font-size:15px;font-weight:700;margin-top:4px}
.tr-leader-role{font-size:12px;color:rgba(255,255,255,.85)}
.tr-leader-mail{font-size:11px;color:rgba(255,255,255,.7);margin-top:2px}
.tr-toolbar{display:flex;flex-wrap:wrap;justify-content:space-between;align-items:center;gap:14px;margin-bottom:18px}
.tr-tabs{display:flex;gap:4px;padding:4px;border-radius:12px;background:var(--gray-100,#F1F5F9)}
.tr-tabs button{display:flex;align-items:center;gap:8px;padding:8px 16px;border:none;border-radius:9px;background:transparent;color:var(--gray-600,#475569);font-size:13px;font-weight:600;cursor:pointer;transition:all .15s}
.tr-tabs button:hover{color:#3730A3}
.tr-tabs button.active{background:#fff;color:#3730A3;box-shadow:0 2px 8px rgba(0,0,0,.08)}
.tr-actions{display:flex;flex-wrap:wrap;gap:10px;align-items:center}
.tr-select{padding:9px 12px;border-radius:10px;border:1px solid var(--gray-200,#E2E8F0);background:#fff;font-size:13px;color:var(--gray-700,#334155);cursor:pointer}
.tr-btn{display:inline-flex;align-items:center;gap:6px;padding:9px 15px;border-radius:10px;border:1px solid var(--gray-200,#E2E8F0);background:#fff;color:var(--gray-700,#334155);font-size:13px;font-weight:600;cursor:pointer;transition:all .15s}
.tr-btn:hover{background:var(--gray-50,#F8FAFC);transform:translateY(-1px)}
.tr-btn.primary{background:linear-gradient(135deg,#4F46E5,#0891B2);color:#fff;border-color:transparent;box-shadow:0 6px 16px -6px rgba(79,70,229,.55)}
.tr-btn.primary:hover{filter:brightness(1.07)}
.tr-btn:disabled{opacity:.6;cursor:wait;transform:none}
.tr-alert{display:flex;gap:12px;align-items:flex-start;padding:14px 18px;border-radius:14px;margin-bottom:18px;background:#FFF7ED;border:1px solid #FED7AA;color:#9A3412;font-size:13.5px;line-height:1.5}
.tr-card{background:#fff;border:1px solid var(--gray-200,#E5E7EB);border-radius:18px;padding:20px 22px;box-shadow:0 1px 3px rgba(15,23,42,.04);transition:box-shadow .2s,transform .2s}
.tr-card h3{display:flex;align-items:center;gap:8px;font-size:15.5px;font-weight:700;margin:0 0 2px}
.tr-muted{color:var(--gray-500,#64748B);font-size:12.5px;margin:0 0 12px}
.tr-muted.small,.small{font-size:11.5px}
.tr-kpis{display:grid;grid-template-columns:repeat(auto-fill,minmax(215px,1fr));gap:14px;margin-bottom:18px}
.tr-kpis.three{grid-template-columns:repeat(auto-fill,minmax(300px,1fr))}
.tr-kpi{display:flex;gap:14px;align-items:flex-start;position:relative;overflow:hidden}
.tr-kpi::after{content:'';position:absolute;left:0;top:0;bottom:0;width:4px;background:var(--accent)}
.tr-kpi:hover{box-shadow:0 10px 24px -10px rgba(15,23,42,.18);transform:translateY(-2px)}
.tr-kpi-icon{width:42px;height:42px;flex-shrink:0;border-radius:12px;display:flex;align-items:center;justify-content:center;color:var(--accent);background:color-mix(in srgb,var(--accent) 12%,white)}
.tr-kpi-label{font-size:12px;color:var(--gray-500,#64748B);font-weight:600;text-transform:uppercase;letter-spacing:.4px}
.tr-kpi-value{font-size:24px;font-weight:800;letter-spacing:-.5px;margin:2px 0}
.tr-kpi-sub{font-size:12px;color:var(--gray-500,#64748B)}
.tr-progress{position:relative;height:16px;border-radius:8px;background:#F1F5F9;overflow:hidden;margin-top:4px;min-width:150px}
.tr-progress div{height:100%;background:linear-gradient(90deg,#14B8A6,#6366F1);border-radius:8px;transition:width .8s ease}
.tr-progress span{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;font-size:10.5px;font-weight:700;color:#0F172A}
.tr-grid-2{display:grid;grid-template-columns:repeat(auto-fit,minmax(420px,1fr));gap:16px;margin-bottom:16px}
.tr-legend{display:flex;flex-direction:column;gap:8px;margin-top:6px}
.tr-legend div{display:grid;grid-template-columns:12px 1fr auto 70px;gap:10px;align-items:center;font-size:13px}
.tr-legend .dot{width:10px;height:10px;border-radius:50%}
.tr-legend .val{font-weight:700}
.tr-legend .sub{color:var(--gray-500,#64748B);font-size:12px;text-align:right}
.tr-rank{list-style:none;margin:0;padding:0;display:flex;flex-direction:column;gap:6px}
.tr-rank li{display:grid;grid-template-columns:28px 1fr auto 82px;gap:10px;align-items:center;padding:9px 10px;border-radius:10px;font-size:13px;transition:background .15s}
.tr-rank li:hover{background:#F8FAFC}
.tr-rank .pos{width:26px;height:26px;border-radius:8px;display:flex;align-items:center;justify-content:center;font-weight:800;font-size:12px;background:#EEF2FF;color:#4338CA}
.tr-rank .p1{background:#FEF3C7;color:#B45309}.tr-rank .p2{background:#E2E8F0;color:#334155}.tr-rank .p3{background:#FFEDD5;color:#C2410C}
.tr-rank li{cursor:pointer}
.tr-rank .who{overflow:hidden;text-overflow:ellipsis;white-space:nowrap;min-width:0}
.tr-rank .who small{display:block;font-size:11px;color:var(--gray-500,#64748B);overflow:hidden;text-overflow:ellipsis}
.tr-rank .cnt{color:var(--gray-500,#64748B);font-size:12px}
.tr-rank .cnt em{color:#059669;font-style:normal;font-weight:600;margin-left:4px}
.tr-q{display:inline-flex;align-items:center;justify-content:center;min-width:30px;padding:2px 7px;margin-right:6px;border-radius:6px;font-size:11px;font-weight:800;color:var(--c);background:color-mix(in srgb,var(--c) 13%,white);border:1px solid color-mix(in srgb,var(--c) 35%,white)}
.tr-cell-main .t1,.tr-cell-main .t2,.tr-cell-main .t3{max-width:340px;overflow:hidden;text-overflow:ellipsis}
.tr-cell-main .t1{font-weight:600}
.tr-cell-main .t2{font-size:12px;color:var(--gray-600,#475569);margin-top:2px}
.tr-cell-main .t3{font-size:11px;color:#6366F1;margin-top:2px}
.tr-cell-journal{max-width:250px;overflow:hidden;text-overflow:ellipsis}
.tr-clear{display:flex;border:none;background:transparent;color:var(--gray-400,#94A3B8);cursor:pointer;padding:4px}
.tr-clear:hover{color:#0F172A}
.tr-rank .amt{font-weight:700;text-align:right}
.tr-empty{padding:30px;text-align:center;color:var(--gray-500,#64748B);font-size:13px}
.tr-filters{display:flex;flex-wrap:wrap;gap:10px;margin-bottom:14px}
.tr-search{flex:1;min-width:260px;display:flex;align-items:center;gap:8px;padding:0 12px;border-radius:10px;border:1px solid var(--gray-200,#E2E8F0);color:var(--gray-400,#94A3B8)}
.tr-search:focus-within{border-color:#6366F1;box-shadow:0 0 0 3px rgba(99,102,241,.15)}
.tr-search input{flex:1;border:none;outline:none;padding:9px 0;font-size:13px;background:transparent;color:var(--text-primary,#0F172A)}
.tr-table-wrap{overflow-x:auto;border:1px solid var(--gray-100,#F1F5F9);border-radius:12px}
.tr-table{width:100%;border-collapse:collapse;font-size:13px}
.tr-table th{text-align:left;padding:11px 12px;background:#F8FAFC;color:var(--gray-500,#64748B);font-size:11.5px;text-transform:uppercase;letter-spacing:.4px;font-weight:700;white-space:nowrap}
.tr-table td{padding:11px 12px;border-top:1px solid #F1F5F9;white-space:nowrap}
.tr-table tbody tr{cursor:pointer;transition:background .12s}
.tr-table tbody tr:hover{background:#F5F7FF}
.tr-table tbody tr.static{cursor:default}
.tr-table tfoot td{font-weight:700;background:#F8FAFC}
.tr-table.compact td,.tr-table.compact th{padding:9px 10px}
.tr-table .r{text-align:right}
.tr-table .strong{font-weight:700}
.tr-table .ellipsis{max-width:230px;overflow:hidden;text-overflow:ellipsis}
.mono{font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-weight:600}
.tr-note-dot{display:inline-block;width:7px;height:7px;border-radius:50%;background:#F59E0B;margin-left:6px;vertical-align:middle}
.tr-days{margin-left:6px;font-size:11px;color:var(--gray-500,#64748B);background:#F1F5F9;padding:1px 6px;border-radius:6px}
.tr-svc{display:inline-flex;align-items:center;gap:6px;font-size:12px;font-weight:600;color:var(--c)}
.tr-svc::before{content:'';width:8px;height:8px;border-radius:50%;background:var(--c)}
.tr-badge{display:inline-block;padding:3px 10px;border-radius:999px;border:1px solid;font-size:11.5px;font-weight:700}
.tr-pager{display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:10px;margin-top:14px;font-size:13px;color:var(--gray-600,#475569)}
.tr-pager div{display:flex;align-items:center;gap:10px}
.tr-pager button{display:flex;padding:6px;border-radius:8px;border:1px solid var(--gray-200,#E2E8F0);background:#fff;cursor:pointer}
.tr-pager button:disabled{opacity:.4;cursor:not-allowed}
.tr-overlay{position:fixed;inset:0;z-index:1000;display:flex;align-items:center;justify-content:center;padding:20px;background:rgba(15,23,42,.5);backdrop-filter:blur(4px);animation:trFade .15s ease}
.tr-modal{width:100%;max-width:720px;max-height:90vh;overflow:auto;background:#fff;border-radius:20px;padding:24px;box-shadow:0 30px 60px -20px rgba(15,23,42,.5);animation:trPop .2s ease}
.tr-modal.narrow{max-width:460px}
.tr-modal-head{display:flex;align-items:center;gap:14px;margin-bottom:18px}
.tr-modal-head>div:first-child{flex:1}
.tr-modal-head h2{margin:2px 0 0;font-size:20px;font-weight:800}
.tr-icon-btn{display:flex;padding:7px;border-radius:10px;border:1px solid var(--gray-200,#E2E8F0);background:#fff;cursor:pointer}
.tr-icon-btn:hover{background:#F8FAFC}
.tr-detail-grid{display:grid;grid-template-columns:repeat(2,1fr);gap:10px}
.tr-detail-grid div{padding:10px 12px;border-radius:10px;background:#F8FAFC;display:flex;flex-direction:column;gap:3px;min-width:0}
.tr-detail-grid span{font-size:11px;text-transform:uppercase;letter-spacing:.4px;color:var(--gray-500,#64748B);font-weight:600}
.tr-detail-grid strong{font-size:13.5px;overflow-wrap:anywhere}
.tr-notes{display:flex;gap:8px;margin-top:14px;padding:12px 14px;border-radius:12px;background:#FFFBEB;border:1px solid #FDE68A;color:#92400E;font-size:13px;line-height:1.5}
.tr-form{display:grid;grid-template-columns:1fr 1fr;gap:12px}
.tr-form label{display:flex;flex-direction:column;gap:5px;font-size:12px;font-weight:600;color:var(--gray-600,#475569)}
.tr-form label.full{grid-column:1/-1}
.tr-form label.check{flex-direction:row;align-items:center;gap:8px;font-size:13px}
.tr-form input,.tr-form select,.tr-form textarea{padding:9px 11px;border-radius:10px;border:1px solid var(--gray-200,#E2E8F0);font-size:13px;font-family:inherit;color:var(--text-primary,#0F172A);background:#fff}
.tr-form input:focus,.tr-form select:focus,.tr-form textarea:focus{outline:none;border-color:#6366F1;box-shadow:0 0 0 3px rgba(99,102,241,.15)}
.tr-form input[type=checkbox]{width:16px;height:16px;accent-color:#4F46E5}
.tr-modal-foot{display:flex;justify-content:flex-end;gap:10px;margin-top:20px}
.tr-toast{position:fixed;bottom:24px;right:24px;z-index:1100;display:flex;align-items:center;gap:8px;padding:12px 18px;border-radius:12px;background:#0F172A;color:#fff;font-size:13px;box-shadow:0 12px 30px -10px rgba(0,0,0,.4);animation:trPop .2s ease}
.tr-fade{animation:trFade .25s ease}
.tr-pkg{margin-bottom:18px;border:1px solid #C7D2FE;background:linear-gradient(135deg,#FFFFFF 0%,#F5F7FF 60%,#ECFEFF 100%)}
.tr-pkg.year{border-color:#BAE6FD;background:linear-gradient(135deg,#FFFFFF 0%,#F0F9FF 60%,#F5F3FF 100%)}
.tr-pkg.year .tr-pkg-tag{background:#E0F2FE;color:#0369A1}
.tr-table tbody tr.tr-row-sel td{background:#EEF2FF;font-weight:600}
.tr-pkg-head{display:flex;flex-wrap:wrap;gap:18px;justify-content:space-between;align-items:flex-start}
.tr-pkg-head>div:first-child{flex:1;min-width:280px}
.tr-pkg-head h3{font-size:19px;margin:8px 0 4px}
.tr-pkg-tag{display:inline-flex;align-items:center;gap:6px;font-size:10.5px;font-weight:800;letter-spacing:.7px;color:#4338CA;background:#E0E7FF;padding:4px 10px;border-radius:999px}
.tr-pkg-balance{text-align:right;padding:12px 18px;border-radius:14px;background:#ECFDF5;border:1px solid #A7F3D0;color:#065F46}
.tr-pkg-balance span{display:block;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.5px}
.tr-pkg-balance strong{display:block;font-size:30px;font-weight:800;letter-spacing:-.6px;line-height:1.15}
.tr-pkg-balance small{font-size:12px;opacity:.85}
.tr-pkg-balance.low{background:#FEF2F2;border-color:#FECACA;color:#991B1B}
.tr-pkg-bar{height:12px;border-radius:999px;background:#E2E8F0;overflow:hidden;margin:16px 0}
.tr-pkg-bar div{height:100%;border-radius:999px;background:linear-gradient(90deg,#10B981,#F59E0B 70%,#EF4444);transition:width .8s ease}
.tr-pkg-flow{display:grid;grid-template-columns:repeat(auto-fit,minmax(190px,1fr));gap:10px}
.tr-pkg-flow div{padding:11px 14px;border-radius:12px;background:#fff;border:1px solid #E2E8F0;display:flex;flex-direction:column;gap:3px}
.tr-pkg-flow span{font-size:11.5px;color:var(--gray-500,#64748B);font-weight:600}
.tr-pkg-flow strong{font-size:17px;font-weight:800}
.tr-pkg-flow .neg strong{color:#B91C1C}.tr-pkg-flow .pos strong{color:#047857}
.tr-pkg-flow .total{background:#0F172A;border-color:#0F172A}.tr-pkg-flow .total span{color:#CBD5E1}.tr-pkg-flow .total strong{color:#fff}
.tr-pkg-foot{display:flex;flex-wrap:wrap;gap:8px 22px;margin-top:14px;font-size:12.5px;color:var(--gray-600,#475569)}
.tr-pkg-foot span{display:inline-flex;align-items:center;gap:6px}
.tr-ledger-head{display:flex;flex-wrap:wrap;gap:12px;justify-content:space-between;align-items:flex-start}
.tr-seg{display:flex;gap:4px;padding:4px;border-radius:10px;background:#F1F5F9}
.tr-seg button{border:none;background:transparent;padding:7px 12px;border-radius:8px;font-size:12.5px;font-weight:600;color:#475569;cursor:pointer}
.tr-seg button.active{background:#fff;color:#3730A3;box-shadow:0 1px 4px rgba(0,0,0,.08)}
.tr-mov{display:inline-flex;align-items:center;gap:4px;font-size:11.5px;font-weight:700;padding:2px 8px;border-radius:999px}
.tr-mov.in{background:#ECFDF5;color:#047857}.tr-mov.out{background:#FEF2F2;color:#B91C1C}
.tr-led-dep td{background:#F0FDF4}
.tr-neg{color:#B91C1C}.tr-pos{color:#047857;font-weight:700}
.tr-preview{grid-column:1/-1;display:grid;grid-template-columns:repeat(3,1fr);gap:8px;padding:12px;border-radius:12px;background:#ECFDF5;border:1px solid #A7F3D0}
.tr-preview div{display:flex;flex-direction:column;gap:2px}
.tr-preview span{font-size:11px;font-weight:600;color:#475569}
.tr-preview strong{font-size:15px;font-weight:800}
.tr-preview.warn{background:#FFFBEB;border-color:#FDE68A}
.tr-preview.bad{background:#FEF2F2;border-color:#FECACA}
.tr-preview p{grid-column:1/-1;display:flex;align-items:center;gap:6px;margin:4px 0 0;font-size:12.5px;color:#991B1B;font-weight:600}
.spin{animation:trSpin 1s linear infinite}
@keyframes trFade{from{opacity:0;transform:translateY(4px)}to{opacity:1;transform:none}}
@keyframes trPop{from{opacity:0;transform:scale(.97)}to{opacity:1;transform:none}}
@keyframes trSpin{to{transform:rotate(360deg)}}
@keyframes trFloat{0%,100%{transform:translateY(0) rotate(0)}50%{transform:translateY(10px) rotate(-4deg)}}
@media (max-width:720px){.tr-page{padding:16px}.tr-grid-2{grid-template-columns:1fr}.tr-form,.tr-detail-grid{grid-template-columns:1fr}.tr-leader{min-width:0;width:100%}}
`;
