'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Sidebar from '@/components/Sidebar';
import Timer from '@/components/Timer';
import ManualLogModal from '@/components/ManualLogModal';
import { api, getUser } from '@/lib/api';
import { PlusCircle, Clock, MapPin, CheckCircle, AlertCircle, Loader } from 'lucide-react';

const STATUS_LABELS: Record<string, string> = {
  pending: 'ממתין',
  in_progress: 'בעבודה',
  completed: 'הושלם',
  cancelled: 'בוטל',
};

const STATUS_BADGES: Record<string, string> = {
  pending: 'badge-yellow',
  in_progress: 'badge-blue',
  completed: 'badge-green',
  cancelled: 'badge-gray',
};

const PRIORITY_LABELS: Record<string, string> = {
  low: 'נמוכה',
  medium: 'בינונית',
  high: 'גבוהה',
  urgent: 'דחוף',
};

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('he-IL', { day: '2-digit', month: '2-digit', year: 'numeric' });
}
function formatTime(mins: number) {
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return h > 0 ? `${h}ש' ${m}ד'` : `${m}ד'`;
}

export default function TechDashboard() {
  const router = useRouter();
  const user = getUser();

  const [tasks, setTasks] = useState<any[]>([]);
  const [logs, setLogs] = useState<any[]>([]);
  const [showManual, setShowManual] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) { router.push('/login'); return; }
    if (user.role === 'admin') { router.push('/admin'); return; }
    loadData();
  }, []);

  async function loadData() {
    setLoading(true);
    try {
      const [tasksData, logsData] = await Promise.all([
        api.tasks.list({ status: 'pending' }),
        api.timelogs.list(),
      ]);
      setTasks(tasksData);
      setLogs(logsData.slice(0, 10));
    } catch (e) {}
    finally { setLoading(false); }
  }

  async function updateTaskStatus(id: number, status: string) {
    try {
      await api.tasks.update(id, { status });
      loadData();
    } catch {}
  }

  const todayLogs = logs.filter(l => {
    const today = new Date().toDateString();
    return new Date(l.start_time).toDateString() === today && l.end_time;
  });
  const todayMinutes = todayLogs.reduce((s: number, l: any) => s + (l.duration_minutes || 0), 0);
  const travelMinutes = todayLogs.filter((l: any) => l.activity_type === 'נסיעה').reduce((s: number, l: any) => s + (l.duration_minutes || 0), 0);

  if (loading) return (
    <div className="layout">
      <Sidebar />
      <main className="main flex items-center justify-center">
        <div style={{ color: 'var(--muted)' }}>טוען...</div>
      </main>
    </div>
  );

  return (
    <div className="layout">
      <Sidebar />
      <main className="main">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold">שלום, {user?.name} 👋</h1>
            <p style={{ color: 'var(--muted)' }} className="text-sm mt-1">
              {new Date().toLocaleDateString('he-IL', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
            </p>
          </div>
          <button className="btn btn-ghost" onClick={() => setShowManual(true)}>
            <PlusCircle size={18} />
            מילוי ידני
          </button>
        </div>

        {/* Today Stats */}
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-6">
          <div className="stat-card">
            <div className="stat-value" style={{ color: 'var(--primary)' }}>{formatTime(todayMinutes)}</div>
            <div className="stat-label">סה"כ היום</div>
          </div>
          <div className="stat-card">
            <div className="stat-value" style={{ color: 'var(--warning)' }}>{formatTime(travelMinutes)}</div>
            <div className="stat-label">נסיעות היום</div>
          </div>
          <div className="stat-card">
            <div className="stat-value" style={{ color: 'var(--success)' }}>{tasks.length}</div>
            <div className="stat-label">משימות פתוחות</div>
          </div>
        </div>

        <div className="grid md:grid-cols-2 gap-6">
          {/* Timer */}
          <Timer tasks={tasks} onLogCreated={loadData} />

          {/* My Tasks */}
          <div className="card">
            <h2 className="text-lg font-bold mb-4 flex items-center gap-2">
              <CheckCircle size={20} /> המשימות שלי
            </h2>
            {tasks.length === 0 ? (
              <div className="text-center py-8" style={{ color: 'var(--muted)' }}>
                <CheckCircle size={40} className="mx-auto mb-2 opacity-30" />
                <p>אין משימות פתוחות</p>
              </div>
            ) : (
              <div className="flex flex-col gap-3">
                {tasks.map((task: any) => (
                  <div
                    key={task.id}
                    className="p-3 rounded-xl flex flex-col gap-2"
                    style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid var(--border)' }}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <div className="font-medium text-sm">{task.title}</div>
                        {task.location && (
                          <div className="flex items-center gap-1 text-xs mt-1" style={{ color: 'var(--muted)' }}>
                            <MapPin size={11} /> {task.location}
                          </div>
                        )}
                      </div>
                      <span className={`badge ${STATUS_BADGES[task.priority] || 'badge-gray'} text-xs shrink-0`}>
                        {PRIORITY_LABELS[task.priority]}
                      </span>
                    </div>
                    <div className="flex gap-2">
                      <button
                        className="btn btn-ghost text-xs py-1 px-2 flex-1"
                        onClick={() => updateTaskStatus(task.id, 'in_progress')}
                      >
                        התחל
                      </button>
                      <button
                        className="btn btn-success text-xs py-1 px-2 flex-1"
                        onClick={() => updateTaskStatus(task.id, 'completed')}
                      >
                        סיים
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Recent Logs */}
        <div className="card mt-6">
          <h2 className="text-lg font-bold mb-4 flex items-center gap-2">
            <Clock size={20} /> פעילויות אחרונות
          </h2>
          {logs.length === 0 ? (
            <div className="text-center py-8" style={{ color: 'var(--muted)' }}>
              <Clock size={40} className="mx-auto mb-2 opacity-30" />
              <p>אין פעילויות עדיין</p>
            </div>
          ) : (
            <div className="table-wrapper">
              <table>
                <thead>
                  <tr>
                    <th>תאריך</th>
                    <th>סוג</th>
                    <th>משימה</th>
                    <th>משך</th>
                    <th>הערות</th>
                  </tr>
                </thead>
                <tbody>
                  {logs.map((log: any) => (
                    <tr key={log.id}>
                      <td className="text-sm">{formatDate(log.start_time)}<br/>
                        <span style={{ color: 'var(--muted)', fontSize: '0.75rem' }}>
                          {new Date(log.start_time).toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' })}
                          {log.end_time && ` - ${new Date(log.end_time).toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' })}`}
                        </span>
                      </td>
                      <td><span className="badge badge-blue">{log.activity_type}</span></td>
                      <td className="text-sm">{log.task_title || '—'}</td>
                      <td className="text-sm">
                        {log.duration_minutes ? formatTime(log.duration_minutes) : (log.end_time ? '—' : (
                          <span className="badge badge-green">פעיל</span>
                        ))}
                      </td>
                      <td className="text-sm" style={{ color: 'var(--muted)' }}>{log.notes || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </main>

      {showManual && (
        <ManualLogModal
          tasks={tasks}
          onClose={() => setShowManual(false)}
          onSaved={loadData}
        />
      )}
    </div>
  );
}
