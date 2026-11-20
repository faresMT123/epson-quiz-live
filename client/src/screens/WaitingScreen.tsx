import { Users } from 'lucide-react';
import type { PlayerSession } from '@shared';
import { EpsonLogo } from '../components/EpsonLogo';

export function WaitingScreen({ session }: { session: PlayerSession }) {
  return (
    <main className="screen">
      <header className="neon-top">
        <EpsonLogo height={38} />
      </header>

      <section className="neon-panel waiting">
        <span className="status-pill">
          <span className="pulse-dot" /> SALLE D'ATTENTE
        </span>
        <h1>Prêt·e, {session.player.firstName} ?</h1>
        <p className="neon-sub">Le quiz démarrera dès que l'organisateur l'aura lancé.</p>

        <div className="wait-counter">
          <Users size={22} />
          <strong>{session.playerCount}</strong>
          <span>joueur{session.playerCount > 1 ? 's' : ''} dans la room</span>
        </div>

        <div className="dots" aria-hidden="true">
          <span />
          <span />
          <span />
        </div>
      </section>
    </main>
  );
}
