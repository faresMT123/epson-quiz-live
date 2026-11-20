import type { PlayerSession } from '@shared';
import { EpsonLogo } from '../components/EpsonLogo';
import { useRemainingMs } from '../lib/useRemainingMs';

export function CountdownScreen({ session }: { session: PlayerSession }) {
  const remaining = useRemainingMs(session.countdownEndsAt);
  const seconds = Math.max(0, Math.min(5, Math.ceil(remaining / 1000)));
  const progress = session.countdownEndsAt
    ? Math.min(100, Math.max(0, (1 - remaining / 5000) * 100))
    : 0;

  return (
    <main className="screen countdown-screen">
      <header className="neon-top">
        <EpsonLogo height={38} />
      </header>

      <span className="eyebrow neon-cyan">LE QUIZ COMMENCE</span>
      <div key={seconds} className="countdown-number" aria-live="polite">
        {seconds}
      </div>
      <h1>Préparez-vous, {session.player.firstName}</h1>
      <p className="muted">5 questions · 60 secondes chrono serveur.</p>

      <div className="countdown-track">
        <span style={{ width: `${progress}%` }} />
      </div>
    </main>
  );
}
