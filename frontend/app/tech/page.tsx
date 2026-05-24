'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Sidebar from '@/components/Sidebar';
import Timer from '@/components/Timer';
import ManualLogModal from '@/components/ManualLogModal';
import { api, getUser } from '@/lib/api';
import { PlusCircle, Clock, MapPin, CheckCircle, AlertCircle, Loader, BarChart3, ClipboardList, ShieldAlert, Award } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from 'recharts';

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

const COLORS = ['#3b82f6', '#f59e0b', '#22c55e', '#ef4444', '#8b5cf6', '#06b6d4'];

const TOOLTIP_STYLE = {
  contentStyle: { background: '#1e293b', border: '1px solid #334155', borderRadius: 8, fontSize: 13 },
  itemStyle: { color: '#f8fafc' },
  cursor: { fill: 'rgba(255,255,255,0.04)' },
};

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('he-IL', { day: '2-digit', month: '2-digit', year: 'numeric' });
}
function formatMinutes(mins: number) {
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return `${h}:${String(m).padStart(2, '0')}`;
}

export default function TechDashboard() {
  const router = useRouter();
  const user = getUser();

  const [tasks, setTasks] = useState<any[]>([]);
  const [logs, setLogs] = useState<any[]>([]);
  const [showManual, setShowManual] = useState(false);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'work' | 'stats'>('work');

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
      setLogs(logsData);
    } catch (e) {}
    finally { setLoading(false); }
  }

  async function updateTaskStatus(id: number, status: string) {
    try {
      await api.tasks.update(id, { status });
      loadData();
    } catch {}
  }

  // Today stats
  const todayLogs = logs.filter(l => {
    const today = new Date().toDateString();
    return new Date(l.start_time).toDateString() === today && l.end_time;
  });
  const todayMinutes = todayLogs.reduce((s: number, l: any) => s + (l.duration_minutes || 0), 0);
  const travelMinutes = todayLogs.filter((l: any) => l.activity_type.includes('נסיעה')).reduce((s: number, l: any) => s + (l.duration_minutes || 0), 0);

  // General stats computations (last 30 days)
  const completedTasksCount = logs.filter(l => l.activity_type === 'טיפול בתקלה' && l.end_time).length;
  const totalMins = logs.reduce((sum, l) => sum + (l.duration_minutes || 0), 0);
  const totalTravelMins = logs.filter(l => l.activity_type.includes('נסיעה')).reduce((sum, l) => sum + (l.duration_minutes || 0), 0);

  // Group by activity for PieChart
  const activityMap: Record<string, number> = {};
  logs.forEach((l: any) => {
    if (l.duration_minutes) {
      activityMap[l.activity_type] = (activityMap[l.activity_type] || 0) + l.duration_minutes;
    }
  });
  const pieData = Object.entries(activityMap).map(([name, value]) => ({
    name,
    value: Math.round((value / 60) * 10) / 10, // in hours
  }));

  // Daily hours for last 7 days (BarChart)
  const last7Days = Array.from({ length: 7 }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - i);
    return d.toISOString().split('T')[0];
  }).reverse();

  const dailyHoursMap: Record<string, number> = {};
  last7Days.forEach(d => { dailyHoursMap[d] = 0; });

  logs.forEach((l: any) => {
    if (l.duration_minutes && l.start_time) {
      const date = l.start_time.split('T')[0];
      if (dailyHoursMap[date] !== undefined) {
        dailyHoursMap[date] += l.duration_minutes;
      }
    }
  });

  const barData = last7Days.map(date => ({
    date,
    hours: Math.round((dailyHoursMap[date] / 60) * 10) / 10,
  }));

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

        {/* Navigation Tabs */}
        <div className="flex gap-2 mb-6" style={{ borderBottom: '1px solid var(--border)', paddingBottom: '10px' }}>
          <button
            onClick={() => setActiveTab('work')}
            className={`btn text-sm ${activeTab === 'work' ? 'btn-primary' : 'btn-ghost'}`}
            style={{ borderRadius: 10, display: 'flex', alignItems: 'center', gap: 6 }}
          >
            <ClipboardList size={16} />
            העבודה שלי
          </button>
          <button
            onClick={() => setActiveTab('stats')}
            className={`btn text-sm ${activeTab === 'stats' ? 'btn-primary' : 'btn-ghost'}`}
            style={{ borderRadius: 10, display: 'flex', alignItems: 'center', gap: 6 }}
          >
            <BarChart3 size={16} />
            סטטיסטיקה וניתוח שלי
          </button>
        </div>

        {activeTab === 'work' ? (
          <>
            {/* Today Stats */}
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-6">
              <div className="stat-card" style={{ textAlign: 'center' }}>
                <div style={{ color: 'var(--primary)', fontFamily: 'monospace', fontSize: '2rem', fontWeight: 700, letterSpacing: 2, lineHeight: 1.1 }} dir="ltr">
                  {formatMinutes(todayMinutes)}
                </div>
                <div className="stat-label" style={{ marginTop: 4 }}>שעות:דקות היום</div>
              </div>
              <div className="stat-card" style={{ textAlign: 'center' }}>
                <div style={{ color: 'var(--warning)', fontFamily: 'monospace', fontSize: '2rem', fontWeight: 700, letterSpacing: 2, lineHeight: 1.1 }} dir="ltr">
                  {formatMinutes(travelMinutes)}
                </div>
                <div className="stat-label" style={{ marginTop: 4 }}>נסיעות היום</div>
              </div>
              <div className="stat-card" style={{ textAlign: 'center' }}>
                <div style={{ color: 'var(--success)', fontSize: '2rem', fontWeight: 700, lineHeight: 1.1 }}>{tasks.length}</div>
                <div className="stat-label" style={{ marginTop: 4 }}>משימות פתוחות</div>
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
                <Clock size={20} /> פעילויות אחרונות (10 אחרונות)
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
                      {logs.slice(0, 10).map((log: any) => (
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
                            {log.duration_minutes ? formatMinutes(log.duration_minutes) : (log.end_time ? '—' : (
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
          </>
        ) : (
          <>
            {/* Stats Dashboard View */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
              <div className="stat-card" style={{ textAlign: 'center' }}>
                <div style={{ color: '#3b82f6', fontFamily: 'monospace', fontSize: '2rem', fontWeight: 700, letterSpacing: 1, lineHeight: 1.1 }} dir="ltr">
                  {formatMinutes(totalMins)}
                </div>
                <div className="stat-label" style={{ marginTop: 4 }}>שעות עבודה (סה"כ)</div>
              </div>
              <div className="stat-card" style={{ textAlign: 'center' }}>
                <div style={{ color: '#f59e0b', fontFamily: 'monospace', fontSize: '2rem', fontWeight: 700, letterSpacing: 1, lineHeight: 1.1 }} dir="ltr">
                  {formatMinutes(totalTravelMins)}
                </div>
                <div className="stat-label" style={{ marginTop: 4 }}>זמן נסיעה (סה"כ)</div>
              </div>
              <div className="stat-card" style={{ textAlign: 'center' }}>
                <div style={{ color: '#22c55e', fontSize: '2rem', fontWeight: 700, lineHeight: 1.1 }}>
                  {completedTasksCount}
                </div>
                <div className="stat-label" style={{ marginTop: 4 }}>תקלות שטופלו</div>
              </div>
              <div className="stat-card" style={{ textAlign: 'center' }}>
                <div style={{ color: '#ef4444', fontSize: '2rem', fontWeight: 700, lineHeight: 1.1 }}>
                  {totalMins > 0 ? Math.round((totalTravelMins / totalMins) * 100) : 0}%
                </div>
                <div className="stat-label" style={{ marginTop: 4 }}>אחוז נסיעה מהעבודה</div>
              </div>
            </div>

            <div className="grid md:grid-cols-2 gap-6">
              {/* Daily Hours Chart */}
              <div className="card">
                <h2 className="text-lg font-bold mb-4">שעות עבודה יומיות (7 ימים אחרונים)</h2>
                <ResponsiveContainer width="100%" height={240}>
                  <BarChart data={barData} margin={{ top: 5, right: 5, left: -20, bottom: 5 }}>
                    <XAxis
                      dataKey="date"
                      tick={{ fontSize: 11, fill: '#94a3b8' }}
                      tickFormatter={d => new Date(d).toLocaleDateString('he-IL', { day: '2-digit', month: '2-digit' })}
                    />
                    <YAxis tick={{ fontSize: 11, fill: '#94a3b8' }} />
                    <Tooltip
                      {...TOOLTIP_STYLE}
                      labelFormatter={d => new Date(d).toLocaleDateString('he-IL')}
                      formatter={(v: any) => [`${v} שעות`, 'זמן עבודה']}
                    />
                    <Bar dataKey="hours" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>

              {/* Activity Types Breakdown Chart */}
              <div className="card">
                <h2 className="text-lg font-bold mb-4">חלוקת זמן לפי סוג פעילות</h2>
                {pieData.length > 0 ? (
                  <ResponsiveContainer width="100%" height={240}>
                    <PieChart>
                      <Pie
                        data={pieData}
                        dataKey="value"
                        nameKey="name"
                        cx="40%"
                        cy="50%"
                        innerRadius={45}
                        outerRadius={75}
                        paddingAngle={3}
                        label={({ percent }: any) => percent > 0.05 ? `${(percent * 100).toFixed(0)}%` : ''}
                        labelLine={false}
                      >
                        {pieData.map((_: any, i: number) => (
                          <Cell key={i} fill={COLORS[i % COLORS.length]} />
                        ))}
                      </Pie>
                      <Legend
                        layout="vertical"
                        align="right"
                        verticalAlign="middle"
                        iconType="circle"
                        iconSize={9}
                        formatter={(val: string) => (
                          <span style={{ color: '#e2e8f0', fontSize: 12 }}>{val}</span>
                        )}
                      />
                      <Tooltip
                        {...TOOLTIP_STYLE}
                        formatter={(v: any, name: any) => [`${v} שעות`, name]}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="flex items-center justify-center h-48 text-sm" style={{ color: 'var(--muted)' }}>
                    אין נתונים
                  </div>
                )}
              </div>
            </div>

            {/* Achievement card */}
            <div className="card mt-6" style={{ background: 'linear-gradient(135deg, rgba(59,130,246,0.08) 0%, rgba(139,92,246,0.08) 100%)', border: '1px solid rgba(59,130,246,0.2)' }}>
              <div className="flex items-center gap-4">
                <div style={{ background: 'rgba(59,130,246,0.15)', padding: 12, borderRadius: 14, color: '#3b82f6' }}>
                  <Award size={32} />
                </div>
                <div>
                  <h3 className="font-bold text-base" style={{ color: '#f8fafc' }}>כל הכבוד על העבודה, {user?.name}!</h3>
                  <p style={{ color: 'var(--muted)', fontSize: '0.82rem', marginTop: 4 }}>
                    השלמת {completedTasksCount} טיפולי תקלות בסך הכל. המקצועיות שלך שומרת על רמת שירות מצוינת!
                  </p>
                </div>
              </div>
            </div>
          </>
        )}
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
