import type { CSSProperties } from 'react';
import blackLogo from '../assets/epson-logo-black.png';
import whiteLogo from '../assets/epson-logo-white.png';
import stciLogo from '../assets/stci-logo.webp';

type LogoVariant = 'white' | 'black';

interface EpsonLogoProps {
  /** Hauteur en pixels ; la largeur suit les proportions d'origine. */
  height?: number;
  /** Version blanche (défaut, interface néon) ou noire. */
  variant?: LogoVariant;
  /** Affiche aussi le logo du partenaire STCI (activé par défaut). */
  partner?: boolean;
  className?: string;
}

/**
 * Logos officiels — fichiers fournis `epson-logo-black.png`,
 * `epson-logo-white.png` et `stci-logo.webp`. Aucune recoloration, aucun
 * filtre, proportions conservées. Le logo STCI est posé sur une pastille
 * claire pour rester lisible sur le fond néon sombre.
 *
 * La hauteur passe par la variable CSS `--logo-h` : les petits écrans la
 * réduisent automatiquement pour que le duo ne déborde jamais de la largeur.
 */
export function EpsonLogo({
  height = 32,
  variant = 'white',
  partner = true,
  className,
}: EpsonLogoProps) {
  const style = { '--logo-h': `${height}px` } as CSSProperties;

  return (
    <span className={`logo-plate ${className ?? ''}`} style={style}>
      {partner ? (
        <span className="logo-lockup">
          <img
            src={variant === 'black' ? blackLogo : whiteLogo}
            alt="Epson"
            className="epson-logo"
            draggable={false}
            decoding="async"
          />
          <span className="logo-sep" aria-hidden="true" />
          <span className="logo-partner">
            <img
              src={stciLogo}
              alt="STCI — Société Tunisienne de Commerce et de l'Informatique"
              className="stci-logo"
              draggable={false}
              decoding="async"
            />
          </span>
        </span>
      ) : (
        <img
          src={variant === 'black' ? blackLogo : whiteLogo}
          alt="Epson"
          className="epson-logo"
          draggable={false}
          decoding="async"
        />
      )}
    </span>
  );
}
