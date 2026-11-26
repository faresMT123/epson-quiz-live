import { jsPDF } from 'jspdf';
import {
  formatDuration,
  type RoomReport,
  type RoomReportPlayer,
  type RoomReportStats,
} from '@shared';
// Logos officiels, inlinés en base64 pour être embarqués dans le PDF.
import epsonLogoWhite from '../assets/epson-logo-white.png?inline';
import stciLogo from '../assets/stci-logo.png?inline';

/**
 * Génération du rapport PDF des participants.
 *
 * Le document est construit entièrement ici (pas de capture d'écran) afin de
 * rester net à l'impression : en-tête de marque, chiffres clés, répartition
 * des bonnes réponses, podium et classement complet paginé.
 */

type Rgb = readonly [number, number, number];

const PAGE_W = 595.28; // A4 portrait, en points
const PAGE_H = 841.89;
const M = 40;
const CONTENT_W = PAGE_W - M * 2;
const FOOTER_LINE = PAGE_H - 46;

const COLOR = {
  navy: [4, 16, 31] as Rgb,
  navySoft: [12, 34, 58] as Rgb,
  blue: [10, 95, 190] as Rgb,
  cyan: [24, 200, 216] as Rgb,
  gold: [198, 156, 56] as Rgb,
  silver: [140, 154, 170] as Rgb,
  bronze: [170, 116, 70] as Rgb,
  green: [24, 138, 88] as Rgb,
  red: [188, 70, 84] as Rgb,
  ink: [20, 30, 42] as Rgb,
  gray: [110, 124, 140] as Rgb,
  line: [216, 226, 238] as Rgb,
  soft: [241, 246, 251] as Rgb,
  softAlt: [249, 251, 254] as Rgb,
  white: [255, 255, 255] as Rgb,
};

const fill = (doc: jsPDF, color: Rgb) => doc.setFillColor(color[0], color[1], color[2]);
const stroke = (doc: jsPDF, color: Rgb) => doc.setDrawColor(color[0], color[1], color[2]);
const ink = (doc: jsPDF, color: Rgb) => doc.setTextColor(color[0], color[1], color[2]);

const dateFmt = new Intl.DateTimeFormat('fr-FR', {
  day: '2-digit',
  month: 'long',
  year: 'numeric',
});
const timeFmt = new Intl.DateTimeFormat('fr-FR', { hour: '2-digit', minute: '2-digit' });

const fullName = (player: RoomReportPlayer) =>
  `${player.lastName.toUpperCase()} ${player.firstName}`;

const percent = (value: number, base: number) =>
  base > 0 ? Math.round((value / base) * 100) : 0;

const plural = (count: number) => (count > 1 ? 's' : '');

/** Tronque un texte pour tenir dans une largeur donnée. */
function fit(
  doc: jsPDF,
  value: string,
  maxWidth: number,
  size: number,
  style: 'normal' | 'bold' = 'normal',
): string {
  doc.setFont('helvetica', style);
  doc.setFontSize(size);
  if (doc.getTextWidth(value) <= maxWidth) return value;
  let cut = value;
  while (cut.length > 1 && doc.getTextWidth(`${cut}…`) > maxWidth) {
    cut = cut.slice(0, -1);
  }
  return `${cut.trimEnd()}…`;
}

/* ------------------------------------------------------------------ */
/* En-tête de marque                                                   */
/* ------------------------------------------------------------------ */

const EPSON_ASPECT = 1930 / 435;
const STCI_ASPECT = 469 / 139;

function drawBand(doc: jsPDF, slim: boolean, rightLabel?: string): void {
  const height = slim ? 44 : 96;
  fill(doc, COLOR.navy);
  doc.rect(0, 0, PAGE_W, height, 'F');
  fill(doc, COLOR.cyan);
  doc.rect(0, height, PAGE_W, 3, 'F');

  const centerY = slim ? 22 : 40;

  // Logo Epson officiel (version blanche, pour fond sombre).
  const epsonH = slim ? 13 : 26;
  const epsonW = epsonH * EPSON_ASPECT;
  doc.addImage(epsonLogoWhite, 'PNG', M, centerY - epsonH / 2, epsonW, epsonH, 'epson-logo', 'FAST');

  const sepX = M + epsonW + (slim ? 10 : 16);
  stroke(doc, COLOR.cyan);
  doc.setLineWidth(0.8);
  const sepH = slim ? 9 : 13;
  doc.line(sepX, centerY - sepH, sepX, centerY + sepH);

  // Logo STCI officiel, posé directement sur le bandeau (sans fond).
  // Sa boîte inclut la baseline : on compense pour que le symbole ait la
  // même hauteur optique que le logotype Epson.
  const stciH = epsonH * 1.34;
  const stciW = stciH * STCI_ASPECT;
  const stciX = sepX + (slim ? 10 : 16);
  doc.addImage(
    stciLogo,
    'PNG',
    stciX,
    centerY - stciH / 2,
    stciW,
    stciH,
    'stci-logo',
    'FAST',
  );

  if (!slim) {
    ink(doc, [156, 190, 219] as Rgb);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.setCharSpace(1.4);
    doc.text('QUIZ EN DIRECT', PAGE_W - M, centerY - 5, { align: 'right' });
    doc.setCharSpace(0);
    ink(doc, COLOR.cyan);
    doc.setFontSize(7);
    doc.setCharSpace(1);
    doc.text('RAPPORT DES PARTICIPANTS', PAGE_W - M, centerY + 11, { align: 'right' });
    doc.setCharSpace(0);
  } else if (rightLabel) {
    ink(doc, [176, 202, 224]);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.text(rightLabel, PAGE_W - M, 29, { align: 'right' });
  }
}

/* ------------------------------------------------------------------ */
/* Blocs de contenu                                                    */
/* ------------------------------------------------------------------ */

function drawTitle(doc: jsPDF, y: number, title: string, subtitle: string): void {
  ink(doc, COLOR.ink);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(17);
  doc.setCharSpace(0.6);
  doc.text(title, M, y);
  doc.setCharSpace(0);

  ink(doc, COLOR.gray);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.text(subtitle, M, y + 17);
}

interface Kpi {
  label: string;
  value: string;
}

function drawKpis(doc: jsPDF, y: number, items: Kpi[]): number {
  const height = 58;
  const gap = 8;
  const width = (CONTENT_W - gap * (items.length - 1)) / items.length;

  items.forEach((item, index) => {
    const x = M + index * (width + gap);
    fill(doc, COLOR.soft);
    stroke(doc, COLOR.line);
    doc.setLineWidth(0.6);
    doc.roundedRect(x, y, width, height, 6, 6, 'FD');

    fill(doc, index === 0 ? COLOR.cyan : COLOR.blue);
    doc.rect(x, y + 10, 2.4, height - 20, 'F');

    ink(doc, COLOR.gray);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(6.6);
    doc.setCharSpace(0.8);
    doc.text(item.label, x + 11, y + 18);
    doc.setCharSpace(0);

    ink(doc, COLOR.ink);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(15);
    doc.text(fit(doc, item.value, width - 20, 15, 'bold'), x + 11, y + 41);
  });

  return y + height;
}

function drawAnswerBreakdown(doc: jsPDF, y: number, stats: RoomReportStats): number {
  const height = 114;
  fill(doc, COLOR.white);
  stroke(doc, COLOR.line);
  doc.setLineWidth(0.6);
  doc.roundedRect(M, y, CONTENT_W, height, 6, 6, 'FD');

  ink(doc, COLOR.gray);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7);
  doc.setCharSpace(0.9);
  doc.text('RÉPARTITION DES BONNES RÉPONSES', M + 14, y + 18);
  doc.setCharSpace(0);

  const rows: { label: string; count: number; color: Rgb }[] = [
    { label: 'Toutes les réponses justes', count: stats.allCorrect, color: COLOR.green },
    { label: 'Au moins une, sans tout trouver', count: stats.someCorrect, color: COLOR.blue },
    { label: 'Aucune réponse juste', count: stats.noneCorrect, color: COLOR.red },
  ];

  const barX = M + 220;
  const barW = 156;
  const barH = 7;

  rows.forEach((row, index) => {
    const baseline = y + 42 + index * 24;

    ink(doc, COLOR.ink);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8.5);
    doc.text(fit(doc, row.label, 190, 8.5), M + 14, baseline);

    fill(doc, COLOR.soft);
    doc.roundedRect(barX, baseline - barH + 1, barW, barH, barH / 2, barH / 2, 'F');
    const ratio = stats.finished > 0 ? row.count / stats.finished : 0;
    const filled = Math.max(ratio > 0 ? 5 : 0, Math.round(barW * ratio));
    if (filled > 0) {
      fill(doc, row.color);
      doc.roundedRect(barX, baseline - barH + 1, filled, barH, barH / 2, barH / 2, 'F');
    }

    ink(doc, COLOR.ink);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8.5);
    doc.text(
      `${row.count} joueur${plural(row.count)}`,
      PAGE_W - M - 76,
      baseline,
      { align: 'right' },
    );
    ink(doc, COLOR.gray);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.text(`${percent(row.count, stats.finished)} %`, PAGE_W - M - 14, baseline, {
      align: 'right',
    });
  });

  ink(doc, COLOR.gray);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(6.5);
  doc.text(
    `Base : ${stats.finished} joueur${plural(stats.finished)} ayant terminé la room.`,
    M + 14,
    y + height - 11,
  );

  return y + height;
}

function drawPodium(doc: jsPDF, y: number, report: RoomReport): number {
  ink(doc, COLOR.gray);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7);
  doc.setCharSpace(0.9);
  doc.text('PODIUM · TOP 3', M, y);
  doc.setCharSpace(0);

  const cardsY = y + 11;
  const height = 108;
  const gap = 10;
  const width = (CONTENT_W - gap * 2) / 3;
  const tones = [COLOR.gold, COLOR.silver, COLOR.bronze];
  const gifts = report.prizes;

  for (let index = 0; index < 3; index += 1) {
    const x = M + index * (width + gap);
    const player = report.top3[index] ?? null;

    if (player) {
      fill(doc, COLOR.white);
    } else {
      fill(doc, COLOR.softAlt);
    }
    stroke(doc, COLOR.line);
    doc.setLineWidth(0.6);
    doc.roundedRect(x, cardsY, width, height, 6, 6, 'FD');

    fill(doc, tones[index]);
    doc.rect(x + 6, cardsY, width - 12, 3, 'F');

    fill(doc, tones[index]);
    doc.circle(x + 25, cardsY + 30, 11, 'F');
    ink(doc, COLOR.white);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.text(String(index + 1), x + 25, cardsY + 34, { align: 'center' });

    if (player) {
      ink(doc, COLOR.ink);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8.8);
      doc.text(fit(doc, fullName(player), width - 52, 8.8, 'bold'), x + 41, cardsY + 28);

      ink(doc, COLOR.gray);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7);
      doc.text(fit(doc, player.company, width - 52, 7), x + 41, cardsY + 39);

      stroke(doc, COLOR.line);
      doc.setLineWidth(0.5);
      doc.line(x + 12, cardsY + 50, x + width - 12, cardsY + 50);

      ink(doc, COLOR.ink);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8.4);
      doc.text(`${player.score ?? 0}/${player.total} bonnes réponses`, x + 12, cardsY + 66);

      ink(doc, COLOR.gray);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7.4);
      doc.text(`Temps : ${formatDuration(player.durationMs ?? 0)}`, x + 12, cardsY + 78);

      const gift = gifts[index] ? `Cadeau : ${gifts[index]}` : 'Cadeau : —';
      ink(doc, COLOR.blue);
      doc.setFontSize(6.8);
      const lines = doc.splitTextToSize(gift, width - 24) as string[];
      doc.text(lines.slice(0, 2), x + 12, cardsY + 92);
    } else {
      ink(doc, COLOR.gray);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8);
      doc.text('Place non attribuée', x + 41, cardsY + 30);
      ink(doc, COLOR.gray);
      doc.setFontSize(6.8);
      doc.text('Aucun joueur classé à ce rang.', x + 12, cardsY + 66);
    }
  }

  return cardsY + height;
}

/* ------------------------------------------------------------------ */
/* Tableau générique paginé                                            */
/* ------------------------------------------------------------------ */

interface Column<T> {
  label: string;
  width?: number;
  align?: 'left' | 'center' | 'right';
  bold?: boolean;
  value: (row: T) => string;
  tone?: (row: T) => Rgb | null;
}

interface TableOptions {
  rowHeight?: number;
  /** Appelé quand une nouvelle page est nécessaire ; renvoie l'ordonnée du tableau. */
  onPageBreak: () => number;
  emptyLabel?: string;
}

function drawTable<T>(
  doc: jsPDF,
  startY: number,
  columns: Column<T>[],
  rows: T[],
  options: TableOptions,
): number {
  const rowHeight = options.rowHeight ?? 21;
  const headerHeight = 22;
  let y = startY;

  if (rows.length === 0) {
    fill(doc, COLOR.softAlt);
    stroke(doc, COLOR.line);
    doc.setLineWidth(0.6);
    doc.roundedRect(M, y, CONTENT_W, 40, 5, 5, 'FD');
    ink(doc, COLOR.gray);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.text(options.emptyLabel ?? 'Aucune donnée disponible.', M + CONTENT_W / 2, y + 23, {
      align: 'center',
    });
    return y + 40;
  }

  const fixedWidth = columns.reduce((sum, column) => sum + (column.width ?? 0), 0);
  const widths = columns.map((column) => column.width ?? Math.max(40, CONTENT_W - fixedWidth));

  const drawHeader = () => {
    fill(doc, COLOR.navy);
    doc.rect(M, y, CONTENT_W, headerHeight, 'F');
    let x = M;
    columns.forEach((column, index) => {
      const width = widths[index];
      const align = column.align ?? 'left';
      const tx = align === 'center' ? x + width / 2 : align === 'right' ? x + width - 8 : x + 8;
      ink(doc, [206, 228, 244] as Rgb);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(6.6);
      doc.setCharSpace(0.7);
      doc.text(column.label, tx, y + 14, { align });
      doc.setCharSpace(0);
      x += width;
    });
    y += headerHeight;
  };

  drawHeader();

  rows.forEach((row, rowIndex) => {
    if (y + rowHeight > FOOTER_LINE - 6) {
      y = options.onPageBreak();
      drawHeader();
    }

    if (rowIndex % 2 === 1) {
      fill(doc, COLOR.softAlt);
      doc.rect(M, y, CONTENT_W, rowHeight, 'F');
    }

    let x = M;
    columns.forEach((column, index) => {
      const width = widths[index];
      const align = column.align ?? 'left';
      const tx = align === 'center' ? x + width / 2 : align === 'right' ? x + width - 8 : x + 8;
      const style = column.bold ? 'bold' : 'normal';
      const label = fit(doc, column.value(row), width - 12, 8.1, style);
      doc.setFont('helvetica', style);
      doc.setFontSize(8.1);
      ink(doc, column.tone?.(row) ?? COLOR.ink);
      doc.text(label, tx, y + rowHeight / 2 + 2.9, { align });
      x += width;
    });

    stroke(doc, [234, 240, 247] as Rgb);
    doc.setLineWidth(0.4);
    doc.line(M, y + rowHeight, PAGE_W - M, y + rowHeight);
    y += rowHeight;
  });

  return y;
}

/* ------------------------------------------------------------------ */
/* Pages                                                               */
/* ------------------------------------------------------------------ */

function drawRoomPage(doc: jsPDF, report: RoomReport): void {
  const stateLabel = report.state === 'FINISHED' ? 'Room terminée' : 'Room en cours';
  drawBand(doc, false);
  drawTitle(
    doc,
    126,
    report.label.toUpperCase(),
    `${dateFmt.format(new Date(report.openedAt))} · ${stateLabel} · ${
      report.questionCount
    } question${plural(report.questionCount)}`,
  );

  const stats = report.stats;
  const kpiBottom = drawKpis(doc, 164, [
    { label: 'PARTICIPANTS', value: String(stats.participants) },
    { label: 'ONT TERMINÉ', value: String(stats.finished) },
    {
      label: 'SCORE MOYEN',
      value:
        stats.averageScore === null
          ? '—'
          : `${stats.averageScore.toFixed(1).replace('.', ',')} / ${report.questionCount}`,
    },
    {
      label: 'TEMPS MOYEN',
      value: stats.averageDurationMs === null ? '—' : formatDuration(stats.averageDurationMs),
    },
  ]);

  const breakdownBottom = drawAnswerBreakdown(doc, kpiBottom + 16, stats);
  const podiumBottom = drawPodium(doc, breakdownBottom + 26, report);

  const tableTop = podiumBottom + 26;
  ink(doc, COLOR.gray);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7);
  doc.setCharSpace(0.9);
  doc.text('CLASSEMENT COMPLET', M, tableTop - 8);
  doc.setCharSpace(0);

  const columns: Column<RoomReportPlayer>[] = [
    {
      label: 'RANG',
      width: 38,
      align: 'center',
      bold: true,
      value: (player) => (player.rank === null ? '—' : String(player.rank)),
      tone: (player) =>
        player.rank === 1
          ? COLOR.gold
          : player.rank === 2
            ? COLOR.silver
            : player.rank === 3
              ? COLOR.bronze
              : COLOR.ink,
    },
    {
      label: 'JOUEUR',
      width: 164,
      bold: true,
      value: (player) => fullName(player),
    },
    {
      label: 'SOCIÉTÉ',
      width: 134,
      value: (player) => player.company,
    },
    {
      label: 'SCORE',
      width: 56,
      align: 'center',
      value: (player) => (player.score === null ? '—' : `${player.score}/${player.total}`),
    },
    {
      label: 'TEMPS',
      width: 66,
      align: 'right',
      value: (player) =>
        player.durationMs === null ? '—' : `${formatDuration(player.durationMs)}${player.autoClosed ? ' *' : ''}`,
    },
    {
      label: 'STATUT',
      align: 'left',
      value: (player) =>
        player.status === 'finished'
          ? 'Terminé'
          : player.status === 'in_progress'
            ? 'En cours'
            : 'Connecté',
    },
  ];

  const tableBottom = drawTable(doc, tableTop, columns, report.players, {
    onPageBreak: () => {
      doc.addPage();
      drawBand(doc, true, `${report.label} · classement complet`);
      return 66;
    },
    emptyLabel: 'Aucun joueur inscrit dans cette room.',
  });

  const hasAuto = report.players.some((player) => player.autoClosed);
  if (hasAuto && tableBottom + 14 < FOOTER_LINE - 4) {
    ink(doc, COLOR.gray);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(6.6);
    doc.text(
      '* Clôture automatique : le temps de réponse était écoulé.',
      M,
      tableBottom + 12,
    );
  }
}

function drawSummaryPage(doc: jsPDF, reports: RoomReport[]): void {
  drawBand(doc, false);
  drawTitle(
    doc,
    126,
    'SYNTHÈSE GÉNÉRALE',
    `${reports.length} room${plural(reports.length)} · historique de la session`,
  );

  const totals = reports.reduce(
    (sum, report) => ({
      participants: sum.participants + report.stats.participants,
      finished: sum.finished + report.stats.finished,
      allCorrect: sum.allCorrect + report.stats.allCorrect,
    }),
    { participants: 0, finished: 0, allCorrect: 0 },
  );

  drawKpis(doc, 164, [
    { label: 'ROOMS', value: String(reports.length) },
    { label: 'PARTICIPANTS', value: String(totals.participants) },
    { label: 'ONT TERMINÉ', value: String(totals.finished) },
    { label: 'TOUTES RÉPONSES JUSTES', value: String(totals.allCorrect) },
  ]);

  ink(doc, COLOR.gray);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7);
  doc.setCharSpace(0.9);
  doc.text('DÉTAIL DES ROOMS', M, 254);
  doc.setCharSpace(0);

  const columns: Column<RoomReport>[] = [
    { label: 'ROOM', width: 58, bold: true, value: (report) => report.label },
    {
      label: 'DATE',
      width: 116,
      value: (report) => dateFmt.format(new Date(report.openedAt)),
    },
    {
      label: 'JOUEURS',
      width: 64,
      align: 'center',
      value: (report) => String(report.stats.participants),
    },
    {
      label: 'TERMINÉS',
      width: 68,
      align: 'center',
      value: (report) => String(report.stats.finished),
    },
    {
      label: 'SCORE MOYEN',
      width: 90,
      align: 'center',
      value: (report) =>
        report.stats.averageScore === null
          ? '—'
          : `${report.stats.averageScore.toFixed(1).replace('.', ',')} / ${report.questionCount}`,
    },
    {
      label: 'MEILLEUR JOUEUR',
      value: (report) =>
        report.top3[0]
          ? `${fullName(report.top3[0])} (${report.top3[0].score}/${report.top3[0].total})`
          : '—',
    },
  ];

  drawTable(doc, 262, columns, reports, {
    rowHeight: 24,
    onPageBreak: () => {
      doc.addPage();
      drawBand(doc, true, 'Synthèse générale');
      return 66;
    },
  });
}

function drawFooters(doc: jsPDF, generatedAt: Date): void {
  const total = doc.getNumberOfPages();
  for (let page = 1; page <= total; page += 1) {
    doc.setPage(page);
    stroke(doc, COLOR.line);
    doc.setLineWidth(0.6);
    doc.line(M, FOOTER_LINE, PAGE_W - M, FOOTER_LINE);

    ink(doc, COLOR.gray);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7);
    doc.text(
      `Epson × STCI · Quiz en direct · Généré le ${dateFmt.format(generatedAt)} à ${timeFmt.format(
        generatedAt,
      )}`,
      M,
      FOOTER_LINE + 12,
    );
    doc.text(`Page ${page} / ${total}`, PAGE_W - M, FOOTER_LINE + 12, { align: 'right' });
  }
}

/** Construit le document PDF des rapports (sans le sauvegarder). */
export function buildParticipantsPdf(input: RoomReport[]): jsPDF | null {
  const reports = [...input].sort((a, b) => a.index - b.index);
  if (reports.length === 0) return null;

  const doc = new jsPDF({ unit: 'pt', format: 'a4', compress: true });
  doc.setProperties({
    title: 'Rapport des participants — Epson Quiz Live',
    subject: 'Classement, scores et temps par room',
    author: 'Epson × STCI',
    creator: 'Epson Quiz Live',
  });

  const multi = reports.length > 1;
  if (multi) {
    drawSummaryPage(doc, reports);
  }

  reports.forEach((report, index) => {
    if (multi || index > 0) doc.addPage();
    drawRoomPage(doc, report);
  });

  const generatedAt = new Date();
  drawFooters(doc, generatedAt);

  return doc;
}

/** Construit le rapport et déclenche le téléchargement du PDF. */
export function downloadParticipantsPdf(input: RoomReport[]): void {
  const reports = [...input].sort((a, b) => a.index - b.index);
  const doc = buildParticipantsPdf(reports);
  if (!doc) return;

  const generatedAt = new Date();
  const scope =
    reports.length === 1 ? reports[0].label.replace(/\s+/g, '-') : 'Toutes-les-rooms';
  const stamp = `${generatedAt.getFullYear()}-${String(generatedAt.getMonth() + 1).padStart(
    2,
    '0',
  )}-${String(generatedAt.getDate()).padStart(2, '0')}`;
  doc.save(`Epson-Quiz-Participants-${scope}-${stamp}.pdf`);
}
