/**
 * Effets sonores de l'interface (Web Audio, aucun fichier audio).
 *
 * Les navigateurs n'autorisent le son qu'après une interaction : `unlockSfx()`
 * est appelé au premier geste de l'utilisateur (voir App.tsx). Les sons sont
 * volontairement courts et discrets — un quiz sur scène, pas un jeu d'arcade.
 */

type AudioCtor = typeof AudioContext;

let ctx: AudioContext | null = null;

function audio(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  if (!ctx) {
    const Ctor: AudioCtor | undefined =
      window.AudioContext ??
      (window as unknown as { webkitAudioContext?: AudioCtor }).webkitAudioContext;
    if (!Ctor) return null;
    try {
      ctx = new Ctor();
    } catch {
      return null;
    }
  }
  if (ctx.state === 'suspended') {
    void ctx.resume().catch(() => undefined);
  }
  return ctx;
}

/** Débloque l'audio (à appeler sur un clic / une touche). */
export function unlockSfx(): void {
  audio();
}

interface ToneOptions {
  freq: number;
  /** Durée en secondes. */
  duration?: number;
  type?: OscillatorType;
  gain?: number;
  /** Décalage en secondes depuis maintenant. */
  delay?: number;
  /** Glissando vers cette fréquence sur la durée du son. */
  slideTo?: number;
}

function tone({
  freq,
  duration = 0.12,
  type = 'sine',
  gain = 0.14,
  delay = 0,
  slideTo,
}: ToneOptions): void {
  const context = audio();
  if (!context) return;
  const start = context.currentTime + delay;
  const osc = context.createOscillator();
  const amp = context.createGain();

  osc.type = type;
  osc.frequency.setValueAtTime(freq, start);
  if (slideTo) osc.frequency.exponentialRampToValueAtTime(slideTo, start + duration);

  // Petite attaque + décroissance douce : évite les clics numériques.
  amp.gain.setValueAtTime(0.0001, start);
  amp.gain.exponentialRampToValueAtTime(gain, start + 0.012);
  amp.gain.exponentialRampToValueAtTime(0.0001, start + duration);

  osc.connect(amp).connect(context.destination);
  osc.start(start);
  osc.stop(start + duration + 0.03);
}

/** Tic de décompte ; `last` accentue la dernière seconde. */
export function sfxCountdownTick(last = false): void {
  tone({
    freq: last ? 1046 : 784,
    duration: last ? 0.2 : 0.075,
    type: 'triangle',
    gain: last ? 0.16 : 0.09,
  });
}

/** Départ du quiz (montée de trois notes). */
export function sfxGo(): void {
  tone({ freq: 523, duration: 0.12, type: 'triangle', gain: 0.12 });
  tone({ freq: 784, duration: 0.12, type: 'triangle', gain: 0.12, delay: 0.1 });
  tone({ freq: 1046, duration: 0.28, type: 'triangle', gain: 0.14, delay: 0.2 });
}

/** Résultat individuel : accord court et chaleureux. */
export function sfxResult(): void {
  tone({ freq: 587, duration: 0.16, type: 'sine', gain: 0.13 });
  tone({ freq: 784, duration: 0.16, type: 'sine', gain: 0.12, delay: 0.12 });
  tone({ freq: 988, duration: 0.34, type: 'sine', gain: 0.12, delay: 0.24 });
}

/** Analyse des résultats : souffle descendant discret. */
export function sfxCalculating(): void {
  tone({ freq: 320, slideTo: 160, duration: 0.55, type: 'sine', gain: 0.06 });
}

/** Entrée en « zone de danger » : nappe grave + alerte sourde. */
export function sfxDangerStart(): void {
  tone({ freq: 150, slideTo: 96, duration: 0.7, type: 'sawtooth', gain: 0.05 });
  tone({ freq: 196, duration: 0.16, type: 'square', gain: 0.045, delay: 0.08 });
  tone({ freq: 196, duration: 0.16, type: 'square', gain: 0.045, delay: 0.3 });
}

/**
 * Pulse des 8 s d'analyse : bip grave qui s'installe, puis double bip aigu
 * dans les trois dernières secondes pour la tension « danger zone ».
 */
export function sfxDangerTick(secondsLeft: number): void {
  const urgent = secondsLeft <= 3;
  const base = urgent ? 466 : 311;

  tone({
    freq: base,
    duration: urgent ? 0.16 : 0.13,
    type: 'square',
    gain: urgent ? 0.07 : 0.05,
  });
  tone({
    freq: base * 0.5,
    duration: 0.22,
    type: 'sine',
    gain: 0.05,
    delay: 0.01,
  });

  if (urgent) {
    tone({ freq: base * 1.5, duration: 0.1, type: 'square', gain: 0.055, delay: 0.15 });
  }
}

/** Synthèse affichée. */
export function sfxSummary(): void {
  tone({ freq: 659, duration: 0.14, type: 'triangle', gain: 0.11 });
  tone({ freq: 880, duration: 0.24, type: 'triangle', gain: 0.11, delay: 0.12 });
}

/** Podium révélé : petite fanfare. */
export function sfxPodium(): void {
  const notes = [523, 659, 784, 1046];
  notes.forEach((freq, index) => {
    tone({ freq, duration: 0.18, type: 'triangle', gain: 0.13, delay: index * 0.11 });
  });
  tone({ freq: 1318, duration: 0.5, type: 'sine', gain: 0.1, delay: 0.46 });
}
