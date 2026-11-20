import { ArrowLeft, Timer } from 'lucide-react';
import { formatDuration, type PlayerSession } from '@shared';
import { EpsonLogo } from '../components/EpsonLogo';

export function ResultScreen({ session, onBack }: { session: PlayerSession; onBack: () => void }) {
  const result = session.result;
  if (!result) return null;

  return (
    <main className="screen result-screen">
      <header className="neon-top">
        <EpsonLogo height={38} />
      </header>

      <section className="result-neon">
        <button
          type="button"
          className="result-back"
          onClick={onBack}
          aria-label="Revenir à l'inscription"
          title="Revenir à l'inscription"
        >
          <ArrowLeft size={20} />
        </button>

        <div className="quiz-tab" aria-hidden="true">
          <span>Q</span>
          <span>U</span>
          <span>I</span>
          <span>Z</span>
        </div>

        <h1 className="result-name">
          {session.player.firstName} {session.player.lastName}
        </h1>

        <div className="result-big" aria-label={`Score ${result.score} sur ${result.total}`}>
          {result.score}
          <span>/{result.total}</span>
        </div>
        <p className="result-label">BONNES RÉPONSES</p>

        <div className="result-time-neon">
          <Timer size={20} />
          <strong>{formatDuration(result.durationMs)}</strong>
        </div>

        <p className="result-saved">
          Votre résultat a bien été enregistré
          {result.autoClosed ? ' automatiquement à la fin du temps imparti' : ''}.
        </p>

        <p className="result-thanks-neon">
          Merci d'avoir participé, les résultats seront annoncés par l'organisateur.
        </p>
      </section>
    </main>
  );
}
