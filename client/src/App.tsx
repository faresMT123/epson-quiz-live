import { useEffect, useState } from 'react';
import { unlockSfx } from './lib/sfx';
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

  // Les navigateurs n'autorisent le son qu'après une interaction : on débloque
  // l'AudioContext au premier geste, quel qu'il soit.
  useEffect(() => {
    const unlock = () => unlockSfx();
    window.addEventListener('pointerdown', unlock, { once: true });
    window.addEventListener('keydown', unlock, { once: true });
    return () => {
      window.removeEventListener('pointerdown', unlock);
      window.removeEventListener('keydown', unlock);
    };
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
