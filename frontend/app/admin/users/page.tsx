'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Sidebar from '@/components/Sidebar';
import { api, getUser } from '@/lib/api';
import { PlusCircle, Pencil, X, UserCheck, UserX } from 'lucide-react';

const EMPTY_FORM = { name: '', username: '', password: '', role: 'technician' };

export default function UsersPage() {
  const router = useRouter();
  const user = getUser();
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState<'create' | 'edit' | null>(null);
  const [editingUser, setEditingUser] = useState<any>(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!user) { router.push('/login'); return; }
    if (user.role !== 'admin') { router.push('/tech'); return; }
    loadData();
  }, []);

  async function loadData() {
    setLoading(true);
    try { setUsers(await api.users.list()); }
    catch {} finally { setLoading(false); }
  }

  function openCreate() {
    setForm(EMPTY_FORM);
    setEditingUser(null);
    setError('');
    setModal('create');
  }

  function openEdit(u: any) {
    setForm({ name: u.name, username: u.username, password: '', role: u.role });
    setEditingUser(u);
    setError('');
    setModal('edit');
  }

  async function handleSave() {
    if (!form.name || !form.username) { setError('שם ושם משתמש נדרשים'); return; }
    if (modal === 'create' && !form.password) { setError('סיסמה נדרשת'); return; }
    setSaving(true); setError('');
    try {
      const data: any = { name: form.name, username: form.username, role: form.role };
      if (form.password) data.password = form.password;
      if (modal === 'create') {
        await api.users.create(data);
      } else {
        await api.users.update(editingUser.id, data);
      }
      setModal(null);
      loadData();
    } catch (err: any) {
      setError(err.message);
    } finally { setSaving(false); }
  }

  async function toggleActive(u: any) {
    await api.users.update(u.id, { active: !u.active });
    loadData();
  }

  return (
    <div className="layout">
      <Sidebar />
      <main className="main">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-bold">ניהול משתמשים</h1>
          <button className="btn btn-primary" onClick={openCreate}>
            <PlusCircle size={18} /> משתמש חדש
          </button>
        </div>

        <div className="card">
          {loading ? (
            <div className="text-center py-12" style={{ color: 'var(--muted)' }}>טוען...</div>
          ) : (
            <div className="table-wrapper">
              <table>
                <thead>
                  <tr>
                    <th>שם</th>
                    <th>שם משתמש</th>
                    <th>תפקיד</th>
                    <th>סטטוס</th>
                    <th>נוצר</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {users.map((u: any) => (
                    <tr key={u.id}>
                      <td className="font-medium">{u.name}</td>
                      <td style={{ color: 'var(--muted)' }}>@{u.username}</td>
                      <td>
                        <span className={`badge ${u.role === 'admin' ? 'badge-blue' : 'badge-gray'}`}>
                          {u.role === 'admin' ? 'מנהל' : 'טכנאי'}
                        </span>
                      </td>
                      <td>
                        <span className={`badge ${u.active ? 'badge-green' : 'badge-red'}`}>
                          {u.active ? 'פעיל' : 'מושבת'}
                        </span>
                      </td>
                      <td className="text-sm" style={{ color: 'var(--muted)' }}>
                        {new Date(u.created_at).toLocaleDateString('he-IL')}
                      </td>
                      <td>
                        <div className="flex gap-1">
                          <button className="btn btn-ghost p-2" onClick={() => openEdit(u)}>
                            <Pencil size={15} />
                          </button>
                          {u.id !== user?.id && (
                            <button
                              className={`btn p-2 ${u.active ? 'btn-danger' : 'btn-success'}`}
                              onClick={() => toggleActive(u)}
                              title={u.active ? 'השבת' : 'הפעל'}
                            >
                              {u.active ? <UserX size={15} /> : <UserCheck size={15} />}
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </main>

      {modal && (
        <div className="modal-overlay" onClick={e => { if (e.target === e.currentTarget) setModal(null); }}>
          <div className="modal">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-lg font-bold">{modal === 'create' ? 'משתמש חדש' : 'עריכת משתמש'}</h2>
              <button onClick={() => setModal(null)} className="btn btn-ghost p-2"><X size={18} /></button>
            </div>
            <div className="flex flex-col gap-4">
              <div>
                <label className="block text-sm font-medium mb-1">שם מלא *</label>
                <input className="input" value={form.name} onChange={e => setForm(f => ({...f, name: e.target.value}))} placeholder="שם ושם משפחה" />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">שם משתמש *</label>
                <input className="input" value={form.username} onChange={e => setForm(f => ({...f, username: e.target.value}))} placeholder="username" dir="ltr" />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">סיסמה {modal === 'edit' && '(השאר ריק אם אין שינוי)'}</label>
                <input className="input" type="password" value={form.password} onChange={e => setForm(f => ({...f, password: e.target.value}))} placeholder="••••••••" />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">תפקיד</label>
                <select className="input" value={form.role} onChange={e => setForm(f => ({...f, role: e.target.value}))}>
                  <option value="technician">טכנאי</option>
                  <option value="admin">מנהל</option>
                </select>
              </div>

              {error && <div className="text-sm py-2 px-4 rounded-lg" style={{ background: '#7f1d1d', color: '#fca5a5' }}>{error}</div>}

              <div className="flex gap-3 mt-2">
                <button className="btn btn-primary flex-1 justify-center" onClick={handleSave} disabled={saving}>
                  {saving ? 'שומר...' : 'שמור'}
                </button>
                <button className="btn btn-ghost flex-1 justify-center" onClick={() => setModal(null)}>ביטול</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
