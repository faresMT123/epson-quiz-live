import { useCallback, useEffect, useRef, useState } from 'react';
import { Check, CheckCircle2, ChevronRight, Loader2, Star, Timer } from 'lucide-react';
import type { PlayerSession } from '@shared';
import { EpsonLogo } from '../components/EpsonLogo';
import { useRemainingMs } from '../lib/useRemainingMs';

interface QuizScreenProps {
  session: PlayerSession;
  onAnswer: (questionId: string, optionIndex: number) => void;
  onFinish: () => Promise<unknown>;
}

const LETTERS = ['A', 'B', 'C', 'D', 'E'];
const ADVANCE_DELAY_MS = 420;

export function QuizScreen({ session, onAnswer, onFinish }: QuizScreenProps) {
  const questions = session.questions ?? [];
  const answeredIds = session.answers;
  const remaining = useRemainingMs(session.quizEndsAt);

  // Reprise à la première question sans réponse (reconnexion en cours de quiz).
  const [index, setIndex] = useState(() => {
    const firstUnanswered = questions.findIndex((question) => answeredIds[question.id] === undefined);
    return firstUnanswered === -1 ? questions.length : firstUnanswered;
  });
  const [locked, setLocked] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const submittingRef = useRef(false);
  const advanceRef = useRef<number | null>(null);

  const total = questions.length;
  const done = index >= total;
  const current = done ? null : questions[index];
  const answeredCount = questions.filter((question) => answeredIds[question.id] !== undefined).length;

  const totalSeconds = Math.ceil(remaining / 1000);
  const clock = `${Math.floor(totalSeconds / 60)}:${String(totalSeconds % 60).padStart(2, '0')}`;
  const progress = session.quizEndsAt ? Math.min(100, Math.max(0, (remaining / 60_000) * 100)) : 0;
  const isLow = remaining <= 10_000;

  const submit = useCallback(async () => {
    if (submittingRef.current) return;
    submittingRef.current = true;
    setSubmitting(true);
    await onFinish();
    setSubmitting(false);
  }, [onFinish]);

  // Envoi automatique à l'expiration du chrono (le serveur clôture de toute façon).
  useEffect(() => {
    if (remaining <= 0) void submit();
  }, [remaining, submit]);

  useEffect(
    () => () => {
      if (advanceRef.current !== null) window.clearTimeout(advanceRef.current);
    },
    [],
  );

  const choose = (questionId: string, optionIndex: number) => {
    if (locked || done) return;
    setLocked(true);
    onAnswer(questionId, optionIndex);
    // Passage automatique et définitif à la question suivante.
    advanceRef.current = window.setTimeout(() => {
      setIndex((value) => value + 1);
      setLocked(false);
      advanceRef.current = null;
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }, ADVANCE_DELAY_MS);
  };

  return (
    <main className="quiz-screen">
      <header className="quiz-header">
        <EpsonLogo height={24} />
      </header>

      <div className="quiz-hud">
        <div className="hud-pill">
          <Star size={18} className="hud-star" />
          <span>
            RÉPONSES <strong>{answeredCount}/{total}</strong>
          </span>
        </div>
        <div className={`hud-pill hud-timer ${isLow ? 'is-low' : ''}`}>
          <Timer size={18} />
          <strong>{clock}</strong>
        </div>
      </div>

      <div className="timer-track" aria-hidden="true">
        <span style={{ width: `${progress}%` }} />
      </div>

      <div className="quiz-body">
        {!done && current && (
          <>
            <section
              key={current.id}
              className={`question-card question-card-single ${locked ? 'is-locked' : ''}`}
              aria-labelledby={`question-${current.id}`}
            >
              <p className="question-step">
                QUESTION {index + 1} / {total}
              </p>
              <div className="question-mini-track" aria-hidden="true">
                <span style={{ width: `${((index + 1) / total) * 100}%` }} />
              </div>
              <h2 id={`question-${current.id}`}>{current.prompt}</h2>

              <div className="options" role="radiogroup" aria-labelledby={`question-${current.id}`}>
                {current.options.map((option, optionIndex) => {
                  const selected = answeredIds[current.id] === optionIndex;
                  return (
                    <button
                      key={option}
                      type="button"
                      role="radio"
                      aria-checked={selected}
                      disabled={locked}
                      className={`option ${selected ? 'is-selected' : ''}`}
                      onClick={() => choose(current.id, optionIndex)}
                    >
                      <span className="option-letter">{LETTERS[optionIndex]}</span>
                      <span className="option-text">{option}</span>
                      <span className="option-check">{selected && <Check size={18} />}</span>
                    </button>
                  );
                })}
              </div>
            </section>

            <p className="quiz-hint muted small">
              Votre réponse enregistre la question suivante automatiquement. Retour impossible.
            </p>
          </>
        )}

        {done && (
          <section className="neon-panel quiz-complete">
            <span className="complete-icon">
              <CheckCircle2 size={30} />
            </span>
            <span className="eyebrow neon-cyan">QUESTIONNAIRE TERMINÉ</span>
            <h1>Toutes vos réponses sont enregistrées</h1>
            <p className="muted">
              Cliquez sur « TERMINER » pour envoyer définitivement vos réponses. Votre score et
              votre temps seront calculés par le serveur.
            </p>
            <button
              type="button"
              className="btn btn-primary btn-lg neon-cta"
              onClick={() => void submit()}
              disabled={submitting}
            >
              {submitting ? (
                <>
                  <Loader2 size={18} className="spin" /> ENVOI…
                </>
              ) : (
                <>
                  TERMINER <ChevronRight size={18} />
                </>
              )}
            </button>
          </section>
        )}
      </div>
    </main>
  );
}
