import { VirtualWiper } from "./VirtualWiper";
import type { AnswerKey, GamePhase } from "@/lib/pullover/types";

export interface AnswerLaneProps {
  letter: AnswerKey;
  text: string;
  phase: GamePhase;
  isCorrect: boolean;
  isContestantChoice?: boolean;
  wipeSeq: number;
  compact?: boolean;
  empty?: boolean;
}

export function AnswerLane({ letter, text, phase, isCorrect, isContestantChoice = false, wipeSeq, compact = false, empty = false }: AnswerLaneProps) {
  const wiping = phase === "wiping" && !isCorrect;
  const wiped = phase === "revealed" && !isCorrect;
  const confirmed = phase === "revealed" && isCorrect;
  const lockedChoice = (phase === "locked" || phase === "wiping") && isContestantChoice;

  if (empty) return <div className={["h-full w-full border border-dashed border-po-steel-line/40", compact ? "rounded-md" : "rounded-xl"].join(" ")} />;

  return (
    <div
      className={[
        "relative h-full w-full overflow-hidden border",
        compact ? "rounded-md" : "rounded-xl",
        confirmed ? "po-panel-correct po-confirm" : "po-panel",
        lockedChoice ? "ring-4 ring-po-amber" : "",
        wiped ? "opacity-0" : "opacity-100",
        "transition-opacity duration-500",
      ].join(" ")}
    >
      <span className={["absolute font-bold tabular-nums", compact ? "right-1 top-0.5 text-[6px]" : "right-4 top-3 text-base", confirmed ? "text-po-green" : lockedChoice ? "text-po-amber" : "text-po-white/35"].join(" ")}>{letter}</span>
      {lockedChoice && (
        <span className={["absolute left-1/2 top-3 -translate-x-1/2 rounded-full bg-po-amber font-black text-po-asphalt-deep", compact ? "px-1 text-[5px]" : "px-4 py-1 text-xs tracking-widest"].join(" ")}>נעול</span>
      )}
      <div key={`content-${wipeSeq}-${letter}`} className={["flex h-full w-full items-center justify-center text-center", compact ? "px-2" : "px-8", wiping ? "po-wipe-content" : "", wiped ? "invisible" : ""].join(" ")}>
        <span className={["font-black leading-tight text-po-white", compact ? "text-[9px]" : "text-3xl md:text-4xl xl:text-5xl"].join(" ")}>{text}</span>
      </div>
      <VirtualWiper seq={wipeSeq} active={wiping && !compact} />
    </div>
  );
}
