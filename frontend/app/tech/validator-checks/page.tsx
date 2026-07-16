'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Sidebar from '@/components/Sidebar';
import { api, getUser } from '@/lib/api';
import { ShieldCheck, Bus, Key, CreditCard, Send, AlertCircle, Loader } from 'lucide-react';

export default function TechValidatorChecksPage() {
  const router = useRouter();
  const user = getUser();

  const [operators, setOperators] = useState<any[]>([]);
  const [cards, setCards] = useState<any[]>([]);
  const [loadingData, setLoadingData] = useState(true);

  // Form State
  const [operatorId, setOperatorId] = useState('');
  const [busNumber, setBusNumber] = useState('');
  const [validatorNumber, setValidatorNumber] = useState('');
  const [cardId, setCardId] = useState('');

  // UI State
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!user) {
      router.push('/login');
      return;
    }
    if (user.role === 'admin') {
      router.push('/admin');
      return;
    }
    loadFormData();
  }, []);

  async function loadFormData() {
    setLoadingData(true);
    try {
      const [opsList, cardsList] = await Promise.all([
        api.operators.list(),
        api.validatorChecks.listCards()
      ]);
      setOperators(opsList);
      setCards(cardsList);

      // Pre-select first operator if available (preferably Dan Badarom or Beersheva)
      const preferredOp = opsList.find((op: any) => 
        op.name.includes('דן בדרום') || op.name.includes('דן באר שבע')
      ) || opsList[0];
      if (preferredOp) setOperatorId(String(preferredOp.id));

      if (cardsList.length > 0) {
        setCardId(String(cardsList[0].id));
      }
    } catch (err) {
      console.error(err);
      setError('שגיאה בטעינת נתוני הטופס');
    } finally {
      setLoadingData(false);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setSuccess(false);

    if (!operatorId || !busNumber.trim() || !validatorNumber || !cardId) {
      setError('אנא מלא את כל שדות החובה');
      return;
    }

    const valNum = parseInt(validatorNumber);
    if (isNaN(valNum) || valNum < 1 || valNum > 9999) {
      setError('מספר הוולידטור חייב להיות מספר בין 1 ל-9999');
      return;
    }

    setSubmitting(true);
    try {
      await api.validatorChecks.createCheck({
        operator_id: parseInt(operatorId),
        bus_number: busNumber.trim(),
        validator_number: valNum,
        card_id: parseInt(cardId)
      });
      setSuccess(true);
      setBusNumber('');
      setValidatorNumber('');
    } catch (err: any) {
      setError(err.message || 'שגיאה בשליחת הבדיקה');
    } finally {
      setSubmitting(false);
    }
  }

  if (loadingData) {
    return (
      <div className="layout">
        <Sidebar />
        <main className="main flex items-center justify-center">
          <div className="text-center" style={{ color: 'var(--muted)' }}>
            <Loader className="animate-spin mx-auto mb-2" size={24} />
            <p>טוען נתונים...</p>
          </div>
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
            <h1 className="text-2xl font-bold">בדיקת וולידטורים</h1>
            <p style={{ color: 'var(--muted)' }} className="text-sm mt-1">
              בצע בדיקה תקופתית אקראית באמצעות כרטיסי רב-קו ייעודיים
            </p>
          </div>
        </div>

        {/* Content card */}
        <div className="max-w-xl mx-auto">
          <div className="card">
            <h2 className="text-lg font-bold mb-6 flex items-center gap-2" style={{ color: 'var(--primary)' }}>
              <ShieldCheck size={20} />
              טופס בדיקת וולידטור
            </h2>

            {error && (
              <div className="mb-4 p-3 rounded-lg flex items-center gap-2 text-sm text-red-400" style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)' }}>
                <AlertCircle size={16} className="shrink-0" />
                <span>{error}</span>
              </div>
            )}

            {success && (
              <div className="mb-4 p-4 rounded-lg text-sm text-green-400" style={{ background: 'rgba(34,197,94,0.1)', border: '1px solid rgba(34,197,94,0.2)' }}>
                <div className="font-semibold text-base mb-1">הבדיקה נשלחה בהצלחה! 🎉</div>
                <div>הנתונים נשמרו במערכת וזמינים לצפייה עבור המנהל.</div>
              </div>
            )}

            <form onSubmit={handleSubmit} className="flex flex-col gap-5">
              {/* Operator */}
              <div>
                <label className="block text-sm font-medium mb-1">מפעיל / חברה *</label>
                <select
                  className="input"
                  value={operatorId}
                  onChange={e => setOperatorId(e.target.value)}
                  required
                >
                  <option value="" disabled>בחר מפעיל</option>
                  {operators.map((op: any) => (
                    <option key={op.id} value={op.id}>{op.name}</option>
                  ))}
                </select>
              </div>

              {/* Bus number */}
              <div>
                <label className="block text-sm font-medium mb-1">מספר אוטובוס *</label>
                <div className="relative flex items-center">
                  <Bus size={16} style={{ position: 'absolute', right: 12, color: 'var(--muted)' }} />
                  <input
                    type="text"
                    className="input"
                    style={{ paddingRight: 36 }}
                    placeholder="הזן מספר אוטובוס"
                    value={busNumber}
                    onChange={e => setBusNumber(e.target.value)}
                    required
                  />
                </div>
              </div>

              {/* Validator number */}
              <div>
                <label className="block text-sm font-medium mb-1">מספר וולידטור * (1-9999)</label>
                <div className="relative flex items-center">
                  <Key size={16} style={{ position: 'absolute', right: 12, color: 'var(--muted)' }} />
                  <input
                    type="number"
                    min="1"
                    max="9999"
                    className="input"
                    style={{ paddingRight: 36 }}
                    placeholder="הזן מספר וולידטור (1-9999)"
                    value={validatorNumber}
                    onChange={e => setValidatorNumber(e.target.value)}
                    required
                  />
                </div>
              </div>

              {/* Rav Kav Card (Short number) */}
              <div>
                <label className="block text-sm font-medium mb-1">מספר כרטיס קצר *</label>
                <div className="relative flex items-center">
                  <CreditCard size={16} style={{ position: 'absolute', right: 12, color: 'var(--muted)' }} />
                  <select
                    className="input"
                    style={{ paddingRight: 36 }}
                    value={cardId}
                    onChange={e => setCardId(e.target.value)}
                    required
                  >
                    <option value="" disabled>בחר כרטיס רב קו</option>
                    {cards.map((c: any) => (
                      <option key={c.id} value={c.id}>
                        {c.short_number} ({c.card_number.slice(0, 4)}...{c.card_number.slice(-4)})
                      </option>
                    ))}
                  </select>
                </div>
                {cards.length === 0 && (
                  <p className="text-xs text-amber-400 mt-1">
                    ⚠️ לא הוגדרו כרטיסי רב-קו פעילים במערכת על ידי מנהל.
                  </p>
                )}
              </div>

              {/* Submit */}
              <button
                type="submit"
                className="btn btn-primary w-full mt-4 justify-center gap-2"
                disabled={submitting || cards.length === 0}
              >
                {submitting ? (
                  <>
                    <Loader className="animate-spin" size={16} />
                    <span>שולח...</span>
                  </>
                ) : (
                  <>
                    <Send size={16} />
                    <span>שלח בדיקה</span>
                  </>
                )}
              </button>
            </form>
          </div>
        </div>
      </main>
    </div>
  );
}
