'use client';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { getUser, logout } from '@/lib/api';
import { LayoutDashboard, ClipboardList, Users, BarChart3, LogOut, Wrench, Clock, Settings, Briefcase, Activity, CheckSquare } from 'lucide-react';

import NotificationCenter from './NotificationCenter';

const adminLinks = [
  { href: '/admin',                     label: 'דאשבורד',         icon: LayoutDashboard },
  { href: '/admin/tasks',               label: 'משימות',          icon: ClipboardList },
  { href: '/admin/users',               label: 'משתמשים',         icon: Users },
  { href: '/admin/equipment',           label: 'סוג מוצר',        icon: Wrench },
  { href: '/admin/operators',           label: 'לקוחות / מפעילים', icon: Briefcase },
  { href: '/admin/reports',             label: 'דוחות',           icon: BarChart3 },
  { href: '/admin/tracker',             label: 'מעקב טכנאים',      icon: Activity },
  { href: '/admin/validator-checks',    label: 'בדיקת וולידטורים', icon: CheckSquare },
];

const techLinks = [
  { href: '/tech',                      label: 'עבודה שלי',        icon: Wrench },
  { href: '/tech/logs',                 label: 'היסטוריה',         icon: Clock },
  { href: '/tech/validator-checks',     label: 'בדיקת וולידטורים', icon: CheckSquare },
];

export default function Sidebar() {
  const pathname = usePathname();
  const user = getUser();
  const links = user?.role === 'admin' ? adminLinks : techLinks;

  return (
    <aside className="sidebar">
      {/* Logo */}
      <div className="flex items-center gap-2 mb-4 px-2">
        <img src="/logo.png" alt="Logo" className="w-20 h-8 object-contain" />
        <div>
          <div className="font-bold text-sm">מערכת טכנאים</div>
          <div className="text-xs" style={{ color: 'var(--muted)' }}>
            {user?.role === 'admin' ? 'מנהל' : 'טכנאי'}
          </div>
        </div>
      </div>

      {/* User */}
      <div className="px-2 py-3 mb-2 rounded-xl" style={{ background: 'rgba(59,130,246,0.1)' }}>
        <div className="text-sm font-semibold">{user?.name}</div>
        <div className="text-xs" style={{ color: 'var(--muted)' }}>@{user?.username}</div>
      </div>

      {/* Links */}
      <nav className="flex flex-col gap-1 flex-1">
        {links.map(({ href, label, icon: Icon }) => (
          <Link
            key={href}
            href={href}
            className={`nav-item ${pathname === href ? 'active' : ''}`}
          >
            <Icon size={18} />
            {label}
          </Link>
        ))}
      </nav>

      {/* Notifications */}
      <div className="mb-2">
        <NotificationCenter />
      </div>

      {/* Logout */}
      <button onClick={logout} className="nav-item w-full text-right" style={{ color: 'var(--danger)' }}>
        <LogOut size={18} />
        יציאה
      </button>

      {/* Footer */}
      <div className="mt-3 pt-3 text-center" style={{ borderTop: '1px solid var(--border)' }}>
        <div className="text-xs" style={{ color: 'var(--muted)', lineHeight: 1.6 }}>
          פותח על ידי
        </div>
        <div className="text-xs font-semibold" style={{ color: 'var(--muted)' }}>
          יבגני קבישר
        </div>
      </div>
    </aside>
  );
}
