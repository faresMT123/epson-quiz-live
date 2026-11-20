import { io, type Socket } from 'socket.io-client';
import type { ClientToServerEvents, ServerToClientEvents } from '@shared';

const explicitUrl = import.meta.env.VITE_SERVER_URL?.trim();

/**
 * Sans URL explicite, la connexion se fait sur l'origine courante :
 * - en dev, le proxy Vite redirige `/socket.io` vers le serveur Node ;
 * - en production, le serveur sert le build client sur la même origine.
 * Pour une app Capacitor, `VITE_SERVER_URL` est obligatoire.
 */
export const socket: Socket<ServerToClientEvents, ClientToServerEvents> = io(
  explicitUrl && explicitUrl.length > 0 ? explicitUrl : undefined,
  {
    autoConnect: true,
    reconnection: true,
    reconnectionAttempts: Infinity,
    reconnectionDelay: 500,
    reconnectionDelayMax: 3_000,
    transports: ['websocket', 'polling'],
  },
);

/**
 * Décalage entre l'horloge du navigateur et celle du serveur.
 * Tous les décomptes sont affichés à partir des heures absolues du serveur.
 */
let clockOffset = 0;

export function syncServerClock(serverNow: number): void {
  if (Number.isFinite(serverNow)) {
    clockOffset = serverNow - Date.now();
  }
}

/** Heure serveur estimée, en epoch ms. */
export function serverNow(): number {
  return Date.now() + clockOffset;
}
