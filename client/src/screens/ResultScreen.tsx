import { useEffect } from 'react';
import { ArrowLeft, Timer } from 'lucide-react';
import { formatDuration, type PlayerSession } from '@shared';
import { EpsonLogo } from '../components/EpsonLogo';
import { sfxResult } from '../lib/sfx';

/** Anneau de score : rayon et épaisseur du trait dans le viewBox 180×180. */
const RING_RADIUS = 70;
const RING_CIRCUMFERENCE = 2 * Math.PI * RING_RADIUS;

export function ResultScreen({ session, onBack }: { session: PlayerSession; onBack: () => void }) {
  const result = session.result;

  useEffect(() => {
    sfxResult();
  }, []);

  if (!result) return null;

  const ratio = result.total > 0 ? Math.min(1, Math.max(0, result.score / result.total)) : 0;

  return (
    <main className="screen result-screen">
      <div className="result-shell">
        <header className="result-brand">
          <EpsonLogo height={34} />
          <span className="result-brand-line">Résultat officiel</span>
        </header>

        <section className="result-card" aria-labelledby="result-player-name">
          <button
            type="button"
            className="result-back"
            onClick={onBack}
            aria-label="Revenir à l'inscription"
            title="Revenir à l'inscription"
          >
            <ArrowLeft size={18} />
          </button>

          <p className="result-kicker">Quiz Epson × STCI</p>
          <h1 id="result-player-name" className="result-name">
            {session.player.firstName} {session.player.lastName}
          </h1>
          <p className="result-company">{session.player.company}</p>

          <div
            className="result-score"
            role="img"
            aria-label={`Score ${result.score} sur ${result.total}`}
          >
            <svg viewBox="0 0 180 180" aria-hidden="true">
              <defs>
                <linearGradient id="resultScoreGrad" x1="0" y1="0" x2="1" y2="1">
                  <stop offset="0%" stopColor="#0a5fbe" />
                  <stop offset="55%" stopColor="#35b8f0" />
                  <stop offset="100%" stopColor="#18c8d8" />
                </linearGradient>
              </defs>
              <circle
                className="score-ring-track"
                cx="90"
                cy="90"
                r={RING_RADIUS}
                strokeWidth={10}
              />
              <circle
                className="score-ring-value"
                cx="90"
                cy="90"
                r={RING_RADIUS}
                strokeWidth={10}
                strokeDasharray={RING_CIRCUMFERENCE}
                strokeDashoffset={RING_CIRCUMFERENCE * (1 - ratio)}
                transform="rotate(-90 90 90)"
              />
            </svg>
            <div className="result-big">
              {result.score}
              <span>/{result.total}</span>
            </div>
          </div>

          <p className="result-label">BONNES RÉPONSES</p>

          <div className="result-time-neon">
            <Timer size={18} />
            <strong>{formatDuration(result.durationMs)}</strong>
          </div>

          <p className="result-saved">
            Votre résultat a bien été enregistré
            {result.autoClosed ? ' automatiquement à la fin du temps imparti' : ''}.
          </p>
        </section>

        <p className="result-thanks">
          Merci d'avoir participé. Les résultats seront annoncés par l'organisateur.
        </p>

        <p className="result-footnote">Epson × STCI · Quiz Live</p>
      </div>
    </main>
  );
}
