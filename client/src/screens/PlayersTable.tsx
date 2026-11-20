import { useMemo, useState } from 'react';
import { ArrowDown, ArrowUp, ArrowUpDown, Search, Users } from 'lucide-react';
import { formatDuration, type AdminPlayerRow, type PlayerStatus } from '@shared';

type SortKey = 'name' | 'company' | 'status' | 'score' | 'durationMs';
type StatusFilter = 'all' | PlayerStatus;

const STATUS_LABEL: Record<PlayerStatus, string> = {
  connected: 'Connecté',
  in_progress: 'En cours',
  finished: 'Terminé',
};

const STATUS_BADGE: Record<PlayerStatus, string> = {
  connected: 'badge-neutral',
  in_progress: 'badge-info',
  finished: 'badge-success',
};

const STATUS_ORDER: Record<PlayerStatus, number> = {
  in_progress: 0,
  connected: 1,
  finished: 2,
};

interface PlayersTableProps {
  players: AdminPlayerRow[];
}

export function PlayersTable({ players }: PlayersTableProps) {
  const [query, setQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [sortKey, setSortKey] = useState<SortKey>('name');
  const [sortDir, setSortDir] = useState<1 | -1>(1);

  const rows = useMemo(() => {
    const term = query.trim().toLowerCase();

    const filtered = players.filter((player) => {
      if (statusFilter !== 'all' && player.status !== statusFilter) return false;
      if (term.length === 0) return true;
      return `${player.firstName} ${player.lastName} ${player.company}`
        .toLowerCase()
        .includes(term);
    });

    const valueOf = (player: AdminPlayerRow): string | number => {
      switch (sortKey) {
        case 'name':
          return `${player.lastName} ${player.firstName}`.toLowerCase();
        case 'company':
          return player.company.toLowerCase();
        case 'status':
          return STATUS_ORDER[player.status];
        case 'score':
          return player.score ?? -1;
        case 'durationMs':
          return player.durationMs ?? Number.MAX_SAFE_INTEGER;
      }
    };

    return [...filtered].sort((a, b) => {
      const left = valueOf(a);
      const right = valueOf(b);
      if (typeof left === 'number' && typeof right === 'number') {
        return (left - right) * sortDir;
      }
      return String(left).localeCompare(String(right), 'fr') * sortDir;
    });
  }, [players, query, statusFilter, sortKey, sortDir]);

  const toggleSort = (key: SortKey) => {
    if (key === sortKey) {
      setSortDir((direction) => (direction === 1 ? -1 : 1));
    } else {
      setSortKey(key);
      setSortDir(1);
    }
  };

  const sortIcon = (key: SortKey) => {
    if (key !== sortKey) return <ArrowUpDown size={13} />;
    return sortDir === 1 ? <ArrowUp size={13} /> : <ArrowDown size={13} />;
  };

  const header = (key: SortKey, label: string) => (
    <th scope="col">
      <button type="button" className="sort-btn" onClick={() => toggleSort(key)}>
        {label}
        {sortIcon(key)}
      </button>
    </th>
  );

  return (
    <section className="card table-card" aria-label="Liste des joueurs">
      <div className="table-toolbar">
        <div>
          <span className="eyebrow">Participants</span>
          <h2>Liste des joueurs</h2>
        </div>
        <div className="table-filters">
          <div className="input-icon input-search">
            <Search size={16} />
            <input
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Rechercher un joueur, une société…"
              aria-label="Rechercher un joueur"
            />
          </div>
          <select
            className="select"
            value={statusFilter}
            onChange={(event) => setStatusFilter(event.target.value as StatusFilter)}
            aria-label="Filtrer par statut"
          >
            <option value="all">Tous les statuts</option>
            <option value="connected">Connecté</option>
            <option value="in_progress">En cours</option>
            <option value="finished">Terminé</option>
          </select>
        </div>
      </div>

      {rows.length === 0 ? (
        <div className="empty-state">
          <Users size={26} />
          <h3>Aucun joueur à afficher</h3>
          <p className="muted">
            {players.length === 0
              ? "Les participants apparaîtront ici dès qu'ils auront rejoint la room."
              : 'Aucun résultat pour cette recherche ou ce filtre.'}
          </p>
        </div>
      ) : (
        <div className="table-scroll">
          <table className="players-table">
            <thead>
              <tr>
                {header('name', 'Nom / Prénom')}
                {header('company', 'Société')}
                {header('status', 'Statut')}
                {header('score', 'Score')}
                {header('durationMs', 'Temps')}
              </tr>
            </thead>
            <tbody>
              {rows.map((player) => (
                <tr key={player.id}>
                  <td>
                    <div className="player-cell">
                      <span
                        className={`presence-dot ${player.connected ? 'is-online' : ''}`}
                        title={player.connected ? 'Connecté' : 'Déconnecté'}
                      />
                      <div>
                        <strong>
                          {player.lastName.toUpperCase()} {player.firstName}
                        </strong>
                        <span className="cell-sub">{player.answeredCount}/5 réponses</span>
                      </div>
                    </div>
                  </td>
                  <td>{player.company}</td>
                  <td>
                    <span className={`badge ${STATUS_BADGE[player.status]}`}>
                      {STATUS_LABEL[player.status]}
                    </span>
                  </td>
                  <td className="cell-num">
                    {player.score === null ? <span className="muted">—</span> : `${player.score}/5`}
                  </td>
                  <td className="cell-num">
                    {player.durationMs === null ? (
                      <span className="muted">—</span>
                    ) : (
                      <>
                        {formatDuration(player.durationMs)}
                        {player.autoClosed && <span className="cell-sub">auto</span>}
                      </>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="table-foot">
        {rows.length} / {players.length} joueur{players.length > 1 ? 's' : ''}
      </div>
    </section>
  );
}
