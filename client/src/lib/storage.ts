const PLAYER_KEY = 'epson-quiz.playerId';
export const ADMIN_TOKEN_KEY = 'epson-quiz.adminToken';

export function loadPlayerId(): string | null {
  try {
    return window.localStorage.getItem(PLAYER_KEY);
  } catch {
    return null;
  }
}

export function savePlayerId(playerId: string): void {
  try {
    window.localStorage.setItem(PLAYER_KEY, playerId);
  } catch {
    /* stockage indisponible : la session reste valide tant que l'onglet est ouvert */
  }
}

export function clearPlayerId(): void {
  try {
    window.localStorage.removeItem(PLAYER_KEY);
  } catch {
    /* ignore */
  }
}

export function loadAdminToken(): string | null {
  try {
    return window.sessionStorage.getItem(ADMIN_TOKEN_KEY);
  } catch {
    return null;
  }
}

export function saveAdminToken(token: string): void {
  try {
    window.sessionStorage.setItem(ADMIN_TOKEN_KEY, token);
  } catch {
    /* ignore */
  }
}

export function clearAdminToken(): void {
  try {
    window.sessionStorage.removeItem(ADMIN_TOKEN_KEY);
  } catch {
    /* ignore */
  }
}
