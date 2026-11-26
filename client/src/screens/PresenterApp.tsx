import { useMemo } from 'react';
import { Loader2 } from 'lucide-react';
import { ROOM_STATE_LABEL } from '@shared';
import { EpsonLogo } from '../components/EpsonLogo';
import { computeRevealStats } from '../lib/revealStats';
import { useAdmin } from '../lib/useAdmin';
import { AdminLogin } from './AdminLogin';
import { LeaderboardReveal } from './LeaderboardReveal';
import { QrScreen } from './QrScreen';

/**
 * Écran de présentation (vidéoprojecteur, TV, second PC).
 *
 * Cet écran ne pilote rien : il n'affiche que ce que l'organisateur déclenche
 * depuis sa console (`/admin`) — le QR code d'inscription, puis le classement.
 * Démarrer le quiz ou changer d'état la room ne le modifie pas.
 */
export function PresenterApp({ onExit }: { onExit: () => void }) {
  const admin = useAdmin();
  const snapshot = admin.snapshot;

  const revealStats = useMemo(
    () => (snapshot ? computeRevealStats(snapshot) : null),
    [snapshot],
  );

  if (!admin.token) {
    return (
      <AdminLogin
        onLogin={admin.login}
        error={admin.error}
        busy={admin.busy}
        onExit={onExit}
      />
    );
  }

  if (!snapshot || !revealStats) {
    return (
      <main className="screen">
        <div className="stack center">
          <Loader2 size={30} className="spin" />
          <p className="muted">Connexion à l'écran de présentation…</p>
        </div>
      </main>
    );
  }

  if (snapshot.reveal.stage !== 'off') {
    return (
      <LeaderboardReveal
        entries={snapshot.leaderboard}
        stats={revealStats}
        stage={snapshot.reveal.stage}
        calculatingUntil={snapshot.reveal.calculatingUntil}
        countdownEndsAt={snapshot.reveal.countdownEndsAt}
        onStartCountdown={() => {}}
        onClose={() => {}}
        showControls={false}
      />
    );
  }

  if (snapshot.display === 'qr') {
    return <QrScreen playerCount={snapshot.stats.total} />;
  }

  return (
    <main className="presenter-idle">
      <EpsonLogo height={54} />
      <p className="presenter-tag">QUIZ TIME</p>
      <p className="presenter-hint">Écran prêt · en attente de l'organisateur</p>
      <span className="badge badge-info">
        {ROOM_STATE_LABEL[snapshot.roomState]} · {snapshot.stats.total} inscrit
        {snapshot.stats.total > 1 ? 's' : ''}
      </span>
    </main>
  );
}
