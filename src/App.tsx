import React, { useEffect, useState } from 'react';
import Dashboard from './components/Dashboard';
import LoginPage from './components/LoginPage';
import ProjectSelectorPage from './components/ProjectSelectorPage';

type AppStep = 'loading' | 'login' | 'project-select' | 'dashboard';

const App: React.FC = () => {
  const [step, setStep] = useState<AppStep>('loading');
  const [userName, setUserName] = useState('');
  const [projectKey, setProjectKey] = useState('');

  // Check auth status on mount — auto-skip login if env token works
  useEffect(() => {
    const checkStatus = async () => {
      try {
        const res = await fetch('/api/auth/status');
        if (res.ok) {
          const data: { connected: boolean; user?: string } = await res.json();
          if (data.connected && data.user) {
            setUserName(data.user);
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

  const handleDisconnect = () => {
    setStep('login');
    setUserName('');
    setProjectKey('');
  };

  if (step === 'loading') {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-blue-500 border-t-transparent" />
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
    />
  );
};

export default App;
