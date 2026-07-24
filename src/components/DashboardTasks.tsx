'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Clock, CheckCircle2, ChevronRight, AlertTriangle, ArrowUpRight } from 'lucide-react';
import Link from 'next/link';

interface Task {
  id: string;
  title: string;
  status: string;
  priority: string;
  due_date: string | null;
  assigned_to: string | null;
}

export default function DashboardTasks() {
  const { profile } = useAuth();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [viewFilter, setViewFilter] = useState<'mine' | 'team'>('mine');

  useEffect(() => {
    async function loadTasks() {
      setLoading(true);
      const supabase = createClient();
      
      let query = supabase.from('tasks')
        .select('id, title, status, priority, due_date, assigned_to')
        .neq('status', 'completada')
        .order('due_date', { ascending: true, nullsFirst: false });
        
      // Filter logic
      if (profile?.role !== 'admin' || viewFilter === 'mine') {
        query = query.eq('assigned_to', profile?.id);
      }
      
      const { data } = await query.limit(5);
      setTasks(data || []);
      setLoading(false);
    }
    
    if (profile) {
      loadTasks();
    }
  }, [profile, viewFilter]);

  if (loading) return <div className="card" style={{ height: '200px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>Cargando tareas...</div>;

  const isOverdue = (date: string | null) => {
    if (!date) return false;
    return new Date(date) < new Date();
  };

  const getPriorityColor = (p: string) => {
    if (p === 'alta') return '#E53935';
    if (p === 'media') return '#F9A825';
    return '#43A047';
  };

  return (
    <div className="card h-full">
      <div className="card-header" style={{ display: 'flex', flexDirection: 'column', gap: '12px', alignItems: 'stretch' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h3 style={{ margin: 0 }}>📋 Tareas Pendientes</h3>
          <Link href="/planner" className="btn btn-ghost btn-sm" style={{ alignSelf: 'flex-start' }}>
            Ver todas <ArrowUpRight size={14} />
          </Link>
        </div>
        
        {profile?.role === 'admin' && (
          <div style={{ display: 'flex', background: 'var(--gray-50)', padding: '4px', borderRadius: 'var(--radius-md)' }}>
            <button
              onClick={() => setViewFilter('mine')}
              style={{
                flex: 1, padding: '6px', fontSize: '12px', fontWeight: 600, border: 'none', borderRadius: 'var(--radius-sm)',
                cursor: 'pointer', background: viewFilter === 'mine' ? 'white' : 'transparent',
                color: viewFilter === 'mine' ? 'var(--gray-900)' : 'var(--gray-500)',
                boxShadow: viewFilter === 'mine' ? 'var(--shadow-sm)' : 'none',
                transition: 'all 0.2s'
              }}
            >Mis Tareas</button>
            <button
              onClick={() => setViewFilter('team')}
              style={{
                flex: 1, padding: '6px', fontSize: '12px', fontWeight: 600, border: 'none', borderRadius: 'var(--radius-sm)',
                cursor: 'pointer', background: viewFilter === 'team' ? 'white' : 'transparent',
                color: viewFilter === 'team' ? 'var(--gray-900)' : 'var(--gray-500)',
                boxShadow: viewFilter === 'team' ? 'var(--shadow-sm)' : 'none',
                transition: 'all 0.2s'
              }}
            >Del Equipo</button>
          </div>
        )}
      </div>
      <div className="card-body" style={{ padding: '0 0 16px 0' }}>
        {tasks.length === 0 ? (
          <div style={{ padding: '24px', textAlign: 'center', color: 'var(--gray-500)', fontSize: '14px' }}>
            No hay tareas pendientes en este momento.
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            {tasks.map(task => (
              <div key={task.id} style={{
                padding: '12px 20px', 
                borderBottom: '1px solid var(--gray-100)',
                display: 'flex', alignItems: 'center', gap: '12px'
              }}>
                <div style={{
                  width: '8px', height: '8px', borderRadius: '50%',
                  background: getPriorityColor(task.priority), flexShrink: 0
                }} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ margin: 0, fontSize: '13px', fontWeight: 600, color: 'var(--gray-900)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {task.title}
                  </p>
                  <p style={{ margin: '2px 0 0', fontSize: '11px', color: 'var(--gray-500)' }}>
                    Estado: <span style={{ textTransform: 'capitalize' }}>{task.status.replace('_', ' ')}</span>
                  </p>
                </div>
                {task.due_date && (
                  <div style={{
                    fontSize: '11px', padding: '4px 8px', borderRadius: '4px',
                    background: isOverdue(task.due_date) ? '#FFEBEE' : 'var(--gray-50)',
                    color: isOverdue(task.due_date) ? '#E53935' : 'var(--gray-600)',
                    fontWeight: isOverdue(task.due_date) ? 600 : 500,
                  }}>
                    {new Date(task.due_date).toLocaleDateString('es-CO', { day: 'numeric', month: 'short' })}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
