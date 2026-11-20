import { QrCode, X } from 'lucide-react';
import { EpsonLogo } from '../components/EpsonLogo';
import { JoinQr, joinUrl } from '../components/JoinQr';

interface QrScreenProps {
  /** Absent = écran piloté à distance : aucun bouton, il suit l'organisateur. */
  onClose?: () => void;
}

/**
 * Écran présentateur plein écran : logo Epson, « QUIZ TIME », « SCAN TO PLAY »
 * et le QR code d'inscription. Il s'affiche sur TOUS les écrans admin dès qu'un
 * organisateur lance l'affichage (téléphone → écran du PC, par exemple).
 */
export function QrScreen({ onClose }: QrScreenProps) {
  const url = joinUrl();

  return (
    <div className="qr-screen" role="dialog" aria-modal="true" aria-label="QR code du quiz">
      <div className="qr-stage">
        <div className="qr-brand">
          <EpsonLogo height={40} />
        </div>

        <div className="qr-title-row">
          <span className="qr-rule" />
          <h2 className="qr-title">QUIZ TIME</h2>
          <span className="qr-rule is-right" />
        </div>

        <p className="qr-scan">SCAN TO PLAY</p>

        <div className="qr-card">
          <JoinQr url={url} />
        </div>

        <p className="qr-url">{url.replace(/^https?:\/\//, '')}</p>

        {onClose && (
          <button type="button" className="btn btn-ghost btn-sm qr-close" onClick={onClose}>
            <X size={16} /> MASQUER LE QR CODE
          </button>
        )}

        {!onClose && (
          <span className="qr-remote">
            <QrCode size={14} /> Affichage piloté depuis la console organisateur
          </span>
        )}
      </div>
    </div>
  );
}
