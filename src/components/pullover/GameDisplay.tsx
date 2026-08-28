import { AnswerLane } from "./AnswerLane";
import { ANSWER_KEYS, answerOf, type GameState, type Question } from "@/lib/pullover/types";

interface GameDisplayProps {
  state: GameState;
  question: Question | undefined;
  total: number;
  compact?: boolean;
}

export function GameDisplay({ state, question, total, compact = false }: GameDisplayProps) {
  const { phase, wipeSeq, questionIndex } = state;
  const answersVisible = phase !== "idle" && phase !== "intro";

  return (
    <div
      dir="rtl"
      className={[
        "po-stage relative flex h-full w-full flex-col overflow-hidden",
        compact ? "gap-1 p-2" : "gap-6 p-8",
      ].join(" ")}
    >
      <div className="po-road-lines pointer-events-none absolute inset-0" />

      {/* show mark */}
      <header
        className={["relative flex items-center justify-center", compact ? "gap-1" : "gap-4"].join(
          " ",
        )}
      >
        <div
          className={[
            "flex items-center border border-po-steel-line",
            compact ? "gap-1 rounded px-1.5 py-0.5" : "gap-3 rounded-full px-6 py-2",
          ].join(" ")}
          style={{ background: "var(--po-glass)" }}
        >
          <span
            className={[
              "rounded-full",
              compact ? "h-1 w-1" : "h-3 w-3",
              phase === "wiping" ? "po-beacon" : "",
            ].join(" ")}
            style={{ background: "var(--po-red)" }}
          />
          <span
            className={[
              "font-black tracking-[0.3em] text-po-white",
              compact ? "text-[7px]" : "text-xl",
            ].join(" ")}
          >
            עצור בצד
          </span>
          <span
            className={[
              "font-semibold tracking-[0.25em] text-po-amber",
              compact ? "text-[6px]" : "text-sm",
            ].join(" ")}
          >
            PULL OVER
          </span>
        </div>
        {!compact && total > 0 && (
          <span dir="ltr" className="absolute left-0 font-mono text-sm tabular-nums text-po-white/40">
            {questionIndex + 1} / {total}
          </span>
        )}
      </header>

      {/* question */}
      <div
        className={[
          "relative flex items-center justify-center text-center",
          compact ? "min-h-[26%]" : "min-h-[22%] px-10",
        ].join(" ")}
      >
        {phase === "idle" || !question ? (
          <span
            className={[
              "font-black tracking-[0.4em] text-po-white/25",
              compact ? "text-[8px]" : "text-3xl",
            ].join(" ")}
          >
            ממתין לשאלה
          </span>
        ) : (
          <h1
            key={`q-${question.id}`}
            className={[
              "po-rise font-black leading-tight text-po-white",
              compact ? "text-[9px]" : "text-4xl md:text-5xl xl:text-6xl",
            ].join(" ")}
          >
            {question.text}
          </h1>
        )}
      </div>

      {/* four wiper lanes */}
      <div className={["relative flex flex-1 flex-col", compact ? "gap-1" : "gap-4"].join(" ")}>
        {question &&
          answersVisible &&
          ANSWER_KEYS.map((key) => (
            <AnswerLane
              key={key}
              letter={key}
              text={answerOf(question, key)}
              phase={phase}
              isCorrect={question.correctAnswer === key}
              wipeSeq={wipeSeq}
              compact={compact}
            />
          ))}
        {(!question || !answersVisible) &&
          ANSWER_KEYS.map((key) => (
            <div
              key={key}
              className={[
                "flex-1 border border-dashed border-po-steel-line/40",
                compact ? "rounded-md" : "rounded-2xl",
              ].join(" ")}
            />
          ))}
      </div>

      {/* locked indicator */}
      {phase === "locked" && !compact && (
        <div className="pointer-events-none absolute inset-x-0 top-24 flex justify-center">
          <span
            className="rounded-full border px-6 py-1 text-sm font-bold tracking-[0.3em] text-po-amber"
            style={{ borderColor: "var(--po-amber)", background: "oklch(0 0 0 / 45%)" }}
          >
            נעול
          </span>
        </div>
      )}
    </div>
  );
}
