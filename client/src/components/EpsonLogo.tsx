import blackLogo from '../assets/epson-logo-black.png';
import whiteLogo from '../assets/epson-logo-white.png';

type LogoVariant = 'white' | 'black';

interface EpsonLogoProps {
  /** Hauteur en pixels ; la largeur suit les proportions d'origine. */
  height?: number;
  /** Version blanche (défaut, interface néon) ou noire. */
  variant?: LogoVariant;
  className?: string;
}

/**
 * Logo Epson officiel — fichiers fournis `epson-logo-black.png` et
 * `epson-logo-white.png`. Aucune recoloration, aucun filtre, proportions
 * conservées.
 */
export function EpsonLogo({ height = 32, variant = 'white', className }: EpsonLogoProps) {
  const src = variant === 'black' ? blackLogo : whiteLogo;

  return (
    <span className={`logo-plate ${className ?? ''}`}>
      <img
        src={src}
        alt="Epson"
        className="epson-logo"
        style={{ height }}
        draggable={false}
        decoding="async"
      />
    </span>
  );
}
