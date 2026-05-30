import React, { useEffect, useState } from 'react';

interface JiraProject {
  key: string;
  name: string;
  id: string;
}

interface ProjectSelectorPageProps {
  userName: string;
  onProjectSelected: (projectKey: string) => void;
  onDisconnect: () => void;
}

const ProjectSelectorPage: React.FC<ProjectSelectorPageProps> = ({
  userName,
  onProjectSelected,
  onDisconnect,
}) => {
  const [projects, setProjects] = useState<JiraProject[]>([]);
  const [loading, setLoading] = useState(true);
  const [selecting, setSelecting] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');

  useEffect(() => {
    let cancelled = false;

    const fetchProjects = async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch('/api/auth/projects');
        if (!res.ok) {
          const body = await res.json().catch(() => null);
          throw new Error(body?.error ?? `Erreur ${res.status}`);
        }
        const data: JiraProject[] = await res.json();
        if (!cancelled) setProjects(data);
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Erreur inconnue');
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    fetchProjects();
    return () => { cancelled = true; };
  }, []);

  const handleSelect = async (projectKey: string) => {
    setSelecting(projectKey);
    try {
      const res = await fetch('/api/auth/select-project', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ projectKey }),
      });
      if (!res.ok) throw new Error(`Erreur sélection projet`);
      onProjectSelected(projectKey);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur');
      setSelecting(null);
    }
  };

  const filtered = projects.filter(
    (p) =>
      p.key.toLowerCase().includes(search.toLowerCase()) ||
      p.name.toLowerCase().includes(search.toLowerCase()),
  );

  return (
    <div className="min-h-screen bg-gray-100">
      {/* Header Orange dark */}
      <header className="bg-gray-900 text-white">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-4 lg:px-8">
          <div className="flex items-center gap-3">
            <div className="flex h-8 w-8 items-center justify-center rounded bg-orange-500" aria-hidden="true">
              <svg viewBox="0 0 50 50" className="h-5 w-5" fill="none">
                <rect width="50" height="50" rx="4" fill="#FF7900"/>
                <rect x="14" y="14" width="22" height="22" rx="2" fill="#fff"/>
              </svg>
            </div>
            <div>
              <h1 className="text-lg font-bold tracking-tight">KPI Dashboard</h1>
              <p className="text-xs text-gray-400">
                Connecté : <span className="text-gray-200 font-medium">{userName}</span>
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onDisconnect}
            className="rounded-lg border border-gray-600 px-4 py-2 text-sm font-medium text-gray-300
                       hover:bg-gray-800 hover:text-white focus:outline-none focus:ring-2 focus:ring-orange-500/40 transition-colors"
          >
            Déconnexion
          </button>
        </div>
      </header>

      <main id="main-content" className="mx-auto max-w-5xl px-6 py-8 lg:px-8">
        <div className="mb-6">
          <h2 className="text-xl font-bold text-gray-900">Sélectionnez un projet</h2>
          <p className="text-sm text-gray-600 mt-1">Choisissez le projet Jira à analyser</p>
        </div>

        {/* Search */}
        <div className="mb-6">
          <label htmlFor="project-search" className="sr-only">Rechercher un projet</label>
          <div className="relative">
            <svg className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input
              id="project-search"
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Rechercher un projet…"
              className="w-full rounded-lg border border-gray-300 bg-white pl-10 pr-4 py-2.5 text-sm
                         placeholder:text-gray-500 focus:border-orange-500 focus:outline-none
                         focus:ring-2 focus:ring-orange-500/20 transition-colors"
            />
          </div>
        </div>

        {error && (
          <div role="alert" className="mb-6 rounded-lg border border-error-500/30 bg-error-100 p-4 text-sm text-error-500 font-medium">
            {error}
          </div>
        )}

        {loading && (
          <div className="flex items-center justify-center py-20" role="status" aria-label="Chargement">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-orange-500 border-t-transparent" aria-hidden="true" />
            <span className="ml-3 text-gray-600">Chargement des projets…</span>
          </div>
        )}

        {!loading && (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3" role="list" aria-label="Projets Jira">
            {filtered.map((project) => (
              <button
                key={project.key}
                type="button"
                role="listitem"
                onClick={() => handleSelect(project.key)}
                disabled={selecting !== null}
                aria-busy={selecting === project.key}
                className="group rounded-xl border border-gray-200 bg-white p-5 text-left shadow-card
                           hover:border-orange-500 hover:shadow-card-hover focus:outline-none focus:ring-2
                           focus:ring-orange-500/30 transition-all disabled:opacity-50"
              >
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-orange-50
                                  text-sm font-bold text-orange-600 group-hover:bg-orange-100 transition-colors"
                       aria-hidden="true">
                    {project.key.slice(0, 3)}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold text-gray-900 truncate">{project.key}</p>
                    <p className="text-xs text-gray-600 truncate">{project.name}</p>
                  </div>
                  {selecting === project.key && (
                    <div className="h-5 w-5 animate-spin rounded-full border-2 border-orange-500 border-t-transparent" aria-hidden="true" />
                  )}
                </div>
              </button>
            ))}
          </div>
        )}

        {!loading && filtered.length === 0 && (
          <div className="py-20 text-center text-gray-500" role="status">
            {search ? 'Aucun projet trouvé pour cette recherche.' : 'Aucun projet accessible.'}
          </div>
        )}
      </main>
    </div>
  );
};

export default ProjectSelectorPage;
