'use client';

import { useEffect, useState } from 'react';
import {
  AlertTriangle, AlertCircle, Info, ChevronDown, ChevronUp,
  Users, BookOpen, Newspaper, DollarSign, ExternalLink,
  Clock, Mail, RefreshCw,
} from 'lucide-react';
import Link from 'next/link';

interface Alert {
  id: string;
  type: 'critical' | 'warning' | 'info';
  category: 'pares' | 'libros' | 'revistas' | 'finanzas';
  title: string;
  description: string;
  details?: any[];
  actionUrl?: string;
  actionLabel?: string;
}

interface Summary {
  pares_sin_responder: number;
  evaluaciones_sin_entregar: number;
  libros_en_proceso: number;
  articulos_pendientes: number;
  total_alertas: number;
  alertas_criticas: number;
  alertas_warning: number;
}

const TYPE_CONFIG = {
  critical: { icon: AlertTriangle, color: '#D32F2F', bg: '#FFEBEE', border: '#EF9A9A', label: 'Crítica' },
  warning: { icon: AlertCircle, color: '#E65100', bg: '#FFF3E0', border: '#FFCC80', label: 'Atención' },
  info: { icon: Info, color: '#1565C0', bg: '#E3F2FD', border: '#90CAF9', label: 'Info' },
};

const CATEGORY_ICONS = {
  pares: Users,
  libros: BookOpen,
  revistas: Newspaper,
  finanzas: DollarSign,
};

export default function AlertsPanel() {
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [filter, setFilter] = useState<string>('all');

  const loadAlerts = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/ai-alerts');
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      setAlerts(data.alerts || []);
      setSummary(data.summary || null);
    } catch (err: any) {
      setError(err.message);
    }
    setLoading(false);
  };

  useEffect(() => { loadAlerts(); }, []);

  const toggleExpand = (id: string) => {
    setExpanded(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const filtered = filter === 'all' ? alerts : alerts.filter(a => a.category === filter);
  const criticalCount = alerts.filter(a => a.type === 'critical').length;
  const warningCount = alerts.filter(a => a.type === 'warning').length;

  if (loading) {
    return (
      <div className="alerts-panel">
        <div className="alerts-panel-header">
          <h3>🔔 Alertas Proactivas</h3>
        </div>
        <div className="alerts-loading">
          <RefreshCw size={20} className="alerts-spin" />
          <span>Analizando datos...</span>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="alerts-panel">
        <div className="alerts-panel-header">
          <h3>🔔 Alertas Proactivas</h3>
        </div>
        <div className="alerts-error">
          <AlertTriangle size={16} /> Error: {error}
          <button onClick={loadAlerts} className="alerts-retry">Reintentar</button>
        </div>
      </div>
    );
  }

  return (
    <div className="alerts-panel">
      {/* Header */}
      <div className="alerts-panel-header">
        <div className="alerts-title-row">
          <h3>🔔 Alertas Proactivas</h3>
          <div className="alerts-badges">
            {criticalCount > 0 && (
              <span className="alerts-badge critical">{criticalCount} crítica{criticalCount !== 1 ? 's' : ''}</span>
            )}
            {warningCount > 0 && (
              <span className="alerts-badge warning">{warningCount} atención</span>
            )}
          </div>
        </div>

        {/* Summary counters */}
        {summary && (
          <div className="alerts-summary-row">
            <div className="alerts-summary-item" title="Pares sin responder invitación">
              <Users size={14} />
              <span>{summary.pares_sin_responder}</span>
              <small>sin responder</small>
            </div>
            <div className="alerts-summary-item" title="Evaluaciones aceptadas sin entregar">
              <Clock size={14} />
              <span>{summary.evaluaciones_sin_entregar}</span>
              <small>sin entregar</small>
            </div>
            <div className="alerts-summary-item" title="Artículos pendientes">
              <Newspaper size={14} />
              <span>{summary.articulos_pendientes}</span>
              <small>artículos</small>
            </div>
          </div>
        )}

        {/* Filter tabs */}
        <div className="alerts-filters">
          {[
            { key: 'all', label: 'Todas', count: alerts.length },
            { key: 'pares', label: 'Pares', count: alerts.filter(a => a.category === 'pares').length },
            { key: 'libros', label: 'Libros', count: alerts.filter(a => a.category === 'libros').length },
            { key: 'revistas', label: 'Revistas', count: alerts.filter(a => a.category === 'revistas').length },
            { key: 'finanzas', label: 'Finanzas', count: alerts.filter(a => a.category === 'finanzas').length },
          ].filter(f => f.count > 0).map(f => (
            <button
              key={f.key}
              className={`alerts-filter-btn ${filter === f.key ? 'active' : ''}`}
              onClick={() => setFilter(f.key)}
            >
              {f.label} <span className="alerts-filter-count">{f.count}</span>
            </button>
          ))}
          <button onClick={loadAlerts} className="alerts-refresh-btn" title="Actualizar">
            <RefreshCw size={14} />
          </button>
        </div>
      </div>

      {/* Alert cards */}
      <div className="alerts-list">
        {filtered.length === 0 && (
          <div className="alerts-empty">
            <span>✅</span>
            <p>No hay alertas en esta categoría</p>
          </div>
        )}

        {filtered.map(alert => {
          const config = TYPE_CONFIG[alert.type];
          const CategoryIcon = CATEGORY_ICONS[alert.category];
          const isExpanded = expanded.has(alert.id);
          const AlertIcon = config.icon;

          return (
            <div key={alert.id} className="alert-card" style={{ borderLeftColor: config.color }}>
              <div className="alert-card-main" onClick={() => alert.details && toggleExpand(alert.id)}>
                <div className="alert-card-icon" style={{ background: config.bg, color: config.color }}>
                  <AlertIcon size={16} />
                </div>
                <div className="alert-card-content">
                  <div className="alert-card-title">{alert.title}</div>
                  <p className="alert-card-desc">{alert.description}</p>
                </div>
                <div className="alert-card-actions">
                  {alert.actionUrl && (
                    <Link href={alert.actionUrl} className="alert-action-link">
                      {alert.actionLabel || 'Ver'} <ExternalLink size={12} />
                    </Link>
                  )}
                  {alert.details && alert.details.length > 0 && (
                    <button className="alert-expand-btn">
                      {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                    </button>
                  )}
                </div>
              </div>

              {/* Expanded details */}
              {isExpanded && alert.details && (
                <div className="alert-details">
                  <table className="alert-details-table">
                    <thead>
                      <tr>
                        {alert.category === 'pares' && (
                          <>
                            <th>Evaluador</th>
                            <th>Artículo</th>
                            <th>Revista</th>
                            <th>Días vencido</th>
                            {alert.details[0]?.email && <th>Email</th>}
                          </>
                        )}
                        {alert.category === 'libros' && (
                          <>
                            <th>Libro</th>
                            <th>Etapa</th>
                            <th>Última actualización</th>
                          </>
                        )}
                        {alert.category === 'revistas' && (
                          <>
                            <th>Artículo</th>
                            <th>Revista</th>
                            <th>Estado</th>
                            <th>Enviado</th>
                          </>
                        )}
                      </tr>
                    </thead>
                    <tbody>
                      {alert.details.map((d: any, i: number) => (
                        <tr key={i}>
                          {alert.category === 'pares' && (
                            <>
                              <td><strong>{d.reviewer}</strong></td>
                              <td className="alert-detail-truncate" title={d.article}>{d.article}</td>
                              <td>{d.journal}</td>
                              <td>
                                <span className={`alert-days-badge ${d.days_overdue > 90 ? 'critical' : d.days_overdue > 30 ? 'warning' : 'info'}`}>
                                  {d.days_overdue}d
                                </span>
                              </td>
                              {d.email && (
                                <td>
                                  <a href={`mailto:${d.email}`} className="alert-email-link" title={d.email}>
                                    <Mail size={12} /> Enviar
                                  </a>
                                </td>
                              )}
                            </>
                          )}
                          {alert.category === 'libros' && (
                            <>
                              <td><strong>{d.title || d.book}</strong></td>
                              <td>{d.stage}</td>
                              <td>{new Date(d.last_update || d.started).toLocaleDateString('es-CO')}</td>
                            </>
                          )}
                          {alert.category === 'revistas' && (
                            <>
                              <td className="alert-detail-truncate" title={d.title}><strong>{d.title}</strong></td>
                              <td>{d.journal}</td>
                              <td>{d.status}</td>
                              <td>{d.submitted ? new Date(d.submitted).toLocaleDateString('es-CO') : '—'}</td>
                            </>
                          )}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {alert.details.length >= 5 && (
                    <p className="alert-details-note">Mostrando los 5 casos más relevantes</p>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
