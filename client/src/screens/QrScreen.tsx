import { QrCode, X } from 'lucide-react';
import { EpsonLogo } from '../components/EpsonLogo';
import { JoinQr, joinUrl } from '../components/JoinQr';

interface QrScreenProps {
  /** Absent = écran piloté à distance : aucun bouton, il suit l'organisateur. */
  onClose?: () => void;
}

/**
 * Écran présentateur plein écran : signature Epson × STCI, « QUIZ TIME »,
 * « SCAN TO PLAY » et le QR code d'inscription. Il s'affiche sur TOUS les
 * écrans admin dès qu'un organisateur lance l'affichage.
 */
export function QrScreen({ onClose }: QrScreenProps) {
  const url = joinUrl();

  return (
    <div className="qr-screen" role="dialog" aria-modal="true" aria-label="QR code du quiz">
      <div className="qr-stage">
        <header className="qr-brand">
          <EpsonLogo height={38} />
          <p className="qr-brand-line">Quiz interactif officiel</p>
        </header>

        <div className="qr-title-row">
          <span className="qr-rule" />
          <h2 className="qr-title">QUIZ TIME</h2>
          <span className="qr-rule is-right" />
        </div>

        <p className="qr-scan">Scannez pour jouer</p>

        <div className="qr-card">
          <JoinQr url={url} />
        </div>

        <p className="qr-url">{url.replace(/^https?:\/\//, '')}</p>

        {onClose ? (
          <button type="button" className="btn btn-ghost btn-sm qr-close" onClick={onClose}>
            <X size={16} /> MASQUER LE QR CODE
          </button>
        ) : (
          <span className="qr-remote">
            <QrCode size={14} /> Affichage piloté depuis la console organisateur
          </span>
        )}

        <p className="qr-footnote">Epson × STCI</p>
      </div>
    </div>
  );
}
