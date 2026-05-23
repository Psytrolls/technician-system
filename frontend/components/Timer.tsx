'use client';
import { useState, useEffect, useRef } from 'react';
import { api } from '@/lib/api';
import { Play, Square, MapPin, Wrench, ChevronDown, CheckCircle, Circle } from 'lucide-react';
import EquipmentDrawer from './EquipmentDrawer';

const ACTIVITY_TYPES = ['נסיעה', 'טיפול בתקלה', 'הפסקה', 'אחר'];

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
  const [operatorList, setOperatorList]     = useState<any[]>([]);
  const [selectedOperator, setSelectedOperator] = useState<number | null>(null);
  const [showDrawer, setShowDrawer]         = useState(false);
  const [location, setLocation]             = useState('');
  const [notes, setNotes]                   = useState('');
  const [loading, setLoading]               = useState(false);
  const [error, setError]                   = useState('');
  const operatorSelectRef                   = useRef<HTMLSelectElement>(null);

  // Load active timer + equipment list + operators
  useEffect(() => {
    api.timelogs.active().then(log => {
      if (log) {
        setActiveLog(log);
        setElapsed(Math.floor((Date.now() - new Date(log.start_time).getTime()) / 1000));
      }
    }).catch(() => {});
    api.equipment.list().then(setEquipList).catch(() => {});
    api.operators.list().then(setOperatorList).catch(() => {});
  }, []);

  // Pre-fill operator when task is selected
  useEffect(() => {
    if (selectedTask) {
      const task = tasks.find(t => t.id === selectedTask);
      if (task?.operator_id) {
        setSelectedOperator(task.operator_id);
      }
    }
  }, [selectedTask, tasks]);

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
        operator_id: selectedOperator ?? undefined,
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
      setSelectedOperator(null);
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
              {activeLog.operator_name && (
                <span className="badge badge-blue">{activeLog.operator_name}</span>
              )}
              {activeLog.task_title && (
                <span className="text-sm" style={{ color: 'var(--muted)' }}>{activeLog.task_title}</span>
              )}
            </div>
          )}
        </div>

        {/* ── Setup form ── */}
        {!activeLog ? (
          <div className="flex flex-col gap-5">
            
            {/* Step 1: Activity type */}
            <div>
              <label className="block text-sm font-semibold mb-2" style={{ color: 'var(--primary)' }}>
                שלב 1: מה סוג הפעילות?
              </label>
              <div className="flex flex-wrap gap-2">
                {ACTIVITY_TYPES.map(type => (
                  <button
                    key={type}
                    onClick={() => {
                      setActivityType(type);
                      setCustomActivity('');
                      // Reset cascading items
                      setSelectedOperator(null);
                      setSelectedEquip(null);
                    }}
                    className="btn btn-ghost text-xs py-1.5 px-3 rounded-lg transition-all"
                    style={activityType === type
                      ? { background: 'var(--primary)', color: 'white', borderColor: 'var(--primary)' }
                      : { background: 'rgba(255,255,255,0.03)' }}
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

            {/* Cascading Step 2: Select Operator (Required for 'טיפול בתקלה', optional/hidden otherwise) */}
            {activityType === 'טיפול בתקלה' && (
              <div className="fade-in border-t pt-4" style={{ borderColor: 'rgba(255,255,255,0.05)' }}>
                <label className="block text-sm font-semibold mb-2" style={{ color: 'var(--primary)' }}>
                  שלב 2: עבור איזה מפעיל / לקוח?
                </label>
                
                {/* Optional Task pre-selection which pre-fills the operator */}
                {tasks.filter(t => t.status !== 'completed').length > 0 && (
                  <div className="mb-3">
                    <span className="text-xs block mb-1.5" style={{ color: 'var(--muted)' }}>שיוך משימה קיימת (אופציונלי):</span>
                    <select
                      className="input text-xs py-1"
                      value={selectedTask ?? ''}
                      onChange={e => {
                        const val = e.target.value ? parseInt(e.target.value) : null;
                        setSelectedTask(val);
                      }}
                    >
                      <option value="">ללא משימה ספציפית</option>
                      {tasks.filter(t => t.status !== 'completed').map(task => (
                        <option key={task.id} value={task.id}>{task.title}</option>
                      ))}
                    </select>
                  </div>
                )}

                <select
                  ref={operatorSelectRef}
                  className="input select-custom"
                  value={selectedOperator ?? ''}
                  onChange={e => {
                    setSelectedOperator(e.target.value ? parseInt(e.target.value) : null);
                    setSelectedEquip(null); // Reset product selection when operator changes
                  }}
                  style={{ border: !selectedOperator ? '1px solid var(--warning)' : '1px solid var(--border)' }}
                >
                  <option value="">-- בחר מפעיל / לקוח --</option>
                  {operatorList.map(op => (
                    <option key={op.id} value={op.id}>{op.name}</option>
                  ))}
                </select>
                {!selectedOperator && (
                  <p className="text-xs mt-1.5 flex items-center gap-1" style={{ color: 'var(--warning)' }}>
                    <span>⚠️</span> נא לבחור לקוח/מפעיל להמשך
                  </p>
                )}
              </div>
            )}

            {/* Cascading Step 3: Select Product Type (Shown only after Operator is selected for 'טיפול בתקלה') */}
            {activityType === 'טיפול בתקלה' && selectedOperator && (
              <div className="fade-in border-t pt-4" style={{ borderColor: 'rgba(255,255,255,0.05)' }}>
                <label className="block text-sm font-semibold mb-2" style={{ color: 'var(--primary)' }}>
                  שלב 3: איזה סוג מוצר?
                </label>
                <button
                  onClick={() => setShowDrawer(true)}
                  className="w-full text-right flex items-center justify-between px-4 py-3 rounded-xl transition-all"
                  style={{
                    border: `2px solid ${selectedEquip ? 'var(--primary)' : 'var(--warning)'}`,
                    background: selectedEquip ? 'rgba(59,130,246,0.08)' : 'rgba(245,158,11,0.02)',
                  }}
                >
                  <ChevronDown size={16} style={{ color: 'var(--muted)', flexShrink: 0 }} />
                  <span style={{ color: selectedEquip ? 'var(--text)' : 'var(--muted)', fontSize: '0.9rem' }}>
                    {selectedEquipName ?? '-- בחר סוג מוצר --'}
                  </span>
                </button>
                {!selectedEquip && (
                  <p className="text-xs mt-1.5 flex items-center gap-1" style={{ color: 'var(--warning)' }}>
                    <span>⚠️</span> נא לבחור את סוג המוצר לטיפול
                  </p>
                )}
              </div>
            )}

            {/* Location (optional) */}
            <div className="border-t pt-4" style={{ borderColor: 'rgba(255,255,255,0.05)' }}>
              <label className="block text-xs mb-1.5 flex items-center gap-1" style={{ color: 'var(--muted)' }}>
                <MapPin size={13} /> מיקום פעילות (אופציונלי)
              </label>
              <input
                className="input text-sm"
                placeholder="מיקום, קו, עמדה..."
                value={location}
                onChange={e => setLocation(e.target.value)}
              />
            </div>

            <button
              className="btn btn-success w-full justify-center text-sm py-3 rounded-xl font-bold mt-2"
              onClick={startTimer}
              disabled={loading || (activityType === 'טיפול בתקלה' && (!selectedOperator || !selectedEquip))}
            >
              <Play size={18} />
              {loading ? 'מפעיל...' : 'התחל עבודה'}
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
          equipment={equipList.filter(e => {
            const ids = e.operator_ids ? e.operator_ids.split(',').map(Number) : [];
            if (ids.length === 0) return true;
            return selectedOperator ? ids.includes(selectedOperator) : false;
          })}
          selected={selectedEquip}
          onSelect={setSelectedEquip}
          onClose={() => setShowDrawer(false)}
        />
      )}
      {/* Dynamic Keyframes Style */}
      <style dangerouslySetInnerHTML={{ __html: `
        @keyframes pulse-border {
          from { box-shadow: 0 0 4px rgba(245, 158, 11, 0.4); border-color: var(--warning); }
          to { box-shadow: 0 0 12px rgba(245, 158, 11, 0.8); border-color: #f59e0b; }
        }
      `}} />
    </>
  );
}
