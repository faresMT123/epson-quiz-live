/**
 * Contrat partagé entre le client et le serveur.
 *
 * IMPORTANT : aucune bonne réponse ne figure dans ces types. Les questions
 * envoyées au client (`PublicQuestion`) ne contiennent ni `correctIndex`
 * ni aucune information permettant de deviner la correction.
 */

export type RoomState = 'WAITING' | 'COUNTDOWN' | 'RUNNING' | 'FINISHED';

/** Durée du décompte 5 → 0 avant le départ du chrono individuel. */
export const COUNTDOWN_MS = 5_000;
/** Temps total accordé au joueur pour répondre aux 5 questions. */
export const QUIZ_DURATION_MS = 60_000;

export type PlayerPhase = 'waiting' | 'countdown' | 'quiz' | 'result';

/**
 * Écran présentateur, partagé entre toutes les consoles admin.
 * `qr` affiche le QR code d'inscription sur tous les écrans connectés.
 */
export type DisplayMode = 'off' | 'qr';

/** Étapes du dévoilement du classement, pilotées côté serveur. */
export type RevealStage = 'off' | 'calculating' | 'summary' | 'countdown' | 'revealed';

/** Durée du calcul des résultats avant la synthèse. */
export const REVEAL_CALC_MS = 8_000;
/** Décompte 5 → 0 avant le podium. */
export const REVEAL_COUNTDOWN_MS = 5_000;

export interface AdminReveal {
  stage: RevealStage;
  /** Fin du calcul (epoch ms) quand `stage === 'calculating'`. */
  calculatingUntil: number | null;
  /** Fin du décompte (epoch ms) quand `stage === 'countdown'`. */
  countdownEndsAt: number | null;
}
export type PlayerStatus = 'connected' | 'in_progress' | 'finished';

export interface PublicQuestion {
  id: string;
  prompt: string;
  options: string[];
}

export interface PlayerIdentity {
  id: string;
  firstName: string;
  lastName: string;
  company: string;
}

export interface PlayerResult {
  score: number;
  total: number;
  /** Temps de réponse serveur, en millisecondes. */
  durationMs: number;
  /** true si le serveur a clôturé automatiquement (temps écoulé). */
  autoClosed: boolean;
}

export interface PlayerSession {
  player: PlayerIdentity;
  phase: PlayerPhase;
  roomState: RoomState;
  accessClosed: boolean;
  playerCount: number;
  /** Heure serveur (epoch ms) au moment de l'émission. */
  serverNow: number;
  /** Fin du décompte personnel (ou global), epoch ms. */
  countdownEndsAt: number | null;
  /** Fin du chrono personnel de 60 s, epoch ms. */
  quizEndsAt: number | null;
  questions: PublicQuestion[] | null;
  /** Réponses déjà enregistrées côté serveur (questionId → index). */
  answers: Record<string, number>;
  result: PlayerResult | null;
}

export interface PublicRoom {
  roomId: string;
  state: RoomState;
  display: DisplayMode;
  playerCount: number;
  connectedCount: number;
  accessClosed: boolean;
  countdownEndsAt: number | null;
  serverNow: number;
}

export interface AdminPlayerRow {
  id: string;
  firstName: string;
  lastName: string;
  company: string;
  status: PlayerStatus;
  connected: boolean;
  score: number | null;
  durationMs: number | null;
  answeredCount: number;
  autoClosed: boolean;
  joinedAt: number;
}

export interface LeaderboardEntry {
  rank: number;
  playerId: string;
  firstName: string;
  lastName: string;
  company: string;
  score: number;
  total: number;
  durationMs: number;
  /** Cadeau associé à ce rang (1 à 3), ou null. */
  gift: string | null;
}

export interface AdminStats {
  total: number;
  connected: number;
  started: number;
  finished: number;
  waiting: number;
}

export interface QuestionInput {
  prompt: string;
  options: string[];
  correctIndex: number;
}

/** Question complète, réservée au canal administrateur (contient la correction). */
export interface AdminQuestion extends QuestionInput {
  id: string;
}

export interface AdminSnapshot {
  roomId: string;
  roomState: RoomState;
  display: DisplayMode;
  reveal: AdminReveal;
  accessClosed: boolean;
  serverNow: number;
  countdownEndsAt: number | null;
  quizStartedAt: number | null;
  /** Fin du dernier chrono joueur encore en cours. */
  quizEndsAt: number | null;
  stats: AdminStats;
  players: AdminPlayerRow[];
  leaderboard: LeaderboardEntry[];
  /** Quiz courant, correction incluse (canal admin uniquement). */
  questions: AdminQuestion[];
  /** Cadeaux des 3 premières places (index 0 = 1re place). */
  prizes: string[];
}

export type AdminAction =
  | 'start'
  | 'close-access'
  | 'open-access'
  | 'new-room'
  | 'show-qr'
  | 'hide-qr'
  | 'show-results'
  | 'reveal-podium'
  | 'hide-results';

export type ErrorCode =
  | 'INVALID'
  | 'ACCESS_CLOSED'
  | 'ROOM_FINISHED'
  | 'NOT_FOUND'
  | 'BAD_STATE'
  | 'UNAUTHORIZED'
  | 'TOO_LATE'
  | 'NO_PLAYERS';

export type Outcome<T> =
  | { ok: true; data: T }
  | { ok: false; code: ErrorCode; message: string };

export interface JoinInput {
  firstName: string;
  lastName: string;
  company: string;
}

export interface ServerToClientEvents {
  'room:public': (room: PublicRoom) => void;
  'player:session': (session: PlayerSession) => void;
  'admin:snapshot': (snapshot: AdminSnapshot) => void;
}

export interface ClientToServerEvents {
  'admin:login': (
    payload: { password: string },
    cb: (res: Outcome<{ token: string }>) => void,
  ) => void;
  'admin:resume': (
    payload: { token: string },
    cb: (res: Outcome<null>) => void,
  ) => void;
  'admin:action': (
    payload: { token: string; action: AdminAction },
    cb: (res: Outcome<null>) => void,
  ) => void;
  'admin:set-prizes': (
    payload: { token: string; prizes: string[] },
    cb: (res: Outcome<null>) => void,
  ) => void;
  'admin:set-questions': (
    payload: { token: string; questions: QuestionInput[] },
    cb: (res: Outcome<null>) => void,
  ) => void;
  'player:join': (payload: JoinInput, cb: (res: Outcome<PlayerSession>) => void) => void;
  'player:resume': (
    payload: { playerId: string },
    cb: (res: Outcome<PlayerSession>) => void,
  ) => void;
  'player:answer': (
    payload: { playerId: string; questionId: string; optionIndex: number },
    cb: (res: Outcome<null>) => void,
  ) => void;
  'player:finish': (
    payload: { playerId: string },
    cb: (res: Outcome<PlayerResult>) => void,
  ) => void;
}

/** Formate une durée en millisecondes avec une précision au millième de seconde. */
export function formatDuration(ms: number): string {
  return `${(ms / 1000).toFixed(3).replace('.', ',')}s`;
}

export function playerFullName(player: { firstName: string; lastName: string }): string {
  return `${player.firstName} ${player.lastName}`;
}

export const ROOM_STATE_LABEL: Record<RoomState, string> = {
  WAITING: 'En attente',
  COUNTDOWN: 'Décompte',
  RUNNING: 'En cours',
  FINISHED: 'Terminée',
};
