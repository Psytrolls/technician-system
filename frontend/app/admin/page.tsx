'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Sidebar from '@/components/Sidebar';
import { api, getUser } from '@/lib/api';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from 'recharts';
import { Users, ClipboardList, Clock, TrendingUp } from 'lucide-react';

const COLORS = ['#3b82f6', '#22c55e', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4', '#f97316'];

function formatHours(h: number) {
  if (!h) return '0:00';
  const totalMins = Math.round(h * 60);
  const hrs = Math.floor(totalMins / 60);
  const mins = totalMins % 60;
  return `${hrs}:${String(mins).padStart(2, '0')}`;
}

function formatMinutes(mins: number) {
  if (!mins) return '0:00';
  const hrs = Math.floor(mins / 60);
  const m = mins % 60;
  return `${hrs}:${String(m).padStart(2, '0')}`;
}

export default function AdminDashboard() {
  const router = useRouter();
  const user = getUser();
  const [summary, setSummary] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  // Date range - last 30 days by default
  const today = new Date().toISOString().split('T')[0];
  const monthAgo = new Date(Date.now() - 30 * 86400000).toISOString().split('T')[0];

  useEffect(() => {
    if (!user) { router.push('/login'); return; }
    if (user.role !== 'admin') { router.push('/tech'); return; }
    loadData();
  }, []);

  async function loadData() {
    setLoading(true);
    try {
      const data = await api.reports.summary({ date_from: monthAgo, date_to: today });
      setSummary(data);
    } catch {}
    finally { setLoading(false); }
  }

  if (loading || !summary) return (
    <div className="layout">
      <Sidebar />
      <main className="main flex items-center justify-center">
        <div style={{ color: 'var(--muted)' }}>טוען נתונים...</div>
      </main>
    </div>
  );

  const { totals, by_activity, by_technician, by_day, tasks } = summary;

  return (
    <div className="layout">
      <Sidebar />
      <main className="main">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold">דאשבורד ניהולי</h1>
            <p style={{ color: 'var(--muted)' }} className="text-sm mt-1">30 ימים אחרונים</p>
          </div>
          <button className="btn btn-ghost text-sm" onClick={loadData}>רענן</button>
        </div>

        {/* KPI Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          <div className="stat-card">
            <div className="flex items-center justify-between mb-2">
              <Clock size={20} style={{ color: 'var(--primary)' }} />
            </div>
            <div className="stat-value" style={{ color: 'var(--primary)', fontFamily: 'monospace', letterSpacing: '1px' }} dir="ltr">
              {formatHours(totals?.total_hours)}
            </div>
            <div className="stat-label">סה"כ שעות עבודה</div>
          </div>

          <div className="stat-card">
            <div className="flex items-center justify-between mb-2">
              <TrendingUp size={20} style={{ color: 'var(--warning)' }} />
            </div>
            <div className="stat-value" style={{ color: 'var(--warning)', fontFamily: 'monospace', letterSpacing: '1px' }} dir="ltr">
              {formatHours(by_activity?.find((a: any) => a.activity_type === 'נסיעה')?.hours)}
            </div>
            <div className="stat-label">שעות נסיעה</div>
          </div>

          <div className="stat-card">
            <div className="flex items-center justify-between mb-2">
              <ClipboardList size={20} style={{ color: 'var(--success)' }} />
            </div>
            <div className="stat-value" style={{ color: 'var(--success)' }}>
              {tasks?.completed || 0}
            </div>
            <div className="stat-label">משימות הושלמו</div>
          </div>

          <div className="stat-card">
            <div className="flex items-center justify-between mb-2">
              <Users size={20} style={{ color: '#8b5cf6' }} />
            </div>
            <div className="stat-value" style={{ color: '#8b5cf6' }}>
              {by_technician?.length || 0}
            </div>
            <div className="stat-label">טכנאים פעילים</div>
          </div>
        </div>

        <div className="grid md:grid-cols-2 gap-6 mb-6">
          {/* Activity by day chart */}
          <div className="card">
            <h2 className="text-base font-bold mb-4">שעות עבודה לפי יום</h2>
            {by_day?.length > 0 ? (
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={by_day} margin={{ top: 5, right: 5, left: -20, bottom: 5 }}>
                  <XAxis
                    dataKey="date"
                    tick={{ fontSize: 11, fill: '#94a3b8' }}
                    tickFormatter={d => new Date(d).toLocaleDateString('he-IL', { day: '2-digit', month: '2-digit' })}
                  />
                  <YAxis tick={{ fontSize: 11, fill: '#94a3b8' }} />
                  <Tooltip
                    contentStyle={{ background: '#1e293b', border: '1px solid #334155', borderRadius: 8, fontSize: 13 }}
                    itemStyle={{ color: '#f8fafc' }}
                    cursor={{ fill: 'rgba(255, 255, 255, 0.05)' }}
                    labelFormatter={d => new Date(d).toLocaleDateString('he-IL')}
                    formatter={(val: any) => [formatHours(val), 'שעות']}
                  />
                  <Bar dataKey="hours" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex items-center justify-center h-40" style={{ color: 'var(--muted)' }}>
                אין נתונים
              </div>
            )}
          </div>

          {/* Activity type pie */}
          <div className="card">
            <h2 className="text-base font-bold mb-4">חלוקה לפי סוג פעילות</h2>
            {by_activity?.length > 0 ? (
              <ResponsiveContainer width="100%" height={220}>
                  <PieChart>
                    <Pie
                      data={by_activity}
                      dataKey="hours"
                      nameKey="activity_type"
                      cx="40%"
                      cy="50%"
                      innerRadius={45}
                      outerRadius={75}
                      paddingAngle={3}
                      label={({ percent }: any) => percent > 0.05 ? `${(percent * 100).toFixed(0)}%` : ''}
                      labelLine={false}
                    >
                      {by_activity.map((_: any, i: number) => (
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
                      contentStyle={{ background: '#1e293b', border: '1px solid #334155', borderRadius: 8 }}
                      itemStyle={{ color: '#f8fafc' }}
                      formatter={(val: any, name: any) => [formatHours(val), name]}
                    />
                  </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex items-center justify-center h-40" style={{ color: 'var(--muted)' }}>
                אין נתונים
              </div>
            )}
          </div>
        </div>

        {/* Operator workload and Completed tasks charts */}
        <div className="grid md:grid-cols-2 gap-6 mb-6">
          <div className="card">
            <h2 className="text-base font-bold mb-4">עומס עבודה לפי לקוח / מפעיל</h2>
            {summary.by_operator?.length > 0 ? (
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={summary.by_operator} margin={{ top: 5, right: 5, left: -20, bottom: 5 }}>
                  <XAxis dataKey="name" tick={{ fontSize: 11, fill: '#94a3b8' }} interval={0} />
                  <YAxis tick={{ fontSize: 11, fill: '#94a3b8' }} />
                  <Tooltip
                    contentStyle={{ background: '#1e293b', border: '1px solid #334155', borderRadius: 8, fontSize: 13 }}
                    itemStyle={{ color: '#f8fafc' }}
                    cursor={{ fill: 'rgba(255, 255, 255, 0.05)' }}
                    formatter={(val: any) => [formatHours(val), 'שעות עבודה']}
                  />
                  <Bar dataKey="hours" radius={[4, 4, 0, 0]}>
                    {summary.by_operator.map((_: any, i: number) => (
                      <Cell key={i} fill={COLORS[(i + 1) % COLORS.length]} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex items-center justify-center h-40" style={{ color: 'var(--muted)' }}>
                אין נתונים
              </div>
            )}
          </div>

          <div className="card">
            <h2 className="text-base font-bold mb-4">משימות שהושלמו לפי יום</h2>
            {summary.completions_by_day?.length > 0 ? (
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={summary.completions_by_day} margin={{ top: 5, right: 5, left: -20, bottom: 5 }}>
                  <XAxis
                    dataKey="date"
                    tick={{ fontSize: 11, fill: '#94a3b8' }}
                    tickFormatter={d => new Date(d).toLocaleDateString('he-IL', { day: '2-digit', month: '2-digit' })}
                  />
                  <YAxis tick={{ fontSize: 11, fill: '#94a3b8' }} />
                  <Tooltip
                    contentStyle={{ background: '#1e293b', border: '1px solid #334155', borderRadius: 8, fontSize: 13 }}
                    itemStyle={{ color: '#f8fafc' }}
                    cursor={{ fill: 'rgba(255, 255, 255, 0.05)' }}
                    labelFormatter={d => new Date(d).toLocaleDateString('he-IL')}
                    formatter={(val: any) => [`${val}`, 'משימות הושלמו']}
                  />
                  <Bar dataKey="completed_count" fill="#10b981" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex items-center justify-center h-40" style={{ color: 'var(--muted)' }}>
                אין נתונים
              </div>
            )}
          </div>
        </div>

        {/* Technicians table */}
        <div className="card">
          <h2 className="text-base font-bold mb-4">ביצועי טכנאים — 30 ימים אחרונים</h2>
          {by_technician?.length > 0 ? (
            <div className="table-wrapper">
              <table>
                <thead>
                  <tr>
                    <th>טכנאי</th>
                    <th>תקלות שהושלמו</th>
                    <th>סה"כ שעות</th>
                    <th>ממוצע פעילות (דקות)</th>
                    <th>עומס</th>
                  </tr>
                </thead>
                <tbody>
                  {by_technician.map((t: any) => {
                    const maxHours = Math.max(...by_technician.map((x: any) => x.total_hours));
                    const pct = maxHours > 0 ? (t.total_hours / maxHours) * 100 : 0;
                    return (
                      <tr key={t.id}>
                        <td className="font-medium">{t.name}</td>
                        <td>{t.completed_tasks ?? 0}</td>
                        <td style={{ fontFamily: 'monospace', textAlign: 'right' }} dir="ltr">{formatHours(t.total_hours)}</td>
                        <td style={{ fontFamily: 'monospace', textAlign: 'right' }} dir="ltr">{formatMinutes(t.avg_minutes)}</td>
                        <td>
                          <div className="flex items-center gap-2">
                            <div className="flex-1 h-2 rounded-full" style={{ background: 'var(--border)' }}>
                              <div
                                className="h-2 rounded-full"
                                style={{ width: `${pct}%`, background: 'var(--primary)' }}
                              />
                            </div>
                            <span className="text-xs" style={{ color: 'var(--muted)' }}>{Math.round(pct)}%</span>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="text-center py-8" style={{ color: 'var(--muted)' }}>
              אין נתוני טכנאים עדיין
            </div>
          )}
        </div>

        {/* Task status */}
        <div className="card mt-6">
          <h2 className="text-base font-bold mb-4">סטטוס משימות</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[
              { label: 'ממתינות', val: tasks?.pending || 0, color: 'var(--warning)' },
              { label: 'בעבודה', val: tasks?.in_progress || 0, color: 'var(--primary)' },
              { label: 'הושלמו', val: tasks?.completed || 0, color: 'var(--success)' },
              { label: 'סה"כ', val: tasks?.total || 0, color: 'var(--text)' },
            ].map(item => (
              <div key={item.label} className="text-center p-4 rounded-xl" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid var(--border)' }}>
                <div className="text-2xl font-bold" style={{ color: item.color }}>{item.val}</div>
                <div className="text-sm mt-1" style={{ color: 'var(--muted)' }}>{item.label}</div>
              </div>
            ))}
          </div>
        </div>
      </main>
    </div>
  );
}
