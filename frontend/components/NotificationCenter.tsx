'use client';
import { useState, useEffect, useRef } from 'react';
import { api } from '@/lib/api';
import { Bell, X, Check, ClipboardList, Info, AlertTriangle } from 'lucide-react';

export default function NotificationCenter() {
  const [unread, setUnread] = useState<any[]>([]);
  const [recent, setRecent] = useState<any[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Fetch initial notifications
    fetchNotifications();

    // Start polling every 12 seconds
    const interval = setInterval(fetchNotifications, 12000);

    // Event listener for click outside to close dropdown
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);

    return () => {
      clearInterval(interval);
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  async function fetchNotifications() {
    try {
      const data = await api.notifications.list();
      setUnread(data.unread || []);
      setRecent(data.recent || []);
    } catch (err) {
      console.error('Failed to fetch notifications:', err);
    }
  }

  async function handleMarkAllRead() {
    try {
      await api.notifications.readAll();
      setUnread([]);
      // Mark all read in recent as well
      setRecent(prev => prev.map(n => ({ ...n, is_read: 1 })));
    } catch (err) {
      console.error('Failed to mark all as read:', err);
    }
  }

  async function handleNotificationClick(n: any) {
    if (n.is_read === 0) {
      try {
        await api.notifications.read(n.id);
        // Remove from unread
        setUnread(prev => prev.filter(item => item.id !== n.id));
        // Mark as read in recent
        setRecent(prev => prev.map(item => item.id === n.id ? { ...item, is_read: 1 } : item));
      } catch (err) {
        console.error('Failed to mark notification as read:', err);
      }
    }
    // Close dropdown
    setIsOpen(false);

    // Optionally redirect or scroll to task
    if (n.related_id) {
      // In this app we can trigger events or just rely on manual navigation since we are already on tasks list
      // But just letting them know is perfect!
    }
  }

  function getNotificationIcon(type: string) {
    switch (type) {
      case 'task_assigned':
        return <ClipboardList size={16} style={{ color: '#3b82f6' }} />;
      case 'work_started':
        return <Info size={16} style={{ color: '#f59e0b' }} />;
      case 'work_completed':
        return <Check size={16} style={{ color: '#22c55e' }} />;
      default:
        return <Bell size={16} style={{ color: '#a4a3b8' }} />;
    }
  }

  return (
    <div style={{ position: 'relative' }} ref={dropdownRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="nav-item"
        style={{
          width: '100%',
          justifyContent: 'space-between',
          background: isOpen ? 'rgba(255, 255, 255, 0.04)' : 'transparent',
          border: 'none',
          cursor: 'pointer',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
            <Bell size={18} />
            {unread.length > 0 && (
              <span
                style={{
                  position: 'absolute',
                  top: -5,
                  right: -5,
                  background: '#ef4444',
                  color: 'white',
                  fontSize: '0.65rem',
                  fontWeight: 'bold',
                  borderRadius: '999px',
                  width: 15,
                  height: 15,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  boxShadow: '0 0 8px rgba(239, 68, 68, 0.6)',
                  animation: 'pulse 1.8s infinite',
                }}
              >
                {unread.length}
              </span>
            )}
          </div>
          <span>התראות</span>
        </div>
      </button>

      {isOpen && (
        <div
          style={{
            position: 'absolute',
            bottom: '100%',
            right: 0,
            width: 320,
            background: '#151f32',
            border: '1px solid #2d3b55',
            borderRadius: 14,
            boxShadow: '0 12px 30px rgba(0, 0, 0, 0.4)',
            zIndex: 999,
            marginBottom: 10,
            overflow: 'hidden',
            animation: 'fadeInUp 0.2s ease-out',
            textAlign: 'right',
          }}
        >
          {/* Header */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '12px 16px',
              borderBottom: '1px solid #2d3b55',
              background: 'rgba(255, 255, 255, 0.01)',
            }}
          >
            <span style={{ fontWeight: 'bold', fontSize: '0.88rem' }}>התראות מערכת</span>
            {unread.length > 0 && (
              <button
                onClick={handleMarkAllRead}
                style={{
                  background: 'none',
                  border: 'none',
                  color: 'var(--primary)',
                  fontSize: '0.75rem',
                  cursor: 'pointer',
                  padding: 0,
                }}
              >
                סמן הכל כנקרא
              </button>
            )}
          </div>

          {/* List */}
          <div style={{ maxHeight: 280, overflowY: 'auto' }}>
            {recent.length === 0 ? (
              <div style={{ padding: '24px 16px', textAlign: 'center', color: 'var(--muted)', fontSize: '0.8rem' }}>
                אין התראות חדשות
              </div>
            ) : (
              recent.map((n: any) => (
                <div
                  key={n.id}
                  onClick={() => handleNotificationClick(n)}
                  style={{
                    display: 'flex',
                    gap: 12,
                    padding: '12px 16px',
                    borderBottom: '1px solid #2d3b55',
                    cursor: 'pointer',
                    background: n.is_read === 0 ? 'rgba(59, 130, 246, 0.05)' : 'transparent',
                    transition: 'background 0.15s',
                  }}
                  onMouseEnter={e => { if (n.is_read !== 0) e.currentTarget.style.background = 'rgba(255, 255, 255, 0.02)'; }}
                  onMouseLeave={e => { if (n.is_read !== 0) e.currentTarget.style.background = 'transparent'; }}
                >
                  <div style={{ marginTop: 2, flexShrink: 0 }}>
                    {getNotificationIcon(n.type)}
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: '0.82rem', fontWeight: n.is_read === 0 ? 'bold' : 'normal' }}>
                      {n.title}
                    </div>
                    <div style={{ fontSize: '0.76rem', color: 'var(--muted)', marginTop: 2, lineHeight: '1.25' }}>
                      {n.message}
                    </div>
                    <div style={{ fontSize: '0.65rem', color: '#64748b', marginTop: 4 }}>
                      {new Date(n.created_at).toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' })}
                    </div>
                  </div>
                  {n.is_read === 0 && (
                    <span
                      style={{
                        width: 6,
                        height: 6,
                        borderRadius: '50%',
                        background: '#3b82f6',
                        alignSelf: 'center',
                        flexShrink: 0,
                      }}
                    />
                  )}
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
