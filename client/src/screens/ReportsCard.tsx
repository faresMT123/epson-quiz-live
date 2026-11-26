import { useCallback, useEffect, useState } from 'react';
import { FileDown, FileText, Loader2 } from 'lucide-react';
import type { AdminSnapshot, RoomReport } from '@shared';
import { downloadParticipantsPdf } from '../lib/reportPdf';

interface ReportsCardProps {
  snapshot: AdminSnapshot;
  requestReport: (roomId?: string) => Promise<RoomReport[] | null>;
}

const dateFmt = new Intl.DateTimeFormat('fr-FR', {
  day: '2-digit',
  month: 'short',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
});

const plural = (count: number) => (count > 1 ? 's' : '');

export function ReportsCard({ snapshot, requestReport }: ReportsCardProps) {
  const [reports, setReports] = useState<RoomReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const data = await requestReport();
    if (data) setReports(data);
    setLoading(false);
  }, [requestReport]);

  // Recharge uniquement quand la room change (nouvel identifiant ou nouvel état).
  // On retire volontairement `snapshot.stats.finished` des dépendances pour éviter
  // de ré-émettre `admin:report` à chaque fois qu'un joueur termine la room.
  useEffect(() => {
    void load();
  }, [load, snapshot.roomId, snapshot.roomState]);

  const download = async (roomId?: string) => {
    const target = roomId ?? 'all';
    setGenerating(target);
    try {
      const data = await requestReport(roomId);
      if (data && data.length > 0) downloadParticipantsPdf(data);
    } finally {
      setGenerating(null);
    }
  };

  const ordered = [...reports].sort((a, b) => b.index - a.index);

  return (
    <section className="neon-panel reports-card" aria-label="Rapports des participants">
      <div className="controls-head">
        <div>
          <span className="eyebrow neon-cyan">EXPORTS</span>
          <h2>RAPPORTS DES PARTICIPANTS</h2>
        </div>
        <button
          type="button"
          className="btn btn-primary btn-sm"
          onClick={() => void download()}
          disabled={loading || generating !== null || reports.length === 0}
          title="Télécharger un PDF avec toutes les rooms de la session."
        >
          {generating === 'all' ? (
            <Loader2 size={16} className="spin" />
          ) : (
            <FileDown size={16} />
          )}
          TOUT EN PDF
        </button>
      </div>

      <p className="helper-text reports-help">
        Un PDF par room : classement complet, scores, temps, podium et répartition des bonnes
        réponses (toutes justes, partiellement justes, aucune).
      </p>

      {loading && reports.length === 0 ? (
        <div className="reports-empty">
          <Loader2 size={18} className="spin" /> Chargement des rooms…
        </div>
      ) : ordered.length === 0 ? (
        <div className="reports-empty">
          <FileText size={20} />
          Aucun participant pour le moment : les rapports apparaîtront dès la première
          inscription.
        </div>
      ) : (
        <ul className="reports-list">
          {ordered.map((report) => (
            <li className="report-row" key={report.roomId}>
              <span className="report-index">{String(report.index).padStart(2, '0')}</span>
              <div className="report-main">
                <strong>
                  {report.label}
                  <span
                    className={`report-state ${
                      report.state === 'FINISHED' ? 'is-done' : 'is-live'
                    }`}
                  >
                    {report.state === 'FINISHED' ? 'TERMINÉE' : 'EN COURS'}
                  </span>
                </strong>
                <span className="report-meta">
                  {dateFmt.format(new Date(report.openedAt))} · {report.stats.participants}{' '}
                  joueur{plural(report.stats.participants)} · {report.stats.finished} terminé
                  {plural(report.stats.finished)} · {report.stats.allCorrect} sans faute
                </span>
              </div>
              <button
                type="button"
                className="btn btn-ghost btn-sm report-download"
                onClick={() => void download(report.roomId)}
                disabled={generating !== null}
                title={`Télécharger le rapport PDF de la ${report.label}.`}
              >
                {generating === report.roomId ? (
                  <Loader2 size={15} className="spin" />
                ) : (
                  <FileDown size={15} />
                )}
                PDF
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
