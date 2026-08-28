import { AnswerLane } from "./AnswerLane";
import { ANSWER_KEYS, answerOf, type GameState, type Question } from "@/lib/pullover/types";

interface GameDisplayProps { state: GameState; question: Question | undefined; total: number; compact?: boolean; }

export function GameDisplay({ state, question, total, compact = false }: GameDisplayProps) {
  const { phase, wipeSeq, questionIndex, lockedAnswer } = state;
  const answersVisible = phase !== "idle" && phase !== "intro";
  const showAnswers = Boolean(question) && answersVisible;
  const renderAnswer = (key: (typeof ANSWER_KEYS)[number]) => (
    <AnswerLane key={key} letter={key} text={question ? answerOf(question, key) : ""} phase={phase}
      isCorrect={question?.correctAnswer === key} isContestantChoice={lockedAnswer === key}
      wipeSeq={wipeSeq} compact={compact} empty={!showAnswers} />
  );

  return (
    <div dir="rtl" className={["po-stage relative flex h-full w-full flex-col overflow-hidden", compact ? "gap-1 p-1.5" : "gap-3 p-6 md:p-10"].join(" ")}>
      <div className="po-road-lines pointer-events-none absolute inset-0" />
      <header className="relative flex shrink-0 items-center justify-center">
        <div className={["flex items-center border border-po-steel-line", compact ? "gap-1 rounded px-1.5 py-0.5" : "gap-3 rounded-full px-5 py-1.5"].join(" ")} style={{ background: "var(--po-glass)" }}>
          <span className={["rounded-full", compact ? "h-1 w-1" : "h-2.5 w-2.5", phase === "wiping" ? "po-beacon" : ""].join(" ")} style={{ background: "var(--po-red)" }} />
          <span className={["font-black tracking-[0.3em] text-po-white", compact ? "text-[7px]" : "text-base"].join(" ")}>עצור בצד</span>
          <span className={["font-semibold tracking-[0.25em] text-po-amber", compact ? "text-[6px]" : "text-[11px]"].join(" ")}>PULL OVER</span>
        </div>
        {!compact && total > 0 && <span dir="ltr" className="absolute left-0 font-mono text-sm tabular-nums text-po-white/40">{questionIndex + 1} / {total}</span>}
      </header>

      <div className={["relative grid min-h-0 flex-1", compact ? "gap-1" : "gap-3 md:gap-4"].join(" ")} style={{ gridTemplateRows: "1fr auto 1fr" }}>
        <div className={["grid min-h-0 grid-cols-2", compact ? "gap-1" : "gap-3 md:gap-4"].join(" ")}>{ANSWER_KEYS.slice(0, 2).map(renderAnswer)}</div>
        <div className={["relative flex items-center justify-center border-y text-center", compact ? "min-h-[18px] px-2 py-1" : "min-h-[18%] px-10 py-6"].join(" ")} style={{ background: "linear-gradient(180deg, oklch(0.24 0.01 250), oklch(0.16 0.01 250))", borderColor: "var(--po-steel-line)" }}>
          {phase === "idle" || !question ? <span className={["font-black tracking-[0.4em] text-po-white/25", compact ? "text-[8px]" : "text-2xl"].join(" ")}>ממתין לשאלה</span> :
            <h1 key={`q-${question.id}`} className={["po-rise font-black leading-tight text-po-white", compact ? "text-[9px]" : "text-3xl md:text-4xl xl:text-5xl"].join(" ")}>{question.text}</h1>}
        </div>
        <div className={["grid min-h-0 grid-cols-2", compact ? "gap-1" : "gap-3 md:gap-4"].join(" ")}>{ANSWER_KEYS.slice(2, 4).map(renderAnswer)}</div>
      </div>
    </div>
  );
}
