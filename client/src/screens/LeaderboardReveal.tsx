import { useEffect, useMemo, useState } from 'react';
import { Trophy, X } from 'lucide-react';
import { formatDuration, type LeaderboardEntry } from '@shared';
import { EpsonLogo } from '../components/EpsonLogo';

/** Décompte de l'analyse des réponses avant l'écran de synthèse. */
const CALC_MS = 8_000;
/** Décompte 5 → 0 avant l'affichage du podium. */
const COUNTDOWN_MS = 5_000;
const MEDALS = ['#f0a63c', '#cfc7dd', '#b57c50'];

type Stage = 'calculating' | 'summary' | 'countdown' | 'revealed';

export interface RevealStats {
  /** Nombre de participants de la room. */
  participants: number;
  /** Nombre de questions du quiz. */
  total: number;
  /** Joueurs ayant toutes les bonnes réponses. */
  allCorrect: number;
  /** Joueurs ayant au moins une bonne réponse, sans avoir tout trouvé. */
  someCorrect: number;
  /** Joueurs sans aucune bonne réponse. */
  noneCorrect: number;
}

interface LeaderboardRevealProps {
  entries: LeaderboardEntry[];
  stats: RevealStats;
  onClose: () => void;
}

export function LeaderboardReveal({ entries, stats, onClose }: LeaderboardRevealProps) {
  const calcEndAt = useMemo(() => Date.now() + CALC_MS, []);
  const [stage, setStage] = useState<Stage>('calculating');
  const [now, setNow] = useState(() => Date.now());
  const [revealEndAt, setRevealEndAt] = useState<number | null>(null);

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 100);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    if (stage === 'calculating' && now >= calcEndAt) setStage('summary');
  }, [stage, now, calcEndAt]);

  useEffect(() => {
    if (stage === 'countdown' && revealEndAt !== null && now >= revealEndAt) {
      setStage('revealed');
    }
  }, [stage, now, revealEndAt]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [onClose]);

  const calcRemaining = Math.max(0, calcEndAt - now);
  const calcSeconds = Math.max(0, Math.ceil(calcRemaining / 1000));
  const calcProgress = Math.min(100, Math.max(0, (1 - calcRemaining / CALC_MS) * 100));

  const countdownSeconds =
    revealEndAt === null ? Math.ceil(COUNTDOWN_MS / 1000) : Math.max(0, Math.ceil((revealEndAt - now) / 1000));

  const startCountdown = () => {
    setRevealEndAt(Date.now() + COUNTDOWN_MS);
    setStage('countdown');
  };

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
          <span className="reveal-tagline">CLASSEMENT PUBLIÉ</span>
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

            <button type="button" className="btn btn-outline calc-close" onClick={onClose}>
              FERMER
            </button>
          </div>
        )}

        {stage === 'summary' && (
          <div className="reveal-summary">
            <h2 className="summary-title">Résultats de la room</h2>
            <p className="summary-sub">
              {stats.participants} participant{stats.participants > 1 ? 's' : ''} · {stats.total}{' '}
              questions
            </p>

            <div className="summary-grid">
              <div className="summary-item">
                <span className="summary-badge is-good" aria-hidden="true" />
                <ParticipantGlyph />
                <span className="summary-count is-good">{stats.allCorrect}</span>
                <span className="summary-label is-good">Toutes justes</span>
                <span className="summary-hint">Ont tout trouvé</span>
              </div>

              <div className="summary-item">
                <X size={26} className="summary-badge-x" aria-hidden="true" />
                <ParticipantGlyph />
                <span className="summary-count is-partial">{stats.someCorrect}</span>
                <span className="summary-label is-partial">Au moins une juste</span>
                <span className="summary-hint">Sans avoir tout trouvé</span>
              </div>

              <div className="summary-item">
                <X size={26} className="summary-badge-x" aria-hidden="true" />
                <ParticipantGlyph />
                <span className="summary-count is-none">{stats.noneCorrect}</span>
                <span className="summary-label is-none">Aucune juste</span>
                <span className="summary-hint">Aucune bonne réponse</span>
              </div>
            </div>

            <div className="summary-actions">
              <button type="button" className="btn-classement" onClick={startCountdown}>
                <Trophy size={20} />
                CLASSEMENT DES 3 PREMIERS
              </button>
              <button type="button" className="btn btn-outline reveal-close" onClick={onClose}>
                FERMER
              </button>
            </div>
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
            <button type="button" className="btn btn-outline" onClick={onClose}>
              FERMER
            </button>
          </div>
        )}

        {stage === 'revealed' && (
          <div className="reveal-results">
            <p className="reveal-sub">Les 3 premiers de la room</p>

            <div className="reveal-podium-frame">
              <div className="gift-podium">
                {entries.slice(0, 3).map((entry) => (
                  <article key={entry.playerId} className={`gift-card rank-${entry.rank}`}>
                    <span className="gift-medal" style={{ background: MEDALS[entry.rank - 1] }}>
                      <span className="gift-medal-ribbon" />
                      <span className="gift-medal-number">{entry.rank}</span>
                    </span>
                    <h3 className="gift-name">
                      {entry.firstName} {entry.lastName}
                    </h3>
                    <p className="gift-meta">
                      {entry.score}/{entry.total} · {formatDuration(entry.durationMs)}
                    </p>
                    <div className="gift-box">
                      <span className="gift-box-rank">{entry.rank}</span>
                      <p>
                        <span className="gift-icon" aria-hidden="true">
                          🎁
                        </span>
                        {entry.gift?.replace(/^[🎁\s]+/u, '') || 'Cadeau à annoncer'}
                      </p>
                    </div>
                  </article>
                ))}
              </div>
            </div>

            <button type="button" className="btn btn-outline btn-lg reveal-close" onClick={onClose}>
              FERMER
            </button>
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
