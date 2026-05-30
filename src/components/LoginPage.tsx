import React, { useState } from 'react';

const JIRA_BASE_URL = 'https://portail.agir.orange.com';
const JIRA_PAT_URL = `${JIRA_BASE_URL}/secure/ViewProfile.jspa?selectedTab=com.atlassian.pats.pats-plugin:jira-user-personal-access-tokens-profile-panel`;

interface LoginPageProps {
  onConnected: (userName: string) => void;
}

const HowToGuide: React.FC = () => {
  const [open, setOpen] = useState(false);

  return (
    <div className="rounded-lg border border-gray-300 bg-gray-50">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-controls="howto-content"
        className="flex w-full items-center justify-between px-4 py-3 text-gray-800 font-medium hover:bg-gray-100 transition-colors rounded-lg"
      >
        <span className="flex items-center gap-2">
          <svg className="h-4 w-4 shrink-0 text-orange-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m1-4h.01M12 2a10 10 0 100 20A10 10 0 0012 2z" />
          </svg>
          Comment générer votre token Jira ?
        </span>
        <svg
          className={`h-4 w-4 shrink-0 transition-transform ${open ? 'rotate-180' : ''}`}
          fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
          aria-hidden="true"
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {open && (
        <div id="howto-content" className="px-4 pb-4 space-y-3 text-gray-700">
          <ol className="space-y-2 list-none" role="list">
            {[
              <>Connectez-vous à <a href={JIRA_BASE_URL} target="_blank" rel="noreferrer" className="underline font-medium text-orange-600 hover:text-orange-700">portail.agir.orange.com</a></>,
              <>Cliquez sur votre <strong>avatar</strong> en haut à droite → <strong>Profil</strong></>,
              <>Dans le menu gauche, cliquez sur <strong>Personal Access Tokens</strong></>,
              <>Cliquez sur <strong>« Create token »</strong></>,
              <>Donnez un nom (ex : <em>KPI Dashboard</em>), définissez une expiration, puis cliquez sur <strong>« Create »</strong></>,
              <>Copiez le token généré <span className="text-error-500 font-medium">(il ne sera plus affiché ensuite)</span> et collez-le ci-dessous.</>,
            ].map((step, i) => (
              <li key={i} className="flex items-start gap-2.5">
                <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-orange-100 text-xs font-bold text-orange-600">
                  {i + 1}
                </span>
                <span>{step}</span>
              </li>
            ))}
          </ol>

          <a
            href={JIRA_PAT_URL}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1.5 rounded-md bg-gray-900 px-3 py-1.5 text-xs font-medium text-white hover:bg-gray-800 transition-colors"
          >
            <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
            </svg>
            Ouvrir la page des tokens Jira
          </a>
        </div>
      )}
    </div>
  );
};

const LoginPage: React.FC<LoginPageProps> = ({ onConnected }) => {
  const [token, setToken] = useState('');
  const [showToken, setShowToken] = useState(false);
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
    <div className="min-h-screen bg-gray-100 flex items-center justify-center px-4 py-10">
      <div className="w-full max-w-md space-y-4">
        {/* Header card */}
        <div className="rounded-xl border border-gray-200 bg-white p-10 shadow-card">
          <div className="text-center mb-8">
            {/* Orange logo block */}
            <div className="inline-flex h-14 w-14 items-center justify-center rounded-xl bg-orange-500 mb-4" aria-hidden="true">
              <svg viewBox="0 0 50 50" className="h-8 w-8" fill="none">
                <rect width="50" height="50" rx="4" fill="#FF7900"/>
                <rect x="14" y="14" width="22" height="22" rx="2" fill="#fff"/>
              </svg>
            </div>
            <h1 className="text-2xl font-bold text-gray-900 tracking-tight">KPI Dashboard</h1>
            <p className="text-sm text-gray-600 mt-1">Connectez-vous avec votre Personal Access Token Jira</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5" noValidate>
            <div>
              <label htmlFor="token" className="block text-sm font-medium text-gray-900 mb-1.5">
                Personal Access Token <span className="text-error-500" aria-label="requis">*</span>
              </label>
              <div className="relative">
                <input
                  id="token"
                  type={showToken ? 'text' : 'password'}
                  value={token}
                  onChange={(e) => setToken(e.target.value)}
                  placeholder="Collez votre token ici…"
                  autoFocus
                  required
                  aria-required="true"
                  aria-invalid={error ? 'true' : undefined}
                  aria-describedby={error ? 'login-error' : undefined}
                  className="w-full rounded-lg border border-gray-300 px-4 py-3 pr-11 text-sm
                             placeholder:text-gray-500 focus:border-orange-500 focus:outline-none
                             focus:ring-2 focus:ring-orange-500/20 transition-colors font-mono
                             aria-[invalid=true]:border-error-500"
                />
                <button
                  type="button"
                  onClick={() => setShowToken((v) => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-800 transition-colors p-1"
                  aria-label={showToken ? 'Masquer le token' : 'Afficher le token'}
                >
                  {showToken ? (
                    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden="true">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                    </svg>
                  ) : (
                    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden="true">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                      <path strokeLinecap="round" strokeLinejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                    </svg>
                  )}
                </button>
              </div>
            </div>

            {error && (
              <div id="login-error" role="alert" className="flex gap-2 rounded-lg border border-error-500/30 bg-error-100 px-4 py-3 text-sm text-error-500">
                <svg className="h-4 w-4 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <span>{error}</span>
              </div>
            )}

            <button
              type="submit"
              disabled={loading || !token.trim()}
              className="w-full rounded-lg bg-orange-500 px-4 py-3 text-sm font-bold text-gray-900
                         shadow-sm hover:bg-orange-600 focus:outline-none focus:ring-2
                         focus:ring-orange-500 focus:ring-offset-2 transition-colors
                         disabled:cursor-not-allowed disabled:opacity-50"
            >
              {loading ? (
                <span className="inline-flex items-center gap-2">
                  <span className="h-4 w-4 animate-spin rounded-full border-2 border-gray-900 border-t-transparent" aria-hidden="true" />
                  Connexion en cours…
                </span>
              ) : (
                'Se connecter'
              )}
            </button>
          </form>
        </div>

        {/* How-to guide */}
        <HowToGuide />
      </div>
    </div>
  );
};

export default LoginPage;
