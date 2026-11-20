import { useCallback, useEffect, useState } from 'react';
import type { AdminAction, AdminSnapshot, QuestionInput } from '@shared';
import { socket, syncServerClock } from './socket';
import { clearAdminToken, loadAdminToken, saveAdminToken } from './storage';

export interface AdminApi {
  token: string | null;
  snapshot: AdminSnapshot | null;
  error: string | null;
  busy: boolean;
  connected: boolean;
  login: (password: string) => Promise<void>;
  action: (action: AdminAction) => Promise<void>;
  savePrizes: (prizes: string[]) => Promise<boolean>;
  saveQuestions: (questions: QuestionInput[]) => Promise<boolean>;
  logout: () => void;
}

export function useAdmin(): AdminApi {
  const [token, setToken] = useState<string | null>(() => loadAdminToken());
  const [snapshot, setSnapshot] = useState<AdminSnapshot | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [connected, setConnected] = useState(socket.connected);

  useEffect(() => {
    const onSnapshot = (next: AdminSnapshot) => {
      syncServerClock(next.serverNow);
      setSnapshot(next);
    };
    const onConnect = () => {
      setConnected(true);
      const stored = loadAdminToken();
      if (!stored) return;
      socket.emit('admin:resume', { token: stored }, (res) => {
        if (res.ok) {
          setToken(stored);
        } else {
          clearAdminToken();
          setToken(null);
          setSnapshot(null);
        }
      });
    };
    const onDisconnect = () => setConnected(false);

    socket.on('admin:snapshot', onSnapshot);
    socket.on('connect', onConnect);
    socket.on('disconnect', onDisconnect);
    setConnected(socket.connected);
    if (socket.connected) onConnect();

    return () => {
      socket.off('admin:snapshot', onSnapshot);
      socket.off('connect', onConnect);
      socket.off('disconnect', onDisconnect);
    };
  }, []);

  const login = useCallback(async (password: string) => {
    setBusy(true);
    setError(null);
    await new Promise<void>((resolve) => {
      socket.emit('admin:login', { password }, (res) => {
        setBusy(false);
        if (res.ok) {
          saveAdminToken(res.data.token);
          setToken(res.data.token);
        } else {
          setError(res.message);
        }
        resolve();
      });
    });
  }, []);

  const action = useCallback(
    async (nextAction: AdminAction) => {
      if (!token) return;
      setBusy(true);
      await new Promise<void>((resolve) => {
        socket.emit('admin:action', { token, action: nextAction }, (res) => {
          setBusy(false);
          setError(res.ok ? null : res.message);
          resolve();
        });
      });
    },
    [token],
  );

  const savePrizes = useCallback(
    async (prizes: string[]) => {
      if (!token) return false;
      setBusy(true);
      const ok = await new Promise<boolean>((resolve) => {
        socket.emit('admin:set-prizes', { token, prizes }, (res) => {
          setBusy(false);
          setError(res.ok ? null : res.message);
          resolve(res.ok);
        });
      });
      return ok;
    },
    [token],
  );

  const saveQuestions = useCallback(
    async (questions: QuestionInput[]) => {
      if (!token) return false;
      setBusy(true);
      const ok = await new Promise<boolean>((resolve) => {
        socket.emit('admin:set-questions', { token, questions }, (res) => {
          setBusy(false);
          setError(res.ok ? null : res.message);
          resolve(res.ok);
        });
      });
      return ok;
    },
    [token],
  );

  const logout = useCallback(() => {
    clearAdminToken();
    setToken(null);
    setSnapshot(null);
    setError(null);
  }, []);

  return {
    token,
    snapshot,
    error,
    busy,
    connected,
    login,
    action,
    savePrizes,
    saveQuestions,
    logout,
  };
}
