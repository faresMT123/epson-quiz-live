import { useEffect, useState, type CSSProperties } from 'react';
import { Gift, Trophy, X } from 'lucide-react';
import {
  REVEAL_CALC_MS,
  REVEAL_COUNTDOWN_MS,
  formatDuration,
  type LeaderboardEntry,
  type RevealStage,
} from '@shared';
import { EpsonLogo } from '../components/EpsonLogo';
import type { RevealStats } from '../lib/revealStats';
import { sfxDangerStart, sfxDangerTick, sfxCountdownTick, sfxPodium, sfxSummary } from '../lib/sfx';

const PLACES = ['1re place', '2e place', '3e place'];

interface LeaderboardRevealProps {
  entries: LeaderboardEntry[];
  stats: RevealStats;
  /** Étape courante : le pilotage est côté serveur, tous les écrans suivent. */
  stage: Exclude<RevealStage, 'off'>;
  calculatingUntil: number | null;
  countdownEndsAt: number | null;
  onStartCountdown: () => void;
  onClose: () => void;
  /**
   * `false` sur l'écran de présentation : aucun bouton, l'écran se contente de
   * suivre ce que fait l'organisateur depuis sa console de pilotage.
   */
  showControls?: boolean;
}

export function LeaderboardReveal({
  entries,
  stats,
  stage,
  calculatingUntil,
  countdownEndsAt,
  onStartCountdown,
  onClose,
  showControls = true,
}: LeaderboardRevealProps) {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 100);
    return () => window.clearInterval(timer);
  }, []);

  // Sons du dévoilement : alerte d'analyse, synthèse, décompte puis podium.
  useEffect(() => {
    if (stage === 'calculating') sfxDangerStart();
    else if (stage === 'summary') sfxSummary();
    else if (stage === 'revealed') sfxPodium();
  }, [stage]);

  useEffect(() => {
    if (!showControls) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [onClose, showControls]);

  const calcRemaining = calculatingUntil === null ? 0 : Math.max(0, calculatingUntil - now);
  const calcSeconds = Math.max(0, Math.ceil(calcRemaining / 1000));
  const calcProgress = Math.min(100, Math.max(0, (1 - calcRemaining / REVEAL_CALC_MS) * 100));

  const countdownSeconds =
    countdownEndsAt === null
      ? Math.ceil(REVEAL_COUNTDOWN_MS / 1000)
      : Math.max(0, Math.ceil((countdownEndsAt - now) / 1000));

  // Tic à chaque seconde du décompte 5 → 0 avant le podium.
  useEffect(() => {
    if (stage !== 'countdown' || countdownSeconds === 0) return;
    sfxCountdownTick(countdownSeconds === 1);
  }, [stage, countdownSeconds]);

  // Pulse « danger zone » pendant les 8 secondes d'analyse des résultats.
  useEffect(() => {
    if (stage !== 'calculating' || calcSeconds === 0) return;
    sfxDangerTick(calcSeconds);
  }, [stage, calcSeconds]);

  return (
    <div
      className="modal-backdrop reveal-backdrop"
      role="dialog"
      aria-modal="true"
      aria-label="Classement Top 3"
    >
      <div className="reveal-modal">
        <header className="reveal-brand">
          <EpsonLogo height={30} />
          <p className="reveal-tagline">Classement officiel</p>
        </header>

        {stage === 'calculating' && (
          <div className="reveal-calculating">
            <div className="calc-ring" aria-hidden="true">
              <span className="calc-ring-arc" />
              <span className="calc-ring-inner">
                <svg viewBox="0 0 24 24" width="30" height="30">
                  <path
                    d="M4 15.5l4.5-5.5 3.2 3.2L20 5.5"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2.2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </span>
            </div>

            <h2 className="calc-title">Calcul des résultats</h2>
            <p className="calc-sub">
              Analyse des réponses de {stats.participants} participant
              {stats.participants > 1 ? 's' : ''}…
            </p>

            <div
              className="calc-progress"
              role="progressbar"
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={Math.round(calcProgress)}
            >
              <span style={{ width: `${calcProgress}%` }} />
            </div>

            <p className="calc-eta" aria-live="polite">
              Résultats disponibles dans {calcSeconds} s
            </p>

            {showControls && (
              <button type="button" className="btn btn-outline calc-close" onClick={onClose}>
                FERMER
              </button>
            )}
          </div>
        )}

        {stage === 'summary' && (
          <div className="reveal-summary">
            <h2 className="summary-title">RÉSULTATS</h2>
            <p className="summary-sub">
              {stats.participants} participant{stats.participants > 1 ? 's' : ''} · {stats.total}{' '}
              questions
            </p>

            <div className="summary-grid">
              <div className="summary-item">
                <span className="summary-badge is-good" aria-hidden="true" />
                <ParticipantGlyph />
                <span className="summary-count is-good">{stats.allCorrect}</span>
                <span className="summary-label is-good">Toutes les réponses justes</span>
              </div>

              <div className="summary-item">
                <X size={26} className="summary-badge-x" aria-hidden="true" />
                <ParticipantGlyph />
                <span className="summary-count is-partial">{stats.someCorrect}</span>
                <span className="summary-label is-partial">Au moins une réponse juste</span>
              </div>

              <div className="summary-item">
                <X size={26} className="summary-badge-x" aria-hidden="true" />
                <ParticipantGlyph />
                <span className="summary-count is-none">{stats.noneCorrect}</span>
                <span className="summary-label is-none">Aucune réponse juste</span>
              </div>
            </div>

            {showControls && (
              <div className="summary-actions">
                <button type="button" className="btn-classement" onClick={onStartCountdown}>
                  <Trophy size={20} />
                  CLASSEMENT DES 3 PREMIERS
                </button>
                <button type="button" className="btn btn-outline reveal-close" onClick={onClose}>
                  FERMER
                </button>
              </div>
            )}
          </div>
        )}

        {stage === 'countdown' && (
          <div className="reveal-countdown">
            <h2>Classement publié</h2>
            <p className="muted">Le podium s'affiche dans un instant…</p>
            <div className="reveal-countdown-number" key={countdownSeconds} aria-live="polite">
              {countdownSeconds}
            </div>
            <p className="muted">Préparez-vous à découvrir les gagnants</p>
            {showControls && (
              <button type="button" className="btn btn-outline" onClick={onClose}>
                FERMER
              </button>
            )}
          </div>
        )}

        {stage === 'revealed' && (
          <div className="reveal-results">
            <p className="reveal-sub">Les 3 premiers de la room</p>

            <div className="reveal-podium-frame">
              <div className="reveal-podium">
                {entries.slice(0, 3).map((entry, slot) => (
                  <article
                    key={entry.playerId}
                    className={`podium-card rank-${entry.rank}`}
                    style={{ '--slot': slot } as CSSProperties}
                  >
                    <div className="podium-rank">
                      <span className="podium-medal" aria-hidden="true">
                        {entry.rank}
                      </span>
                      <span className="podium-place">{PLACES[entry.rank - 1]}</span>
                    </div>

                    <h3 className="podium-name">
                      {entry.firstName} {entry.lastName}
                    </h3>
                    <p className="podium-company">{entry.company}</p>

                    <div className="podium-stats">
                      <span>
                        <strong>
                          {entry.score}/{entry.total}
                        </strong>{' '}
                        bonnes réponses
                      </span>
                      <span>{formatDuration(entry.durationMs)}</span>
                    </div>

                    <div className="podium-gift">
                      <span className="podium-gift-icon" aria-hidden="true">
                        <Gift size={18} />
                      </span>
                      <div>
                        <span className="podium-gift-label">Cadeau</span>
                        <p className="podium-gift-text">
                          {entry.gift?.replace(/^[🎁\s]+/u, '') || 'Cadeau à annoncer'}
                        </p>
                      </div>
                    </div>
                  </article>
                ))}
              </div>
            </div>

            {showControls && (
              <button type="button" className="btn btn-outline btn-lg reveal-close" onClick={onClose}>
                FERMER
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

/** Silhouette de participant assis derrière une table. */
function ParticipantGlyph() {
  return (
    <svg className="summary-glyph" viewBox="0 0 64 60" aria-hidden="true">
      <circle cx="32" cy="13" r="8" fill="none" stroke="currentColor" strokeWidth="2.6" />
      <path
        d="M19 30c0-7.5 5.8-12.5 13-12.5S45 22.5 45 30"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.6"
        strokeLinecap="round"
      />
      <path d="M9 33h46" stroke="#ffffff" strokeWidth="2.6" strokeLinecap="round" />
      <path d="M16 33v15M48 33v15" stroke="#ffffff" strokeWidth="2.6" strokeLinecap="round" />
    </svg>
  );
}
