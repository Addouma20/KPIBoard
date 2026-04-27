import React, { useState } from 'react';

interface LoginPageProps {
  onConnected: (userName: string) => void;
}

const LoginPage: React.FC<LoginPageProps> = ({ onConnected }) => {
  const [token, setToken] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token.trim()) return;

    setLoading(true);
    setError(null);

    try {
      const res = await fetch('/api/auth/connect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: token.trim() }),
      });

      if (!res.ok) {
        const body = await res.json().catch(() => null);
        const details = body?.details ? ` (${body.details})` : '';
        throw new Error((body?.error ?? `Erreur ${res.status}`) + details);
      }

      const data: { user: string } = await res.json();
      onConnected(data.user);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur de connexion');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
      <div className="w-full max-w-md">
        <div className="rounded-2xl border border-gray-100 bg-white p-10 shadow-sm">
          <div className="text-center mb-8">
            <h1 className="text-3xl font-bold text-gray-900 tracking-tight">Jira KPI Dashboard</h1>
            <p className="text-sm text-gray-400 mt-2">Connectez-vous avec votre token Jira</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label htmlFor="token" className="block text-sm font-medium text-gray-700 mb-1.5">
                Token Jira (Bearer)
              </label>
              <input
                id="token"
                type="password"
                value={token}
                onChange={(e) => setToken(e.target.value)}
                placeholder="Collez votre token ici…"
                autoFocus
                className="w-full rounded-lg border border-gray-300 px-4 py-3 text-sm
                           placeholder:text-gray-400 focus:border-blue-500 focus:outline-none
                           focus:ring-2 focus:ring-blue-500/20 transition-colors"
              />
              <p className="text-xs text-gray-400 mt-1.5">
                Générez un token depuis Jira → Profil → Personal Access Tokens
              </p>
            </div>

            {error && (
              <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading || !token.trim()}
              className="w-full rounded-lg bg-blue-600 px-4 py-3 text-sm font-medium text-white
                         shadow-sm hover:bg-blue-700 focus:outline-none focus:ring-2
                         focus:ring-blue-500 focus:ring-offset-2 transition-colors
                         disabled:cursor-not-allowed disabled:opacity-50"
            >
              {loading ? (
                <span className="inline-flex items-center gap-2">
                  <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                  Connexion…
                </span>
              ) : (
                'Se connecter'
              )}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};

export default LoginPage;
