'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Sidebar from '@/components/Sidebar';
import { api, getUser } from '@/lib/api';
import { PlusCircle, Pencil, Trash2, X } from 'lucide-react';
import TaskTimeline from '@/components/TaskTimeline';

const STATUS_LABELS: Record<string, string> = {
  pending: 'ממתין', in_progress: 'בעבודה', completed: 'הושלם', cancelled: 'בוטל',
};
const STATUS_BADGES: Record<string, string> = {
  pending: 'badge-yellow', in_progress: 'badge-blue', completed: 'badge-green', cancelled: 'badge-gray',
};
const PRIORITY_LABELS: Record<string, string> = {
  low: 'נמוכה', medium: 'בינונית', high: 'גבוהה', urgent: 'דחוף',
};
const PRIORITY_BADGES: Record<string, string> = {
  low: 'badge-gray', medium: 'badge-blue', high: 'badge-yellow', urgent: 'badge-red',
};
const FAULT_TYPES = ['תקלת חשמל', 'תקלת רשת', 'תקלת מכניקה', 'תחזוקה שגרתית', 'התקנה', 'בדיקה', 'אחר'];

const EMPTY_FORM = {
  title: '', description: '', location: '', fault_type: '', assigned_to: '', priority: 'medium', operator_id: '',
};

export default function TasksPage() {
  const router = useRouter();
  const user = getUser();
  const [tasks, setTasks] = useState<any[]>([]);
  const [users, setUsers] = useState<any[]>([]);
  const [operators, setOperators] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState<'create' | 'edit' | null>(null);
  const [editingTask, setEditingTask] = useState<any>(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [filter, setFilter] = useState('');

  useEffect(() => {
    if (!user) { router.push('/login'); return; }
    if (user.role !== 'admin') { router.push('/tech'); return; }
    loadData();
  }, []);

  async function loadData() {
    setLoading(true);
    try {
      const [t, u, ops] = await Promise.all([api.tasks.list(), api.users.list(), api.operators.list()]);
      setTasks(t);
      setUsers(u.filter((u: any) => u.role === 'technician' && u.active));
      setOperators(ops);
    } catch {}
    finally { setLoading(false); }
  }

  function openCreate() {
    setForm(EMPTY_FORM);
    setEditingTask(null);
    setError('');
    setModal('create');
  }

  function openEdit(task: any) {
    setForm({
      title: task.title,
      description: task.description || '',
      location: task.location || '',
      fault_type: task.fault_type || '',
      assigned_to: task.assigned_to?.toString() || '',
      priority: task.priority,
      operator_id: task.operator_id?.toString() || '',
    });
    setEditingTask(task);
    setError('');
    setModal('edit');
  }

  async function handleSave() {
    if (!form.title.trim()) { setError('כותרת נדרשת'); return; }
    setSaving(true);
    setError('');
    try {
      const data = {
        ...form,
        assigned_to: form.assigned_to ? parseInt(form.assigned_to) : undefined,
        operator_id: form.operator_id ? parseInt(form.operator_id) : null,
      };
      if (modal === 'create') {
        await api.tasks.create(data);
      } else {
        await api.tasks.update(editingTask.id, data);
      }
      setModal(null);
      loadData();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: number) {
    if (!confirm('האם למחוק את המשימה?')) return;
    await api.tasks.delete(id);
    loadData();
  }

  const filteredTasks = filter
    ? tasks.filter(t => t.status === filter)
    : tasks;

  return (
    <div className="layout">
      <Sidebar />
      <main className="main">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-bold">ניהול משימות</h1>
          <button className="btn btn-primary" onClick={openCreate}>
            <PlusCircle size={18} /> משימה חדשה
          </button>
        </div>

        {/* Filters */}
        <div className="flex gap-2 mb-4 flex-wrap">
          {['', 'pending', 'in_progress', 'completed', 'cancelled'].map(s => (
            <button
              key={s}
              className="btn btn-ghost text-xs py-1"
              style={filter === s ? { background: 'var(--primary)', color: 'white', borderColor: 'var(--primary)' } : {}}
              onClick={() => setFilter(s)}
            >
              {s ? STATUS_LABELS[s] : 'הכל'} ({s ? tasks.filter(t => t.status === s).length : tasks.length})
            </button>
          ))}
        </div>

        <div className="card">
          {loading ? (
            <div className="text-center py-12" style={{ color: 'var(--muted)' }}>טוען...</div>
          ) : filteredTasks.length === 0 ? (
            <div className="text-center py-12" style={{ color: 'var(--muted)' }}>אין משימות</div>
          ) : (
            <div className="table-wrapper">
              <table>
                <thead>
                  <tr>
                    <th>כותרת</th>
                    <th>לקוח / מפעיל</th>
                    <th>מוקצה ל</th>
                    <th>סוג תקלה</th>
                    <th>עדיפות</th>
                    <th>סטטוס</th>
                    <th>תאריך</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {filteredTasks.map((task: any) => (
                    <tr key={task.id}>
                      <td>
                        <div className="font-medium">{task.title}</div>
                        {task.location && (
                          <div className="text-xs mt-0.5" style={{ color: 'var(--muted)' }}>📍 {task.location}</div>
                        )}
                      </td>
                      <td>
                        {task.operator_name ? (
                          <span className="badge badge-blue">{task.operator_name}</span>
                        ) : (
                          <span style={{ color: 'var(--muted)' }}>—</span>
                        )}
                      </td>
                      <td>
                        {task.assigned_to === 0
                          ? <span className="badge badge-blue">👥 כל הטכנאים</span>
                          : task.assigned_name || <span style={{ color: 'var(--muted)' }}>לא הוקצה</span>
                        }
                      </td>
                      <td>{task.fault_type || '—'}</td>
                      <td><span className={`badge ${PRIORITY_BADGES[task.priority]}`}>{PRIORITY_LABELS[task.priority]}</span></td>
                      <td><span className={`badge ${STATUS_BADGES[task.status]}`}>{STATUS_LABELS[task.status]}</span></td>
                      <td className="text-sm" style={{ color: 'var(--muted)' }}>
                        {new Date(task.created_at).toLocaleDateString('he-IL')}
                      </td>
                      <td>
                        <div className="flex gap-1">
                          <button className="btn btn-ghost p-2" onClick={() => openEdit(task)}>
                            <Pencil size={15} />
                          </button>
                          <button className="btn btn-danger p-2" onClick={() => handleDelete(task.id)}>
                            <Trash2 size={15} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </main>

      {/* Modal */}
      {modal && (
        <div className="modal-overlay" onClick={e => { if (e.target === e.currentTarget) setModal(null); }}>
          <div className="modal" style={{ maxWidth: modal === 'edit' ? 820 : 500 }}>
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-lg font-bold">{modal === 'create' ? 'משימה חדשה' : 'עריכת משימה'}</h2>
              <button onClick={() => setModal(null)} className="btn btn-ghost p-2"><X size={18} /></button>
            </div>
            
            <div className="flex flex-col md:flex-row gap-6">
              {/* Form inputs */}
              <div className="flex-1 flex flex-col gap-4">
                <div>
                  <label className="block text-sm font-medium mb-1">כותרת *</label>
                  <input className="input" value={form.title} onChange={e => setForm(f => ({...f, title: e.target.value}))} placeholder="כותרת המשימה" />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">תיאור</label>
                  <textarea className="input" rows={2} value={form.description} onChange={e => setForm(f => ({...f, description: e.target.value}))} placeholder="תיאור המשימה..." />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-sm font-medium mb-1">מיקום</label>
                    <input className="input" value={form.location} onChange={e => setForm(f => ({...f, location: e.target.value}))} placeholder="כתובת / מיקום" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1">לקוח / מפעיל</label>
                    <select className="input" value={form.operator_id} onChange={e => setForm(f => ({...f, operator_id: e.target.value}))}>
                      <option value="">ללא לקוח / מפעיל</option>
                      {operators.map((op: any) => <option key={op.id} value={op.id}>{op.name}</option>)}
                    </select>
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <label className="block text-sm font-medium mb-1">סוג תקלה</label>
                    <select className="input" value={form.fault_type} onChange={e => setForm(f => ({...f, fault_type: e.target.value}))}>
                      <option value="">בחר...</option>
                      {FAULT_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1">הקצה לטכנאי</label>
                    <select className="input" value={form.assigned_to} onChange={e => setForm(f => ({...f, assigned_to: e.target.value}))}>
                      <option value="">לא הוקצה</option>
                      <option value="0">👥 כל הטכנאים</option>
                      {users.map((u: any) => <option key={u.id} value={u.id}>{u.name}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1">עדיפות</label>
                    <select className="input" value={form.priority} onChange={e => setForm(f => ({...f, priority: e.target.value}))}>
                      <option value="low">נמוכה</option>
                      <option value="medium">בינונית</option>
                      <option value="high">גבוהה</option>
                      <option value="urgent">דחוף</option>
                    </select>
                  </div>
                </div>

                {error && <div className="text-sm py-2 px-4 rounded-lg" style={{ background: '#7f1d1d', color: '#fca5a5' }}>{error}</div>}

                <div className="flex gap-3 mt-2">
                  <button className="btn btn-primary flex-1 justify-center" onClick={handleSave} disabled={saving}>
                    {saving ? 'שומר...' : 'שמור'}
                  </button>
                  <button className="btn btn-ghost flex-1 justify-center" onClick={() => setModal(null)}>ביטול</button>
                </div>
              </div>

              {/* Task History Timeline (only when editing) */}
              {modal === 'edit' && editingTask && (
                <div style={{ width: 280, borderRight: '1px solid #2d3b55', paddingRight: 20, display: 'flex', flexDirection: 'column' }}>
                  <h3 style={{ fontSize: '0.88rem', fontWeight: 'bold', marginBottom: 12, color: 'var(--muted)' }}>היסטוריית פעילות</h3>
                  <div style={{ flex: 1, overflowY: 'auto', maxHeight: 380, paddingLeft: 8 }} className="custom-scrollbar">
                    <TaskTimeline taskId={editingTask.id} />
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
