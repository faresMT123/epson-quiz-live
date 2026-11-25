import { useEffect, useMemo, useRef, useState } from 'react';
import {
  BarChart3,
  CheckCircle2,
  Gift,
  ListChecks,
  Lock,
  LogOut,
  Monitor,
  Plus,
  PlayCircle,
  QrCode,
  RefreshCcw,
  Save,
  Timer,
  Trash2,
  Unlock,
  Users,
  X,
} from 'lucide-react';
import {
  ROOM_STATE_LABEL,
  type AdminSnapshot,
  type QuestionInput,
  type RoomState,
} from '@shared';
import { EpsonLogo } from '../components/EpsonLogo';
import type { AdminApi } from '../lib/useAdmin';
import { useRemainingMs } from '../lib/useRemainingMs';
import { computeRevealStats } from '../lib/revealStats';
import { LeaderboardReveal } from './LeaderboardReveal';
import { PlayersTable } from './PlayersTable';
import { QrScreen } from './QrScreen';
import { ReportsCard } from './ReportsCard';

interface AdminDashboardProps {
  admin: AdminApi;
  snapshot: AdminSnapshot;
  onExit: () => void;
}

const OPTION_LETTERS = ['A', 'B', 'C', 'D', 'E'];
const MAX_QUESTIONS = 10;
const MAX_OPTIONS = 5;
const MIN_OPTIONS = 2;

const STATE_BADGE: Record<RoomState, string> = {
  WAITING: 'badge-neutral',
  COUNTDOWN: 'badge-info',
  RUNNING: 'badge-info',
  FINISHED: 'badge-success',
};

const PRIZE_LABELS = ['1re place', '2e place', '3e place'];
const PRIZE_PLACEHOLDERS = [
  'Imprimante L3310',
  'Weekend pour 2 personnes valeur de 500DT',
  'Carte cadeau FATALE valeur 300DT',
];

function formatClock(ms: number): string {
  const totalSeconds = Math.max(0, Math.ceil(ms / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${String(seconds).padStart(2, '0')}`;
}

interface StatCardProps {
  icon: React.ReactNode;
  label: string;
  value: React.ReactNode;
  hint?: string;
  tone?: string;
}

function StatCard({ icon, label, value, hint, tone }: StatCardProps) {
  return (
    <article className={`stat-card ${tone ?? ''}`}>
      <span className="stat-icon">{icon}</span>
      <div className="stat-body">
        <span className="stat-label">{label}</span>
        <strong className="stat-value">{value}</strong>
        {hint && <span className="stat-hint">{hint}</span>}
      </div>
    </article>
  );
}

export function AdminDashboard({ admin, snapshot, onExit }: AdminDashboardProps) {
  const [confirmNewRoom, setConfirmNewRoom] = useState(false);
  const [prizeDrafts, setPrizeDrafts] = useState<string[]>(() => [...snapshot.prizes]);
  const [prizeSaved, setPrizeSaved] = useState(false);
  const [questionDrafts, setQuestionDrafts] = useState<QuestionInput[]>(() =>
    snapshot.questions.map((question) => ({
      prompt: question.prompt,
      options: [...question.options],
      correctIndex: question.correctIndex,
    })),
  );
  const [questionsSaved, setQuestionsSaved] = useState(false);
  // Le QR s'affiche uniquement sur la console qui l'a demandé : les autres
  // consoles admin gardent leur interface normale.
  const [qrVisible, setQrVisible] = useState(false);
  const { action, error, busy, connected, logout, savePrizes, saveQuestions, requestReport } =
    admin;
  const { roomState, stats, accessClosed } = snapshot;

  // Répartition des joueurs pour l'écran de synthèse du classement.
  const revealStats = useMemo(() => computeRevealStats(snapshot), [snapshot]);

  const isFinished = roomState === 'FINISHED';
  const prizesEditable = roomState === 'WAITING' || roomState === 'FINISHED';
  const endsAt =
    roomState === 'COUNTDOWN'
      ? snapshot.countdownEndsAt
      : roomState === 'RUNNING'
        ? snapshot.quizEndsAt
        : null;
  const remaining = useRemainingMs(endsAt);

  // Ne réinitialise le brouillon que lorsque les cadeaux enregistrés changent.
  const prizesKey = snapshot.prizes.join('\u0001');
  const lastPrizesKey = useRef(prizesKey);
  useEffect(() => {
    if (lastPrizesKey.current !== prizesKey) {
      lastPrizesKey.current = prizesKey;
      setPrizeDrafts([...snapshot.prizes]);
    }
  }, [prizesKey, snapshot.prizes]);

  // Ne réinitialise le brouillon que lorsque le quiz enregistré change.
  const questionsKey = JSON.stringify(snapshot.questions);
  const lastQuestionsKey = useRef(questionsKey);
  useEffect(() => {
    if (lastQuestionsKey.current !== questionsKey) {
      lastQuestionsKey.current = questionsKey;
      setQuestionDrafts(
        snapshot.questions.map((question) => ({
          prompt: question.prompt,
          options: [...question.options],
          correctIndex: question.correctIndex,
        })),
      );
    }
  }, [questionsKey, snapshot.questions]);

  const timerLabel =
    roomState === 'COUNTDOWN'
      ? `${Math.ceil(remaining / 1000)} s`
      : roomState === 'RUNNING'
        ? formatClock(remaining)
        : roomState === 'FINISHED'
          ? 'Terminée'
          : '—';

  const handleNewRoom = () => {
    if (!isFinished) return;
    setConfirmNewRoom(true);
  };

  const handleSavePrizes = async () => {
    const ok = await savePrizes(prizeDrafts);
    if (ok) {
      setPrizeSaved(true);
      window.setTimeout(() => setPrizeSaved(false), 2600);
    }
  };

  const updateQuestion = (index: number, patch: Partial<QuestionInput>) => {
    setQuestionDrafts((prev) =>
      prev.map((question, position) => (position === index ? { ...question, ...patch } : question)),
    );
  };

  const addQuestion = () => {
    setQuestionDrafts((prev) =>
      prev.length >= MAX_QUESTIONS
        ? prev
        : [...prev, { prompt: '', options: ['', '', ''], correctIndex: 0 }],
    );
  };

  const removeQuestion = (index: number) => {
    setQuestionDrafts((prev) =>
      prev.length <= 1 ? prev : prev.filter((_, position) => position !== index),
    );
  };

  const addOption = (questionIndex: number) => {
    setQuestionDrafts((prev) =>
      prev.map((question, position) =>
        position === questionIndex && question.options.length < MAX_OPTIONS
          ? { ...question, options: [...question.options, ''] }
          : question,
      ),
    );
  };

  const removeOption = (questionIndex: number, optionIndex: number) => {
    setQuestionDrafts((prev) =>
      prev.map((question, position) => {
        if (position !== questionIndex || question.options.length <= MIN_OPTIONS) return question;
        const options = question.options.filter((_, index) => index !== optionIndex);
        let correctIndex = question.correctIndex;
        if (optionIndex === correctIndex) correctIndex = 0;
        else if (optionIndex < correctIndex) correctIndex -= 1;
        return { ...question, options, correctIndex };
      }),
    );
  };

  const questionsValid = questionDrafts.every(
    (question) =>
      question.prompt.trim().length > 0 &&
      question.options.length >= MIN_OPTIONS &&
      question.options.every((option) => option.trim().length > 0) &&
      question.correctIndex >= 0 &&
      question.correctIndex < question.options.length,
  );

  const handleSaveQuestions = async () => {
    if (!questionsValid) return;
    const saved = await saveQuestions(questionDrafts);
    if (saved) {
      setQuestionsSaved(true);
      window.setTimeout(() => setQuestionsSaved(false), 2600);
    }
  };

  const helperMessage = isFinished
    ? 'Room terminée : affichez le classement ou préparez une nouvelle room.'
    : "« Nouvelle room » sera activée dès que la room actuelle sera terminée (temps écoulé et tous les joueurs clôturés).";

  return (
    <div className="admin">
      <header className="admin-header">
        <div className="admin-brand">
          <EpsonLogo height={26} />
          <div className="admin-title">
            <span className="eyebrow neon-cyan">CONSOLE ORGANISATEUR</span>
            <h1>QUIZ EN DIRECT</h1>
          </div>
        </div>
        <div className="admin-header-actions">
          <span className={`live-tag ${connected ? 'is-live' : ''}`}>
            <span className="live-dot" />
            {connected ? 'EN DIRECT' : 'HORS LIGNE'}
          </span>
          <a
            className="btn btn-ghost btn-sm"
            href="/ecran"
            target="_blank"
            rel="noreferrer"
            title="Ouvrir l'écran de présentation (QR code et classement) sur un autre écran."
          >
            <Monitor size={16} /> ÉCRAN
          </a>
          <button
            type="button"
            className="btn btn-ghost btn-sm"
            onClick={() => {
              logout();
              onExit();
            }}
          >
            <LogOut size={16} /> QUITTER
          </button>
        </div>
      </header>

      <main className="admin-main">
        <section className="stats-grid" aria-label="Statistiques en temps réel">
          <StatCard
            icon={<Users size={20} />}
            label="Joueurs connectés"
            value={stats.connected}
            hint={`${stats.total} inscrit${stats.total > 1 ? 's' : ''} au total`}
          />
          <StatCard
            icon={<PlayCircle size={20} />}
            label="Ont commencé"
            value={stats.started}
            hint={`${stats.waiting} en attente`}
          />
          <StatCard
            icon={<CheckCircle2 size={20} />}
            label="Ont terminé"
            value={stats.finished}
            hint={
              stats.started > 0
                ? `${Math.round((stats.finished / stats.started) * 100)} % des lancés`
                : '—'
            }
            tone="tone-success"
          />
          <StatCard
            icon={<Timer size={20} />}
            label="État de la room"
            value={ROOM_STATE_LABEL[roomState]}
            hint={
              roomState === 'RUNNING'
                ? `Temps restant : ${timerLabel}`
                : roomState === 'COUNTDOWN'
                  ? `Départ dans ${timerLabel}`
                  : roomState === 'WAITING'
                    ? accessClosed
                      ? 'Accès fermé'
                      : 'Accès ouvert'
                    : 'Classement disponible'
            }
            tone="tone-accent"
          />
        </section>

        <section className="neon-panel controls-card">
          <div className="controls-head">
            <div>
              <span className="eyebrow neon-cyan">PILOTAGE</span>
              <h2>CONTRÔLES DE LA ROOM</h2>
            </div>
            <span className={`badge ${STATE_BADGE[roomState]}`}>
              {ROOM_STATE_LABEL[roomState]}
              {roomState === 'RUNNING' && <span className="badge-timer">{timerLabel}</span>}
            </span>
          </div>

          <div className="controls-row">
            <button
              type="button"
              className="btn btn-primary"
              onClick={() => void action('start')}
              disabled={roomState !== 'WAITING' || stats.total === 0 || busy}
              title={
                roomState !== 'WAITING'
                  ? 'Le quiz est déjà lancé.'
                  : stats.total === 0
                    ? 'Aucun joueur dans la room.'
                    : 'Lancer le décompte de 5 secondes.'
              }
            >
              <PlayCircle size={18} /> DÉMARRER LE QUIZ
            </button>

            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => void action(accessClosed ? 'open-access' : 'close-access')}
              disabled={isFinished || busy}
              title={isFinished ? 'La room est terminée.' : undefined}
            >
              {accessClosed ? <Unlock size={18} /> : <Lock size={18} />}
              {accessClosed ? "OUVRIR L'ACCÈS" : "FERMER L'ACCÈS"}
            </button>

            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => {
                if (qrVisible) {
                  setQrVisible(false);
                  if (snapshot.display === 'qr') void action('hide-qr');
                } else {
                  setQrVisible(true);
                  if (snapshot.display !== 'qr') void action('show-qr');
                }
              }}
              disabled={busy}
              title="Affiche le QR code d'inscription en plein écran sur cet appareil et sur l'écran de présentation."
            >
              <QrCode size={18} />
              {qrVisible ? 'MASQUER LE QR CODE' : 'AFFICHER LE QR CODE'}
            </button>

            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => void action('show-results')}
              disabled={!isFinished || busy}
              title={
                !isFinished
                  ? 'Disponible à la fin de la room.'
                  : "S'affiche aussi sur l'écran de présentation."
              }
            >
              <BarChart3 size={18} /> AFFICHER LE CLASSEMENT
            </button>

            <button
              type="button"
              className="btn btn-ghost"
              onClick={handleNewRoom}
              disabled={!isFinished || busy}
              title={!isFinished ? 'La room actuelle doit être terminée.' : undefined}
            >
              <RefreshCcw size={18} /> NOUVELLE ROOM
            </button>
          </div>

          <p className="helper-text">{helperMessage}</p>
          {error && <div className="alert alert-error">{error}</div>}
        </section>

        <section className="neon-panel prizes-card">
          <div className="controls-head">
            <div>
              <span className="eyebrow neon-cyan">RÉCOMPENSES</span>
              <h2>CADEAUX DU PODIUM</h2>
            </div>
            <span className="badge badge-gold">
              <Gift size={14} /> TOP 3
            </span>
          </div>

          <p className="helper-text prizes-help">
            Renseignez le cadeau de chaque place avant de démarrer. Les cadeaux sont enregistrés
            pour toutes les nouvelles rooms.
          </p>

          <div className="prizes-grid">
            {PRIZE_LABELS.map((label, index) => (
              <div className="field" key={label}>
                <label htmlFor={`prize-${index}`}>{label}</label>
                <input
                  id={`prize-${index}`}
                  value={prizeDrafts[index] ?? ''}
                  maxLength={80}
                  placeholder={PRIZE_PLACEHOLDERS[index]}
                  disabled={!prizesEditable}
                  onChange={(event) => {
                    const next = [...prizeDrafts];
                    next[index] = event.target.value;
                    setPrizeDrafts(next);
                  }}
                />
              </div>
            ))}
            <div className="prizes-actions">
              <button
                type="button"
                className="btn btn-primary"
                onClick={() => void handleSavePrizes()}
                disabled={!prizesEditable || busy}
              >
                <Save size={18} /> ENREGISTRER
              </button>
              {!prizesEditable && (
                <span className="helper-text">Modifiable en attente ou après la room.</span>
              )}
              {prizeSaved && <span className="prize-saved">Cadeaux enregistrés ✓</span>}
            </div>
          </div>
        </section>

        <section className="neon-panel questions-card">
          <div className="controls-head">
            <div>
              <span className="eyebrow neon-cyan">QUIZ</span>
              <h2>QUESTIONS &amp; RÉPONSES</h2>
            </div>
            <span className="badge badge-info">
              <ListChecks size={14} /> {questionDrafts.length} QUESTION
              {questionDrafts.length > 1 ? 'S' : ''}
            </span>
          </div>

          <p className="helper-text questions-help">
            Ajoutez, modifiez ou supprimez les questions et leurs réponses. Cliquez sur la lettre
            pour définir la bonne réponse. Enregistrez avant de démarrer la room.
          </p>

          <div className="questions-list">
            {questionDrafts.map((question, questionIndex) => (
              <article className="question-editor" key={questionIndex}>
                <header className="question-editor-head">
                  <span className="question-editor-num">QUESTION {questionIndex + 1}</span>
                  <button
                    type="button"
                    className="icon-btn is-danger"
                    onClick={() => removeQuestion(questionIndex)}
                    disabled={!prizesEditable || busy || questionDrafts.length <= 1}
                    aria-label={`Supprimer la question ${questionIndex + 1}`}
                    title="Supprimer la question"
                  >
                    <Trash2 size={16} />
                  </button>
                </header>

                <input
                  className="question-input"
                  value={question.prompt}
                  maxLength={200}
                  placeholder="Intitulé de la question"
                  disabled={!prizesEditable}
                  onChange={(event) =>
                    updateQuestion(questionIndex, { prompt: event.target.value })
                  }
                />

                <div className="question-options" role="radiogroup">
                  {question.options.map((option, optionIndex) => (
                    <div
                      className={`question-option ${
                        question.correctIndex === optionIndex ? 'is-correct' : ''
                      }`}
                      key={optionIndex}
                    >
                      <button
                        type="button"
                        role="radio"
                        aria-checked={question.correctIndex === optionIndex}
                        className="question-letter"
                        onClick={() => updateQuestion(questionIndex, { correctIndex: optionIndex })}
                        disabled={!prizesEditable}
                        title="Définir comme bonne réponse"
                      >
                        {OPTION_LETTERS[optionIndex]}
                      </button>
                      <input
                        value={option}
                        maxLength={100}
                        placeholder={`Réponse ${OPTION_LETTERS[optionIndex]}`}
                        disabled={!prizesEditable}
                        onChange={(event) => {
                          const options = [...question.options];
                          options[optionIndex] = event.target.value;
                          updateQuestion(questionIndex, { options });
                        }}
                      />
                      <button
                        type="button"
                        className="icon-btn"
                        onClick={() => removeOption(questionIndex, optionIndex)}
                        disabled={!prizesEditable || question.options.length <= MIN_OPTIONS}
                        aria-label={`Supprimer la réponse ${OPTION_LETTERS[optionIndex]}`}
                        title="Supprimer la réponse"
                      >
                        <X size={14} />
                      </button>
                    </div>
                  ))}
                </div>

                <div className="question-editor-foot">
                  <button
                    type="button"
                    className="btn btn-ghost btn-sm"
                    onClick={() => addOption(questionIndex)}
                    disabled={!prizesEditable || question.options.length >= MAX_OPTIONS}
                  >
                    <Plus size={14} /> AJOUTER UNE RÉPONSE
                  </button>
                  <span className="helper-text">
                    {question.options.length}/{MAX_OPTIONS} réponses
                  </span>
                </div>
              </article>
            ))}
          </div>

          <div className="questions-actions">
            <button
              type="button"
              className="btn btn-secondary"
              onClick={addQuestion}
              disabled={!prizesEditable || busy || questionDrafts.length >= MAX_QUESTIONS}
            >
              <Plus size={18} /> AJOUTER UNE QUESTION
            </button>
            <button
              type="button"
              className="btn btn-primary"
              onClick={() => void handleSaveQuestions()}
              disabled={!prizesEditable || busy || !questionsValid}
            >
              <Save size={18} /> ENREGISTRER
            </button>
            {!prizesEditable && (
              <span className="helper-text">Modifiable en attente ou après la room.</span>
            )}
            {questionsSaved && <span className="prize-saved">Questions enregistrées ✓</span>}
          </div>
        </section>

        <PlayersTable players={snapshot.players} />

        <ReportsCard snapshot={snapshot} requestReport={requestReport} />

        <footer className="admin-foot">
          <span>
            Room <code>{snapshot.roomId.slice(0, 8)}</code>
          </span>
          <span>Mise à jour en direct · limitée à 1 fois par seconde</span>
        </footer>
      </main>

      {qrVisible && snapshot.reveal.stage === 'off' && (
        <QrScreen
          onClose={() => {
            setQrVisible(false);
            if (snapshot.display === 'qr') void action('hide-qr');
          }}
        />
      )}

      {snapshot.reveal.stage !== 'off' && (
        <LeaderboardReveal
          entries={snapshot.leaderboard}
          stats={revealStats}
          stage={snapshot.reveal.stage}
          calculatingUntil={snapshot.reveal.calculatingUntil}
          countdownEndsAt={snapshot.reveal.countdownEndsAt}
          onStartCountdown={() => void action('reveal-podium')}
          onClose={() => void action('hide-results')}
        />
      )}

      {confirmNewRoom && (
        <div
          className="modal-backdrop"
          role="dialog"
          aria-modal="true"
          aria-labelledby="new-room-title"
        >
          <div className="modal">
            <h2 id="new-room-title">Créer une nouvelle room ?</h2>
            <p className="muted">
              Les joueurs, les scores et le classement actuels seront définitivement réinitialisés.
              Les cadeaux du podium sont conservés.
            </p>
            <div className="modal-actions">
              <button type="button" className="btn btn-ghost" onClick={() => setConfirmNewRoom(false)}>
                ANNULER
              </button>
              <button
                type="button"
                className="btn btn-primary"
                onClick={() => {
                  setConfirmNewRoom(false);
                  void action('new-room');
                }}
              >
                CRÉER LA ROOM
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
