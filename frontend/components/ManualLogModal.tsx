'use client';
import { useState, useEffect, useRef } from 'react';
import { api } from '@/lib/api';
import { X, Wrench, ChevronDown } from 'lucide-react';
import EquipmentDrawer from './EquipmentDrawer';

const ACTIVITY_TYPES = ['נסיעה', 'טיפול בתקלה', 'התקנה', 'תחזוקה', 'בדיקה', 'הפסקה', 'אחר'];

// Activity types that require equipment selection
const EQUIPMENT_ACTIVITIES = new Set(['טיפול בתקלה', 'התקנה', 'תחזוקה', 'בדיקה', 'אחר']);

interface Props {
  tasks: any[];
  onClose: () => void;
  onSaved: () => void;
}

export default function ManualLogModal({ tasks, onClose, onSaved }: Props) {
  const [form, setForm] = useState({
    activity_type: ACTIVITY_TYPES[0],
    task_id: '',
    start_time: '',
    end_time: '',
    location: '',
    notes: '',
    edit_reason: 'שכחתי להפעיל טיימר',
  });
  const [customActivity, setCustomActivity] = useState('');
  const [equipList, setEquipList]           = useState<any[]>([]);
  const [selectedEquip, setSelectedEquip]   = useState<number | null>(null);
  const [operatorList, setOperatorList]     = useState<any[]>([]);
  const [selectedOperator, setSelectedOperator] = useState<number | null>(null);
  const [showDrawer, setShowDrawer]         = useState(false);
  const [error, setError]   = useState('');
  const [loading, setLoading] = useState(false);
  const operatorSelectRef   = useRef<HTMLSelectElement>(null);

  useEffect(() => {
    api.equipment.list().then(setEquipList).catch(() => {});
    api.operators.list().then(setOperatorList).catch(() => {});
  }, []);

  // Pre-fill operator when task is selected
  useEffect(() => {
    if (form.task_id) {
      const task = tasks.find(t => t.id === parseInt(form.task_id));
      if (task?.operator_id) {
        setSelectedOperator(task.operator_id);
      }
    }
  }, [form.task_id, tasks]);

  function set(key: string, val: string) {
    setForm(f => ({ ...f, [key]: val }));
  }

  const resolvedActivity = form.activity_type === 'אחר' && customActivity.trim()
    ? `אחר: ${customActivity.trim()}`
    : form.activity_type;

  const showEquip = EQUIPMENT_ACTIVITIES.has(form.activity_type);
  const selectedEquipName = equipList.find(e => e.id === selectedEquip)?.name;

  async function handleSave() {
    if (!form.start_time || !form.end_time) {
      setError('שעת התחלה וסיום נדרשות');
      return;
    }
    if (new Date(form.end_time) <= new Date(form.start_time)) {
      setError('שעת הסיום חייבת להיות אחרי שעת ההתחלה');
      return;
    }
    if (form.activity_type === 'אחר' && !customActivity.trim()) {
      setError('אנא פרט את סוג הפעילות');
      return;
    }
    setError('');
    setLoading(true);
    try {
      await api.timelogs.start({
        activity_type: resolvedActivity,
        task_id: form.task_id ? parseInt(form.task_id) : undefined,
        equipment_id: showEquip ? (selectedEquip ?? undefined) : undefined,
        operator_id: selectedOperator ?? undefined,
        start_time: form.start_time,
        end_time: form.end_time,
        location: form.location || undefined,
        notes: form.notes || undefined,
        is_manual: true,
      });
      onSaved();
      onClose();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <div className="modal-overlay" onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
        <div className="modal">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-lg font-bold">מילוי ידני</h2>
            <button onClick={onClose} className="btn btn-ghost p-2"><X size={18} /></button>
          </div>

          <div className="flex flex-col gap-4">

            {/* Activity type */}
            <div>
              <label className="block text-sm font-medium mb-1">סוג פעילות *</label>
              <select
                className="input"
                value={form.activity_type}
                onChange={e => {
                  const val = e.target.value;
                  set('activity_type', val);
                  setCustomActivity('');
                  setSelectedEquip(null);
                  if (val === 'טיפול בתקלה') {
                    setTimeout(() => {
                      operatorSelectRef.current?.focus();
                    }, 100);
                  }
                }}
              >
                {ACTIVITY_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
              {form.activity_type === 'אחר' && (
                <input
                  className="input mt-2"
                  placeholder="פרט את סוג הפעילות..."
                  value={customActivity}
                  onChange={e => setCustomActivity(e.target.value)}
                  autoFocus
                />
              )}
            </div>

            {/* Equipment picker — shown for repair/service activities */}
            {showEquip && (
              <div>
                <label className="block text-sm font-medium mb-1 flex items-center gap-1">
                  <Wrench size={14} /> סוג מוצר
                </label>
                <button
                  type="button"
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
            )}

            {/* Task */}
            <div>
              <label className="block text-sm font-medium mb-1">משימה</label>
              <select className="input" value={form.task_id} onChange={e => set('task_id', e.target.value)}>
                <option value="">ללא משימה</option>
                {tasks.map((t: any) => <option key={t.id} value={t.id}>{t.title}</option>)}
              </select>
            </div>

            {/* Operator select */}
            <div>
              <label className="block text-sm font-medium mb-1">לקוח / מפעיל</label>
              <select
                ref={operatorSelectRef}
                className="input select-custom"
                value={selectedOperator ?? ''}
                onChange={e => setSelectedOperator(e.target.value ? parseInt(e.target.value) : null)}
                style={{
                  border: form.activity_type === 'טיפול בתקלה' && !selectedOperator 
                    ? '2px dashed var(--warning)' 
                    : '1px solid var(--border)',
                  animation: form.activity_type === 'טיפול בתקלה' && !selectedOperator 
                    ? 'pulse-border 1.5s infinite alternate' 
                    : 'none',
                  transition: 'all 0.3s ease'
                }}
              >
                <option value="">בחר לקוח / מפעיל...</option>
                {operatorList.map(op => (
                  <option key={op.id} value={op.id}>{op.name}</option>
                ))}
              </select>
            </div>

            {/* Times */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium mb-1">שעת התחלה *</label>
                <input
                  type="datetime-local" className="input"
                  value={form.start_time}
                  onChange={e => set('start_time', e.target.value)}
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">שעת סיום *</label>
                <input
                  type="datetime-local" className="input"
                  value={form.end_time}
                  onChange={e => set('end_time', e.target.value)}
                />
              </div>
            </div>

            {/* Location */}
            <div>
              <label className="block text-sm font-medium mb-1">מיקום</label>
              <input
                className="input" placeholder="מיקום העבודה"
                value={form.location}
                onChange={e => set('location', e.target.value)}
              />
            </div>

            {/* Notes */}
            <div>
              <label className="block text-sm font-medium mb-1">הערות</label>
              <textarea
                className="input" rows={2} placeholder="הוסף הערות..."
                value={form.notes}
                onChange={e => set('notes', e.target.value)}
              />
            </div>

            {/* Manual reason */}
            <div>
              <label className="block text-sm font-medium mb-1">סיבת הוספה ידנית *</label>
              <input
                className="input" placeholder="למשל: שכחתי להפעיל טיימר"
                value={form.edit_reason}
                onChange={e => set('edit_reason', e.target.value)}
              />
            </div>

            {error && (
              <div className="text-sm py-2 px-4 rounded-lg" style={{ background: '#7f1d1d', color: '#fca5a5' }}>
                {error}
              </div>
            )}

            <div className="flex gap-3 mt-2">
              <button className="btn btn-primary flex-1 justify-center" onClick={handleSave} disabled={loading}>
                {loading ? 'שומר...' : 'שמור לוג'}
              </button>
              <button className="btn btn-ghost flex-1 justify-center" onClick={onClose}>
                ביטול
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Equipment wheel drawer — renders above modal */}
      {showDrawer && (
        <EquipmentDrawer
          equipment={equipList}
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
