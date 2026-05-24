'use client';
import { useState, useEffect } from 'react';
import { api } from '@/lib/api';
import { 
  Plus, User, Truck, Wrench, Info, CheckCircle2, XCircle, Edit, Clock 
} from 'lucide-react';

interface TaskTimelineProps {
  taskId: number;
}

export default function TaskTimeline({ taskId }: TaskTimelineProps) {
  const [history, setHistory] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (taskId) {
      loadHistory();
    }
  }, [taskId]);

  async function loadHistory() {
    setLoading(true);
    try {
      const data = await api.tasks.history(taskId);
      setHistory(data || []);
    } catch (err) {
      console.error('Failed to load task history:', err);
    } finally {
      setLoading(false);
    }
  }

  function getEventStyles(action: string) {
    switch (action) {
      case 'created':
        return { icon: <Plus size={14} />, color: '#3b82f6', bg: 'rgba(59,130,246,0.1)' };
      case 'assigned':
        return { icon: <User size={14} />, color: '#8b5cf6', bg: 'rgba(139,92,246,0.1)' };
      case 'started_travel':
        return { icon: <Truck size={14} />, color: '#f59e0b', bg: 'rgba(245,158,11,0.1)' };
      case 'started_work':
        return { icon: <Wrench size={14} />, color: '#eab308', bg: 'rgba(234,179,8,0.1)' };
      case 'status_changed':
        return { icon: <Info size={14} />, color: '#06b6d4', bg: 'rgba(6,182,212,0.1)' };
      case 'completed':
        return { icon: <CheckCircle2 size={14} />, color: '#22c55e', bg: 'rgba(34,197,94,0.1)' };
      case 'cancelled':
        return { icon: <XCircle size={14} />, color: '#ef4444', bg: 'rgba(239,68,68,0.1)' };
      default:
        return { icon: <Edit size={14} />, color: '#94a3b8', bg: 'rgba(148,163,184,0.1)' };
    }
  }

  if (loading) {
    return (
      <div style={{ color: 'var(--muted)', fontSize: '0.82rem', padding: '12px 0' }}>
        טוען היסטוריית פעילות...
      </div>
    );
  }

  if (history.length === 0) {
    return (
      <div style={{ color: 'var(--muted)', fontSize: '0.82rem', padding: '12px 0', textAlign: 'center' }}>
        אין היסטוריית פעילות מוקלטת משימה זו
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 0, padding: '12px 0' }}>
      {history.map((h: any, index: number) => {
        const { icon, color, bg } = getEventStyles(h.action);
        const dateObj = new Date(h.created_at);
        const dateStr = dateObj.toLocaleDateString('he-IL', { day: '2-digit', month: '2-digit' });
        const timeStr = dateObj.toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' });

        return (
          <div key={h.id} style={{ display: 'flex', gap: 16, position: 'relative' }}>
            {/* Timeline connector line */}
            {index < history.length - 1 && (
              <div
                style={{
                  position: 'absolute',
                  top: 26,
                  right: 13,
                  width: 2,
                  bottom: -16,
                  background: '#2d3b55',
                  zIndex: 1,
                }}
              />
            )}

            {/* Icon container */}
            <div
              style={{
                width: 28,
                height: 28,
                borderRadius: '50%',
                background: bg,
                color: color,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                border: `1px solid rgba(${color === '#3b82f6' ? '59,130,246' : '45,59,85'}, 0.25)`,
                zIndex: 2,
                flexShrink: 0,
              }}
            >
              {icon}
            </div>

            {/* Content info */}
            <div style={{ paddingBottom: index < history.length - 1 ? 20 : 8, flex: 1, textAlign: 'right' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 12 }}>
                <span style={{ fontWeight: 600, fontSize: '0.84rem', color: '#f8fafc' }}>
                  {h.details}
                </span>
                <span
                  style={{
                    fontFamily: 'monospace',
                    fontSize: '0.74rem',
                    color: 'var(--muted)',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 4,
                  }}
                  dir="ltr"
                >
                  <Clock size={11} />
                  {dateStr} {timeStr}
                </span>
              </div>
              <div style={{ fontSize: '0.76rem', color: 'var(--muted)', marginTop: 2 }}>
                בוצע על ידי: <span style={{ color: '#e2e8f0' }}>{h.user_name}</span>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
