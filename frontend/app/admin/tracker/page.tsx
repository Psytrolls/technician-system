'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Sidebar from '@/components/Sidebar';
import { api, getUser } from '@/lib/api';
import { 
  Activity, User, Clock, Truck, Wrench, MapPin, Coffee, AlertCircle, ClipboardList, Briefcase 
} from 'lucide-react';

export default function TrackerPage() {
  const router = useRouter();
  const user = getUser();

  const [technicians, setTechnicians] = useState<any[]>([]);
  const [selectedTech, setSelectedTech] = useState<string>('');
  const [selectedDate, setSelectedDate] = useState<string>(
    new Date().toISOString().split('T')[0]
  );
  
  const [logs, setLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingTechs, setLoadingTechs] = useState(true);
  const [error, setError] = useState('');

  // 1. Initial Load: Get all active technicians
  useEffect(() => {
    if (!user) { router.push('/login'); return; }
    if (user.role !== 'admin') { router.push('/tech'); return; }
    loadTechnicians();
  }, []);

  // 2. Load logs when selected technician or date changes
  useEffect(() => {
    if (selectedTech) {
      loadLogs();
    } else {
      setLogs([]);
    }
  }, [selectedTech, selectedDate]);

  async function loadTechnicians() {
    setLoadingTechs(true);
    try {
      const data = await api.users.list();
      const techs = data.filter((u: any) => u.role === 'technician' && u.active);
      setTechnicians(techs);
      if (techs.length > 0) {
        setSelectedTech(techs[0].id.toString());
      }
    } catch (err) {
      setError('שגיאה בטעינת טכנאים');
    } finally {
      setLoadingTechs(false);
    }
  }

  async function loadLogs() {
    setLoading(true);
    setError('');
    try {
      // Query timelogs for this specific tech and day
      const data = await api.timelogs.list({
        user_id: selectedTech,
        date_from: selectedDate,
        date_to: selectedDate,
      });
      
      // The timelogs list returns them in DESC order (latest first).
      // For a daily timeline tracker, it is much cleaner to show them in ASC order (chronological, from morning to evening).
      setLogs([...data].reverse());
    } catch (err) {
      setError('שגיאה בטעינת פעילויות');
    } finally {
      setLoading(false);
    }
  }

  function formatDuration(mins: number) {
    if (!mins) return '—';
    const h = Math.floor(mins / 60);
    const m = mins % 60;
    return `${h}:${String(m).padStart(2, '0')}`;
  }

  // Calculate stats for the selected day
  const totalMins = logs.reduce((sum, l) => sum + (l.duration_minutes || 0), 0);
  const travelMins = logs
    .filter(l => l.activity_type.includes('נסיעה'))
    .reduce((sum, l) => sum + (l.duration_minutes || 0), 0);
  const workMins = logs
    .filter(l => l.activity_type === 'טיפול בתקלה')
    .reduce((sum, l) => sum + (l.duration_minutes || 0), 0);
  const tasksCompleted = logs.filter(
    l => l.activity_type === 'טיפול בתקלה' && l.end_time
  ).length;

  function getActivityStyle(activity: string) {
    switch (activity) {
      case 'נסיעה':
      case 'נסיעה למחסן':
        return { icon: <Truck size={15} />, color: '#f59e0b', bg: 'rgba(245,158,11,0.08)', border: 'rgba(245,158,11,0.2)' };
      case 'טיפול בתקלה':
        return { icon: <Wrench size={15} />, color: '#22c55e', bg: 'rgba(34,197,94,0.08)', border: 'rgba(34,197,94,0.2)' };
      case 'הפסקה':
        return { icon: <Coffee size={15} />, color: '#8b5cf6', bg: 'rgba(139,92,246,0.08)', border: 'rgba(139,92,246,0.2)' };
      default:
        return { icon: <Clock size={15} />, color: '#3b82f6', bg: 'rgba(59,130,246,0.08)', border: 'rgba(59,130,246,0.2)' };
    }
  }

  return (
    <div className="layout">
      <Sidebar />
      <main className="main">
        {/* Header */}
        <div className="flex items-center gap-2 mb-6">
          <Activity size={24} style={{ color: 'var(--primary)' }} />
          <div>
            <h1 className="text-2xl font-bold">מעקב טכנאים יומי</h1>
            <p style={{ color: 'var(--muted)' }} className="text-sm mt-1">
              צפייה ביומן הפעילות המלא והכרונולוגי של כל טכנאי לפי ימים
            </p>
          </div>
        </div>

        {/* Filters Panel */}
        <div className="card mb-6">
          <div className="flex flex-wrap gap-4 items-end">
            <div style={{ flex: 1, minWidth: 200 }}>
              <label className="block text-sm font-medium mb-1">בחר טכנאי *</label>
              <div className="flex items-center gap-2 relative">
                <User size={16} style={{ position: 'absolute', right: 12, color: 'var(--muted)' }} />
                <select
                  className="input"
                  style={{ paddingRight: 36 }}
                  value={selectedTech}
                  onChange={e => setSelectedTech(e.target.value)}
                  disabled={loadingTechs}
                >
                  {loadingTechs && <option>טוען טכנאים...</option>}
                  {technicians.map((t: any) => (
                    <option key={t.id} value={t.id}>{t.name}</option>
                  ))}
                </select>
              </div>
            </div>

            <div style={{ flex: 1, minWidth: 200 }}>
              <label className="block text-sm font-medium mb-1">בחר תאריך *</label>
              <div className="flex items-center gap-2 relative">
                <input
                  type="date"
                  className="input"
                  value={selectedDate}
                  onChange={e => setSelectedDate(e.target.value)}
                />
              </div>
            </div>
          </div>
        </div>

        {/* Loading / Error States */}
        {loading ? (
          <div className="text-center py-16" style={{ color: 'var(--muted)' }}>טוען פעילות...</div>
        ) : error ? (
          <div className="text-center py-12 text-red-400">{error}</div>
        ) : selectedTech === '' ? (
          <div className="text-center py-12" style={{ color: 'var(--muted)' }}>אנא בחר טכנאי ותאריך כדי לצפות ביומן הפעילות.</div>
        ) : (
          <>
            {/* Daily KPI Dashboard */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
              <div className="stat-card" style={{ textAlign: 'center' }}>
                <div style={{ color: 'var(--primary)', fontFamily: 'monospace', fontSize: '2rem', fontWeight: 700, letterSpacing: 1, lineHeight: 1.1 }} dir="ltr">
                  {formatDuration(totalMins)}
                </div>
                <div className="stat-label" style={{ marginTop: 4 }}>סה"כ זמן מוקלט</div>
              </div>
              <div className="stat-card" style={{ textAlign: 'center' }}>
                <div style={{ color: '#f59e0b', fontFamily: 'monospace', fontSize: '2rem', fontWeight: 700, letterSpacing: 1, lineHeight: 1.1 }} dir="ltr">
                  {formatDuration(travelMins)}
                </div>
                <div className="stat-label" style={{ marginTop: 4 }}>זמן נסיעות</div>
              </div>
              <div className="stat-card" style={{ textAlign: 'center' }}>
                <div style={{ color: '#22c55e', fontFamily: 'monospace', fontSize: '2rem', fontWeight: 700, letterSpacing: 1, lineHeight: 1.1 }} dir="ltr">
                  {formatDuration(workMins)}
                </div>
                <div className="stat-label" style={{ marginTop: 4 }}>זמן טיפול בתקלות</div>
              </div>
              <div className="stat-card" style={{ textAlign: 'center' }}>
                <div style={{ color: '#ef4444', fontSize: '2rem', fontWeight: 700, lineHeight: 1.1 }}>
                  {tasksCompleted}
                </div>
                <div className="stat-label" style={{ marginTop: 4 }}>תקלות שהושלמו היום</div>
              </div>
            </div>

            {/* Chronological Timeline Diary */}
            <div className="card">
              <h2 className="text-lg font-bold mb-6 flex items-center gap-2">
                <Clock size={20} /> יומן פעילות כרונולוגי
              </h2>

              {logs.length === 0 ? (
                <div className="text-center py-12" style={{ color: 'var(--muted)' }}>
                  <AlertCircle size={36} className="mx-auto mb-2 opacity-30" />
                  <p>אין פעילות מוקלטת לטכנאי זה ביום שנבחר.</p>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 0, paddingRight: 10 }}>
                  {logs.map((log: any, index: number) => {
                    const { icon, color, bg, border } = getActivityStyle(log.activity_type);
                    const startT = new Date(log.start_time).toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' });
                    const endT = log.end_time 
                      ? new Date(log.end_time).toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' })
                      : 'פעיל כעת';

                    return (
                      <div key={log.id} style={{ display: 'flex', gap: 20, position: 'relative' }}>
                        {/* Vertical timeline line connector */}
                        {index < logs.length - 1 && (
                          <div
                            style={{
                              position: 'absolute',
                              top: 32,
                              right: 17,
                              width: 2,
                              bottom: -20,
                              background: 'rgba(45, 59, 85, 0.4)',
                              zIndex: 1,
                            }}
                          />
                        )}

                        {/* Chronological Dot/Icon */}
                        <div
                          style={{
                            width: 36,
                            height: 36,
                            borderRadius: '50%',
                            background: bg,
                            color: color,
                            border: `1px solid ${border}`,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            zIndex: 2,
                            flexShrink: 0,
                            boxShadow: '0 4px 10px rgba(0, 0, 0, 0.2)',
                          }}
                        >
                          {icon}
                        </div>

                        {/* Card Info Content */}
                        <div 
                          className="flex-1 rounded-xl p-4 mb-5 text-right"
                          style={{
                            background: 'rgba(255, 255, 255, 0.015)',
                            border: '1px solid var(--border)',
                          }}
                        >
                          {/* Row 1: Time range and activity badge */}
                          <div className="flex items-center justify-between flex-wrap gap-2 mb-2">
                            <div className="flex items-center gap-2">
                              <span style={{ fontSize: '0.8rem', padding: '3px 8px', borderRadius: 6, background: bg, color: color, fontWeight: 600, border: `1px solid ${border}` }}>
                                {log.activity_type}
                              </span>
                              {log.is_manual === 1 && (
                                <span className="text-xs badge badge-gray">הזנה ידנית</span>
                              )}
                            </div>

                            <span style={{ fontFamily: 'monospace', fontWeight: 700, color: '#f8fafc', fontSize: '0.9rem' }} dir="ltr">
                              {startT} - {endT} {log.duration_minutes ? `(${log.duration_minutes} ד')` : ''}
                            </span>
                          </div>

                          {/* Row 2: Task title and Client details */}
                          {(log.task_title || log.operator_name) && (
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-2 pt-2" style={{ borderTop: '1px solid rgba(45, 59, 85, 0.3)' }}>
                              {log.task_title && (
                                <div className="flex items-center gap-1.5 text-xs text-slate-200">
                                  <ClipboardList size={13} style={{ color: 'var(--muted)' }} />
                                  <span style={{ color: 'var(--muted)' }}>משימה:</span>
                                  <span className="font-semibold">{log.task_title}</span>
                                </div>
                              )}
                              {log.operator_name && (
                                <div className="flex items-center gap-1.5 text-xs text-slate-200">
                                  <Briefcase size={13} style={{ color: 'var(--muted)' }} />
                                  <span style={{ color: 'var(--muted)' }}>לקוח:</span>
                                  <span className="badge badge-blue">{log.operator_name}</span>
                                </div>
                              )}
                            </div>
                          )}

                          {/* Row 3: Notes & Location */}
                          {(log.notes || log.location) && (
                            <div className="flex flex-col gap-1.5 mt-2 bg-slate-900/20 p-2.5 rounded-lg border border-slate-800/40">
                              {log.location && (
                                <div className="flex items-center gap-1.5 text-xs" style={{ color: 'var(--muted)' }}>
                                  <MapPin size={11} style={{ color: 'var(--primary)' }} />
                                  <span>מיקום: {log.location}</span>
                                </div>
                              )}
                              {log.notes && (
                                <div className="text-xs" style={{ color: '#e2e8f0', lineHeight: 1.4 }}>
                                  <strong style={{ color: 'var(--muted)' }}>פירוט:</strong> {log.notes}
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </>
        )}
      </main>
    </div>
  );
}
