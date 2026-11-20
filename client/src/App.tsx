import { useEffect, useState } from 'react';
import { AdminApp } from './screens/AdminApp';
import { PlayerApp } from './screens/PlayerApp';
import { PresenterApp } from './screens/PresenterApp';

function normalizePath(path: string): string {
  const trimmed = path.replace(/\/+$/, '');
  return trimmed.length === 0 ? '/' : trimmed;
}

export function App() {
  const [path, setPath] = useState(() => normalizePath(window.location.pathname));

  useEffect(() => {
    const onPopState = () => setPath(normalizePath(window.location.pathname));
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, []);

  const navigate = (to: string) => {
    window.history.pushState({}, '', to);
    setPath(normalizePath(to));
    window.scrollTo({ top: 0 });
  };

  if (path === '/admin') {
    return <AdminApp onExit={() => navigate('/')} />;
  }

  if (path === '/ecran') {
    return <PresenterApp onExit={() => navigate('/')} />;
  }

  return <PlayerApp onAdmin={() => navigate('/admin')} />;
}
