'use client';
import { useState, useEffect } from 'react';
import { api } from '@/lib/api';
import { Play, Square, MapPin, Wrench, ChevronDown, CheckCircle, Circle } from 'lucide-react';
import EquipmentDrawer from './EquipmentDrawer';

const ACTIVITY_TYPES = ['נסיעה', 'טיפול בתקלה', 'התקנה', 'תחזוקה', 'בדיקה', 'הפסקה', 'אחר'];

const PRIORITY_COLOR: Record<string, string> = {
  urgent: '#ef4444', high: '#f59e0b', medium: '#3b82f6', low: '#64748b',
};
const PRIORITY_LABEL: Record<string, string> = {
  urgent: 'דחוף', high: 'גבוהה', medium: 'בינונית', low: 'נמוכה',
};

interface TimerProps {
  tasks: any[];
  onLogCreated: () => void;
}

function pad(n: number) { return String(n).padStart(2, '0'); }
function formatDuration(s: number) {
  return `${pad(Math.floor(s/3600))}:${pad(Math.floor((s%3600)/60))}:${pad(s%60)}`;
}

export default function Timer({ tasks, onLogCreated }: TimerProps) {
  const [activeLog, setActiveLog]           = useState<any>(null);
  const [elapsed, setElapsed]               = useState(0);
  const [activityType, setActivityType]     = useState(ACTIVITY_TYPES[0]);
  const [customActivity, setCustomActivity] = useState('');
  const [selectedTask, setSelectedTask]     = useState<number | null>(null);
  const [selectedEquip, setSelectedEquip]   = useState<number | null>(null);
  const [equipList, setEquipList]           = useState<any[]>([]);
  const [showDrawer, setShowDrawer]         = useState(false);
  const [location, setLocation]             = useState('');
  const [notes, setNotes]                   = useState('');
  const [loading, setLoading]               = useState(false);
  const [error, setError]                   = useState('');

  // Load active timer + equipment list
  useEffect(() => {
    api.timelogs.active().then(log => {
      if (log) {
        setActiveLog(log);
        setElapsed(Math.floor((Date.now() - new Date(log.start_time).getTime()) / 1000));
      }
    }).catch(() => {});
    api.equipment.list().then(setEquipList).catch(() => {});
  }, []);

  // Tick
  useEffect(() => {
    if (!activeLog) return;
    const id = setInterval(() => setElapsed(e => e + 1), 1000);
    return () => clearInterval(id);
  }, [activeLog]);

  const resolvedActivity = activityType === 'אחר' && customActivity.trim()
    ? `אחר: ${customActivity.trim()}`
    : activityType;

  const selectedEquipName = equipList.find(e => e.id === selectedEquip)?.name;

  async function startTimer() {
    if (activityType === 'אחר' && !customActivity.trim()) {
      setError('אנא פרט את סוג הפעילות');
      return;
    }
    setError('');
    setLoading(true);
    try {
      await api.timelogs.start({
        activity_type: resolvedActivity,
        task_id: selectedTask ?? undefined,
        equipment_id: selectedEquip ?? undefined,
        location: location || undefined,
      });
      const newLog = await api.timelogs.active();
      setActiveLog(newLog);
      setElapsed(0);
      setNotes('');
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function stopTimer() {
    if (!activeLog) return;
    setError('');
    setLoading(true);
    try {
      await api.timelogs.stop(activeLog.id, { notes: notes || undefined });
      setActiveLog(null);
      setElapsed(0);
      setNotes('');
      setSelectedEquip(null);
      onLogCreated();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <div className="card">
        <h2 className="text-lg font-bold mb-4 flex items-center gap-2">
          <span>⏱</span> טיימר פעילות
        </h2>

        {/* Timer display */}
        <div className="text-center mb-5">
          <div className="timer-display" style={{ color: activeLog ? 'var(--success)' : 'var(--muted)' }}>
            {formatDuration(elapsed)}
          </div>
          {activeLog && (
            <div className="mt-2 flex items-center justify-center gap-2 flex-wrap">
              <span className="badge badge-green">{activeLog.activity_type}</span>
              {activeLog.task_title && (
                <span className="text-sm" style={{ color: 'var(--muted)' }}>{activeLog.task_title}</span>
              )}
            </div>
          )}
        </div>

        {/* ── Setup form ── */}
        {!activeLog ? (
          <div className="flex flex-col gap-4">

            {/* Equipment picker button */}
            <div>
              <label className="block text-sm font-medium mb-2 flex items-center gap-1">
                <Wrench size={14} /> סוג מוצר
              </label>
              <button
                onClick={() => setShowDrawer(true)}
                className="w-full text-right flex items-center justify-between px-4 py-3 rounded-xl transition-all"
                style={{
                  border: `2px solid ${selectedEquip ? 'var(--primary)' : 'var(--border)'}`,
                  background: selectedEquip ? 'rgba(59,130,246,0.08)' : 'rgba(255,255,255,0.02)',
                }}
              >
                <ChevronDown size={16} style={{ color: 'var(--muted)', flexShrink: 0 }} />
                <span style={{ color: selectedEquip ? 'var(--text)' : 'var(--muted)', fontSize: '0.9rem' }}>
                  {selectedEquipName ?? 'בחר סוג מוצר...'}
                </span>
              </button>
            </div>

            {/* Task cards */}
            <div>
              <label className="block text-sm font-medium mb-2">על איזו משימה אתה עובד?</label>
              <div className="flex flex-col gap-2">
                <button
                  onClick={() => setSelectedTask(null)}
                  className="text-right rounded-xl px-3 py-2.5 transition-all"
                  style={{
                    border: `2px solid ${selectedTask === null ? 'var(--primary)' : 'var(--border)'}`,
                    background: selectedTask === null ? 'rgba(59,130,246,0.1)' : 'transparent',
                  }}
                >
                  <div className="flex items-center gap-2">
                    {selectedTask === null
                      ? <CheckCircle size={16} style={{ color: 'var(--primary)', flexShrink: 0 }} />
                      : <Circle size={16} style={{ color: 'var(--muted)', flexShrink: 0 }} />
                    }
                    <span className="text-sm" style={{ color: 'var(--muted)' }}>ללא משימה ספציפית</span>
                  </div>
                </button>

                {tasks.map((task: any) => {
                  const isSel = selectedTask === task.id;
                  return (
                    <button
                      key={task.id}
                      onClick={() => setSelectedTask(task.id)}
                      className="text-right rounded-xl px-3 py-2.5 transition-all"
                      style={{
                        border: `2px solid ${isSel ? 'var(--primary)' : 'var(--border)'}`,
                        background: isSel ? 'rgba(59,130,246,0.1)' : 'rgba(255,255,255,0.02)',
                      }}
                    >
                      <div className="flex items-start gap-2">
                        {isSel
                          ? <CheckCircle size={16} style={{ color: 'var(--primary)', flexShrink: 0, marginTop: 2 }} />
                          : <Circle size={16} style={{ color: 'var(--muted)', flexShrink: 0, marginTop: 2 }} />
                        }
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-sm font-medium">{task.title}</span>
                            {task.priority && (
                              <span className="text-xs px-1.5 py-0.5 rounded-full" style={{
                                background: PRIORITY_COLOR[task.priority] + '22',
                                color: PRIORITY_COLOR[task.priority], fontWeight: 600,
                              }}>
                                {PRIORITY_LABEL[task.priority]}
                              </span>
                            )}
                          </div>
                          {task.location && (
                            <div className="flex items-center gap-1 mt-0.5 text-xs" style={{ color: 'var(--muted)' }}>
                              <MapPin size={11} /> {task.location}
                            </div>
                          )}
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Activity type */}
            <div>
              <label className="block text-sm font-medium mb-2">מה אתה עושה?</label>
              <div className="flex flex-wrap gap-2">
                {ACTIVITY_TYPES.map(type => (
                  <button
                    key={type}
                    onClick={() => { setActivityType(type); setCustomActivity(''); }}
                    className="btn btn-ghost text-xs py-1 px-3"
                    style={activityType === type
                      ? { background: 'var(--primary)', color: 'white', borderColor: 'var(--primary)' }
                      : {}}
                  >
                    {type}
                  </button>
                ))}
              </div>
              {activityType === 'אחר' && (
                <input
                  className="input mt-2"
                  placeholder="פרט את סוג הפעילות..."
                  value={customActivity}
                  onChange={e => setCustomActivity(e.target.value)}
                  autoFocus
                />
              )}
            </div>

            {/* Location */}
            <div>
              <label className="block text-sm font-medium mb-1 flex items-center gap-1">
                <MapPin size={14} /> מיקום (אופציונלי)
              </label>
              <input
                className="input"
                placeholder="הכנס מיקום..."
                value={location}
                onChange={e => setLocation(e.target.value)}
              />
            </div>

            <button className="btn btn-success w-full justify-center" onClick={startTimer} disabled={loading}>
              <Play size={18} />
              {loading ? 'מפעיל...' : 'התחל טיימר'}
            </button>
          </div>

        ) : (
          /* ── Running ── */
          <div className="flex flex-col gap-3">
            <div>
              <label className="block text-sm font-medium mb-1">הערות</label>
              <textarea
                className="input" rows={3}
                placeholder="הוסף הערות לפעילות..."
                value={notes}
                onChange={e => setNotes(e.target.value)}
              />
            </div>
            <button className="btn btn-danger w-full justify-center" onClick={stopTimer} disabled={loading}>
              <Square size={18} />
              {loading ? 'עוצר...' : 'עצור טיימר'}
            </button>
          </div>
        )}

        {error && (
          <div className="mt-3 text-sm text-center py-2 px-4 rounded-lg" style={{ background: '#7f1d1d', color: '#fca5a5' }}>
            {error}
          </div>
        )}
      </div>

      {/* Equipment drawer */}
      {showDrawer && (
        <EquipmentDrawer
          equipment={equipList}
          selected={selectedEquip}
          onSelect={setSelectedEquip}
          onClose={() => setShowDrawer(false)}
        />
      )}
    </>
  );
}
