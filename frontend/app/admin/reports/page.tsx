'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Sidebar from '@/components/Sidebar';
import { api, getUser } from '@/lib/api';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  LineChart, Line, CartesianGrid, PieChart, Pie, Cell, Legend,
} from 'recharts';
import { Download } from 'lucide-react';

const COLORS = ['#3b82f6', '#22c55e', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4', '#f97316'];

const TOOLTIP_STYLE = {
  contentStyle: { background: '#1e293b', border: '1px solid #334155', borderRadius: 8, fontSize: 13 },
  itemStyle: { color: '#f8fafc' },
  cursor: { fill: 'rgba(255,255,255,0.04)' },
};

function EmptyChart() {
  return (
    <div className="flex items-center justify-center h-48 text-sm" style={{ color: 'var(--muted)' }}>
      אין נתונים לתצוגה
    </div>
  );
}

const renderYAxisTick = ({ x, y, payload }: any) => {
  return (
    <text
      x={x - 8}
      y={y + 4}
      textAnchor="end"
      fill="#e2e8f0"
      fontSize={11}
    >
      {payload.value}
    </text>
  );
};


export default function ReportsPage() {
  const router = useRouter();
  const user = getUser();
  const [summary, setSummary] = useState<any>(null);
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);

  const today = new Date().toISOString().split('T')[0];
  const [dateFrom, setDateFrom] = useState(
    new Date(Date.now() - 30 * 86400000).toISOString().split('T')[0]
  );
  const [dateTo, setDateTo] = useState(today);
  const [selectedUser, setSelectedUser] = useState('');

  useEffect(() => {
    if (!user) { router.push('/login'); return; }
    if (user.role !== 'admin') { router.push('/tech'); return; }
    api.users.list().then(u => setUsers(u.filter((x: any) => x.role === 'technician')));
    loadData();
  }, []);

  async function loadData() {
    setLoading(true);
    const params: Record<string, string> = { date_from: dateFrom, date_to: dateTo };
    if (selectedUser) params.user_id = selectedUser;
    try { setSummary(await api.reports.summary(params)); }
    catch {} finally { setLoading(false); }
  }

  // Download xlsx directly from backend as binary
  async function handleExport() {
    setExporting(true);
    try {
      const token = localStorage.getItem('token');
      const params = new URLSearchParams({ date_from: dateFrom, date_to: dateTo });
      if (selectedUser) params.set('user_id', selectedUser);
      const res = await fetch(`/api/reports/export?${params}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error('שגיאה בייצוא');
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `דוח_טכנאים_${dateFrom}_${dateTo}.xlsx`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      alert('שגיאה בייצוא הקובץ');
    } finally {
      setExporting(false);
    }
  }

  const travelHours = summary?.by_activity?.find((a: any) => a.activity_type === 'נסיעה')?.hours || 0;
  const travelPct = summary?.totals?.total_hours > 0
    ? Math.round((travelHours / summary.totals.total_hours) * 100)
    : 0;

  return (
    <div className="layout">
      <Sidebar />
      <main className="main">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-bold">דוחות וסטטיסטיקות</h1>
          <button className="btn btn-success" onClick={handleExport} disabled={exporting}>
            <Download size={18} />
            {exporting ? 'מייצא...' : 'יצוא Excel'}
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
            <div>
              <label className="block text-sm font-medium mb-1">טכנאי</label>
              <select
                className="input" style={{ width: 'auto' }}
                value={selectedUser} onChange={e => setSelectedUser(e.target.value)}
              >
                <option value="">כל הטכנאים</option>
                {users.map((u: any) => <option key={u.id} value={u.id}>{u.name}</option>)}
              </select>
            </div>
            <button className="btn btn-primary" onClick={loadData}>הפעל פילטר</button>
          </div>
        </div>

        {loading ? (
          <div className="text-center py-16" style={{ color: 'var(--muted)' }}>טוען נתונים...</div>
        ) : !summary ? null : (
          <>
            {/* KPI cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
              {[
                { label: 'שעות עבודה', val: `${summary.totals?.total_hours || 0}`, unit: "ש'", color: '#3b82f6' },
                { label: 'רשומות פעילות', val: summary.totals?.total_entries || 0, unit: '', color: '#22c55e' },
                { label: 'שעות נסיעה', val: `${travelHours}`, unit: "ש'", color: '#f59e0b' },
                { label: 'אחוז נסיעה', val: `${travelPct}`, unit: '%', color: '#ef4444' },
              ].map(item => (
                <div key={item.label} className="stat-card">
                  <div className="stat-value" style={{ color: item.color }}>
                    {item.val}<span className="text-base font-normal">{item.unit}</span>
                  </div>
                  <div className="stat-label">{item.label}</div>
                </div>
              ))}
            </div>

            {/* Row 1: Line chart + Pie chart */}
            <div className="grid md:grid-cols-2 gap-6 mb-6">

              {/* Line: hours per day */}
              <div className="card">
                <h2 className="font-bold mb-4">שעות עבודה לפי יום</h2>
                {summary.by_day?.length > 0 ? (
                  <ResponsiveContainer width="100%" height={220}>
                    <LineChart data={summary.by_day} margin={{ top: 5, right: 10, left: -15, bottom: 5 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                      <XAxis
                        dataKey="date"
                        tick={{ fontSize: 11, fill: '#94a3b8' }}
                        tickFormatter={d =>
                          new Date(d + 'T00:00:00').toLocaleDateString('he-IL', { day: '2-digit', month: '2-digit' })
                        }
                        interval="preserveStartEnd"
                      />
                      <YAxis tick={{ fontSize: 11, fill: '#94a3b8' }} tickFormatter={v => `${v} ש'`} />
                      <Tooltip
                        {...TOOLTIP_STYLE}
                        labelFormatter={d =>
                          new Date(d + 'T00:00:00').toLocaleDateString('he-IL', { weekday: 'long', day: 'numeric', month: 'long' })
                        }
                        formatter={(v: any) => [`${v} ש'`, 'שעות']}
                      />
                      <Line
                        dataKey="hours"
                        stroke="#3b82f6"
                        strokeWidth={2.5}
                        dot={{ r: 3, fill: '#3b82f6' }}
                        activeDot={{ r: 5 }}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                ) : <EmptyChart />}
              </div>

              {/* Pie: activity types */}
              <div className="card">
                <h2 className="font-bold mb-4">חלוקה לפי סוג פעילות</h2>
                {summary.by_activity?.length > 0 ? (
                  <ResponsiveContainer width="100%" height={220}>
                    <PieChart>
                      <Pie
                        data={summary.by_activity}
                        dataKey="hours"
                        nameKey="activity_type"
                        cx="45%"
                        cy="50%"
                        innerRadius={45}
                        outerRadius={75}
                        paddingAngle={3}
                        label={({ name, percent }: any) =>
                          percent > 0.05 ? `${(percent * 100).toFixed(0)}%` : ''
                        }
                        labelLine={false}
                      >
                        {summary.by_activity.map((_: any, i: number) => (
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
                        formatter={(v: any, name: any) => [`${v} ש'`, name]}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                ) : <EmptyChart />}
              </div>
            </div>

            {/* Row 2: Horizontal bar (activity hours) + Technician comparison */}
            <div className="grid md:grid-cols-2 gap-6 mb-6">

              {/* Horizontal bar: hours per activity */}
              <div className="card">
                <h2 className="font-bold mb-4">שעות לפי סוג פעילות</h2>
                {summary.by_activity?.length > 0 ? (
                  <ResponsiveContainer width="100%" height={220}>
                    <BarChart
                      data={summary.by_activity}
                      layout="vertical"
                      margin={{ top: 5, right: 40, left: 80, bottom: 5 }}
                    >
                      <XAxis type="number" tick={{ fontSize: 11, fill: '#94a3b8' }} tickFormatter={v => `${v} ש'`} />
                      <YAxis
                        type="category"
                        dataKey="activity_type"
                        tick={renderYAxisTick}
                        width={90}
                      />
                      <Tooltip
                        {...TOOLTIP_STYLE}
                        formatter={(v: any) => [`${v} ש'`, 'שעות']}
                      />
                      <Bar dataKey="hours" radius={[0, 6, 6, 0]} label={{ position: 'right', fill: '#94a3b8', fontSize: 11, formatter: (v: any) => `${v} ש'` }}>
                        {summary.by_activity.map((_: any, i: number) => (
                          <Cell key={i} fill={COLORS[i % COLORS.length]} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                ) : <EmptyChart />}
              </div>

              {/* Bar: technician comparison */}
              <div className="card">
                <h2 className="font-bold mb-4">השוואת טכנאים — שעות עבודה</h2>
                {summary.by_technician?.length > 0 ? (
                  <ResponsiveContainer width="100%" height={220}>
                    <BarChart
                      data={summary.by_technician}
                      margin={{ top: 5, right: 10, left: -10, bottom: 45 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
                      <XAxis
                        dataKey="name"
                        tick={{ fontSize: 12, fill: '#e2e8f0' }}
                        angle={-15}
                        textAnchor="end"
                        interval={0}
                      />
                      <YAxis tick={{ fontSize: 11, fill: '#94a3b8' }} tickFormatter={v => `${v} ש'`} />
                      <Tooltip
                        {...TOOLTIP_STYLE}
                        formatter={(v: any) => [`${v} ש'`, 'שעות']}
                      />
                      <Bar dataKey="total_hours" radius={[6, 6, 0, 0]} label={{ position: 'top', fill: '#94a3b8', fontSize: 11, formatter: (v: any) => `${v} ש'` }}>
                        {summary.by_technician.map((_: any, i: number) => (
                          <Cell key={i} fill={COLORS[i % COLORS.length]} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                ) : <EmptyChart />}
              </div>
            </div>

            {/* Row 3: Operator workload + Completed tasks per day */}
            <div className="grid md:grid-cols-2 gap-6 mb-6">

              {/* Bar/Donut: Operator workload comparison */}
              <div className="card">
                <h2 className="font-bold mb-4">עומס לפי לקוח / מפעיל (שעות עבודה)</h2>
                {summary.by_operator?.length > 0 ? (
                  <ResponsiveContainer width="100%" height={220}>
                    <BarChart
                      data={summary.by_operator}
                      margin={{ top: 5, right: 10, left: -10, bottom: 25 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
                      <XAxis
                        dataKey="name"
                        tick={{ fontSize: 11, fill: '#e2e8f0' }}
                        interval={0}
                      />
                      <YAxis tick={{ fontSize: 11, fill: '#94a3b8' }} tickFormatter={v => `${v} ש'`} />
                      <Tooltip
                        {...TOOLTIP_STYLE}
                        formatter={(v: any) => [`${v} ש'`, 'שעות עבודה']}
                      />
                      <Bar dataKey="hours" radius={[6, 6, 0, 0]} fill="#3b82f6" label={{ position: 'top', fill: '#94a3b8', fontSize: 11, formatter: (v: any) => `${v} ש'` }}>
                        {summary.by_operator.map((_: any, i: number) => (
                          <Cell key={i} fill={COLORS[(i + 2) % COLORS.length]} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                ) : <EmptyChart />}
              </div>

              {/* Line/Bar: completed tasks per day */}
              <div className="card">
                <h2 className="font-bold mb-4">משימות שהושלמו לפי יום</h2>
                {summary.completions_by_day?.length > 0 ? (
                  <ResponsiveContainer width="100%" height={220}>
                    <LineChart data={summary.completions_by_day} margin={{ top: 5, right: 10, left: -15, bottom: 5 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                      <XAxis
                        dataKey="date"
                        tick={{ fontSize: 11, fill: '#94a3b8' }}
                        tickFormatter={d =>
                          new Date(d + 'T00:00:00').toLocaleDateString('he-IL', { day: '2-digit', month: '2-digit' })
                        }
                        interval="preserveStartEnd"
                      />
                      <YAxis tick={{ fontSize: 11, fill: '#94a3b8' }} tickFormatter={v => `${v}`} />
                      <Tooltip
                        {...TOOLTIP_STYLE}
                        labelFormatter={d =>
                          new Date(d + 'T00:00:00').toLocaleDateString('he-IL', { weekday: 'long', day: 'numeric', month: 'long' })
                        }
                        formatter={(v: any) => [`${v}`, 'משימות שהושלמו']}
                      />
                      <Line
                        dataKey="completed_count"
                        stroke="#10b981"
                        strokeWidth={2.5}
                        dot={{ r: 3, fill: '#10b981' }}
                        activeDot={{ r: 5 }}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                ) : <EmptyChart />}
              </div>
            </div>

            {/* Technician detail table */}
            {summary.by_technician?.length > 0 && (
              <div className="card">
                <h2 className="font-bold mb-4">פירוט לפי טכנאי</h2>
                <div className="table-wrapper">
                  <table>
                    <thead>
                      <tr>
                        <th>טכנאי</th>
                        <th>דיווחים</th>
                        <th>משימות שהושלמו</th>
                        <th>שעות עבודה</th>
                        <th>ממוצע פעילות</th>
                        <th>עומס יחסי</th>
                      </tr>
                    </thead>
                    <tbody>
                      {summary.by_technician.map((t: any, i: number) => {
                        const maxH = Math.max(...summary.by_technician.map((x: any) => x.total_hours));
                        const pct = maxH > 0 ? Math.round((t.total_hours / maxH) * 100) : 0;
                        return (
                          <tr key={t.id}>
                            <td>
                              <div className="flex items-center gap-2">
                                <span
                                  className="inline-block w-2.5 h-2.5 rounded-full"
                                  style={{ background: COLORS[i % COLORS.length] }}
                                />
                                <span className="font-medium">{t.name}</span>
                              </div>
                            </td>
                            <td>{t.entries}</td>
                            <td>{t.completed_tasks ?? 0}</td>
                            <td>{t.total_hours}ש'</td>
                            <td>{t.avg_minutes}ד'</td>
                            <td style={{ width: 160 }}>
                              <div className="flex items-center gap-2">
                                <div
                                  className="flex-1 rounded-full overflow-hidden"
                                  style={{ height: 8, background: 'var(--border)' }}
                                >
                                  <div
                                    style={{
                                      width: `${pct}%`,
                                      height: '100%',
                                      background: COLORS[i % COLORS.length],
                                      borderRadius: 999,
                                      transition: 'width 0.6s ease',
                                    }}
                                  />
                                </div>
                                <span className="text-xs w-8" style={{ color: 'var(--muted)' }}>{pct}%</span>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </>
        )}
      </main>
    </div>
  );
}
