import { randomUUID } from 'node:crypto';
import {
  COUNTDOWN_MS,
  QUIZ_DURATION_MS,
  REVEAL_CALC_MS,
  REVEAL_COUNTDOWN_MS,
  type AdminSnapshot,
  type AdminPlayerRow,
  type AdminStats,
  type DisplayMode,
  type ErrorCode,
  type JoinInput,
  type LeaderboardEntry,
  type Outcome,
  type PlayerPhase,
  type PlayerResult,
  type PlayerSession,
  type PublicQuestion,
  type PublicRoom,
  type RevealStage,
  type RoomReport,
  type RoomReportPlayer,
  type RoomState,
} from '../../shared/src/index';
import { QUESTIONS as DEFAULT_QUESTIONS, type Question } from './questions';

/**
 * État d'un joueur, entièrement en mémoire.
 * Les temps autoritaires sont mesurés avec `process.hrtime.bigint()` afin
 * d'être indépendants de l'horloge système et impossibles à falsifier côté client.
 */
export interface Player {
  id: string;
  firstName: string;
  lastName: string;
  company: string;
  joinedAt: number;
  socketId: string | null;
  /** Epoch ms planifié pour le début de SON quiz (fin de son décompte). */
  pendingStartAt: number | null;
  startedAt: number | null;
  startedHr: bigint | null;
  endsAt: number | null;
  /** Réponse choisie, exprimée dans l'ordre des propositions servi à CE joueur. */
  answers: Record<string, number>;
  /**
   * Ordre des propositions mélangé pour ce joueur, par question :
   * `optionOrders[qid][i]` = index d'origine de la proposition affichée en position `i`.
   */
  optionOrders: Record<string, number[]>;
  submittedAt: number | null;
  score: number | null;
  /** Nombre de questions au moment du départ (dénominateur du score). */
  total: number | null;
  durationMs: number | null;
  autoClosed: boolean;
}

interface GameHooks {
  onPublic: () => void;
  onAdmin: () => void;
  onPlayer: (player: Player) => void;
}

const ok = <T,>(data: T): Outcome<T> => ({ ok: true, data });
const fail = (code: ErrorCode, message: string): Outcome<never> => ({
  ok: false,
  code,
  message,
});

/** Mélange une copie de la liste (Fisher–Yates). */
function shuffle<T>(items: T[]): T[] {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

/** Nettoie et valide un champ texte libre. */
function cleanText(value: unknown, maxLength: number): string | null {
  if (typeof value !== 'string') return null;
  const text = value.trim().replace(/\s+/g, ' ');
  if (text.length === 0 || text.length > maxLength) return null;
  // Refuse les caractères de contrôle.
  if (/[\u0000-\u001f\u007f]/.test(text)) return null;
  return text;
}

export class Game {
  private roomId = randomUUID();
  private state: RoomState = 'WAITING';
  /** Écran présentateur (QR code) piloté depuis n'importe quelle console admin. */
  private display: DisplayMode = 'off';
  /** Étapes du dévoilement du classement (partagées entre les consoles). */
  private revealStage: RevealStage = 'off';
  private revealCalculatingUntil: number | null = null;
  private revealCountdownEndsAt: number | null = null;
  private accessClosed = false;
  private countdownEndsAt: number | null = null;
  private quizStartedAt: number | null = null;
  private readonly players = new Map<string, Player>();
  /** Cadeaux du podium, conservés d'une room à l'autre (jamais réinitialisés). */
  private prizes: string[] = [
    'Imprimante L3310',
    'Weekend pour 2 personnes valeur de 500DT',
    'Carte cadeau FATALE valeur 300DT',
  ];
  /** Quiz courant, modifiable par l'organisateur avant chaque room. */
  private questions: Question[] = DEFAULT_QUESTIONS.map((question) => ({
    ...question,
    options: [...question.options],
  }));
  /** Ordre mélangé servi aux joueurs, retiré au départ de chaque partie. */
  private playQuestions: Question[] = [];
  /** Numéro de la room courante (1, 2, 3…). */
  private roomIndex = 1;
  private roomOpenedAt = Date.now();
  private finishedAt: number | null = null;
  /** Rooms terminées conservées pour les rapports (50 dernières). */
  private readonly archivedReports: RoomReport[] = [];

  constructor(private readonly hooks: GameHooks) {}

  /* ----------------------------------------------------------------- */
  /* Parcours joueur                                                    */
  /* ----------------------------------------------------------------- */

  join(input: JoinInput, socketId: string): Outcome<PlayerSession> {
    const firstName = cleanText(input?.firstName, 40);
    const lastName = cleanText(input?.lastName, 40);
    const company = cleanText(input?.company, 60);
    if (!firstName || !lastName || !company) {
      return fail('INVALID', 'Nom, prénom et société sont obligatoires (40 caractères maximum).');
    }
    if (this.state === 'FINISHED') {
      return fail('ROOM_FINISHED', 'La partie est terminée. Merci de votre participation.');
    }
    if (this.accessClosed) {
      return fail('ACCESS_CLOSED', "Accès fermé par l'organisateur.");
    }

    const player: Player = {
      id: randomUUID(),
      firstName,
      lastName,
      company,
      joinedAt: Date.now(),
      socketId,
      pendingStartAt: null,
      startedAt: null,
      startedHr: null,
      endsAt: null,
      answers: {},
      optionOrders: {},
      submittedAt: null,
      score: null,
      total: null,
      durationMs: null,
      autoClosed: false,
    };

    if (this.state === 'COUNTDOWN' && this.countdownEndsAt !== null) {
      // Rejoint le décompte global en cours.
      player.pendingStartAt = this.countdownEndsAt;
    } else if (this.state === 'RUNNING') {
      // Décompte personnel de 5 s puis 60 s, même si le quiz a déjà démarré.
      player.pendingStartAt = Date.now() + COUNTDOWN_MS;
    }

    this.players.set(player.id, player);
    this.hooks.onPublic();
    this.hooks.onAdmin();
    return ok(this.sessionFor(player));
  }

  resume(playerId: string, socketId: string): Outcome<PlayerSession> {
    const player = this.players.get(playerId);
    if (!player) {
      return fail('NOT_FOUND', 'Session expirée. Merci de rejoindre la room à nouveau.');
    }
    player.socketId = socketId;
    this.hooks.onPublic();
    this.hooks.onAdmin();
    return ok(this.sessionFor(player));
  }

  answer(playerId: string, questionId: string, optionIndex: number): Outcome<null> {
    const player = this.players.get(playerId);
    if (!player) return fail('NOT_FOUND', 'Joueur inconnu.');
    if (player.submittedAt !== null) {
      return fail('TOO_LATE', 'Vos réponses ont déjà été envoyées.');
    }
    if (player.startedHr === null || player.endsAt === null) {
      return fail('BAD_STATE', "Le quiz n'a pas encore commencé pour vous.");
    }
    if (Date.now() >= player.endsAt) {
      this.finalize(player, true);
      return fail('TOO_LATE', 'Le temps est écoulé, vos réponses ont été enregistrées.');
    }
    const question = this.questions.find((item) => item.id === questionId);
    if (!question) {
      return fail('INVALID', 'Question inconnue.');
    }
    if (
      !Number.isInteger(optionIndex) ||
      optionIndex < 0 ||
      optionIndex >= question.options.length
    ) {
      return fail('INVALID', 'Réponse invalide.');
    }
    player.answers[questionId] = optionIndex;
    this.hooks.onAdmin();
    return ok(null);
  }

  finish(playerId: string): Outcome<PlayerResult> {
    const player = this.players.get(playerId);
    if (!player) return fail('NOT_FOUND', 'Joueur inconnu.');
    if (player.submittedAt !== null) {
      // Idempotent : un seul envoi effectif, les suivants renvoient le résultat.
      return ok(this.resultOf(player));
    }
    if (player.startedHr === null) {
      return fail('BAD_STATE', "Le quiz n'a pas encore commencé pour vous.");
    }
    // Si le temps est écoulé, la clôture automatique fait foi (60 s exactement).
    const expired = player.endsAt !== null && Date.now() >= player.endsAt;
    this.finalize(player, expired);
    return ok(this.resultOf(player));
  }

  /** Détache un socket déconnecté sans supprimer le joueur (reconnexion possible). */
  detachSocket(socketId: string): void {
    let changed = false;
    for (const player of this.players.values()) {
      if (player.socketId === socketId) {
        player.socketId = null;
        changed = true;
      }
    }
    if (changed) {
      this.hooks.onPublic();
      this.hooks.onAdmin();
    }
  }

  /* ----------------------------------------------------------------- */
  /* Actions organisateur                                               */
  /* ----------------------------------------------------------------- */

  start(): Outcome<null> {
    if (this.state !== 'WAITING') {
      return fail(
        'BAD_STATE',
        this.state === 'FINISHED'
          ? 'Cette room est terminée. Créez une nouvelle room.'
          : 'Le quiz est déjà lancé.',
      );
    }
    if (this.players.size === 0) {
      return fail('NO_PLAYERS', 'Aucun joueur connecté pour démarrer le quiz.');
    }
    // Nouvel ordre aléatoire à chaque partie (identique pour tous les joueurs).
    this.playQuestions = shuffle(this.questions);
    this.state = 'COUNTDOWN';
    this.countdownEndsAt = Date.now() + COUNTDOWN_MS;
    for (const player of this.players.values()) {
      player.pendingStartAt = this.countdownEndsAt;
    }
    this.hooks.onPublic();
    this.hooks.onAdmin();
    // Les joueurs déjà en salle d'attente doivent recevoir leur décompte.
    for (const player of this.players.values()) {
      this.hooks.onPlayer(player);
    }
    return ok(null);
  }

  setAccess(closed: boolean): Outcome<null> {
    if (this.state === 'FINISHED') {
      return fail('BAD_STATE', 'La room est terminée : les inscriptions sont définitivement closes.');
    }
    if (this.accessClosed === closed) return ok(null);
    this.accessClosed = closed;
    this.hooks.onPublic();
    this.hooks.onAdmin();
    return ok(null);
  }

  /** Bascule l'écran présentateur (QR code d'inscription). */
  setDisplay(next: DisplayMode): Outcome<null> {
    if (next !== 'off' && next !== 'qr') {
      return fail('INVALID', 'Écran inconnu.');
    }
    if (this.display === next) return ok(null);
    this.display = next;
    this.hooks.onPublic();
    this.hooks.onAdmin();
    return ok(null);
  }

  /** Lance le dévoilement du classement (calcul de 8 s puis synthèse). */
  startReveal(): Outcome<null> {
    if (this.state !== 'FINISHED') {
      return fail('BAD_STATE', 'Le classement est disponible à la fin de la room.');
    }
    this.revealStage = 'calculating';
    this.revealCalculatingUntil = Date.now() + REVEAL_CALC_MS;
    this.revealCountdownEndsAt = null;
    this.hooks.onAdmin();
    return ok(null);
  }

  /** Décompte 5 → 0 puis podium, déclenché depuis une console de pilotage. */
  startPodiumCountdown(): Outcome<null> {
    if (this.revealStage !== 'summary' && this.revealStage !== 'calculating') {
      return fail('BAD_STATE', 'La synthèse du classement n’est pas encore affichée.');
    }
    this.revealStage = 'countdown';
    this.revealCalculatingUntil = null;
    this.revealCountdownEndsAt = Date.now() + REVEAL_COUNTDOWN_MS;
    this.hooks.onAdmin();
    return ok(null);
  }

  /** Ferme le classement sur tous les écrans. */
  hideReveal(): Outcome<null> {
    if (this.revealStage === 'off') return ok(null);
    this.resetReveal();
    this.hooks.onAdmin();
    return ok(null);
  }

  private resetReveal(): void {
    this.revealStage = 'off';
    this.revealCalculatingUntil = null;
    this.revealCountdownEndsAt = null;
  }

  newRoom(): Outcome<null> {
    if (this.state !== 'FINISHED') {
      return fail(
        'BAD_STATE',
        "La room actuelle n'est pas terminée : « Nouvelle room » est indisponible.",
      );
    }
    // Archive la room terminée avant de réinitialiser la mémoire.
    const previous = this.buildReport();
    if (previous.players.length > 0) {
      this.archivedReports.push(previous);
      if (this.archivedReports.length > 50) this.archivedReports.shift();
    }
    this.roomId = randomUUID();
    this.roomIndex += 1;
    this.roomOpenedAt = Date.now();
    this.finishedAt = null;
    this.state = 'WAITING';
    this.display = 'off';
    this.resetReveal();
    this.accessClosed = false;
    this.countdownEndsAt = null;
    this.quizStartedAt = null;
    this.playQuestions = [];
    this.players.clear();
    // Les cadeaux sont volontairement conservés pour les nouvelles rooms.
    this.hooks.onPublic();
    this.hooks.onAdmin();
    return ok(null);
  }

  /** Enregistre les 3 cadeaux du podium (conservés pour toutes les rooms). */
  setPrizes(input: unknown): Outcome<null> {
    if (!Array.isArray(input) || input.length !== 3) {
      return fail('INVALID', 'Renseignez exactement trois cadeaux (1re, 2e et 3e place).');
    }
    const next: string[] = [];
    for (const value of input) {
      if (value === undefined || value === null || value === '') {
        next.push('');
        continue;
      }
      if (typeof value !== 'string') {
        return fail('INVALID', 'Chaque cadeau doit être un texte.');
      }
      const text = value.trim().replace(/\s+/g, ' ');
      if (text.length > 80 || /[\u0000-\u001f\u007f]/.test(text)) {
        return fail('INVALID', 'Chaque cadeau est limité à 80 caractères.');
      }
      next.push(text);
    }
    this.prizes = next;
    this.hooks.onAdmin();
    return ok(null);
  }

  /** Remplace le quiz (questions + réponses). Conservé d'une room à l'autre. */
  setQuestions(input: unknown): Outcome<null> {
    if (this.state === 'COUNTDOWN' || this.state === 'RUNNING') {
      return fail('BAD_STATE', 'Les questions ne sont plus modifiables pendant le quiz.');
    }
    if (!Array.isArray(input) || input.length === 0) {
      return fail('INVALID', 'Ajoutez au moins une question.');
    }
    if (input.length > 10) {
      return fail('INVALID', 'Le quiz est limité à 10 questions.');
    }

    const next: Question[] = [];
    for (const [index, value] of input.entries()) {
      const raw = value as { prompt?: unknown; options?: unknown; correctIndex?: unknown };
      const prompt = cleanText(raw?.prompt, 200);
      if (!prompt) {
        return fail(
          'INVALID',
          `Question ${index + 1} : l'intitulé est obligatoire (200 caractères maximum).`,
        );
      }
      if (!Array.isArray(raw?.options) || raw.options.length < 2 || raw.options.length > 5) {
        return fail('INVALID', `Question ${index + 1} : prévoyez entre 2 et 5 réponses.`);
      }
      const options: string[] = [];
      for (const option of raw.options) {
        const text = cleanText(option, 100);
        if (!text) {
          return fail(
            'INVALID',
            `Question ${index + 1} : chaque réponse est obligatoire (100 caractères maximum).`,
          );
        }
        options.push(text);
      }
      const correctIndex = raw?.correctIndex;
      if (
        !Number.isInteger(correctIndex) ||
        (correctIndex as number) < 0 ||
        (correctIndex as number) >= options.length
      ) {
        return fail('INVALID', `Question ${index + 1} : indiquez la bonne réponse.`);
      }
      next.push({ id: `q${index + 1}`, prompt, options, correctIndex: correctIndex as number });
    }

    this.questions = next;
    this.hooks.onAdmin();
    return ok(null);
  }

  /* ----------------------------------------------------------------- */
  /* Horloge autoritaire                                                */
  /* ----------------------------------------------------------------- */

  /** Appelé toutes les 100 ms par le serveur. */
  tick(): void {
    const now = Date.now();
    this.tickReveal(now);

    if (this.state === 'COUNTDOWN' && this.countdownEndsAt !== null && now >= this.countdownEndsAt) {
      this.state = 'RUNNING';
      this.quizStartedAt = this.countdownEndsAt;
      this.countdownEndsAt = null;
      this.hooks.onPublic();
      this.hooks.onAdmin();
    }

    if (this.state !== 'RUNNING') return;

    for (const player of this.players.values()) {
      if (
        player.startedHr === null &&
        player.pendingStartAt !== null &&
        now >= player.pendingStartAt
      ) {
        this.begin(player);
      }
    }

    for (const player of this.players.values()) {
      if (player.submittedAt === null && player.endsAt !== null && now >= player.endsAt) {
        this.finalize(player, true);
      }
    }
  }

  private tickReveal(now: number): void {
    if (
      this.revealStage === 'calculating' &&
      this.revealCalculatingUntil !== null &&
      now >= this.revealCalculatingUntil
    ) {
      this.revealStage = 'summary';
      this.revealCalculatingUntil = null;
      this.hooks.onAdmin();
      return;
    }
    if (
      this.revealStage === 'countdown' &&
      this.revealCountdownEndsAt !== null &&
      now >= this.revealCountdownEndsAt
    ) {
      this.revealStage = 'revealed';
      this.revealCountdownEndsAt = null;
      this.hooks.onAdmin();
    }
  }

  private begin(player: Player): void {
    player.pendingStartAt = null;
    player.total = this.questions.length;
    // Propositions mélangées, une fois pour ce joueur : l'ordre reste stable
    // pendant tout son quiz (y compris s'il se reconnecte).
    const served = this.playQuestions.length > 0 ? this.playQuestions : this.questions;
    player.optionOrders = {};
    for (const question of served) {
      const order = shuffle(question.options.map((_, index) => index));
      // Garantit un ordre différent de celui saisi par l'organisateur.
      if (question.options.length > 1 && order.every((value, index) => value === index)) {
        order.push(order.shift() as number);
      }
      player.optionOrders[question.id] = order;
    }
    player.startedAt = Date.now();
    player.startedHr = process.hrtime.bigint();
    player.endsAt = player.startedAt + QUIZ_DURATION_MS;
    this.hooks.onPlayer(player);
    this.hooks.onAdmin();
  }

  private finalize(player: Player, auto: boolean): void {
    if (player.submittedAt !== null || player.startedHr === null || player.endsAt === null) return;

    const startedHr = player.startedHr;
    const endHr = auto
      ? startedHr + BigInt(QUIZ_DURATION_MS) * 1_000_000n
      : process.hrtime.bigint();
    const elapsed = Number(endHr - startedHr) / 1_000_000;

    player.durationMs = auto ? QUIZ_DURATION_MS : Math.max(0, Math.round(elapsed));
    player.score = this.questions.reduce((total, question) => {
      const chosen = player.answers[question.id];
      if (chosen === undefined) return total;
      // La réponse est stockée dans l'ordre mélangé du joueur : on repasse
      // par l'ordre d'origine pour la comparer à la correction.
      const order = player.optionOrders[question.id];
      const original = order ? (order[chosen] ?? chosen) : chosen;
      return total + (original === question.correctIndex ? 1 : 0);
    }, 0);
    player.submittedAt = Date.now();
    player.autoClosed = auto;

    this.hooks.onPlayer(player);
    this.hooks.onAdmin();
    this.checkFinished();
  }

  private checkFinished(): void {
    if (this.state !== 'RUNNING') return;
    if (this.players.size === 0) return;
    for (const player of this.players.values()) {
      if (player.submittedAt === null) return;
    }
    this.state = 'FINISHED';
    this.finishedAt = Date.now();
    this.hooks.onPublic();
    this.hooks.onAdmin();
  }

  /* ----------------------------------------------------------------- */
  /* Vues réseau                                                        */
  /* ----------------------------------------------------------------- */

  publicState(): PublicRoom {
    let connectedCount = 0;
    for (const player of this.players.values()) {
      if (player.socketId !== null) connectedCount += 1;
    }
    return {
      roomId: this.roomId,
      state: this.state,
      display: this.display,
      playerCount: this.players.size,
      connectedCount,
      accessClosed: this.accessClosed,
      countdownEndsAt: this.countdownEndsAt,
      serverNow: Date.now(),
    };
  }

  sessionFor(player: Player): PlayerSession {
    let phase: PlayerPhase;
    if (player.submittedAt !== null) phase = 'result';
    else if (player.startedHr !== null) phase = 'quiz';
    else if (player.pendingStartAt !== null || this.state === 'COUNTDOWN') phase = 'countdown';
    else phase = 'waiting';

    const countdownEndsAt =
      phase === 'countdown' ? (player.pendingStartAt ?? this.countdownEndsAt) : null;

    const served = this.playQuestions.length > 0 ? this.playQuestions : this.questions;
    const questions: PublicQuestion[] | null =
      phase === 'quiz' || phase === 'result'
        ? served.map((question) => {
            const order = player.optionOrders[question.id];
            return {
              id: question.id,
              prompt: question.prompt,
              options: order ? order.map((index) => question.options[index]) : [...question.options],
            };
          })
        : null;

    return {
      player: {
        id: player.id,
        firstName: player.firstName,
        lastName: player.lastName,
        company: player.company,
      },
      phase,
      roomState: this.state,
      accessClosed: this.accessClosed,
      playerCount: this.players.size,
      serverNow: Date.now(),
      countdownEndsAt,
      quizEndsAt: player.endsAt,
      questions,
      answers: { ...player.answers },
      result: player.submittedAt !== null ? this.resultOf(player) : null,
    };
  }

  /** Snapshot complet réservé aux sockets du canal `admin`. */
  snapshot(): AdminSnapshot {
    const players: AdminPlayerRow[] = [...this.players.values()]
      .sort((a, b) => a.joinedAt - b.joinedAt)
      .map((player) => ({
        id: player.id,
        firstName: player.firstName,
        lastName: player.lastName,
        company: player.company,
        status:
          player.submittedAt !== null
            ? 'finished'
            : player.startedHr !== null
              ? 'in_progress'
              : 'connected',
        connected: player.socketId !== null,
        score: player.score,
        durationMs: player.durationMs,
        answeredCount: Object.keys(player.answers).length,
        autoClosed: player.autoClosed,
        joinedAt: player.joinedAt,
      }));

    const stats: AdminStats = {
      total: players.length,
      connected: players.filter((p) => p.connected).length,
      started: players.filter((p) => p.status !== 'connected').length,
      finished: players.filter((p) => p.status === 'finished').length,
      waiting: players.filter((p) => p.status === 'connected').length,
    };

    return {
      roomId: this.roomId,
      roomState: this.state,
      display: this.display,
      reveal: {
        stage: this.revealStage,
        calculatingUntil: this.revealCalculatingUntil,
        countdownEndsAt: this.revealCountdownEndsAt,
      },
      accessClosed: this.accessClosed,
      serverNow: Date.now(),
      countdownEndsAt: this.countdownEndsAt,
      quizStartedAt: this.quizStartedAt,
      quizEndsAt: this.roomEndsAt(),
      stats,
      players,
      leaderboard: this.leaderboard(),
      questions: this.questions.map((question) => ({
        id: question.id,
        prompt: question.prompt,
        options: [...question.options],
        correctIndex: question.correctIndex,
      })),
      prizes: [...this.prizes],
    };
  }

  private roomEndsAt(): number | null {
    let latest: number | null = null;
    for (const player of this.players.values()) {
      if (player.submittedAt !== null) continue;
      // Un retardataire encore en décompte aura 60 s supplémentaires.
      const candidate =
        player.endsAt ??
        (player.pendingStartAt !== null ? player.pendingStartAt + QUIZ_DURATION_MS : null);
      if (candidate !== null) {
        latest = latest === null ? candidate : Math.max(latest, candidate);
      }
    }
    return latest;
  }

  /** Classement : plus de bonnes réponses d'abord, puis temps le plus court. */
  private leaderboard(): LeaderboardEntry[] {
    return [...this.players.values()]
      .filter(
        (player) =>
          player.submittedAt !== null && player.score !== null && player.durationMs !== null,
      )
      .sort((a, b) => {
        const byScore = (b.score ?? 0) - (a.score ?? 0);
        if (byScore !== 0) return byScore;
        const byTime = (a.durationMs ?? 0) - (b.durationMs ?? 0);
        if (byTime !== 0) return byTime;
        return a.lastName.localeCompare(b.lastName, 'fr');
      })
      .map((player, index) => ({
        rank: index + 1,
        playerId: player.id,
        firstName: player.firstName,
        lastName: player.lastName,
        company: player.company,
        score: player.score ?? 0,
        total: player.total ?? this.questions.length,
        durationMs: player.durationMs ?? 0,
        gift: index < 3 ? this.prizes[index] || null : null,
      }));
  }

  /* ----------------------------------------------------------------- */
  /* Rapports (export PDF)                                              */
  /* ----------------------------------------------------------------- */

  /**
   * Rapports disponibles : rooms archivées puis room courante.
   * Sans `roomId`, renvoie tout l'historique de la session.
   */
  reports(roomId?: string): RoomReport[] {
    const current = this.buildReport();
    if (roomId) {
      return [...this.archivedReports, current].filter((report) => report.roomId === roomId);
    }
    const includeCurrent = current.players.length > 0 || this.state !== 'WAITING';
    return includeCurrent ? [...this.archivedReports, current] : [...this.archivedReports];
  }

  private buildReport(): RoomReport {
    const questionCount = this.questions.length;

    const finished = [...this.players.values()]
      .filter(
        (player) =>
          player.submittedAt !== null && player.score !== null && player.durationMs !== null,
      )
      .sort((a, b) => {
        const byScore = (b.score ?? 0) - (a.score ?? 0);
        if (byScore !== 0) return byScore;
        const byTime = (a.durationMs ?? 0) - (b.durationMs ?? 0);
        if (byTime !== 0) return byTime;
        return a.lastName.localeCompare(b.lastName, 'fr');
      });

    const pending = [...this.players.values()]
      .filter((player) => player.submittedAt === null)
      .sort((a, b) => a.joinedAt - b.joinedAt);

    const row = (player: Player, rank: number | null): RoomReportPlayer => ({
      rank,
      firstName: player.firstName,
      lastName: player.lastName,
      company: player.company,
      status:
        player.submittedAt !== null
          ? 'finished'
          : player.startedHr !== null
            ? 'in_progress'
            : 'connected',
      score: player.score,
      total: player.total ?? questionCount,
      durationMs: player.durationMs,
      answeredCount: Object.keys(player.answers).length,
      autoClosed: player.autoClosed,
      joinedAt: player.joinedAt,
    });

    const players = [
      ...finished.map((player, position) => row(player, position + 1)),
      ...pending.map((player) => row(player, null)),
    ];

    const allCorrect = finished.filter(
      (player) => (player.score ?? 0) === (player.total ?? questionCount),
    ).length;
    const someCorrect = finished.filter((player) => {
      const score = player.score ?? 0;
      return score > 0 && score < (player.total ?? questionCount);
    }).length;
    const noneCorrect = finished.filter((player) => (player.score ?? 0) === 0).length;
    const average = (values: number[]): number | null =>
      values.length > 0 ? values.reduce((sum, value) => sum + value, 0) / values.length : null;

    return {
      roomId: this.roomId,
      index: this.roomIndex,
      label: `Room ${this.roomIndex}`,
      state: this.state,
      openedAt: this.roomOpenedAt,
      finishedAt: this.finishedAt,
      questionCount,
      prizes: [...this.prizes],
      stats: {
        participants: this.players.size,
        finished: finished.length,
        allCorrect,
        someCorrect,
        noneCorrect,
        averageScore: average(finished.map((player) => player.score ?? 0)),
        averageDurationMs: average(finished.map((player) => player.durationMs ?? 0)),
      },
      top3: players.slice(0, Math.min(3, finished.length)),
      players,
    };
  }

  private resultOf(player: Player): PlayerResult {
    return {
      score: player.score ?? 0,
      total: player.total ?? this.questions.length,
      durationMs: player.durationMs ?? 0,
      autoClosed: player.autoClosed,
    };
  }
}
