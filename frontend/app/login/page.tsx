'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/api';

export default function LoginPage() {
  const router = useRouter();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const data = await api.auth.login(username, password);
      localStorage.setItem('token', data.token);
      localStorage.setItem('user', JSON.stringify(data.user));
      if (data.user.role === 'admin') {
        router.push('/admin');
      } else {
        router.push('/tech');
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center" style={{ background: 'var(--bg)' }}>
      <div className="card w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="text-4xl mb-3">🔧</div>
          <h1 className="text-2xl font-bold">מערכת ניהול טכנאים</h1>
          <p style={{ color: 'var(--muted)' }} className="text-sm mt-1">היכנס לחשבון שלך</p>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div>
            <label className="block text-sm font-medium mb-2">שם משתמש</label>
            <input
              className="input"
              type="text"
              placeholder="username"
              value={username}
              onChange={e => setUsername(e.target.value)}
              required
              autoFocus
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-2">סיסמה</label>
            <input
              className="input"
              type="password"
              placeholder="••••••••"
              value={password}
              onChange={e => setPassword(e.target.value)}
              required
            />
          </div>

          {error && (
            <div className="text-sm text-center py-2 px-4 rounded-lg" style={{ background: '#7f1d1d', color: '#fca5a5' }}>
              {error}
            </div>
          )}

          <button className="btn btn-primary w-full justify-center mt-2" type="submit" disabled={loading}>
            {loading ? 'מתחבר...' : 'כניסה'}
          </button>
        </form>

        <div className="mt-6 text-xs text-center" style={{ color: 'var(--muted)' }}>
          <p>מנהל: admin / admin123</p>
          <p>טכנאי: david / tech123</p>
        </div>
      </div>
    </div>
  );
}
