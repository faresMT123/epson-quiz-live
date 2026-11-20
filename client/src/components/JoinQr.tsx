import { useEffect, useState } from 'react';
import QRCode from 'qrcode';
import blackLogo from '../assets/epson-logo-black.png';

/**
 * URL que les joueurs doivent scanner : la racine de l'application sur laquelle
 * l'organisateur est connecté (Render, domaine, ou localhost en dev).
 */
export function joinUrl(): string {
  return `${window.location.origin}/`;
}

interface JoinQrProps {
  url: string;
  className?: string;
}

/**
 * QR code du lien d'inscription, avec le logo Epson incrusté au centre.
 * Correction d'erreur « H » (30 %) pour que le logo reste parfaitement lisible
 * par les téléphones.
 */
export function JoinQr({ url, className }: JoinQrProps) {
  const [dataUrl, setDataUrl] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let active = true;
    setFailed(false);
    QRCode.toDataURL(url, {
      errorCorrectionLevel: 'H',
      margin: 0,
      width: 1024,
      color: { dark: '#000000', light: '#ffffff' },
    })
      .then((value) => {
        if (active) setDataUrl(value);
      })
      .catch(() => {
        if (active) setFailed(true);
      });
    return () => {
      active = false;
    };
  }, [url]);

  return (
    <div className={`qr-code ${className ?? ''}`}>
      {dataUrl ? (
        <img src={dataUrl} alt={`QR code pour rejoindre le quiz : ${url}`} draggable={false} />
      ) : (
        <span className="qr-placeholder">{failed ? 'QR indisponible' : 'Génération du QR…'}</span>
      )}
      <span className="qr-badge">
        <img src={blackLogo} alt="Epson" draggable={false} />
      </span>
    </div>
  );
}
