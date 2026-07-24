'use client';

import { useEffect, useState, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import {
  Plus, X, Calendar, User, Flag, MessageSquare, Send, Trash2,
  LayoutGrid, List, ChevronRight, Clock, CheckCircle2, AlertTriangle,
} from 'lucide-react';

// ─── Constants ───
const STATUS_COLS = [
  { key: 'pendiente', label: 'Pendiente', color: '#78909C', bg: '#ECEFF1', icon: Clock },
  { key: 'en_progreso', label: 'En Progreso', color: '#1565C0', bg: '#E3F2FD', icon: ChevronRight },
  { key: 'revision', label: 'Revisión', color: '#F57C00', bg: '#FFF3E0', icon: AlertTriangle },
  { key: 'completada', label: 'Completada', color: '#2E7D32', bg: '#E8F5E9', icon: CheckCircle2 },
];

const PRIORITY_OPTIONS = [
  { value: 'alta', label: '🔴 Alta', color: '#E53935' },
  { value: 'media', label: '🟡 Media', color: '#F9A825' },
  { value: 'baja', label: '🟢 Baja', color: '#43A047' },
];

const CATEGORY_OPTIONS = [
  { value: 'revista', label: '📰 Revista' },
  { value: 'libro', label: '📚 Libro' },
  { value: 'certificado', label: '📜 Certificado' },
  { value: 'administrativo', label: '🏢 Administrativo' },
  { value: 'otro', label: '📌 Otro' },
];

interface Task {
  id: string;
  title: string;
  description: string | null;
  status: string;
  priority: string;
  category: string;
  assigned_to: string | null;
  created_by: string | null;
  journal_id: string | null;
  due_date: string | null;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
}

interface UserProfile { id: string; full_name: string | null; email: string; avatar_url: string | null; role: string; }
interface Journal { id: string; name: string; }
interface Comment { id: string; task_id: string; user_id: string; content: string; created_at: string; }

export default function PlannerPage() {
  const { profile, hasAccess, isReadOnly: checkReadOnly } = useAuth();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [journals, setJournals] = useState<Journal[]>([]);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState<'kanban' | 'list'>('kanban');

  // Filters
  const [filterUser, setFilterUser] = useState('');
  const [filterPriority, setFilterPriority] = useState('');
  const [filterCategory, setFilterCategory] = useState('');

  // Modal
  const [showModal, setShowModal] = useState(false);
  const [editTask, setEditTask] = useState<Task | null>(null);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [status, setStatus] = useState('pendiente');
  const [priority, setPriority] = useState('media');
  const [category, setCategory] = useState('otro');
  const [assignedTo, setAssignedTo] = useState('');
  const [journalId, setJournalId] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [saving, setSaving] = useState(false);

  // Detail panel
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [comments, setComments] = useState<Comment[]>([]);
  const [newComment, setNewComment] = useState('');
  const [loadingComments, setLoadingComments] = useState(false);

  const isReadOnly = checkReadOnly('planner');

  const loadData = useCallback(async () => {
    const supabase = createClient();
    const [tRes, uRes, jRes] = await Promise.all([
      supabase.from('tasks').select('*').order('created_at', { ascending: false }),
      supabase.from('user_profiles').select('id, full_name, email, avatar_url, role').eq('active', true),
      supabase.from('journals').select('id, name').order('name'),
    ]);
    setTasks(tRes.data || []);
    setUsers(uRes.data || []);
    setJournals(jRes.data || []);
    setLoading(false);
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  // ─── Filtered Tasks ───
  const filteredTasks = tasks.filter(t => {
    if (filterUser && t.assigned_to !== filterUser) return false;
    if (filterPriority && t.priority !== filterPriority) return false;
    if (filterCategory && t.category !== filterCategory) return false;
    return true;
  });

  // ─── Modal handlers ───
  const openNew = () => {
    setEditTask(null);
    setTitle(''); setDescription(''); setStatus('pendiente'); setPriority('media');
    setCategory('otro'); setAssignedTo(''); setJournalId(''); setDueDate('');
    setShowModal(true);
  };

  const openEdit = (t: Task) => {
    setEditTask(t);
    setTitle(t.title); setDescription(t.description || ''); setStatus(t.status);
    setPriority(t.priority); setCategory(t.category); setAssignedTo(t.assigned_to || '');
    setJournalId(t.journal_id || ''); setDueDate(t.due_date || '');
    setShowModal(true);
  };

  const handleSave = async () => {
    if (!title.trim()) return;
    setSaving(true);
    const supabase = createClient();
    const payload: any = {
      title: title.trim(),
      description: description.trim() || null,
      status,
      priority,
      category,
      assigned_to: assignedTo || null,
      journal_id: journalId || null,
      due_date: dueDate || null,
      updated_at: new Date().toISOString(),
    };

    if (status === 'completada' && (!editTask || editTask.status !== 'completada')) {
      payload.completed_at = new Date().toISOString();
    }

    if (editTask) {
      await supabase.from('tasks').update(payload).eq('id', editTask.id);
    } else {
      payload.created_by = profile?.id || null;
      await supabase.from('tasks').insert(payload);
    }

    setSaving(false);
    setShowModal(false);
    loadData();
  };

  const moveTask = async (taskId: string, newStatus: string) => {
    const supabase = createClient();
    const update: any = { status: newStatus, updated_at: new Date().toISOString() };
    if (newStatus === 'completada') update.completed_at = new Date().toISOString();
    await supabase.from('tasks').update(update).eq('id', taskId);
    setTasks(prev => prev.map(t => t.id === taskId ? { ...t, ...update } : t));
    if (selectedTask?.id === taskId) setSelectedTask(prev => prev ? { ...prev, ...update } : null);
  };

  const deleteTask = async (taskId: string) => {
    if (!confirm('¿Eliminar esta tarea permanentemente?')) return;
    const supabase = createClient();
    await supabase.from('tasks').delete().eq('id', taskId);
    setSelectedTask(null);
    loadData();
  };

  // ─── Comments ───
  const loadComments = async (taskId: string) => {
    setLoadingComments(true);
    const supabase = createClient();
    const { data } = await supabase.from('task_comments').select('*').eq('task_id', taskId).order('created_at');
    setComments(data || []);
    setLoadingComments(false);
  };

  const addComment = async () => {
    if (!newComment.trim() || !selectedTask) return;
    const supabase = createClient();
    await supabase.from('task_comments').insert({
      task_id: selectedTask.id,
      user_id: profile?.id,
      content: newComment.trim(),
    });
    setNewComment('');
    loadComments(selectedTask.id);
  };

  const openDetail = (t: Task) => {
    setSelectedTask(t);
    loadComments(t.id);
  };

  // ─── Helpers ───
  const getUserName = (id: string | null) => {
    if (!id) return 'Sin asignar';
    const u = users.find(u => u.id === id);
    return u?.full_name || u?.email || 'Desconocido';
  };

  const getUserAvatar = (id: string | null) => users.find(u => u.id === id);

  const isOverdue = (t: Task) => {
    if (!t.due_date || t.status === 'completada') return false;
    return new Date(t.due_date) < new Date();
  };

  const getStatusCol = (status: string) => STATUS_COLS.find(s => s.key === status) || STATUS_COLS[0];

  if (loading) return (
    <div className="page-container" style={{ display: 'flex', justifyContent: 'center', padding: '100px' }}>
      <div className="spinner" />
    </div>
  );

  const overdueCount = tasks.filter(t => isOverdue(t)).length;
  const pendingCount = tasks.filter(t => t.status === 'pendiente').length;
  const inProgressCount = tasks.filter(t => t.status === 'en_progreso').length;

  return (
    <div className="page-container">
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '24px' }}>
        <div>
          <h1 className="page-title" style={{ marginBottom: '4px' }}>Planificador de Actividades</h1>
          <p className="page-subtitle">{tasks.length} tareas · {pendingCount} pendientes · {inProgressCount} en progreso
            {overdueCount > 0 && <span style={{ color: '#E53935', fontWeight: 600 }}> · ⚠ {overdueCount} vencidas</span>}
          </p>
        </div>
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          {/* View toggle */}
          <div style={{
            display: 'flex', background: 'var(--gray-50)', borderRadius: 'var(--radius-md)',
            padding: '2px', gap: '2px',
          }}>
            <button
              onClick={() => setViewMode('kanban')}
              style={{
                padding: '6px 12px', borderRadius: 'var(--radius-sm)', border: 'none', cursor: 'pointer',
                background: viewMode === 'kanban' ? 'white' : 'transparent',
                color: viewMode === 'kanban' ? 'var(--gray-900)' : 'var(--gray-500)',
                boxShadow: viewMode === 'kanban' ? 'var(--shadow-sm)' : 'none',
                fontSize: '13px', fontWeight: 500, display: 'flex', alignItems: 'center', gap: '4px',
              }}
            ><LayoutGrid size={14} /> Kanban</button>
            <button
              onClick={() => setViewMode('list')}
              style={{
                padding: '6px 12px', borderRadius: 'var(--radius-sm)', border: 'none', cursor: 'pointer',
                background: viewMode === 'list' ? 'white' : 'transparent',
                color: viewMode === 'list' ? 'var(--gray-900)' : 'var(--gray-500)',
                boxShadow: viewMode === 'list' ? 'var(--shadow-sm)' : 'none',
                fontSize: '13px', fontWeight: 500, display: 'flex', alignItems: 'center', gap: '4px',
              }}
            ><List size={14} /> Lista</button>
          </div>
          {!isReadOnly && (
            <button className="btn btn-primary" onClick={openNew}><Plus size={16} /> Nueva Tarea</button>
          )}
        </div>
      </div>

      {/* Filters */}
      <div style={{ display: 'flex', gap: '10px', marginBottom: '20px', flexWrap: 'wrap' }}>
        <select value={filterUser} onChange={e => setFilterUser(e.target.value)}
          style={{ padding: '6px 10px', borderRadius: 'var(--radius-md)', border: '1px solid var(--gray-200)',
            fontSize: '13px', background: 'white' }}>
          <option value="">Todos los miembros</option>
          {users.map(u => <option key={u.id} value={u.id}>{u.full_name || u.email}</option>)}
        </select>
        <select value={filterPriority} onChange={e => setFilterPriority(e.target.value)}
          style={{ padding: '6px 10px', borderRadius: 'var(--radius-md)', border: '1px solid var(--gray-200)',
            fontSize: '13px', background: 'white' }}>
          <option value="">Todas las prioridades</option>
          {PRIORITY_OPTIONS.map(p => <option key={p.value} value={p.value}>{p.label}</option>)}
        </select>
        <select value={filterCategory} onChange={e => setFilterCategory(e.target.value)}
          style={{ padding: '6px 10px', borderRadius: 'var(--radius-md)', border: '1px solid var(--gray-200)',
            fontSize: '13px', background: 'white' }}>
          <option value="">Todas las categorías</option>
          {CATEGORY_OPTIONS.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
        </select>
        {(filterUser || filterPriority || filterCategory) && (
          <button onClick={() => { setFilterUser(''); setFilterPriority(''); setFilterCategory(''); }}
            style={{ padding: '6px 10px', fontSize: '12px', border: 'none', background: 'var(--gray-100)',
              borderRadius: 'var(--radius-md)', cursor: 'pointer', color: 'var(--gray-600)' }}>
            ✕ Limpiar filtros
          </button>
        )}
      </div>

      {/* Content */}
      <div style={{ display: 'flex', gap: '20px' }}>
        {/* Main area */}
        <div style={{ flex: 1, minWidth: 0 }}>
          {viewMode === 'kanban' ? (
            /* ─── KANBAN VIEW ─── */
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '16px' }}>
              {STATUS_COLS.map(col => {
                const colTasks = filteredTasks.filter(t => t.status === col.key);
                const Icon = col.icon;
                return (
                  <div key={col.key} style={{
                    background: 'var(--gray-50)', borderRadius: 'var(--radius-lg)',
                    padding: '12px', minHeight: '400px',
                  }}
                  onDragOver={(e) => { e.preventDefault(); e.dataTransfer.dropEffect = 'move'; }}
                  onDrop={(e) => {
                    e.preventDefault();
                    const taskId = e.dataTransfer.getData('taskId');
                    if (taskId && !isReadOnly) { moveTask(taskId, col.key); }
                  }}
                  >
                    <div style={{
                      display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px',
                      padding: '6px 10px', borderRadius: 'var(--radius-md)', background: col.bg,
                    }}>
                      <Icon size={14} color={col.color} />
                      <span style={{ fontSize: '13px', fontWeight: 600, color: col.color }}>{col.label}</span>
                      <span style={{
                        marginLeft: 'auto', fontSize: '11px', fontWeight: 700,
                        background: `${col.color}22`, color: col.color,
                        padding: '1px 7px', borderRadius: '10px',
                      }}>{colTasks.length}</span>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                      {colTasks.map(task => (
                        <TaskCard
                          key={task.id}
                          task={task}
                          users={users}
                          isOverdue={isOverdue(task)}
                          isSelected={selectedTask?.id === task.id}
                          onClick={() => openDetail(task)}
                          onMove={!isReadOnly ? moveTask : undefined}
                          statusCols={STATUS_COLS}
                        />
                      ))}
                      {colTasks.length === 0 && (
                        <div style={{
                          padding: '24px', textAlign: 'center', color: 'var(--gray-400)',
                          fontSize: '12px', fontStyle: 'italic',
                        }}>
                          Sin tareas
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            /* ─── LIST VIEW ─── */
            <div className="card">
              <div className="table-container">
                <table>
                  <thead>
                    <tr>
                      <th>Tarea</th>
                      <th>Estado</th>
                      <th>Prioridad</th>
                      <th>Asignado</th>
                      <th>Fecha Límite</th>
                      <th>Categoría</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredTasks.map(t => {
                      const sc = getStatusCol(t.status);
                      const pr = PRIORITY_OPTIONS.find(p => p.value === t.priority);
                      return (
                        <tr key={t.id} onClick={() => openDetail(t)}
                          style={{
                            cursor: 'pointer',
                            background: selectedTask?.id === t.id ? 'var(--gray-50)' : undefined,
                          }}>
                          <td>
                            <span style={{ fontWeight: 600, fontSize: '13px' }}>{t.title}</span>
                          </td>
                          <td>
                            <span style={{
                              fontSize: '11px', fontWeight: 600, padding: '3px 10px', borderRadius: '12px',
                              background: sc.bg, color: sc.color,
                            }}>{sc.label}</span>
                          </td>
                          <td>
                            <span style={{ fontSize: '12px' }}>{pr?.label}</span>
                          </td>
                          <td style={{ fontSize: '13px' }}>{getUserName(t.assigned_to)}</td>
                          <td style={{
                            fontSize: '12px',
                            color: isOverdue(t) ? '#E53935' : 'var(--gray-500)',
                            fontWeight: isOverdue(t) ? 600 : 400,
                          }}>
                            {t.due_date ? new Date(t.due_date).toLocaleDateString('es-CO') : '—'}
                          </td>
                          <td style={{ fontSize: '12px' }}>
                            {CATEGORY_OPTIONS.find(c => c.value === t.category)?.label}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>

        {/* Detail Panel */}
        {selectedTask && (
          <div style={{
            width: '340px', flexShrink: 0,
            background: 'white', borderRadius: 'var(--radius-lg)',
            border: '1px solid var(--gray-100)', padding: '20px',
            maxHeight: 'calc(100vh - 180px)', overflowY: 'auto',
            boxShadow: 'var(--shadow-md)',
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <h3 style={{ fontSize: '15px', fontWeight: 700, margin: 0 }}>Detalle</h3>
              <div style={{ display: 'flex', gap: '4px' }}>
                {!isReadOnly && (
                  <>
                    <button className="btn btn-ghost btn-icon" title="Editar" onClick={() => openEdit(selectedTask)}>
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                    </button>
                    <button className="btn btn-ghost btn-icon" title="Eliminar" onClick={() => deleteTask(selectedTask.id)}>
                      <Trash2 size={14} color="#E53935" />
                    </button>
                  </>
                )}
                <button className="btn btn-ghost btn-icon" onClick={() => setSelectedTask(null)}>
                  <X size={14} />
                </button>
              </div>
            </div>

            <h4 style={{ fontSize: '14px', fontWeight: 600, marginBottom: '8px' }}>{selectedTask.title}</h4>
            {selectedTask.description && (
              <p style={{ fontSize: '13px', color: 'var(--gray-600)', lineHeight: 1.5, marginBottom: '16px' }}>
                {selectedTask.description}
              </p>
            )}

            {/* Status quick-move buttons */}
            {!isReadOnly && (
              <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap', marginBottom: '16px' }}>
                {STATUS_COLS.map(col => (
                  <button key={col.key}
                    onClick={() => moveTask(selectedTask.id, col.key)}
                    style={{
                      fontSize: '11px', padding: '4px 10px', borderRadius: '12px', border: 'none', cursor: 'pointer',
                      background: selectedTask.status === col.key ? col.color : col.bg,
                      color: selectedTask.status === col.key ? 'white' : col.color,
                      fontWeight: 600, transition: 'all 0.15s',
                    }}>
                    {col.label}
                  </button>
                ))}
              </div>
            )}

            {/* Meta info */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: '20px' }}>
              <DetailRow icon={<User size={13} />} label="Asignado" value={getUserName(selectedTask.assigned_to)} />
              <DetailRow icon={<Flag size={13} />} label="Prioridad"
                value={PRIORITY_OPTIONS.find(p => p.value === selectedTask.priority)?.label || ''} />
              <DetailRow icon={<Calendar size={13} />} label="Fecha límite"
                value={selectedTask.due_date ? new Date(selectedTask.due_date).toLocaleDateString('es-CO') : 'Sin fecha'}
                valueColor={isOverdue(selectedTask) ? '#E53935' : undefined} />
              <DetailRow icon={<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18"/></svg>}
                label="Categoría" value={CATEGORY_OPTIONS.find(c => c.value === selectedTask.category)?.label || ''} />
              {selectedTask.created_by && (
                <DetailRow icon={<User size={13} />} label="Creado por" value={getUserName(selectedTask.created_by)} />
              )}
            </div>

            {/* Comments */}
            <div style={{ borderTop: '1px solid var(--gray-100)', paddingTop: '16px' }}>
              <h5 style={{ fontSize: '12px', fontWeight: 600, color: 'var(--gray-500)', marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <MessageSquare size={13} /> Comentarios ({comments.length})
              </h5>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '12px' }}>
                {loadingComments ? (
                  <p style={{ fontSize: '12px', color: 'var(--gray-400)' }}>Cargando...</p>
                ) : comments.length === 0 ? (
                  <p style={{ fontSize: '12px', color: 'var(--gray-400)', fontStyle: 'italic' }}>Sin comentarios aún</p>
                ) : comments.map(c => {
                  const commenter = getUserAvatar(c.user_id);
                  return (
                    <div key={c.id} style={{
                      padding: '8px 10px', background: 'var(--gray-50)',
                      borderRadius: 'var(--radius-md)', fontSize: '12px',
                    }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                        <span style={{ fontWeight: 600, color: 'var(--gray-700)' }}>
                          {commenter?.full_name || 'Usuario'}
                        </span>
                        <span style={{ color: 'var(--gray-400)', fontSize: '10px' }}>
                          {new Date(c.created_at).toLocaleDateString('es-CO')}
                        </span>
                      </div>
                      <p style={{ margin: 0, color: 'var(--gray-600)', lineHeight: 1.4 }}>{c.content}</p>
                    </div>
                  );
                })}
              </div>
              {!isReadOnly && (
                <div style={{ display: 'flex', gap: '6px' }}>
                  <input
                    value={newComment} onChange={e => setNewComment(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && addComment()}
                    placeholder="Escribe un comentario..."
                    style={{
                      flex: 1, padding: '8px 10px', fontSize: '12px',
                      borderRadius: 'var(--radius-md)', border: '1px solid var(--gray-200)',
                    }}
                  />
                  <button onClick={addComment}
                    style={{
                      padding: '8px', borderRadius: 'var(--radius-md)', border: 'none',
                      background: 'var(--primary)', color: 'white', cursor: 'pointer',
                    }}>
                    <Send size={14} />
                  </button>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* ─── Create/Edit Modal ─── */}
      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: '520px' }}>
            <div className="modal-header">
              <h3>{editTask ? 'Editar Tarea' : 'Nueva Tarea'}</h3>
              <button className="btn btn-ghost btn-icon" onClick={() => setShowModal(false)}><X size={18} /></button>
            </div>
            <div className="modal-body">
              <div className="form-group">
                <label>Título *</label>
                <input value={title} onChange={e => setTitle(e.target.value)} placeholder="¿Qué se necesita hacer?" />
              </div>
              <div className="form-group">
                <label>Descripción</label>
                <textarea value={description} onChange={e => setDescription(e.target.value)}
                  placeholder="Detalles, instrucciones..."
                  rows={3} style={{ resize: 'vertical' }} />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div className="form-group">
                  <label>Estado</label>
                  <select value={status} onChange={e => setStatus(e.target.value)}>
                    {STATUS_COLS.map(s => <option key={s.key} value={s.key}>{s.label}</option>)}
                  </select>
                </div>
                <div className="form-group">
                  <label>Prioridad</label>
                  <select value={priority} onChange={e => setPriority(e.target.value)}>
                    {PRIORITY_OPTIONS.map(p => <option key={p.value} value={p.value}>{p.label}</option>)}
                  </select>
                </div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div className="form-group">
                  <label>Asignar a</label>
                  <select value={assignedTo} onChange={e => setAssignedTo(e.target.value)}>
                    <option value="">Sin asignar</option>
                    {users.map(u => <option key={u.id} value={u.id}>{u.full_name || u.email}</option>)}
                  </select>
                </div>
                <div className="form-group">
                  <label>Categoría</label>
                  <select value={category} onChange={e => setCategory(e.target.value)}>
                    {CATEGORY_OPTIONS.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
                  </select>
                </div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div className="form-group">
                  <label>Fecha límite</label>
                  <input type="date" value={dueDate} onChange={e => setDueDate(e.target.value)} />
                </div>
                {(category === 'revista') && (
                  <div className="form-group">
                    <label>Revista</label>
                    <select value={journalId} onChange={e => setJournalId(e.target.value)}>
                      <option value="">Seleccionar...</option>
                      {journals.map(j => <option key={j.id} value={j.id}>{j.name}</option>)}
                    </select>
                  </div>
                )}
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-ghost" onClick={() => setShowModal(false)}>Cancelar</button>
              <button className="btn btn-primary" onClick={handleSave} disabled={saving || !title.trim()}>
                {saving ? 'Guardando...' : editTask ? 'Actualizar' : 'Crear Tarea'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Sub-components ───

function TaskCard({ task, users, isOverdue, isSelected, onClick, onMove, statusCols }: {
  task: Task;
  users: UserProfile[];
  isOverdue: boolean;
  isSelected: boolean;
  onClick: () => void;
  onMove?: (id: string, status: string) => void;
  statusCols: typeof STATUS_COLS;
}) {
  const assigned = users.find(u => u.id === task.assigned_to);
  const pr = PRIORITY_OPTIONS.find(p => p.value === task.priority);
  const currentIdx = statusCols.findIndex(s => s.key === task.status);

  return (
    <div
      draggable={!!onMove}
      onDragStart={(e) => {
        if (!onMove) return;
        e.dataTransfer.setData('taskId', task.id);
        e.dataTransfer.effectAllowed = 'move';
      }}
      onClick={onClick}
      style={{
        background: 'white', borderRadius: 'var(--radius-md)', padding: '12px',
        cursor: onMove ? 'grab' : 'pointer', transition: 'all 0.15s',
        border: isSelected ? '2px solid var(--primary)' : '1px solid var(--gray-100)',
        boxShadow: isSelected ? '0 0 0 3px var(--primary-light)' : 'var(--shadow-sm)',
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '6px' }}>
        <span style={{ fontSize: '13px', fontWeight: 600, lineHeight: 1.3, flex: 1, marginRight: '8px' }}>
          {task.title}
        </span>
        <span style={{
          width: '8px', height: '8px', borderRadius: '50%', flexShrink: 0,
          background: pr?.color || '#ccc', marginTop: '4px',
        }} title={pr?.label} />
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          {assigned?.avatar_url ? (
            <img src={assigned.avatar_url} alt="" style={{ width: '20px', height: '20px', borderRadius: '50%', objectFit: 'cover' }} />
          ) : (
            <div style={{
              width: '20px', height: '20px', borderRadius: '50%', background: 'var(--gray-100)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: '9px', fontWeight: 700, color: 'var(--gray-500)',
            }}>
              {(assigned?.full_name || '?')[0]}
            </div>
          )}
          <span style={{ fontSize: '11px', color: 'var(--gray-500)' }}>
            {assigned?.full_name?.split(' ')[0] || 'Sin asignar'}
          </span>
        </div>

        {task.due_date && (
          <span style={{
            fontSize: '10px', padding: '2px 6px', borderRadius: '8px',
            background: isOverdue ? '#FFEBEE' : 'var(--gray-50)',
            color: isOverdue ? '#E53935' : 'var(--gray-500)',
            fontWeight: isOverdue ? 600 : 400,
          }}>
            {new Date(task.due_date).toLocaleDateString('es-CO', { day: 'numeric', month: 'short' })}
          </span>
        )}
      </div>

      {/* Quick move arrows */}
      {onMove && (
        <div style={{
          display: 'flex', justifyContent: 'flex-end', gap: '4px', marginTop: '8px',
          borderTop: '1px solid var(--gray-50)', paddingTop: '6px',
        }}>
          {currentIdx > 0 && (
            <button onClick={e => { e.stopPropagation(); onMove(task.id, statusCols[currentIdx - 1].key); }}
              style={{
                padding: '2px 8px', fontSize: '10px', borderRadius: '6px',
                border: '1px solid var(--gray-200)', background: 'white', cursor: 'pointer',
                color: 'var(--gray-600)',
              }}>← {statusCols[currentIdx - 1].label}</button>
          )}
          {currentIdx < statusCols.length - 1 && (
            <button onClick={e => { e.stopPropagation(); onMove(task.id, statusCols[currentIdx + 1].key); }}
              style={{
                padding: '2px 8px', fontSize: '10px', borderRadius: '6px',
                border: '1px solid var(--gray-200)', background: 'white', cursor: 'pointer',
                color: 'var(--gray-600)',
              }}>{statusCols[currentIdx + 1].label} →</button>
          )}
        </div>
      )}
    </div>
  );
}

function DetailRow({ icon, label, value, valueColor }: {
  icon: React.ReactNode; label: string; value: string; valueColor?: string;
}) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px' }}>
      <span style={{ color: 'var(--gray-400)', display: 'flex' }}>{icon}</span>
      <span style={{ color: 'var(--gray-500)', minWidth: '70px' }}>{label}</span>
      <span style={{ fontWeight: 500, color: valueColor || 'var(--gray-800)' }}>{value}</span>
    </div>
  );
}
