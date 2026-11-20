import type { AdminSnapshot } from '@shared';

/** Répartition des joueurs affichée dans la synthèse du classement. */
export interface RevealStats {
  /** Nombre de participants de la room. */
  participants: number;
  /** Nombre de questions du quiz. */
  total: number;
  /** Joueurs ayant toutes les bonnes réponses. */
  allCorrect: number;
  /** Joueurs ayant au moins une bonne réponse, sans avoir tout trouvé. */
  someCorrect: number;
  /** Joueurs sans aucune bonne réponse. */
  noneCorrect: number;
}

export function computeRevealStats(snapshot: AdminSnapshot): RevealStats {
  const total = snapshot.leaderboard[0]?.total ?? snapshot.questions.length;
  const scored = snapshot.players.filter((player) => player.score !== null);
  return {
    participants: snapshot.stats.total,
    total,
    allCorrect: scored.filter((player) => player.score === total).length,
    someCorrect: scored.filter((player) => (player.score ?? 0) > 0 && player.score !== total).length,
    noneCorrect: scored.filter((player) => player.score === 0).length,
  };
}
