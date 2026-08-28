import { VirtualWiper } from "./VirtualWiper";
import type { AnswerKey, GamePhase } from "@/lib/pullover/types";

export interface AnswerLaneProps {
  letter: AnswerKey;
  text: string;
  phase: GamePhase;
  isCorrect: boolean;
  wipeSeq: number;
  /** compact rendering for the operator preview monitor */
  compact?: boolean;
}

export function AnswerLane({
  letter,
  text,
  phase,
  isCorrect,
  wipeSeq,
  compact = false,
}: AnswerLaneProps) {
  const wiping = phase === "wiping" && !isCorrect;
  const wiped = phase === "revealed" && !isCorrect;
  const confirmed = phase === "revealed" && isCorrect;

  return (
    <div
      className={[
        "relative flex-1 overflow-hidden",
        compact ? "rounded-md" : "rounded-2xl",
        confirmed ? "po-panel-correct po-confirm" : "po-panel",
        wiped ? "opacity-0" : "opacity-100",
        "transition-opacity duration-500",
      ].join(" ")}
    >
      {/* lane number strip */}
      <div
        className={[
          "absolute inset-y-0 right-0 flex items-center justify-center",
          compact ? "w-6" : "w-20",
        ].join(" ")}
        style={{ background: "oklch(0 0 0 / 25%)" }}
      >
        <span
          className={[
            "font-black tabular-nums",
            compact ? "text-[10px]" : "text-4xl",
            confirmed ? "text-po-green" : "text-po-white/70",
          ].join(" ")}
        >
          {letter}
        </span>
      </div>

      <div
        key={`content-${wipeSeq}-${letter}`}
        className={[
          "flex h-full items-center",
          compact ? "pr-7 pl-2" : "pr-24 pl-8",
          wiping ? "po-wipe-content" : "",
          wiped ? "invisible" : "",
        ].join(" ")}
      >
        <span
          className={[
            "font-bold leading-tight text-po-white",
            compact ? "text-[10px]" : "text-3xl md:text-4xl xl:text-5xl",
          ].join(" ")}
        >
          {text}
        </span>
      </div>

      {confirmed && !compact && (
        <div
          className="absolute inset-x-0 bottom-0 h-1"
          style={{ background: "var(--po-green)" }}
        />
      )}

      <VirtualWiper seq={wipeSeq} active={wiping && !compact} />
    </div>
  );
}
