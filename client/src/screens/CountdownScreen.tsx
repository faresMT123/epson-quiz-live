import { useEffect } from 'react';
import type { PlayerSession } from '@shared';
import { EpsonLogo } from '../components/EpsonLogo';
import { sfxCountdownTick, sfxGo } from '../lib/sfx';
import { useRemainingMs } from '../lib/useRemainingMs';

export function CountdownScreen({ session }: { session: PlayerSession }) {
  const remaining = useRemainingMs(session.countdownEndsAt);
  const seconds = Math.max(0, Math.min(5, Math.ceil(remaining / 1000)));
  const progress = session.countdownEndsAt
    ? Math.min(100, Math.max(0, (1 - remaining / 5000) * 100))
    : 0;

  // Un son par seconde, la dernière accentuée.
  useEffect(() => {
    if (seconds > 0) sfxCountdownTick(seconds === 1);
  }, [seconds]);

  useEffect(() => {
    sfxGo();
  }, []);

  return (
    <main className="screen countdown-screen">
      <header className="neon-top">
        <EpsonLogo height={34} />
      </header>

      <span className="eyebrow countdown-eyebrow">LE QUIZ COMMENCE</span>

      <div key={seconds} className="countdown-number" aria-live="polite">
        {seconds}
      </div>

      <h1>Préparez-vous, {session.player.firstName}</h1>

      <div className="countdown-meta">
        <span>60 secondes</span>
        <span>Chrono serveur</span>
        <span>Bonne chance</span>
      </div>

      <div className="countdown-track">
        <span style={{ width: `${progress}%` }} />
      </div>
    </main>
  );
}
