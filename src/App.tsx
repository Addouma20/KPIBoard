import React, { useEffect, useState } from 'react';
import Dashboard from './components/Dashboard';
import LoginPage from './components/LoginPage';
import ProjectSelectorPage from './components/ProjectSelectorPage';

type AppStep = 'loading' | 'login' | 'project-select' | 'dashboard';

const App: React.FC = () => {
  const [step, setStep] = useState<AppStep>('loading');
  const [userName, setUserName] = useState('');
  const [projectKey, setProjectKey] = useState('');

  // Check auth status on mount — auto-skip login/project-select if env token + project key work
  useEffect(() => {
    const checkStatus = async () => {
      try {
        const res = await fetch('/api/auth/status');
        if (res.ok) {
          const data: { connected: boolean; user?: string; projectKey?: string } = await res.json();
          if (data.connected) {
            if (data.user) setUserName(data.user);
            if (data.projectKey) {
              setProjectKey(data.projectKey);
              setStep('dashboard');
              return;
            }
            setStep('project-select');
            return;
          }
        }
      } catch { /* ignore */ }
      setStep('login');
    };
    checkStatus();
  }, []);

  const handleConnected = (name: string) => {
    setUserName(name);
    setStep('project-select');
  };

  const handleProjectSelected = (key: string) => {
    setProjectKey(key);
    setStep('dashboard');
  };

  const handleChangeProject = () => {
    setProjectKey('');
    setStep('project-select');
  };

  const handleDisconnect = () => {
    setStep('login');
    setUserName('');
    setProjectKey('');
  };

  if (step === 'loading') {
    return (
      <div className="min-h-screen bg-gray-100 flex flex-col items-center justify-center gap-4" role="status" aria-label="Chargement de l'application">
        <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-orange-500" aria-hidden="true">
          <svg viewBox="0 0 50 50" className="h-7 w-7" fill="none">
            <rect width="50" height="50" rx="4" fill="#FF7900"/>
            <rect x="14" y="14" width="22" height="22" rx="2" fill="#fff"/>
          </svg>
        </div>
        <div className="h-6 w-6 animate-spin rounded-full border-3 border-orange-500 border-t-transparent" aria-hidden="true" />
        <span className="text-sm text-gray-600 font-medium">Chargement…</span>
      </div>
    );
  }

  if (step === 'login') {
    return <LoginPage onConnected={handleConnected} />;
  }

  if (step === 'project-select') {
    return (
      <ProjectSelectorPage
        userName={userName}
        onProjectSelected={handleProjectSelected}
        onDisconnect={handleDisconnect}
      />
    );
  }

  return (
    <Dashboard
      userName={userName}
      projectKey={projectKey}
      onDisconnect={handleDisconnect}
      onChangeProject={handleChangeProject}
    />
  );
};

export default App;
