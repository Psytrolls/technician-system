'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Sidebar from '@/components/Sidebar';
import { api, getUser } from '@/lib/api';
import { PlusCircle, Pencil, Trash2, X, BarChart2 } from 'lucide-react';

const EMPTY_FORM = { name: '', category: '', description: '' };

export default function EquipmentPage() {
  const router = useRouter();
  const user = getUser();

  const [equipment, setEquipment] = useState<any[]>([]);
  const [stats, setStats]         = useState<any[]>([]);
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
      const [eq, st] = await Promise.all([
        api.equipment.list(false),   // all, including inactive
        api.equipment.stats(),
      ]);
      setEquipment(eq);
      setStats(st);
    } catch {}
    finally { setLoading(false); }
  }

  function openCreate() {
    setForm(EMPTY_FORM);
    setEditing(null);
    setError('');
    setModal('create');
  }
  function openEdit(eq: any) {
    setForm({ name: eq.name, category: eq.category || '', description: eq.description || '' });
    setEditing(eq);
    setError('');
    setModal('edit');
  }

  async function handleSave() {
    if (!form.name.trim()) { setError('שם נדרש'); return; }
    setSaving(true); setError('');
    try {
      if (modal === 'create') {
        await api.equipment.create(form);
      } else {
        await api.equipment.update(editing.id, form);
      }
      setModal(null);
      loadData();
    } catch (err: any) {
      setError(err.message);
    } finally { setSaving(false); }
  }

  async function handleToggle(eq: any) {
    await api.equipment.update(eq.id, { active: !eq.active });
    loadData();
  }

  // Group by category
  const byCategory: Record<string, any[]> = {};
  equipment.forEach(eq => {
    const cat = eq.category || 'כללי';
    if (!byCategory[cat]) byCategory[cat] = [];
    byCategory[cat].push(eq);
  });

  const statsMap: Record<string, any> = {};
  stats.forEach(s => { statsMap[s.name] = s; });

  return (
    <div className="layout">
      <Sidebar />
      <main className="main">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold">ניהול סוגי מוצר</h1>
            <p className="text-sm mt-1" style={{ color: 'var(--muted)' }}>
              רשימת הציוד שהטכנאים יכולים לבחור בזמן עבודה
            </p>
          </div>
          <button className="btn btn-primary" onClick={openCreate}>
            <PlusCircle size={18} /> סוג מוצר חדש
          </button>
        </div>

        {/* Stats */}
        {stats.length > 0 && (
          <div className="card mb-6">
            <h2 className="font-bold mb-4 flex items-center gap-2">
              <BarChart2 size={18} /> סוגי מוצר בשימוש גבוה
            </h2>
            <div className="flex flex-wrap gap-3">
              {stats.slice(0, 6).map((s: any) => (
                <div
                  key={s.name}
                  className="px-4 py-3 rounded-xl text-sm"
                  style={{ background: 'rgba(59,130,246,0.08)', border: '1px solid rgba(59,130,246,0.2)' }}
                >
                  <div className="font-semibold">{s.name}</div>
                  <div style={{ color: 'var(--muted)', fontSize: '0.78rem', marginTop: 2 }}>
                    {s.service_count} טיפולים · {s.total_hours}ש'
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Equipment list by category */}
        {loading ? (
          <div className="text-center py-12" style={{ color: 'var(--muted)' }}>טוען...</div>
        ) : (
          Object.entries(byCategory).sort().map(([cat, items]) => (
            <div key={cat} className="card mb-4">
              <h3 className="font-bold text-sm mb-3" style={{ color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: 1 }}>
                {cat}
              </h3>
              <div className="table-wrapper">
                <table>
                  <thead>
                    <tr>
                      <th>שם</th>
                      <th>תיאור</th>
                      <th>טיפולים</th>
                      <th>שעות</th>
                      <th>סטטוס</th>
                      <th></th>
                    </tr>
                  </thead>
                  <tbody>
                    {items.map((eq: any) => {
                      const s = statsMap[eq.name];
                      return (
                        <tr key={eq.id} style={{ opacity: eq.active ? 1 : 0.5 }}>
                          <td className="font-medium">{eq.name}</td>
                          <td className="text-sm" style={{ color: 'var(--muted)' }}>{eq.description || '—'}</td>
                          <td>{s?.service_count || 0}</td>
                          <td>{s?.total_hours || 0}ש'</td>
                          <td>
                            <span className={`badge ${eq.active ? 'badge-green' : 'badge-gray'}`}>
                              {eq.active ? 'פעיל' : 'מושבת'}
                            </span>
                          </td>
                          <td>
                            <div className="flex gap-1">
                              <button className="btn btn-ghost p-2" onClick={() => openEdit(eq)}>
                                <Pencil size={15} />
                              </button>
                              <button
                                className={`btn p-2 ${eq.active ? 'btn-danger' : 'btn-success'}`}
                                onClick={() => handleToggle(eq)}
                                title={eq.active ? 'הסר מהרשימה' : 'החזר לרשימה'}
                              >
                                <Trash2 size={15} />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          ))
        )}

        {!loading && equipment.length === 0 && (
          <div className="card text-center py-12" style={{ color: 'var(--muted)' }}>
            אין סוגי מוצר ברשימה — לחץ על "סוג מוצר חדש" להוספה
          </div>
        )}
      </main>

      {/* Modal */}
      {modal && (
        <div className="modal-overlay" onClick={e => { if (e.target === e.currentTarget) setModal(null); }}>
          <div className="modal">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-lg font-bold">{modal === 'create' ? 'סוג מוצר חדש' : 'עריכת סוג מוצר'}</h2>
              <button onClick={() => setModal(null)} className="btn btn-ghost p-2"><X size={18} /></button>
            </div>
            <div className="flex flex-col gap-4">
              <div>
                <label className="block text-sm font-medium mb-1">שם סוג המוצר *</label>
                <input className="input" value={form.name}
                  onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                  placeholder="למשל: מזגן, מחשב נייד..." />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">קטגוריה</label>
                <input className="input" value={form.category}
                  onChange={e => setForm(f => ({ ...f, category: e.target.value }))}
                  placeholder="למשל: מיזוג אוויר, מחשבים, חשמל..." />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">תיאור</label>
                <input className="input" value={form.description}
                  onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                  placeholder="תיאור קצר (אופציונלי)" />
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
