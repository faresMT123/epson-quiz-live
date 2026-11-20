import { useCallback, useEffect, useRef, useState } from 'react';
import type {
  JoinInput,
  Outcome,
  PlayerResult,
  PlayerSession,
  PublicRoom,
} from '@shared';
import { socket, syncServerClock } from './socket';
import { clearPlayerId, loadPlayerId, savePlayerId } from './storage';

export interface PlayerApi {
  session: PlayerSession | null;
  notice: string | null;
  joining: boolean;
  connected: boolean;
  join: (input: JoinInput) => Promise<Outcome<PlayerSession>>;
  answer: (questionId: string, optionIndex: number) => void;
  finish: () => Promise<PlayerResult | null>;
  leave: () => void;
}

export function usePlayer(): PlayerApi {
  const [session, setSession] = useState<PlayerSession | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [joining, setJoining] = useState(false);
  const [connected, setConnected] = useState(socket.connected);
  const playerIdRef = useRef<string | null>(loadPlayerId());

  const applySession = useCallback((next: PlayerSession) => {
    syncServerClock(next.serverNow);
    setSession(next);
    setNotice(null);
  }, []);

  const resume = useCallback(() => {
    const id = playerIdRef.current ?? loadPlayerId();
    if (!id) return;
    socket.emit('player:resume', { playerId: id }, (res) => {
      if (res.ok) {
        applySession(res.data);
      } else {
        clearPlayerId();
        playerIdRef.current = null;
        setSession(null);
        setNotice(res.message);
      }
    });
  }, [applySession]);

  useEffect(() => {
    const onSession = (next: PlayerSession) => applySession(next);
    const onRoom = (room: PublicRoom) => {
      syncServerClock(room.serverNow);
      setSession((prev) =>
        prev
          ? {
              ...prev,
              roomState: room.state,
              accessClosed: room.accessClosed,
              playerCount: room.playerCount,
              serverNow: room.serverNow,
            }
          : prev,
      );
    };
    const onConnect = () => {
      setConnected(true);
      resume();
    };
    const onDisconnect = () => setConnected(false);

    socket.on('player:session', onSession);
    socket.on('room:public', onRoom);
    socket.on('connect', onConnect);
    socket.on('disconnect', onDisconnect);
    setConnected(socket.connected);
    if (socket.connected) resume();

    return () => {
      socket.off('player:session', onSession);
      socket.off('room:public', onRoom);
      socket.off('connect', onConnect);
      socket.off('disconnect', onDisconnect);
    };
  }, [applySession, resume]);

  const join = useCallback(
    (input: JoinInput) =>
      new Promise<Outcome<PlayerSession>>((resolve) => {
        setJoining(true);
        setNotice(null);
        socket.emit('player:join', input, (res) => {
          setJoining(false);
          if (res.ok) {
            savePlayerId(res.data.player.id);
            playerIdRef.current = res.data.player.id;
            applySession(res.data);
          } else {
            setNotice(res.message);
          }
          resolve(res);
        });
      }),
    [applySession],
  );

  const answer = useCallback((questionId: string, optionIndex: number) => {
    const playerId = playerIdRef.current;
    if (!playerId) return;
    // Le serveur reste seul juge : cette réponse est validée à la réception.
    setSession((prev) =>
      prev ? { ...prev, answers: { ...prev.answers, [questionId]: optionIndex } } : prev,
    );
    socket.emit('player:answer', { playerId, questionId, optionIndex }, () => {});
  }, []);

  const finish = useCallback(
    () =>
      new Promise<PlayerResult | null>((resolve) => {
        const playerId = playerIdRef.current;
        if (!playerId) {
          resolve(null);
          return;
        }
        socket.emit('player:finish', { playerId }, (res) => {
          if (res.ok) {
            resolve(res.data);
          } else {
            setNotice(res.message);
            resolve(null);
          }
        });
      }),
    [],
  );

  const leave = useCallback(() => {
    clearPlayerId();
    playerIdRef.current = null;
    setSession(null);
  }, []);

  return { session, notice, joining, connected, join, answer, finish, leave };
}
