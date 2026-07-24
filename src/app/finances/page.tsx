'use client';

import { useEffect, useState, useCallback, useMemo } from 'react';
import { createClient } from '@/lib/supabase/client';
import {
  DollarSign, TrendingUp, TrendingDown, Plus, Pencil, Trash2,
  Building2, ShoppingCart, Briefcase, PiggyBank, Target, Search
} from 'lucide-react';
import ServiceForm from '@/components/ServiceForm';
import ProductionCostForm from '@/components/ProductionCostForm';
import ProviderForm from '@/components/ProviderForm';
import BookSaleForm from '@/components/BookSaleForm';
import BudgetForm from '@/components/BudgetForm';
import ConfirmDialog from '@/components/ConfirmDialog';

type FinTab = 'servicios' | 'costos' | 'presupuesto' | 'proveedores' | 'ventas';

const SERVICE_LABELS: Record<string, string> = {
  diagramacion: 'Diagramación', edicion: 'Edición', formacion: 'Formación',
  asesoria: 'Asesoría', otro: 'Otro',
};
const STATUS_COLORS: Record<string, { bg: string; color: string }> = {
  cotizado: { bg: '#E3F2FD', color: '#1565C0' },
  en_proceso: { bg: '#FFF3E0', color: '#F57C00' },
  facturado: { bg: '#F3E5F5', color: '#7B1FA2' },
  pagado: { bg: '#E8F5E9', color: '#2E7D32' },
};
const COST_LABELS: Record<string, string> = {
  imprenta: '🏭 Imprenta', isbn: '📖 ISBN', diseno: '🎨 Diseño', correccion: '✏️ Corrección',
  doi: '🔗 DOI', apc: '💳 APC', hosting_ojs: '🖥️ OJS', otro: '📦 Otro',
};
const BUDGET_LABELS: Record<string, string> = {
  nomina: '👥 Nómina', produccion_libros: '📚 Libros', produccion_revistas: '📰 Revistas',
  eventos: '🎤 Eventos', servicios: '🔧 Servicios', operacion: '🏢 Operación', otro: '📦 Otro',
};
const CHANNEL_LABELS: Record<string, string> = {
  directo: '🏢 Directo', libreria: '📚 Librería', feria: '🎪 Feria', online: '🌐 Online',
};

export default function FinancesPage() {
  const [activeTab, setActiveTab] = useState<FinTab>('servicios');
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [services, setServices] = useState<any[]>([]);
  const [costs, setCosts] = useState<any[]>([]);
  const [budget, setBudget] = useState<any[]>([]);
  const [providers, setProviders] = useState<any[]>([]);
  const [sales, setSales] = useState<any[]>([]);
  const [revenueTarget, setRevenueTarget] = useState<number>(30000000);
  const [loading, setLoading] = useState(true);

  // Modal states
  const [showService, setShowService] = useState(false);
  const [showCost, setShowCost] = useState(false);
  const [showProvider, setShowProvider] = useState(false);
  const [showSale, setShowSale] = useState(false);
  const [showBudget, setShowBudget] = useState(false);
  const [editItem, setEditItem] = useState<any>(null);
  const [deleteItem, setDeleteItem] = useState<{ table: string; id: string; label: string } | null>(null);
  const [deleting, setDeleting] = useState(false);

  const loadData = useCallback(async () => {
    const supabase = createClient();
    const yearStart = `${selectedYear}-01-01`;
    const yearEnd = `${selectedYear}-12-31`;

    const [sRes, cRes, bRes, pRes, slRes, tRes] = await Promise.all([
      supabase.from('external_services').select('*').gte('date', yearStart).lte('date', yearEnd).order('date', { ascending: false }),
      supabase.from('production_costs').select('*').gte('date', yearStart).lte('date', yearEnd).order('date', { ascending: false }),
      supabase.from('budget_items').select('*').eq('year', selectedYear).order('category'),
      supabase.from('providers').select('*').order('name'),
      supabase.from('book_sales').select('*, books(title)').gte('date', yearStart).lte('date', yearEnd).order('date', { ascending: false }),
      supabase.from('revenue_targets').select('*').eq('year', selectedYear).single(),
    ]);

    setServices(sRes.data || []);
    setCosts(cRes.data || []);
    setBudget(bRes.data || []);
    setProviders(pRes.data || []);
    setSales(slRes.data || []);
    setRevenueTarget(tRes.data?.target_amount || 30000000);
    setLoading(false);
  }, [selectedYear]);

  useEffect(() => { loadData(); }, [loadData]);

  const handleDelete = async () => {
    if (!deleteItem) return;
    setDeleting(true);
    const supabase = createClient();
    await supabase.from(deleteItem.table).delete().eq('id', deleteItem.id);
    setDeleting(false);
    setDeleteItem(null);
    loadData();
  };

  const formatCOP = (a: number) => new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(a);

  // KPI calculations
  const totalIncome = useMemo(() => {
    const serviceIncome = services.filter(s => s.status === 'facturado' || s.status === 'pagado').reduce((s, r) => s + (r.amount || 0), 0);
    const salesIncome = sales.reduce((s, r) => s + (r.total_amount || 0), 0);
    return serviceIncome + salesIncome;
  }, [services, sales]);

  const totalExpenses = useMemo(() => costs.reduce((s, r) => s + (r.amount || 0), 0), [costs]);
  const balance = totalIncome - totalExpenses;
  const targetPct = revenueTarget > 0 ? Math.round((totalIncome / revenueTarget) * 100) : 0;

  // Monthly chart data
  const monthlyData = useMemo(() => {
    const months = Array.from({ length: 12 }, (_, i) => ({
      month: i,
      label: ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'][i],
      income: 0,
      expense: 0,
    }));
    services.filter(s => s.status === 'facturado' || s.status === 'pagado').forEach(s => {
      const m = new Date(s.date).getMonth();
      months[m].income += s.amount || 0;
    });
    sales.forEach(s => {
      const m = new Date(s.date).getMonth();
      months[m].income += s.total_amount || 0;
    });
    costs.forEach(c => {
      const m = new Date(c.date).getMonth();
      months[m].expense += c.amount || 0;
    });
    return months;
  }, [services, costs, sales]);

  const maxMonthly = Math.max(...monthlyData.map(m => Math.max(m.income, m.expense)), 1);

  const tabs: { key: FinTab; label: string; icon: any; count: number }[] = [
    { key: 'servicios', label: 'Servicios', icon: Briefcase, count: services.length },
    { key: 'costos', label: 'Costos', icon: TrendingDown, count: costs.length },
    { key: 'ventas', label: 'Ventas', icon: ShoppingCart, count: sales.length },
    { key: 'presupuesto', label: 'Presupuesto', icon: PiggyBank, count: budget.length },
    { key: 'proveedores', label: 'Proveedores', icon: Building2, count: providers.length },
  ];

  if (loading) return <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '60vh' }}><p style={{ color: 'var(--gray-500)' }}>Cargando finanzas...</p></div>;

  return (
    <>
      <div className="page-header">
        <div className="flex items-center justify-between">
          <div>
            <h2>Finanzas y Servicios</h2>
            <p>Ingresos, gastos, presupuesto y proveedores — {selectedYear}</p>
          </div>
          <div className="flex gap-2">
            <select value={selectedYear} onChange={e => setSelectedYear(parseInt(e.target.value))} style={{ padding: '8px 12px', borderRadius: 'var(--radius-md)', border: '1px solid var(--gray-200)', fontSize: '14px', fontWeight: 600 }}>
              {[2024, 2025, 2026, 2027].map(y => <option key={y} value={y}>{y}</option>)}
            </select>
            <button className="btn btn-primary" onClick={() => { setEditItem(null); if (activeTab === 'servicios') setShowService(true); else if (activeTab === 'costos') setShowCost(true); else if (activeTab === 'ventas') setShowSale(true); else if (activeTab === 'presupuesto') setShowBudget(true); else setShowProvider(true); }}>
              <Plus size={18} /> Nuevo
            </button>
          </div>
        </div>
      </div>

      <div className="page-content">
        {/* KPI Cards */}
        <div className="stats-grid mb-6">
          <div className="stat-card">
            <div className="stat-icon" style={{ background: '#E8F5E9' }}><TrendingUp size={24} color="#43A047" /></div>
            <div className="stat-info">
              <h4>Ingresos</h4>
              <div className="stat-value" style={{ fontSize: '20px', color: '#43A047' }}>{formatCOP(totalIncome)}</div>
              <div className="stat-subtitle">Servicios + Ventas</div>
            </div>
          </div>
          <div className="stat-card">
            <div className="stat-icon" style={{ background: '#FFEBEE' }}><TrendingDown size={24} color="#E53935" /></div>
            <div className="stat-info">
              <h4>Gastos</h4>
              <div className="stat-value" style={{ fontSize: '20px', color: '#E53935' }}>{formatCOP(totalExpenses)}</div>
              <div className="stat-subtitle">Costos producción</div>
            </div>
          </div>
          <div className="stat-card">
            <div className="stat-icon" style={{ background: balance >= 0 ? '#E3F2FD' : '#FFEBEE' }}>
              <DollarSign size={24} color={balance >= 0 ? '#1565C0' : '#E53935'} />
            </div>
            <div className="stat-info">
              <h4>Balance</h4>
              <div className="stat-value" style={{ fontSize: '20px', color: balance >= 0 ? '#43A047' : '#E53935' }}>{formatCOP(balance)}</div>
            </div>
          </div>
          <div className="stat-card">
            <div className="stat-icon" style={{ background: '#F3E5F5' }}><Target size={24} color="#7B1FA2" /></div>
            <div className="stat-info">
              <h4>Meta {selectedYear}</h4>
              <div className="stat-value" style={{ fontSize: '18px' }}>{formatCOP(revenueTarget)}</div>
              <div style={{ width: '100%', height: '6px', background: 'var(--gray-100)', borderRadius: '3px', marginTop: '6px', overflow: 'hidden' }}>
                <div style={{ width: `${Math.min(targetPct, 100)}%`, height: '100%', background: targetPct >= 100 ? '#43A047' : '#7B1FA2', borderRadius: '3px', transition: 'width 0.5s' }} />
              </div>
              <div className="stat-subtitle">{targetPct}% cumplido</div>
            </div>
          </div>
        </div>

        {/* Monthly chart */}
        <div className="card mb-6">
          <div className="card-header"><h3>📊 Ingresos vs Gastos por Mes</h3></div>
          <div className="card-body">
            <div style={{ display: 'flex', gap: '8px', alignItems: 'flex-end', height: '120px' }}>
              {monthlyData.map(m => (
                <div key={m.month} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '2px' }}>
                  <div style={{ display: 'flex', gap: '2px', alignItems: 'flex-end', width: '100%', justifyContent: 'center' }}>
                    <div style={{
                      width: '45%', height: `${Math.max((m.income / maxMonthly) * 90, 2)}px`,
                      background: 'linear-gradient(180deg, #43A047, #66BB6A)', borderRadius: '2px 2px 0 0',
                    }} title={`Ingreso: ${formatCOP(m.income)}`} />
                    <div style={{
                      width: '45%', height: `${Math.max((m.expense / maxMonthly) * 90, 2)}px`,
                      background: 'linear-gradient(180deg, #E53935, #EF5350)', borderRadius: '2px 2px 0 0',
                    }} title={`Gasto: ${formatCOP(m.expense)}`} />
                  </div>
                  <span style={{ fontSize: '10px', color: 'var(--gray-500)' }}>{m.label}</span>
                </div>
              ))}
            </div>
            <div style={{ display: 'flex', gap: '16px', justifyContent: 'center', marginTop: '12px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <div style={{ width: '12px', height: '12px', borderRadius: '2px', background: '#43A047' }} />
                <span style={{ fontSize: '11px', color: 'var(--gray-500)' }}>Ingresos</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <div style={{ width: '12px', height: '12px', borderRadius: '2px', background: '#E53935' }} />
                <span style={{ fontSize: '11px', color: 'var(--gray-500)' }}>Gastos</span>
              </div>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div style={{ display: 'flex', gap: '4px', marginBottom: '20px', borderBottom: '2px solid var(--gray-100)' }}>
          {tabs.map(t => {
            const Icon = t.icon;
            return (
              <button key={t.key} onClick={() => setActiveTab(t.key)} style={{
                padding: '10px 16px', fontSize: '13px', fontWeight: 600,
                background: 'none', border: 'none', cursor: 'pointer',
                color: activeTab === t.key ? 'var(--primary)' : 'var(--gray-400)',
                borderBottom: activeTab === t.key ? '3px solid var(--primary)' : '3px solid transparent',
                marginBottom: '-2px', transition: 'all 0.15s',
                display: 'flex', alignItems: 'center', gap: '6px',
              }}>
                <Icon size={16} /> {t.label}
                <span style={{ fontSize: '11px', background: activeTab === t.key ? 'var(--primary)' : 'var(--gray-200)', color: activeTab === t.key ? 'white' : 'var(--gray-500)', padding: '1px 6px', borderRadius: '8px' }}>{t.count}</span>
              </button>
            );
          })}
        </div>

        {/* === TAB: SERVICIOS === */}
        {activeTab === 'servicios' && (
          <div className="card">
            <div className="card-header">
              <h3>💼 Servicios Externos</h3>
              <button className="btn btn-primary btn-sm" onClick={() => { setEditItem(null); setShowService(true); }}><Plus size={14} /> Nuevo Servicio</button>
            </div>
            <div className="card-body" style={{ padding: 0 }}>
              {services.length === 0 ? (
                <div className="empty-state"><div className="empty-icon">💼</div><h3>Sin servicios</h3><p>Registra servicios de diagramación, edición o formación.</p><button className="btn btn-primary btn-sm" onClick={() => setShowService(true)}><Plus size={14} /> Registrar</button></div>
              ) : (
                <table className="data-table">
                  <thead><tr><th>Fecha</th><th>Tipo</th><th>Cliente</th><th>Monto</th><th>Factura</th><th>Estado</th><th></th></tr></thead>
                  <tbody>
                    {services.map(s => (
                      <tr key={s.id}>
                        <td style={{ fontSize: '12px', color: 'var(--gray-500)', whiteSpace: 'nowrap' }}>{s.date}</td>
                        <td><span style={{ fontSize: '12px' }}>{SERVICE_LABELS[s.service_type] || s.service_type}</span></td>
                        <td style={{ fontWeight: 600 }}>{s.client_name}</td>
                        <td style={{ fontWeight: 700, color: '#43A047' }}>{formatCOP(s.amount)}</td>
                        <td style={{ fontSize: '12px', color: 'var(--gray-400)' }}>{s.invoice_number || '—'}</td>
                        <td>
                          <span style={{ fontSize: '11px', fontWeight: 600, padding: '3px 8px', borderRadius: '12px', background: STATUS_COLORS[s.status]?.bg || '#F5F5F5', color: STATUS_COLORS[s.status]?.color || '#666' }}>
                            {s.status}
                          </span>
                        </td>
                        <td>
                          <div className="flex gap-1">
                            <button className="btn btn-ghost btn-icon" onClick={() => { setEditItem(s); setShowService(true); }}><Pencil size={14} /></button>
                            <button className="btn btn-ghost btn-icon" onClick={() => setDeleteItem({ table: 'external_services', id: s.id, label: s.client_name })}><Trash2 size={14} color="var(--error)" /></button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        )}

        {/* === TAB: COSTOS === */}
        {activeTab === 'costos' && (
          <div className="card">
            <div className="card-header">
              <h3>📉 Costos de Producción</h3>
              <button className="btn btn-primary btn-sm" onClick={() => { setEditItem(null); setShowCost(true); }}><Plus size={14} /> Nuevo Costo</button>
            </div>
            <div className="card-body" style={{ padding: 0 }}>
              {costs.length === 0 ? (
                <div className="empty-state"><div className="empty-icon">📉</div><h3>Sin costos</h3><p>Registra costos de imprenta, ISBN, diseño, DOI, etc.</p><button className="btn btn-primary btn-sm" onClick={() => setShowCost(true)}><Plus size={14} /> Registrar</button></div>
              ) : (
                <table className="data-table">
                  <thead><tr><th>Fecha</th><th>Tipo</th><th>Concepto</th><th>Entidad</th><th>Monto</th><th>Factura</th><th></th></tr></thead>
                  <tbody>
                    {costs.map(c => (
                      <tr key={c.id}>
                        <td style={{ fontSize: '12px', color: 'var(--gray-500)', whiteSpace: 'nowrap' }}>{c.date}</td>
                        <td><span style={{ fontSize: '12px' }}>{COST_LABELS[c.cost_type] || c.cost_type}</span></td>
                        <td style={{ fontSize: '13px' }}>{c.description || '—'}</td>
                        <td><span className={`badge ${c.entity_type === 'book' ? 'badge-info' : 'badge-neutral'}`}>{c.entity_type === 'book' ? '📚' : '📰'}</span></td>
                        <td style={{ fontWeight: 700, color: '#E53935' }}>{formatCOP(c.amount)}</td>
                        <td style={{ fontSize: '12px', color: 'var(--gray-400)' }}>{c.invoice_number || '—'}</td>
                        <td>
                          <div className="flex gap-1">
                            <button className="btn btn-ghost btn-icon" onClick={() => { setEditItem(c); setShowCost(true); }}><Pencil size={14} /></button>
                            <button className="btn btn-ghost btn-icon" onClick={() => setDeleteItem({ table: 'production_costs', id: c.id, label: c.description || c.cost_type })}><Trash2 size={14} color="var(--error)" /></button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        )}

        {/* === TAB: VENTAS === */}
        {activeTab === 'ventas' && (
          <div className="card">
            <div className="card-header">
              <h3>🛒 Ventas de Libros</h3>
              <button className="btn btn-primary btn-sm" onClick={() => { setEditItem(null); setShowSale(true); }}><Plus size={14} /> Nueva Venta</button>
            </div>
            <div className="card-body" style={{ padding: 0 }}>
              {sales.length === 0 ? (
                <div className="empty-state"><div className="empty-icon">🛒</div><h3>Sin ventas</h3><p>Registra ventas de libros.</p><button className="btn btn-primary btn-sm" onClick={() => setShowSale(true)}><Plus size={14} /> Registrar</button></div>
              ) : (
                <table className="data-table">
                  <thead><tr><th>Fecha</th><th>Libro</th><th>Cant.</th><th>P. Unit.</th><th>Total</th><th>Canal</th><th>Comprador</th><th></th></tr></thead>
                  <tbody>
                    {sales.map(s => (
                      <tr key={s.id}>
                        <td style={{ fontSize: '12px', color: 'var(--gray-500)', whiteSpace: 'nowrap' }}>{s.date}</td>
                        <td style={{ fontWeight: 600, maxWidth: '200px' }}>{(s.books as any)?.title || '—'}</td>
                        <td>{s.quantity}</td>
                        <td style={{ fontSize: '12px' }}>{formatCOP(s.unit_price)}</td>
                        <td style={{ fontWeight: 700, color: '#43A047' }}>{formatCOP(s.total_amount)}</td>
                        <td><span style={{ fontSize: '11px' }}>{CHANNEL_LABELS[s.channel] || s.channel}</span></td>
                        <td style={{ fontSize: '12px', color: 'var(--gray-500)' }}>{s.buyer || '—'}</td>
                        <td>
                          <div className="flex gap-1">
                            <button className="btn btn-ghost btn-icon" onClick={() => { setEditItem(s); setShowSale(true); }}><Pencil size={14} /></button>
                            <button className="btn btn-ghost btn-icon" onClick={() => setDeleteItem({ table: 'book_sales', id: s.id, label: (s.books as any)?.title || 'venta' })}><Trash2 size={14} color="var(--error)" /></button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        )}

        {/* === TAB: PRESUPUESTO === */}
        {activeTab === 'presupuesto' && (
          <div className="card">
            <div className="card-header">
              <h3>💰 Presupuesto {selectedYear}</h3>
              <button className="btn btn-primary btn-sm" onClick={() => { setEditItem(null); setShowBudget(true); }}><Plus size={14} /> Nueva Partida</button>
            </div>
            <div className="card-body">
              {budget.length === 0 ? (
                <div className="empty-state"><div className="empty-icon">💰</div><h3>Sin presupuesto</h3><p>Define las partidas presupuestales para {selectedYear}.</p><button className="btn btn-primary btn-sm" onClick={() => setShowBudget(true)}><Plus size={14} /> Crear Partida</button></div>
              ) : (
                <>
                  {/* Summary bar */}
                  {(() => {
                    const totalPlanned = budget.reduce((s: number, b: any) => s + (b.planned_amount || 0), 0);
                    const totalExecuted = budget.reduce((s: number, b: any) => s + (b.executed_amount || 0), 0);
                    const execPct = totalPlanned > 0 ? Math.round((totalExecuted / totalPlanned) * 100) : 0;
                    return (
                      <div style={{ marginBottom: '20px', padding: '16px', background: 'var(--gray-50)', borderRadius: 'var(--radius-lg)' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                          <div><span style={{ fontSize: '12px', color: 'var(--gray-500)' }}>Presupuestado: </span><span style={{ fontWeight: 800, color: 'var(--gray-800)' }}>{formatCOP(totalPlanned)}</span></div>
                          <div><span style={{ fontSize: '12px', color: 'var(--gray-500)' }}>Ejecutado: </span><span style={{ fontWeight: 800, color: execPct > 100 ? '#E53935' : '#1565C0' }}>{formatCOP(totalExecuted)}</span></div>
                          <span style={{ fontWeight: 800, color: execPct > 100 ? '#E53935' : execPct > 80 ? '#F57C00' : '#1565C0' }}>{execPct}%</span>
                        </div>
                        <div style={{ width: '100%', height: '8px', background: 'var(--gray-200)', borderRadius: '4px', overflow: 'hidden' }}>
                          <div style={{ width: `${Math.min(execPct, 100)}%`, height: '100%', background: execPct > 100 ? '#E53935' : execPct > 80 ? '#F57C00' : '#1565C0', borderRadius: '4px', transition: 'width 0.5s' }} />
                        </div>
                      </div>
                    );
                  })()}

                  {budget.map((b: any) => {
                    const pct = b.planned_amount > 0 ? Math.round((b.executed_amount / b.planned_amount) * 100) : 0;
                    return (
                      <div key={b.id} style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '12px', marginBottom: '8px', background: 'white', border: '1px solid var(--gray-100)', borderRadius: 'var(--radius-md)' }}>
                        <span style={{ fontSize: '14px', minWidth: '120px' }}>{BUDGET_LABELS[b.category] || b.category}</span>
                        <div style={{ flex: 1 }}>
                          <div style={{ width: '100%', height: '8px', background: 'var(--gray-100)', borderRadius: '4px', overflow: 'hidden' }}>
                            <div style={{ width: `${Math.min(pct, 100)}%`, height: '100%', borderRadius: '4px', background: pct > 100 ? '#E53935' : pct > 80 ? '#F57C00' : 'var(--primary)', transition: 'width 0.3s' }} />
                          </div>
                        </div>
                        <span style={{ fontSize: '12px', fontWeight: 700, minWidth: '100px', textAlign: 'right', color: 'var(--gray-600)' }}>{formatCOP(b.executed_amount)}</span>
                        <span style={{ fontSize: '11px', color: 'var(--gray-400)', minWidth: '90px' }}>/ {formatCOP(b.planned_amount)}</span>
                        <span style={{ fontSize: '12px', fontWeight: 700, minWidth: '40px', textAlign: 'right', color: pct > 100 ? '#E53935' : pct > 80 ? '#F57C00' : '#1565C0' }}>{pct}%</span>
                        <div className="flex gap-1">
                          <button className="btn btn-ghost btn-icon" onClick={() => { setEditItem(b); setShowBudget(true); }}><Pencil size={14} /></button>
                          <button className="btn btn-ghost btn-icon" onClick={() => setDeleteItem({ table: 'budget_items', id: b.id, label: BUDGET_LABELS[b.category] || b.category })}><Trash2 size={14} color="var(--error)" /></button>
                        </div>
                      </div>
                    );
                  })}
                </>
              )}
            </div>
          </div>
        )}

        {/* === TAB: PROVEEDORES === */}
        {activeTab === 'proveedores' && (
          <div className="card">
            <div className="card-header">
              <h3>🏢 Proveedores</h3>
              <button className="btn btn-primary btn-sm" onClick={() => { setEditItem(null); setShowProvider(true); }}><Plus size={14} /> Nuevo Proveedor</button>
            </div>
            <div className="card-body" style={{ padding: 0 }}>
              {providers.length === 0 ? (
                <div className="empty-state"><div className="empty-icon">🏢</div><h3>Sin proveedores</h3><p>Registra imprentas, diseñadores y otros proveedores.</p><button className="btn btn-primary btn-sm" onClick={() => setShowProvider(true)}><Plus size={14} /> Registrar</button></div>
              ) : (
                <table className="data-table">
                  <thead><tr><th>Nombre</th><th>NIT</th><th>Contacto</th><th>Servicios</th><th>Estado</th><th></th></tr></thead>
                  <tbody>
                    {providers.map(p => (
                      <tr key={p.id}>
                        <td style={{ fontWeight: 600 }}>{p.name}</td>
                        <td style={{ fontFamily: 'monospace', fontSize: '12px' }}>{p.nit || '—'}</td>
                        <td>
                          <div style={{ fontSize: '13px' }}>{p.contact_name || '—'}</div>
                          {p.email && <div style={{ fontSize: '11px', color: 'var(--gray-400)' }}>{p.email}</div>}
                        </td>
                        <td>
                          <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
                            {(p.service_types || []).map((t: string) => (
                              <span key={t} style={{ fontSize: '10px', padding: '2px 6px', borderRadius: '8px', background: 'var(--primary-50)', color: 'var(--primary)', fontWeight: 600 }}>{t}</span>
                            ))}
                          </div>
                        </td>
                        <td>
                          <span className={`badge ${p.status === 'activo' ? 'badge-success' : 'badge-neutral'}`}>{p.status}</span>
                        </td>
                        <td>
                          <div className="flex gap-1">
                            <button className="btn btn-ghost btn-icon" onClick={() => { setEditItem(p); setShowProvider(true); }}><Pencil size={14} /></button>
                            <button className="btn btn-ghost btn-icon" onClick={() => setDeleteItem({ table: 'providers', id: p.id, label: p.name })}><Trash2 size={14} color="var(--error)" /></button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Modals */}
      <ServiceForm isOpen={showService} onClose={() => { setShowService(false); setEditItem(null); }} onSaved={loadData} service={editItem} />
      <ProductionCostForm isOpen={showCost} onClose={() => { setShowCost(false); setEditItem(null); }} onSaved={loadData} cost={editItem} />
      <ProviderForm isOpen={showProvider} onClose={() => { setShowProvider(false); setEditItem(null); }} onSaved={loadData} provider={editItem} />
      <BookSaleForm isOpen={showSale} onClose={() => { setShowSale(false); setEditItem(null); }} onSaved={loadData} sale={editItem} />
      <BudgetForm isOpen={showBudget} onClose={() => { setShowBudget(false); setEditItem(null); }} onSaved={loadData} item={editItem} defaultYear={selectedYear} />
      <ConfirmDialog isOpen={!!deleteItem} onClose={() => setDeleteItem(null)} onConfirm={handleDelete} loading={deleting} title="Eliminar Registro" message={`¿Eliminar "${deleteItem?.label}"?`} />
    </>
  );
}
