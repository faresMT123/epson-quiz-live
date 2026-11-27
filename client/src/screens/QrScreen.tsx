import { QrCode, Users, X } from 'lucide-react';
import { EpsonLogo } from '../components/EpsonLogo';
import { JoinQr, joinUrl } from '../components/JoinQr';
import './qr-screen.css';

interface QrScreenProps {
  /** Absent = écran piloté à distance : aucun bouton, il suit l'organisateur. */
  onClose?: () => void;
  /** Nombre de joueurs déjà inscrits dans la room. */
  playerCount?: number;
}

const TITLE = 'QUIZ TIME';
const STEPS = ['Scannez le QR code', 'Choisissez votre pseudo', 'Jouez en direct'];
const AVATAR_COLORS = ['#4d8dff', '#22c55e', '#f59e0b', '#ec4899', '#a78bfa'];
const TICKER = ['SCANNEZ POUR JOUER', 'QUIZ TIME', 'EPSON × STCI', 'PRÊTS ?'];

/** Particules déterministes (pas de Math.random → pas de saut au re-render). */
const PARTICLES = Array.from({ length: 16 }, (_, i) => ({
  left: (i * 37 + 11) % 100,
  size: 4 + ((i * 5) % 9),
  dur: 11 + ((i * 3) % 9),
  delay: -((i * 2.3) % 14),
  glyph: i % 4 === 0 ? '?' : i % 7 === 0 ? '!' : '',
}));

const css = (vars: Record<string, string>) => vars as React.CSSProperties;

/**
 * Écran présentateur plein écran : signature Epson × STCI, « QUIZ TIME »,
 * « SCANNEZ POUR JOUER » et le QR code d'inscription. Il s'affiche sur TOUS les
 * écrans admin dès qu'un organisateur lance l'affichage.
 */
export function QrScreen({ onClose, playerCount }: QrScreenProps) {
  const url = joinUrl();
  const shown = typeof playerCount === 'number' ? Math.min(playerCount, AVATAR_COLORS.length) : 0;

  return (
    <div className="qr-screen qrs" role="dialog" aria-modal="true" aria-label="QR code du quiz">
      {/* Ambiance : grille, faisceaux, particules */}
      <div className="qrs-bg" aria-hidden="true">
        <span className="qrs-grid" />
        <span className="qrs-beam is-a" />
        <span className="qrs-beam is-b" />
        {PARTICLES.map((p, i) => (
          <span
            key={i}
            className="qrs-particle"
            style={css({
              left: `${p.left}%`,
              width: `${p.size}px`,
              height: `${p.size}px`,
              '--dur': `${p.dur}s`,
              '--delay': `${p.delay}s`,
            })}
          >
            {p.glyph}
          </span>
        ))}
      </div>

      {/* Mascottes Epson */}
      <aside className="qrs-side is-left" aria-hidden="true">
        <img
          className="qrs-mascot is-back"
          src="/icons/mascots/ballerina.png"
          alt=""
          draggable={false}
          style={css({ '--enter': '0.9s', '--dur': '6.8s', '--delay': '-2s' })}
        />
        <img
          className="qrs-mascot"
          src="/icons/mascots/guitar.png"
          alt=""
          draggable={false}
          style={css({ '--enter': '0.6s', '--dur': '5.6s', '--delay': '0s' })}
        />
      </aside>

      <main className="qrs-stage">
        <header className="qrs-brand qrs-in" style={css({ '--d': '0ms' })}>
          <EpsonLogo height={38} />
          <span className="qrs-brand-sep" />
          <span className="qrs-brand-tag">
            <span className="qrs-onair" /> Live
          </span>
        </header>

        <section className="qrs-hero">
          <h2 className="qrs-title" aria-label={TITLE}>
            {TITLE.split('').map((ch, i) => (
              <span
                key={i}
                aria-hidden="true"
                className={`qrs-letter${ch === ' ' ? ' is-space' : ''}`}
                style={css({ '--i': String(i) })}
              >
                {ch === ' ' ? '\u00A0' : ch}
              </span>
            ))}
          </h2>
          <p className="qrs-scan qrs-in" style={css({ '--d': '700ms' })}>
            <span className="qrs-chevrons" aria-hidden="true">
              <i /><i /><i />
            </span>
            Scannez pour jouer
            <span className="qrs-chevrons is-flip" aria-hidden="true">
              <i /><i /><i />
            </span>
          </p>
        </section>

        <div className="qrs-stagecard qrs-in" style={css({ '--d': '400ms' })}>
          <span className="qrs-wave" aria-hidden="true" />
          <span className="qrs-wave is-2" aria-hidden="true" />
          <span className="qrs-wave is-3" aria-hidden="true" />
          <div className="qrs-ring">
            <div className="qrs-card">
              <span className="qrs-corner tl" />
              <span className="qrs-corner tr" />
              <span className="qrs-corner bl" />
              <span className="qrs-corner br" />
              <div className="qrs-qr">
                <JoinQr url={url} />
                <span className="qrs-scanline" aria-hidden="true" />
                <span className="qrs-shine" aria-hidden="true" />
              </div>
            </div>
          </div>
        </div>

        <p className="qrs-url qrs-in" style={css({ '--d': '900ms' })}>
          <QrCode size={15} />
          {url.replace(/^https?:\/\//, '')}
        </p>

        <ol className="qrs-steps qrs-in" style={css({ '--d': '1000ms' })}>
          {STEPS.map((s, i) => (
            <li key={s} style={css({ '--k': String(i) })}>
              <b>{i + 1}</b>
              <span>{s}</span>
            </li>
          ))}
        </ol>

        {typeof playerCount === 'number' && (
          <div className="qrs-counter qrs-in" style={css({ '--d': '1100ms' })}>
            <span className="qrs-live" aria-hidden="true" />
            <div className="qrs-avatars" aria-hidden="true">
              {Array.from({ length: shown }).map((_, i) => (
                <span key={i} style={css({ background: AVATAR_COLORS[i], '--a': String(i) })} />
              ))}
              {shown === 0 && <Users size={18} />}
            </div>
            <strong key={playerCount} className="qrs-count">
              {playerCount}
            </strong>
            <span>joueur{playerCount > 1 ? 's' : ''} dans la room</span>
          </div>
        )}

        {!onClose && (
          <span className="qrs-remote qrs-in" style={css({ '--d': '1200ms' })}>
            Affichage piloté depuis la console organisateur
          </span>
        )}
      </main>

      <aside className="qrs-side is-right" aria-hidden="true">
        <img
          className="qrs-mascot"
          src="/icons/mascots/football.png"
          alt=""
          draggable={false}
          style={css({ '--enter': '0.75s', '--dur': '5.2s', '--delay': '-1s' })}
        />
        <img
          className="qrs-mascot is-back"
          src="/icons/mascots/book.png"
          alt=""
          draggable={false}
          style={css({ '--enter': '1.05s', '--dur': '6.4s', '--delay': '-3s' })}
        />
      </aside>

      {/* Bandeau défilant */}
      <div className="qrs-ticker" aria-hidden="true">
        <div className="qrs-ticker-track">
          {[0, 1].map((k) => (
            <div className="qrs-ticker-set" key={k}>
              {Array.from({ length: 3 }).flatMap((_, r) =>
                TICKER.map((t) => (
                  <span key={`${r}-${t}`}>
                    {t}
                    <em>◆</em>
                  </span>
                )),
              )}
            </div>
          ))}
        </div>
      </div>

      {onClose && (
        <button
          type="button"
          className="qrs-x"
          onClick={onClose}
          aria-label="Fermer le QR code"
          title="Fermer"
        >
          <X size={22} />
        </button>
      )}
    </div>
  );
}