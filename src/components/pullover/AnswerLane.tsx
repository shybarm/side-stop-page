import { HE_LETTER, type AnswerKey, type GamePhase } from "@/lib/pullover/types";

export interface AnswerLaneProps {
  letter: AnswerKey;
  text: string;
  phase: GamePhase;
  isCorrect: boolean;
  isContestantChoice?: boolean;
  wipeSeq: number;
  compact?: boolean;
  empty?: boolean;
  /** lane order, used to stagger the entry wipe */
  index?: number;
}

/**
 * One answer = one car windshield.
 * Entry: the parked wiper sweeps up and back, and the clean glass with the answer is revealed
 * behind the blade (the whole pane, not just the text). Reveal: wrong panes are wiped clean
 * away by the same wiper; the correct pane stays put and lights up.
 * The blade here is the virtual stand-in for the physical wiper motor (see hardwareAdapter).
 */
export function AnswerLane({ letter, text, phase, isCorrect, wipeSeq, compact = false, empty = false, index = 0 }: AnswerLaneProps) {
  const locked = phase === "locked";
  const result = phase === "wiping" || phase === "revealed";
  const wrong = result && !isCorrect;
  const state = empty ? "is-empty" : result ? (isCorrect ? "is-correct" : "is-wrong") : locked ? "is-locked" : "";
  const delay = `${index * 0.16}s`;
  // Blade runs on entry and again when this pane is wiped away; it rests parked otherwise.
  const bladeKey = empty ? "parked" : wrong ? `out-${wipeSeq}` : "in";
  const bladeRuns = !empty && (!result || wrong);
  return (
    <div className={["po-shield", compact ? "po-shield-compact" : "", state].join(" ")}>
      <div className="po-shield-glass" />
      {!empty && (
        <div className={["po-shield-clean", wrong ? "po-wipe-out" : "po-wipe-in"].join(" ")} style={{ animationDelay: wrong ? "0s" : delay }}>
          <div className="po-shield-tint" />
          {locked && <div className="po-lock-scan absolute inset-0" />}
          <span className={["po-shield-letter absolute font-black", compact ? "right-1.5 top-0.5 text-[6px]" : "right-5 top-3 text-base"].join(" ")}>{HE_LETTER[letter]}</span>
          <div className={["relative z-10 flex h-full w-full items-center justify-center text-center", compact ? "px-2" : "px-10"].join(" ")}>
            <span className={["po-shield-text font-black leading-tight", compact ? "text-[9px]" : "text-3xl md:text-4xl xl:text-5xl"].join(" ")}>{text}</span>
          </div>
          <div className="po-shield-glare" />
        </div>
      )}
      {!compact && (
        <div className="po-shield-wiper-clip">
          <div key={bladeKey} className={["po-shield-blade", bladeRuns ? "run" : ""].join(" ")} style={{ animationDelay: wrong ? "0s" : delay }}>
            <i className="po-shield-arm" /><i className="po-shield-rubber" />
          </div>
          <i className="po-shield-pivot" />
        </div>
      )}
    </div>
  );
}
