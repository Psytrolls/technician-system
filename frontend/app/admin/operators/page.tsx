'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Sidebar from '@/components/Sidebar';
import { api, getUser } from '@/lib/api';
import { PlusCircle, Pencil, Trash2, X, Briefcase } from 'lucide-react';

const EMPTY_FORM = { name: '' };

export default function OperatorsPage() {
  const router = useRouter();
  const user = getUser();

  const [operators, setOperators] = useState<any[]>([]);
  const [loading, setLoading]     = useState(true);
  const [modal, setModal]         = useState<'create' | 'edit' | null>(null);
  const [editing, setEditing]     = useState<any>(null);
  const [form, setForm]           = useState(EMPTY_FORM);
  const [saving, setSaving]       = useState(false);
  const [error, setError]         = useState('');

  useEffect(() => {
    if (!user) { router.push('/login'); return; }
    if (user.role !== 'admin') { router.push('/tech'); return; }
    loadData();
  }, []);

  async function loadData() {
    setLoading(true);
    try {
      const ops = await api.operators.list(false);   // all, including inactive
      setOperators(ops);
    } catch {}
    finally { setLoading(false); }
  }

  function openCreate() {
    setForm(EMPTY_FORM);
    setEditing(null);
    setError('');
    setModal('create');
  }
  function openEdit(op: any) {
    setForm({ name: op.name });
    setEditing(op);
    setError('');
    setModal('edit');
  }

  async function handleSave() {
    if (!form.name.trim()) { setError('שם מפעיל נדרש'); return; }
    setSaving(true); setError('');
    try {
      if (modal === 'create') {
        await api.operators.create(form);
      } else {
        await api.operators.update(editing.id, form);
      }
      setModal(null);
      loadData();
    } catch (err: any) {
      setError(err.message);
    } finally { setSaving(false); }
  }

  async function handleToggle(op: any) {
    await api.operators.update(op.id, { active: !op.active });
    loadData();
  }

  return (
    <div className="layout">
      <Sidebar />
      <main className="main">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold">ניהול לקוחות / מפעילים</h1>
            <p className="text-sm mt-1" style={{ color: 'var(--muted)' }}>
              רשימת הלקוחות והמפעילים שהטכנאים נותנים להם שירות
            </p>
          </div>
          <button className="btn btn-primary" onClick={openCreate}>
            <PlusCircle size={18} /> מפעיל חדש
          </button>
        </div>

        {/* Operators list */}
        {loading ? (
          <div className="text-center py-12" style={{ color: 'var(--muted)' }}>טוען...</div>
        ) : (
          <div className="card">
            <div className="table-wrapper">
              <table>
                <thead>
                  <tr>
                    <th>שם</th>
                    <th>תאריך יצירה</th>
                    <th>סטטוס</th>
                    <th>פעולות</th>
                  </tr>
                </thead>
                <tbody>
                  {operators.map((op: any) => (
                    <tr key={op.id} style={{ opacity: op.active ? 1 : 0.5 }}>
                      <td className="font-medium flex items-center gap-2">
                        <Briefcase size={16} className="text-blue-500" />
                        {op.name}
                      </td>
                      <td className="text-sm" style={{ color: 'var(--muted)' }}>
                        {op.created_at ? new Date(op.created_at).toLocaleDateString('he-IL') : '—'}
                      </td>
                      <td>
                        <span className={`badge ${op.active ? 'badge-green' : 'badge-gray'}`}>
                          {op.active ? 'פעיל' : 'מושבת'}
                        </span>
                      </td>
                      <td>
                        <div className="flex gap-1">
                          <button className="btn btn-ghost p-2" onClick={() => openEdit(op)}>
                            <Pencil size={15} />
                          </button>
                          <button
                            className={`btn p-2 ${op.active ? 'btn-danger' : 'btn-success'}`}
                            onClick={() => handleToggle(op)}
                            title={op.active ? 'השבת מפעיל' : 'הפעל מפעיל'}
                          >
                            <Trash2 size={15} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {!loading && operators.length === 0 && (
          <div className="card text-center py-12" style={{ color: 'var(--muted)' }}>
            אין לקוחות / מפעילים ברשימה — לחץ על "מפעיל חדש" להוספה
          </div>
        )}
      </main>

      {/* Modal */}
      {modal && (
        <div className="modal-overlay" onClick={e => { if (e.target === e.currentTarget) setModal(null); }}>
          <div className="modal">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-lg font-bold">{modal === 'create' ? 'מפעיל חדש' : 'עריכת מפעיל'}</h2>
              <button onClick={() => setModal(null)} className="btn btn-ghost p-2"><X size={18} /></button>
            </div>
            <div className="flex flex-col gap-4">
              <div>
                <label className="block text-sm font-medium mb-1">שם הלקוח / מפעיל *</label>
                <input className="input" value={form.name}
                  onChange={e => setForm({ name: e.target.value })}
                  placeholder="למשל: חברת אלפא, חברת בטא..." />
              </div>
              {error && (
                <div className="text-sm py-2 px-4 rounded-lg" style={{ background: '#7f1d1d', color: '#fca5a5' }}>
                  {error}
                </div>
              )}
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
