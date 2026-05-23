'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Sidebar from '@/components/Sidebar';
import { api, getUser } from '@/lib/api';
import ManualLogModal from '@/components/ManualLogModal';
import { PlusCircle, Pencil, Clock, X } from 'lucide-react';

const ACTIVITY_TYPES = ['נסיעה', 'טיפול בתקלה', 'התקנה', 'תחזוקה', 'בדיקה', 'הפסקה', 'אחר'];

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('he-IL', { day: '2-digit', month: '2-digit', year: 'numeric' });
}
function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' });
}
function formatDuration(mins: number) {
  if (!mins) return '—';
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return h > 0 ? `${h}:${String(m).padStart(2, '0')}` : `0:${String(m).padStart(2, '0')}`;
}
function formatClock(mins: number) {
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return `${h}:${String(m).padStart(2, '0')}`;
}
function toDatetimeLocal(iso: string) {
  if (!iso) return '';
  // Convert UTC ISO to local datetime-local string
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export default function TechLogsPage() {
  const router = useRouter();
  const user = getUser();

  const [logs, setLogs] = useState<any[]>([]);
  const [tasks, setTasks] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showManual, setShowManual] = useState(false);

  // Edit modal state
  const [editLog, setEditLog] = useState<any>(null);
  const [editForm, setEditForm] = useState({
    activity_type: '',
    start_time: '',
    end_time: '',
    notes: '',
    location: '',
    edit_reason: '',
  });
  const [saving, setSaving] = useState(false);
  const [editError, setEditError] = useState('');

  // Filter
  const today = new Date().toISOString().split('T')[0];
  const [dateFrom, setDateFrom] = useState(
    new Date(Date.now() - 7 * 86400000).toISOString().split('T')[0]
  );
  const [dateTo, setDateTo] = useState(today);

  useEffect(() => {
    if (!user) { router.push('/login'); return; }
    if (user.role === 'admin') { router.push('/admin'); return; }
    loadData();
  }, []);

  async function loadData() {
    setLoading(true);
    try {
      const [logsData, tasksData] = await Promise.all([
        api.timelogs.list({ date_from: dateFrom, date_to: dateTo }),
        api.tasks.list(),
      ]);
      setLogs(logsData);
      setTasks(tasksData);
    } catch {}
    finally { setLoading(false); }
  }

  function openEdit(log: any) {
    setEditLog(log);
    setEditForm({
      activity_type: log.activity_type,
      start_time: toDatetimeLocal(log.start_time),
      end_time: log.end_time ? toDatetimeLocal(log.end_time) : '',
      notes: log.notes || '',
      location: log.location || '',
      edit_reason: '',
    });
    setEditError('');
  }

  async function handleSaveEdit() {
    if (!editForm.edit_reason.trim()) {
      setEditError('נדרשת סיבת תיקון');
      return;
    }
    setSaving(true);
    setEditError('');
    try {
      await api.timelogs.update(editLog.id, {
        activity_type: editForm.activity_type,
        start_time: editForm.start_time ? new Date(editForm.start_time).toISOString() : undefined,
        end_time: editForm.end_time ? new Date(editForm.end_time).toISOString() : undefined,
        notes: editForm.notes || undefined,
        location: editForm.location || undefined,
        edit_reason: editForm.edit_reason,
      });
      setEditLog(null);
      loadData();
    } catch (err: any) {
      setEditError(err.message);
    } finally {
      setSaving(false);
    }
  }

  // Stats for filtered period
  const completedLogs = logs.filter(l => l.end_time);
  const totalMins = completedLogs.reduce((s, l) => s + (l.duration_minutes || 0), 0);
  const travelMins = completedLogs.filter(l => l.activity_type === 'נסיעה').reduce((s, l) => s + (l.duration_minutes || 0), 0);

  return (
    <div className="layout">
      <Sidebar />
      <main className="main">

        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold">היסטוריית פעילויות</h1>
            <p className="text-sm mt-1" style={{ color: 'var(--muted)' }}>כל הלוגים שלך</p>
          </div>
          <button className="btn btn-ghost" onClick={() => setShowManual(true)}>
            <PlusCircle size={18} /> מילוי ידני
          </button>
        </div>

        {/* Filters */}
        <div className="card mb-6">
          <div className="flex flex-wrap gap-4 items-end">
            <div>
              <label className="block text-sm font-medium mb-1">מתאריך</label>
              <input
                type="date" className="input" style={{ width: 'auto' }}
                value={dateFrom} onChange={e => setDateFrom(e.target.value)}
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">עד תאריך</label>
              <input
                type="date" className="input" style={{ width: 'auto' }}
                value={dateTo} onChange={e => setDateTo(e.target.value)}
              />
            </div>
            <button className="btn btn-primary" onClick={loadData}>חפש</button>
          </div>
        </div>

        {/* Period stats */}
        <div className="grid grid-cols-3 gap-4 mb-6">
          <div className="stat-card" style={{ textAlign: 'center' }}>
            <div style={{ color: '#3b82f6', fontFamily: 'monospace', fontSize: '2rem', fontWeight: 700, letterSpacing: 2, lineHeight: 1.1 }} dir="ltr">
              {formatClock(totalMins)}
            </div>
            <div className="stat-label" style={{ marginTop: 4 }}>שעות:דקות בתקופה</div>
          </div>
          <div className="stat-card" style={{ textAlign: 'center' }}>
            <div style={{ color: '#f59e0b', fontFamily: 'monospace', fontSize: '2rem', fontWeight: 700, letterSpacing: 2, lineHeight: 1.1 }} dir="ltr">
              {formatClock(travelMins)}
            </div>
            <div className="stat-label" style={{ marginTop: 4 }}>נסיעות</div>
          </div>
          <div className="stat-card" style={{ textAlign: 'center' }}>
            <div style={{ color: '#22c55e', fontSize: '2rem', fontWeight: 700, lineHeight: 1.1 }}>{completedLogs.length}</div>
            <div className="stat-label" style={{ marginTop: 4 }}>פעילויות</div>
          </div>
        </div>

        {/* Logs table */}
        <div className="card">
          {loading ? (
            <div className="text-center py-12" style={{ color: 'var(--muted)' }}>טוען...</div>
          ) : logs.length === 0 ? (
            <div className="text-center py-12" style={{ color: 'var(--muted)' }}>
              <Clock size={40} className="mx-auto mb-3 opacity-30" />
              <p>אין פעילויות בתקופה הנבחרת</p>
            </div>
          ) : (
            <div className="table-wrapper">
              <table>
                <thead>
                  <tr>
                    <th>תאריך</th>
                    <th>שעות</th>
                    <th>סוג פעילות</th>
                    <th>משימה</th>
                    <th>מיקום</th>
                    <th>משך</th>
                    <th>הערות</th>
                    <th>תיקון</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {logs.map((log: any) => (
                    <tr key={log.id}>
                      <td className="text-sm font-medium">{formatDate(log.start_time)}</td>
                      <td className="text-sm" style={{ color: 'var(--muted)' }}>
                        {formatTime(log.start_time)}
                        {log.end_time && <> – {formatTime(log.end_time)}</>}
                      </td>
                      <td>
                        <span className="badge badge-blue">{log.activity_type}</span>
                      </td>
                      <td className="text-sm">{log.task_title || <span style={{ color: 'var(--muted)' }}>—</span>}</td>
                      <td className="text-sm" style={{ color: 'var(--muted)' }}>{log.location || '—'}</td>
                      <td className="text-sm font-medium">
                        {log.end_time
                          ? formatDuration(log.duration_minutes)
                          : <span className="badge badge-green">פעיל</span>
                        }
                      </td>
                      <td className="text-sm" style={{ color: 'var(--muted)', maxWidth: 160 }}>
                        <span className="line-clamp-1">{log.notes || '—'}</span>
                      </td>
                      <td>
                        {log.is_manual ? (
                          <span className="badge badge-yellow text-xs">ידני</span>
                        ) : '—'}
                      </td>
                      <td>
                        {log.end_time && (
                          <button
                            className="btn btn-ghost p-2"
                            onClick={() => openEdit(log)}
                            title="תיקון"
                          >
                            <Pencil size={15} />
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </main>

      {/* Manual log modal */}
      {showManual && (
        <ManualLogModal
          tasks={tasks}
          onClose={() => setShowManual(false)}
          onSaved={loadData}
        />
      )}

      {/* Edit log modal */}
      {editLog && (
        <div className="modal-overlay" onClick={e => { if (e.target === e.currentTarget) setEditLog(null); }}>
          <div className="modal">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-lg font-bold">תיקון לוג</h2>
              <button onClick={() => setEditLog(null)} className="btn btn-ghost p-2"><X size={18} /></button>
            </div>

            <div className="flex flex-col gap-4">
              <div>
                <label className="block text-sm font-medium mb-1">סוג פעילות</label>
                <select
                  className="input"
                  value={editForm.activity_type}
                  onChange={e => setEditForm(f => ({ ...f, activity_type: e.target.value }))}
                >
                  {ACTIVITY_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium mb-1">שעת התחלה</label>
                  <input
                    type="datetime-local" className="input"
                    value={editForm.start_time}
                    onChange={e => setEditForm(f => ({ ...f, start_time: e.target.value }))}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">שעת סיום</label>
                  <input
                    type="datetime-local" className="input"
                    value={editForm.end_time}
                    onChange={e => setEditForm(f => ({ ...f, end_time: e.target.value }))}
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">מיקום</label>
                <input
                  className="input" placeholder="מיקום..."
                  value={editForm.location}
                  onChange={e => setEditForm(f => ({ ...f, location: e.target.value }))}
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">הערות</label>
                <textarea
                  className="input" rows={2}
                  value={editForm.notes}
                  onChange={e => setEditForm(f => ({ ...f, notes: e.target.value }))}
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">סיבת תיקון *</label>
                <input
                  className="input" placeholder="למה אתה מתקן את הלוג?"
                  value={editForm.edit_reason}
                  onChange={e => setEditForm(f => ({ ...f, edit_reason: e.target.value }))}
                />
              </div>

              {editError && (
                <div className="text-sm py-2 px-4 rounded-lg" style={{ background: '#7f1d1d', color: '#fca5a5' }}>
                  {editError}
                </div>
              )}

              <div className="flex gap-3 mt-2">
                <button className="btn btn-primary flex-1 justify-center" onClick={handleSaveEdit} disabled={saving}>
                  {saving ? 'שומר...' : 'שמור תיקון'}
                </button>
                <button className="btn btn-ghost flex-1 justify-center" onClick={() => setEditLog(null)}>
                  ביטול
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
