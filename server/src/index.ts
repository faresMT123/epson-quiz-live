import path from 'node:path';
import { existsSync } from 'node:fs';
import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';
import { createServer } from 'node:http';
import dotenv from 'dotenv';
import express from 'express';
import { Server } from 'socket.io';
import type {
  AdminAction,
  ClientToServerEvents,
  ErrorCode,
  Outcome,
  ServerToClientEvents,
} from '../../shared/src/index';
import { Game, type Player } from './game';

// Charge la racine du monorepo puis le dossier server (sans écraser).
dotenv.config({ path: path.resolve(__dirname, '../../.env') });
dotenv.config({ path: path.resolve(__dirname, '../.env') });

const configuredPort = Number(process.env.PORT);
const PORT = Number.isInteger(configuredPort) && configuredPort > 0 ? configuredPort : 3001;
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD ?? '';
const CORS_ORIGINS = (process.env.CORS_ORIGIN ?? 'http://localhost:5173,http://localhost:4173')
  .split(',')
  .map((origin) => origin.trim())
  .filter(Boolean);

// Render expose l'URL publique du service : on l'autorise sans configuration manuelle.
const publicUrl = process.env.RENDER_EXTERNAL_URL?.trim();
if (publicUrl && !CORS_ORIGINS.includes(publicUrl)) {
  CORS_ORIGINS.push(publicUrl);
}

if (ADMIN_PASSWORD.length === 0) {
  console.error(
    "[server] ADMIN_PASSWORD est manquant. Copiez .env.example vers .env et définissez un mot de passe.",
  );
  process.exit(1);
}

const app = express();
app.disable('x-powered-by');

const clientDist = path.resolve(__dirname, '../../client/dist');
const indexHtml = path.join(clientDist, 'index.html');
const serveClient = existsSync(indexHtml);
if (serveClient) {
  app.use(express.static(clientDist, { index: false }));
}

/** Jetons admin valides (en mémoire uniquement). */
const adminTokens = new Set<string>();

const game = new Game({
  onPublic: () => {
    io.emit('room:public', game.publicState());
  },
  onAdmin: () => scheduleAdminSnapshot(),
  onPlayer: (player: Player) => {
    io.to(playerRoom(player.id)).emit('player:session', game.sessionFor(player));
  },
});

const httpServer = createServer(app);
const io = new Server<ClientToServerEvents, ServerToClientEvents>(httpServer, {
  cors: {
    origin: CORS_ORIGINS,
    methods: ['GET', 'POST'],
  },
  pingInterval: 20_000,
  pingTimeout: 20_000,
  // Les messages sont petits : on borne la taille pour éviter les abus.
  maxHttpBufferSize: 64 * 1024,
});

app.get('/health', (_req, res) => {
  const state = game.publicState();
  res.json({
    ok: true,
    uptime: Math.round(process.uptime()),
    room: { state: state.state, players: state.playerCount, connected: state.connectedCount },
  });
});

if (serveClient) {
  app.get('*', (req, res, next) => {
    if (req.path.startsWith('/socket.io')) return next();
    res.sendFile(indexHtml);
  });
}

/* ------------------------------------------------------------------ */
/* Diffusion admin throttlée : au plus 1 snapshot par seconde          */
/* ------------------------------------------------------------------ */

let lastAdminEmit = 0;
let adminTimer: NodeJS.Timeout | null = null;

function emitAdminSnapshot(): void {
  lastAdminEmit = Date.now();
  io.to('admin').emit('admin:snapshot', game.snapshot());
}

function scheduleAdminSnapshot(): void {
  if (adminTimer !== null) return;
  const wait = 1000 - (Date.now() - lastAdminEmit);
  if (wait <= 0) {
    emitAdminSnapshot();
    return;
  }
  adminTimer = setTimeout(() => {
    adminTimer = null;
    emitAdminSnapshot();
  }, wait);
}

/* ------------------------------------------------------------------ */
/* Helpers                                                             */
/* ------------------------------------------------------------------ */

const playerRoom = (playerId: string): string => `p:${playerId}`;

const ok = <T,>(data: T): Outcome<T> => ({ ok: true, data });
const fail = (code: ErrorCode, message: string): Outcome<never> => ({
  ok: false,
  code,
  message,
});

function reply<T>(cb: unknown, value: Outcome<T>): void {
  if (typeof cb === 'function') {
    (cb as (res: Outcome<T>) => void)(value);
  }
}

function passwordMatches(candidate: string): boolean {
  const a = createHash('sha256').update(candidate).digest();
  const b = createHash('sha256').update(ADMIN_PASSWORD).digest();
  return timingSafeEqual(a, b);
}

/* ------------------------------------------------------------------ */
/* Connexions                                                          */
/* ------------------------------------------------------------------ */

io.on('connection', (socket) => {
  socket.data.adminAttempts = 0;
  socket.data.adminBlockedUntil = 0;
  socket.data.adminToken = null;

  /* ---------------- Admin ---------------- */

  socket.on('admin:login', (payload, cb) => {
    const now = Date.now();
    if (now < (socket.data.adminBlockedUntil as number)) {
      return reply(cb, fail('UNAUTHORIZED', 'Trop de tentatives. Réessayez dans quelques secondes.'));
    }
    const password = typeof payload?.password === 'string' ? payload.password : '';
    if (!passwordMatches(password)) {
      socket.data.adminAttempts = (socket.data.adminAttempts as number) + 1;
      if ((socket.data.adminAttempts as number) >= 5) {
        socket.data.adminAttempts = 0;
        socket.data.adminBlockedUntil = now + 5_000;
      }
      return reply(cb, fail('UNAUTHORIZED', 'Mot de passe incorrect.'));
    }

    socket.data.adminAttempts = 0;
    const token = randomBytes(32).toString('hex');
    adminTokens.add(token);
    socket.data.adminToken = token;
    void socket.join('admin');
    reply(cb, ok({ token }));
    // Snapshot immédiat (hors throttle : il est déjà limité par la connexion).
    socket.emit('admin:snapshot', game.snapshot());
  });

  socket.on('admin:resume', (payload, cb) => {
    const token = typeof payload?.token === 'string' ? payload.token : '';
    if (!token || !adminTokens.has(token)) {
      return reply(cb, fail('UNAUTHORIZED', 'Session administrateur expirée.'));
    }
    socket.data.adminToken = token;
    void socket.join('admin');
    reply(cb, ok(null));
    socket.emit('admin:snapshot', game.snapshot());
  });

  socket.on('admin:set-prizes', (payload, cb) => {
    const token = typeof payload?.token === 'string' ? payload.token : '';
    if (!token || token !== socket.data.adminToken || !adminTokens.has(token)) {
      return reply(cb, fail('UNAUTHORIZED', 'Session administrateur invalide.'));
    }
    const result = game.setPrizes(payload?.prizes);
    if (result.ok) scheduleAdminSnapshot();
    return reply(cb, result);
  });

  socket.on('admin:set-questions', (payload, cb) => {
    const token = typeof payload?.token === 'string' ? payload.token : '';
    if (!token || token !== socket.data.adminToken || !adminTokens.has(token)) {
      return reply(cb, fail('UNAUTHORIZED', 'Session administrateur invalide.'));
    }
    const result = game.setQuestions(payload?.questions);
    if (result.ok) scheduleAdminSnapshot();
    return reply(cb, result);
  });

  socket.on('admin:report', (payload, cb) => {
    const token = typeof payload?.token === 'string' ? payload.token : '';
    if (!token || token !== socket.data.adminToken || !adminTokens.has(token)) {
      return reply(cb, fail('UNAUTHORIZED', 'Session administrateur invalide.'));
    }
    const roomId =
      typeof payload?.roomId === 'string' && payload.roomId.length > 0 ? payload.roomId : undefined;
    return reply(cb, ok(game.reports(roomId)));
  });

  socket.on('admin:action', (payload, cb) => {
    const token = typeof payload?.token === 'string' ? payload.token : '';
    if (!token || token !== socket.data.adminToken || !adminTokens.has(token)) {
      return reply(cb, fail('UNAUTHORIZED', 'Session administrateur invalide.'));
    }
    const action = payload?.action as AdminAction;

    let result: Outcome<null>;
    switch (action) {
      case 'start':
        result = game.start();
        break;
      case 'close-access':
        result = game.setAccess(true);
        break;
      case 'open-access':
        result = game.setAccess(false);
        break;
      case 'new-room':
        result = game.newRoom();
        break;
      case 'show-qr':
        result = game.setDisplay('qr');
        break;
      case 'hide-qr':
        result = game.setDisplay('off');
        break;
      case 'show-results':
        result = game.startReveal();
        break;
      case 'reveal-podium':
        result = game.startPodiumCountdown();
        break;
      case 'hide-results':
        result = game.hideReveal();
        break;
      default:
        result = fail('INVALID', 'Action inconnue.');
    }

    if (!result.ok) return reply(cb, result);
    // Force une remontée rapide aux autres écrans admin (respecte le throttle).
    scheduleAdminSnapshot();
    return reply(cb, ok(null));
  });

  /* ---------------- Joueur ---------------- */

  socket.on('player:join', (payload, cb) => {
    const result = game.join(payload, socket.id);
    if (!result.ok) return reply(cb, result);
    void socket.join(playerRoom(result.data.player.id));
    reply(cb, result);
  });

  socket.on('player:resume', (payload, cb) => {
    const playerId = typeof payload?.playerId === 'string' ? payload.playerId : '';
    if (!playerId) return reply(cb, fail('INVALID', 'Identifiant joueur manquant.'));
    const result = game.resume(playerId, socket.id);
    if (!result.ok) return reply(cb, result);
    void socket.join(playerRoom(playerId));
    reply(cb, result);
  });

  socket.on('player:answer', (payload, cb) => {
    const playerId = typeof payload?.playerId === 'string' ? payload.playerId : '';
    const questionId = typeof payload?.questionId === 'string' ? payload.questionId : '';
    const optionIndex = payload?.optionIndex;
    if (!playerId) return reply(cb, fail('INVALID', 'Joueur inconnu.'));
    reply(cb, game.answer(playerId, questionId, optionIndex));
  });

  socket.on('player:finish', (payload, cb) => {
    const playerId = typeof payload?.playerId === 'string' ? payload.playerId : '';
    if (!playerId) return reply(cb, fail('INVALID', 'Joueur inconnu.'));
    reply(cb, game.finish(playerId));
  });

  socket.on('disconnect', () => {
    game.detachSocket(socket.id);
  });
});

/* ------------------------------------------------------------------ */
/* Horloge serveur                                                     */
/* ------------------------------------------------------------------ */

const TICK_MS = 100;
setInterval(() => game.tick(), TICK_MS);

httpServer.listen(PORT, () => {
  console.log(`[server] Epson Quiz Live à l'écoute sur http://localhost:${PORT}`);
  console.log(
    `[server] Client statique ${serveClient ? `servi depuis ${clientDist}` : 'absent (mode dev Vite)'}`,
  );
  console.log(`[server] Origines CORS : ${CORS_ORIGINS.join(', ')}`);
});
