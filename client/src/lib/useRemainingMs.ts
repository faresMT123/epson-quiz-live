import { useEffect, useState } from 'react';
import { serverNow } from './socket';

/**
 * Temps restant jusqu'à une échéance serveur (epoch ms).
 * L'échéance est absolue : le client ne fait que la comparer à l'heure serveur
 * estimée, les décomptes restent alignés même après une reconnexion.
 */
export function useRemainingMs(endsAt: number | null): number {
  const [remaining, setRemaining] = useState(() =>
    endsAt === null ? 0 : Math.max(0, endsAt - serverNow()),
  );

  useEffect(() => {
    if (endsAt === null) {
      setRemaining(0);
      return;
    }
    const update = () => setRemaining(Math.max(0, endsAt - serverNow()));
    update();
    const timer = window.setInterval(update, 100);
    return () => window.clearInterval(timer);
  }, [endsAt]);

  return remaining;
}
