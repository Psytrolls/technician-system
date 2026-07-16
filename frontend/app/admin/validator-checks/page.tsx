'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Sidebar from '@/components/Sidebar';
import { api, getUser } from '@/lib/api';
import { Plus, Trash2, Eye, Download, ShieldAlert, CreditCard, Activity, CheckCircle, ToggleLeft, ToggleRight } from 'lucide-react';

export default function AdminValidatorChecksPage() {
  const router = useRouter();
  const user = getUser();

  const [activeTab, setActiveTab] = useState<'logs' | 'cards'>('logs');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Dropdown options
  const [operators, setOperators] = useState<any[]>([]);

  // Logs Tab State
  const [checks, setChecks] = useState<any[]>([]);
  const [filterDateFrom, setFilterDateFrom] = useState('');
  const [filterDateTo, setFilterDateTo] = useState('');
  const [filterOperatorId, setFilterOperatorId] = useState('');

  // Cards Tab State
  const [cards, setCards] = useState<any[]>([]);
  const [newCardNumber, setNewCardNumber] = useState('');
  const [newShortNumber, setNewShortNumber] = useState('');
  const [editingCardId, setEditingCardId] = useState<number | null>(null);
  const [editCardNumber, setEditCardNumber] = useState('');
  const [editShortNumber, setEditShortNumber] = useState('');
  const [editCardActive, setEditCardActive] = useState(true);
  const [savingCard, setSavingCard] = useState(false);

  useEffect(() => {
    if (!user) {
      router.push('/login');
      return;
    }
    if (user.role !== 'admin') {
      router.push('/tech');
      return;
    }
    loadInitialData();
  }, []);

  async function loadInitialData() {
    setLoading(true);
    setError('');
    try {
      const [opsList, cardsList] = await Promise.all([
        api.operators.list(),
        api.validatorChecks.listCards()
      ]);
      setOperators(opsList);
      setCards(cardsList);
      await loadChecksData(opsList);
    } catch (err) {
      setError('שגיאה בטעינת נתונים ראשוניים');
    } finally {
      setLoading(false);
    }
  }

  async function loadChecksData(opsList = operators) {
    try {
      const params: Record<string, string> = {};
      if (filterDateFrom) params.date_from = filterDateFrom;
      if (filterDateTo) params.date_to = filterDateTo;
      if (filterOperatorId) params.operator_id = filterOperatorId;

      const checksList = await api.validatorChecks.listChecks(params);
      setChecks(checksList);
    } catch (err) {
      setError('שגיאה בטעינת היסטוריית בדיקות');
    }
  }

  // Reload logs on filter change
  useEffect(() => {
    if (user && user.role === 'admin') {
      loadChecksData();
    }
  }, [filterDateFrom, filterDateTo, filterOperatorId]);

  // Card CRUD actions
  async function handleAddCard(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (!newCardNumber.trim() || !newShortNumber.trim()) {
      setError('יש למלא את כל השדות להוספת כרטיס');
      return;
    }

    if (!/^\d{10}$/.test(newCardNumber.trim())) {
      setError('מספר כרטיס רב קו חייב להכיל בדיוק 10 ספרות');
      return;
    }

    setSavingCard(true);
    try {
      await api.validatorChecks.createCard({
        card_number: newCardNumber.trim(),
        short_number: newShortNumber.trim()
      });
      setNewCardNumber('');
      setNewShortNumber('');
      setSuccess('הכרטיס נוסף בהצלחה!');
      // Reload cards list
      const cardsList = await api.validatorChecks.listCards();
      setCards(cardsList);
    } catch (err: any) {
      setError(err.message || 'שגיאה בהוספת כרטיס');
    } finally {
      setSavingCard(false);
    }
  }

  async function handleUpdateCard(id: number) {
    setError('');
    setSuccess('');

    if (!editCardNumber.trim() || !editShortNumber.trim()) {
      setError('יש למלא את כל השדות לעדכון כרטיס');
      return;
    }

    if (!/^\d{10}$/.test(editCardNumber.trim())) {
      setError('מספר כרטיס רב קו חייב להכיל בדיוק 10 ספרות');
      return;
    }

    setSavingCard(true);
    try {
      await api.validatorChecks.updateCard(id, {
        card_number: editCardNumber.trim(),
        short_number: editShortNumber.trim(),
        active: editCardActive
      });
      setEditingCardId(null);
      setSuccess('הכרטיס עודכן בהצלחה!');
      const cardsList = await api.validatorChecks.listCards();
      setCards(cardsList);
    } catch (err: any) {
      setError(err.message || 'שגיאה בעדכון כרטיס');
    } finally {
      setSavingCard(false);
    }
  }

  async function handleDeleteCard(id: number) {
    if (!confirm('האם אתה בטוח שברצונך למחוק כרטיס זה?')) return;
    setError('');
    setSuccess('');

    try {
      const res = await api.validatorChecks.deleteCard(id);
      setSuccess(res.message || 'הכרטיס נמחק בהצלחה!');
      const cardsList = await api.validatorChecks.listCards();
      setCards(cardsList);
    } catch (err: any) {
      setError(err.message || 'שגיאה במחיקת כרטיס');
    }
  }

  function handleExportExcel() {
    const params: Record<string, string> = {};
    if (filterDateFrom) params.date_from = filterDateFrom;
    if (filterDateTo) params.date_to = filterDateTo;
    if (filterOperatorId) params.operator_id = filterOperatorId;

    const url = api.validatorChecks.exportChecksUrl(params);
    window.open(url, '_blank');
  }

  // Key KPI stats
  const totalChecks = checks.length;
  const uniqueBuses = new Set(checks.map(c => c.bus_number)).size;
  const uniqueCards = new Set(checks.map(c => c.card_short_number)).size;

  if (loading) {
    return (
      <div className="layout">
        <Sidebar />
        <main className="main flex items-center justify-center">
          <div style={{ color: 'var(--muted)' }}>טוען נתונים...</div>
        </main>
      </div>
    );
  }

  return (
    <div className="layout">
      <Sidebar />
      <main className="main">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold">מעקב בדיקות וולידטורים</h1>
            <p style={{ color: 'var(--muted)' }} className="text-sm mt-1">
              נהל כרטיסי רב-קו, צפה בלוגי בדיקות של טכנאים וייצא דוחות
            </p>
          </div>
        </div>

        {/* Tab Selection */}
        <div className="flex gap-2 mb-6" style={{ borderBottom: '1px solid var(--border)', paddingBottom: '10px' }}>
          <button
            onClick={() => { setActiveTab('logs'); setError(''); setSuccess(''); }}
            className={`btn text-sm ${activeTab === 'logs' ? 'btn-primary' : 'btn-ghost'}`}
            style={{ borderRadius: 10, display: 'flex', alignItems: 'center', gap: 6 }}
          >
            <Activity size={16} />
            לוגים ודוחות
          </button>
          <button
            onClick={() => { setActiveTab('cards'); setError(''); setSuccess(''); }}
            className={`btn text-sm ${activeTab === 'cards' ? 'btn-primary' : 'btn-ghost'}`}
            style={{ borderRadius: 10, display: 'flex', alignItems: 'center', gap: 6 }}
          >
            <CreditCard size={16} />
            ניהול כרטיסי רב-קו
          </button>
        </div>

        {error && (
          <div className="mb-4 p-3 rounded-lg text-sm text-red-400" style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)' }}>
            {error}
          </div>
        )}

        {success && (
          <div className="mb-4 p-3 rounded-lg text-sm text-green-400" style={{ background: 'rgba(34,197,94,0.1)', border: '1px solid rgba(34,197,94,0.2)' }}>
            {success}
          </div>
        )}

        {activeTab === 'logs' ? (
          <>
            {/* KPI statistics widgets */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
              <div className="stat-card" style={{ textAlign: 'center' }}>
                <div style={{ color: 'var(--primary)', fontSize: '2rem', fontWeight: 700, lineHeight: 1.1 }}>{totalChecks}</div>
                <div className="stat-label" style={{ marginTop: 4 }}>סה"כ בדיקות שבוצעו</div>
              </div>
              <div className="stat-card" style={{ textAlign: 'center' }}>
                <div style={{ color: 'var(--warning)', fontSize: '2rem', fontWeight: 700, lineHeight: 1.1 }}>{uniqueBuses}</div>
                <div className="stat-label" style={{ marginTop: 4 }}>אוטובוסים ייחודיים שנבדקו</div>
              </div>
              <div className="stat-card" style={{ textAlign: 'center' }}>
                <div style={{ color: 'var(--success)', fontSize: '2rem', fontWeight: 700, lineHeight: 1.1 }}>{uniqueCards}</div>
                <div className="stat-label" style={{ marginTop: 4 }}>כרטיסי רב-קו פעילים בשימוש</div>
              </div>
            </div>

            {/* Filter controls */}
            <div className="card mb-6">
              <div className="flex flex-wrap gap-4 items-end justify-between">
                <div className="flex flex-wrap gap-4 items-end">
                  <div>
                    <label className="block text-sm font-medium mb-1">מפעיל / חברה</label>
                    <select
                      className="input"
                      style={{ width: 'auto', minWidth: '150px' }}
                      value={filterOperatorId}
                      onChange={e => setFilterOperatorId(e.target.value)}
                    >
                      <option value="">כל המפעילים</option>
                      {operators.map((op: any) => (
                        <option key={op.id} value={op.id}>{op.name}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1">מתאריך</label>
                    <input
                      type="date"
                      className="input"
                      style={{ width: 'auto' }}
                      value={filterDateFrom}
                      onChange={e => setFilterDateFrom(e.target.value)}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1">עד תאריך</label>
                    <input
                      type="date"
                      className="input"
                      style={{ width: 'auto' }}
                      value={filterDateTo}
                      onChange={e => setFilterDateTo(e.target.value)}
                    />
                  </div>
                </div>

                <button className="btn btn-success" onClick={handleExportExcel} disabled={checks.length === 0}>
                  <Download size={18} />
                  יצוא Excel
                </button>
              </div>
            </div>

            {/* Table of logs */}
            <div className="card">
              <h2 className="text-lg font-bold mb-4 flex items-center gap-2">
                <Activity size={20} />
                היסטוריית בדיקות
              </h2>

              <div className="table-wrapper">
                <table>
                  <thead>
                    <tr>
                      <th>שם טכנאי</th>
                      <th>מפעיל</th>
                      <th>מספר אוטובוס</th>
                      <th>מספר וולידטור</th>
                      <th>מספר כרטיס</th>
                      <th>מספר רב-קו מלא</th>
                      <th style={{ textAlign: 'center' }}>תאריך ושעת בדיקה</th>
                    </tr>
                  </thead>
                  <tbody>
                    {checks.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="text-center py-8" style={{ color: 'var(--muted)' }}>
                          לא נמצאו בדיקות התואמות את הפילטרים שנבחרו
                        </td>
                      </tr>
                    ) : (
                      checks.map((c: any) => (
                        <tr key={c.id}>
                          <td className="font-semibold">{c.technician_name}</td>
                          <td>{c.operator_name}</td>
                          <td style={{ fontFamily: 'monospace' }}>{c.bus_number}</td>
                          <td style={{ fontFamily: 'monospace' }}>{c.validator_number}</td>
                          <td>
                            <span className="badge badge-blue">{c.card_short_number}</span>
                          </td>
                          <td style={{ fontFamily: 'monospace', color: 'var(--muted)' }}>{c.card_number}</td>
                          <td style={{ textAlign: 'center', fontFamily: 'monospace' }}>
                            {new Date(c.created_at).toLocaleString('he-IL', {
                              day: '2-digit', month: '2-digit', year: 'numeric',
                              hour: '2-digit', minute: '2-digit'
                            })}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        ) : (
          <div className="grid md:grid-cols-3 gap-6">
            {/* Configure card form */}
            <div className="card md:col-span-1 h-fit">
              <h2 className="text-lg font-bold mb-4 flex items-center gap-2" style={{ color: 'var(--primary)' }}>
                <Plus size={20} />
                הוספת כרטיס רב-קו
              </h2>

              <form onSubmit={handleAddCard} className="flex flex-col gap-4">
                <div>
                  <label className="block text-sm font-medium mb-1">מספר כרטיס קצר *</label>
                  <input
                    type="text"
                    className="input"
                    placeholder="למשל: 1, 2, A"
                    value={newShortNumber}
                    onChange={e => setNewShortNumber(e.target.value)}
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">מספר רב-קו מלא * (10 ספרות)</label>
                  <input
                    type="text"
                    maxLength={10}
                    className="input"
                    placeholder="למשל: 0123456789"
                    value={newCardNumber}
                    onChange={e => setNewCardNumber(e.target.value)}
                    required
                  />
                </div>
                <button type="submit" className="btn btn-primary w-full justify-center" disabled={savingCard}>
                  {savingCard ? 'שומר...' : 'הוסף כרטיס'}
                </button>
              </form>
            </div>

            {/* Configured cards list */}
            <div className="card md:col-span-2">
              <h2 className="text-lg font-bold mb-4 flex items-center gap-2">
                <CreditCard size={20} />
                כרטיסים מוגדרים
              </h2>

              <div className="table-wrapper">
                <table>
                  <thead>
                    <tr>
                      <th>מספר קצר</th>
                      <th>מספר רב-קו מלא</th>
                      <th>סטטוס</th>
                      <th style={{ textAlign: 'center' }}>פעולות</th>
                    </tr>
                  </thead>
                  <tbody>
                    {cards.length === 0 ? (
                      <tr>
                        <td colSpan={4} className="text-center py-8" style={{ color: 'var(--muted)' }}>
                          לא הוגדרו כרטיסי רב-קו עדיין
                        </td>
                      </tr>
                    ) : (
                      cards.map((c: any) => {
                        const isEditing = editingCardId === c.id;
                        return (
                          <tr key={c.id}>
                            {isEditing ? (
                              <>
                                <td>
                                  <input
                                    type="text"
                                    className="input text-xs py-1"
                                    style={{ width: '80px' }}
                                    value={editShortNumber}
                                    onChange={e => setEditShortNumber(e.target.value)}
                                  />
                                </td>
                                <td>
                                  <input
                                    type="text"
                                    maxLength={10}
                                    className="input text-xs py-1"
                                    value={editCardNumber}
                                    onChange={e => setEditCardNumber(e.target.value)}
                                  />
                                </td>
                                <td>
                                  <button
                                    type="button"
                                    onClick={() => setEditCardActive(!editCardActive)}
                                    className="flex items-center gap-1 text-xs btn-ghost py-1 px-2 rounded"
                                  >
                                    {editCardActive ? (
                                      <ToggleRight size={20} className="text-green-400" />
                                    ) : (
                                      <ToggleLeft size={20} className="text-gray-500" />
                                    )}
                                    <span>{editCardActive ? 'פעיל' : 'לא פעיל'}</span>
                                  </button>
                                </td>
                                <td style={{ textAlign: 'center' }}>
                                  <div className="flex gap-2 justify-center">
                                    <button
                                      className="btn btn-success text-xs py-1 px-2"
                                      onClick={() => handleUpdateCard(c.id)}
                                      disabled={savingCard}
                                    >
                                      שמור
                                    </button>
                                    <button
                                      className="btn btn-ghost text-xs py-1 px-2"
                                      onClick={() => setEditingCardId(null)}
                                    >
                                      ביטול
                                    </button>
                                  </div>
                                </td>
                              </>
                            ) : (
                              <>
                                <td className="font-bold">
                                  <span className="badge badge-blue">{c.short_number}</span>
                                </td>
                                <td style={{ fontFamily: 'monospace' }}>{c.card_number}</td>
                                <td>
                                  <span className={`badge ${c.active ? 'badge-green' : 'badge-gray'}`}>
                                    {c.active ? 'פעיל' : 'לא פעיל'}
                                  </span>
                                </td>
                                <td style={{ textAlign: 'center' }}>
                                  <div className="flex gap-3 justify-center items-center">
                                    <button
                                      className="text-xs hover:text-blue-400 transition"
                                      onClick={() => {
                                        setEditingCardId(c.id);
                                        setEditCardNumber(c.card_number);
                                        setEditShortNumber(c.short_number);
                                        setEditCardActive(c.active === 1);
                                      }}
                                    >
                                      ערוך
                                    </button>
                                    <button
                                      className="text-red-400 hover:text-red-500 transition"
                                      onClick={() => handleDeleteCard(c.id)}
                                    >
                                      <Trash2 size={16} />
                                    </button>
                                  </div>
                                </td>
                              </>
                            )}
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
