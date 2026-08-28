import { useEffect } from "react";
import { Link } from "@tanstack/react-router";
import { GameDisplay } from "./GameDisplay";
import { Button } from "@/components/ui/button";
import {
  actions,
  canLoadQuestion,
  canLock,
  canNext,
  canReveal,
  canShowAnswers,
  useGameState,
} from "@/lib/pullover/gameStore";
import { useQuestions } from "@/lib/pullover/questionStore";
import { ANSWER_KEYS, answerOf, PHASE_LABEL, type GamePhase } from "@/lib/pullover/types";

const PHASE_COLOR: Record<GamePhase, string> = {
  idle: "var(--po-steel-line)",
  intro: "var(--po-white)",
  answers: "var(--po-amber)",
  locked: "var(--po-amber)",
  wiping: "var(--po-red)",
  revealed: "var(--po-green)",
};

export function OperatorConsole() {
  const state = useGameState();
  const [questions] = useQuestions();
  const question = questions[state.questionIndex];

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      if (t && /INPUT|TEXTAREA|SELECT/.test(t.tagName)) return;
      if (e.code === "Space") {
        e.preventDefault();
        actions.advance();
      } else if (e.key === "r" || e.key === "R" || e.key === "ר") {
        actions.reveal();
      } else if (e.key === "n" || e.key === "N" || e.key === "ן") {
        actions.nextQuestion();
      } else if (e.key === "Escape") {
        actions.reset();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return (
    <div dir="rtl" className="min-h-screen bg-po-asphalt-deep text-po-white">
      {/* status bar */}
      <header className="flex flex-wrap items-center gap-4 border-b border-po-steel-line bg-po-asphalt px-6 py-3">
        <span className="text-sm font-black tracking-[0.3em]">עצור בצד</span>
        <span className="text-xs font-semibold tracking-[0.25em] text-po-amber">CONTROL</span>

        <div className="flex items-center gap-2 rounded-full border border-po-steel-line px-4 py-1">
          <span
            className={`h-2.5 w-2.5 rounded-full ${state.phase === "wiping" ? "po-beacon" : ""}`}
            style={{ background: PHASE_COLOR[state.phase] }}
          />
          <span className="text-sm font-bold">{PHASE_LABEL[state.phase]}</span>
        </div>

        <span className="font-mono text-sm tabular-nums text-po-white/60">
          שאלה {questions.length ? state.questionIndex + 1 : 0} / {questions.length}
        </span>

        <div className="ms-auto flex items-center gap-2">
          <Link
            to="/game"
            target="_blank"
            className="rounded-md border border-po-steel-line px-3 py-1.5 text-xs font-semibold hover:bg-po-steel"
          >
            פתח מסך משחק
          </Link>
          <Link
            to="/questions"
            className="rounded-md border border-po-steel-line px-3 py-1.5 text-xs font-semibold hover:bg-po-steel"
          >
            מחסן שאלות
          </Link>
        </div>
      </header>

      <div className="grid gap-6 p-6 lg:grid-cols-[1fr_360px]">
        {/* main: question + answers with correct marked for operator only */}
        <section className="space-y-4">
          <div className="rounded-xl border border-po-steel-line bg-po-asphalt p-6">
            <div className="mb-2 text-xs font-semibold tracking-widest text-po-white/40">
              שאלה נוכחית {question?.category ? `· ${question.category}` : ""}
            </div>
            <h2 className="text-2xl font-black leading-snug">
              {question?.text ?? "אין שאלות במחסן"}
            </h2>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            {question &&
              ANSWER_KEYS.map((key) => {
                const correct = question.correctAnswer === key;
                return (
                  <div
                    key={key}
                    className="flex items-center gap-3 rounded-lg border p-4"
                    style={{
                      borderColor: correct ? "var(--po-green)" : "var(--po-steel-line)",
                      background: correct ? "oklch(0.32 0.05 152 / 40%)" : "var(--po-asphalt)",
                    }}
                  >
                    <span
                      className="flex h-8 w-8 items-center justify-center rounded-md text-sm font-black"
                      style={{
                        background: correct ? "var(--po-green)" : "var(--po-steel)",
                        color: correct ? "oklch(0.15 0 0)" : "var(--po-white)",
                      }}
                    >
                      {key}
                    </span>
                    <span className="flex-1 font-semibold">{answerOf(question, key)}</span>
                    {correct && (
                      <span className="text-xs font-bold tracking-widest text-po-green">נכונה</span>
                    )}
                  </div>
                );
              })}
          </div>

          {/* preview monitor */}
          <div className="rounded-xl border border-po-steel-line bg-po-asphalt p-4">
            <div className="mb-2 flex items-center justify-between text-xs font-semibold tracking-widest text-po-white/40">
              <span>PREVIEW · תצוגת PROGRAM</span>
              <span className="font-mono">16:9</span>
            </div>
            <div className="mx-auto aspect-video w-full max-w-md overflow-hidden rounded-lg border border-po-steel-line">
              <GameDisplay
                state={state}
                question={question}
                total={questions.length}
                compact
              />
            </div>
          </div>

          {/* question rundown */}
          <div className="rounded-xl border border-po-steel-line bg-po-asphalt p-4">
            <div className="mb-2 text-xs font-semibold tracking-widest text-po-white/40">RUNDOWN</div>
            <div className="flex flex-wrap gap-2">
              {questions.map((q, i) => (
                <button
                  key={q.id}
                  onClick={() => actions.goToQuestion(i)}
                  className="rounded-md border px-3 py-1 font-mono text-xs tabular-nums"
                  style={{
                    borderColor:
                      i === state.questionIndex ? "var(--po-amber)" : "var(--po-steel-line)",
                    color: i === state.questionIndex ? "var(--po-amber)" : "var(--po-white)",
                  }}
                >
                  {i + 1}
                </button>
              ))}
            </div>
          </div>
        </section>

        {/* transport controls */}
        <aside className="space-y-3">
          <TransportButton
            label="העלה שאלה"
            hint="Space"
            disabled={!question || !canLoadQuestion(state)}
            onClick={actions.loadQuestion}
          />
          <TransportButton
            label="הצג תשובות"
            hint="Space"
            disabled={!canShowAnswers(state)}
            onClick={actions.showAnswers}
          />
          <TransportButton
            label="נעילה"
            hint="Space"
            disabled={!canLock(state)}
            onClick={actions.lock}
          />

          <div className="my-4 border-t border-dashed border-po-steel-line pt-4">
            <Button
              onClick={actions.reveal}
              disabled={!canReveal(state)}
              className="h-24 w-full rounded-xl text-xl font-black tracking-wider disabled:opacity-30"
              style={{ background: "var(--po-red)", color: "var(--po-white)" }}
            >
              הפעל מגבים / חשוף תשובה
            </Button>
            <div className="mt-2 text-center font-mono text-[11px] text-po-white/40">R</div>
          </div>

          <TransportButton
            label="שאלה הבאה"
            hint="N"
            disabled={!canNext(state)}
            onClick={actions.nextQuestion}
          />
          <TransportButton label="RESET" hint="Esc" onClick={actions.reset} danger />

          <div className="rounded-lg border border-po-steel-line p-3 text-[11px] leading-relaxed text-po-white/40">
            <div className="mb-1 font-bold tracking-widest">קיצורי מקלדת</div>
            Space · מצב הבא &nbsp;|&nbsp; R · מגבים &nbsp;|&nbsp; N · שאלה הבאה &nbsp;|&nbsp; Esc ·
            איפוס
          </div>
        </aside>
      </div>
    </div>
  );
}

function TransportButton({
  label,
  hint,
  onClick,
  disabled,
  danger,
}: {
  label: string;
  hint: string;
  onClick: () => void;
  disabled?: boolean;
  danger?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className="flex h-16 w-full items-center justify-between rounded-xl border px-5 text-lg font-bold transition-colors disabled:cursor-not-allowed disabled:opacity-30"
      style={{
        borderColor: danger ? "var(--po-red)" : "var(--po-steel-line)",
        background: danger ? "oklch(0.3 0.06 27 / 45%)" : "var(--po-steel)",
        color: "var(--po-white)",
      }}
    >
      <span>{label}</span>
      <span className="font-mono text-[11px] text-po-white/40">{hint}</span>
    </button>
  );
}
