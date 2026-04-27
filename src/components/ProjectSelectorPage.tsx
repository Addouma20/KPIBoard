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
    <div className="min-h-screen bg-gray-50">
      <header className="border-b border-gray-200 bg-white">
        <div className="mx-auto flex max-w-4xl items-center justify-between px-6 py-5 lg:px-8">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 tracking-tight">Jira KPI Dashboard</h1>
            <p className="text-sm text-gray-400 mt-0.5">
              Connecté en tant que <span className="font-medium text-gray-600">{userName}</span>
            </p>
          </div>
          <button
            type="button"
            onClick={onDisconnect}
            className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-600
                       hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500/20 transition-colors"
          >
            Déconnexion
          </button>
        </div>
      </header>

      <main className="mx-auto max-w-4xl px-6 py-8 lg:px-8">
        <div className="mb-6">
          <h2 className="text-lg font-semibold text-gray-800">Sélectionnez un projet</h2>
          <p className="text-sm text-gray-400 mt-0.5">Choisissez le projet Jira à analyser</p>
        </div>

        {/* Search */}
        <div className="mb-6">
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Rechercher un projet…"
            className="w-full rounded-lg border border-gray-300 px-4 py-2.5 text-sm
                       placeholder:text-gray-400 focus:border-blue-500 focus:outline-none
                       focus:ring-2 focus:ring-blue-500/20 transition-colors"
          />
        </div>

        {error && (
          <div className="mb-6 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
            {error}
          </div>
        )}

        {loading && (
          <div className="flex items-center justify-center py-20">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-blue-500 border-t-transparent" />
            <span className="ml-3 text-gray-500">Chargement des projets…</span>
          </div>
        )}

        {!loading && (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {filtered.map((project) => (
              <button
                key={project.key}
                type="button"
                onClick={() => handleSelect(project.key)}
                disabled={selecting !== null}
                className="group rounded-2xl border border-gray-100 bg-white p-5 text-left shadow-sm
                           hover:border-blue-200 hover:shadow-md focus:outline-none focus:ring-2
                           focus:ring-blue-500/20 transition-all disabled:opacity-50"
              >
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-50
                                  text-sm font-bold text-blue-600 group-hover:bg-blue-100 transition-colors">
                    {project.key.slice(0, 3)}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold text-gray-800 truncate">{project.key}</p>
                    <p className="text-xs text-gray-400 truncate">{project.name}</p>
                  </div>
                  {selecting === project.key && (
                    <div className="h-5 w-5 animate-spin rounded-full border-2 border-blue-500 border-t-transparent" />
                  )}
                </div>
              </button>
            ))}
          </div>
        )}

        {!loading && filtered.length === 0 && (
          <div className="py-20 text-center text-gray-400">
            {search ? 'Aucun projet trouvé pour cette recherche.' : 'Aucun projet accessible.'}
          </div>
        )}
      </main>
    </div>
  );
};

export default ProjectSelectorPage;
