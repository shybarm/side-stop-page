import { type AnswerKey, type GamePhase } from "@/lib/pullover/types";
import { LockKeyhole } from "lucide-react";


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
  concave?: boolean;
}

/**
 * One answer = one car windshield.
 * Entry: the parked wiper sweeps up and back, and the clean glass with the answer is revealed
 * behind the blade (the whole pane, not just the text). Reveal keeps every answer readable
 * on a green or red result surface.
 * The blade here is the virtual stand-in for the physical wiper motor (see hardwareAdapter).
 */
export function AnswerLane({ letter, text, phase, isCorrect, wipeSeq, compact = false, empty = false, index = 0, concave = false }: AnswerLaneProps) {
  const locked = phase === "locked";
  const result = phase === "wiping" || phase === "revealed";
  const wrong = result && !isCorrect;
  const state = empty ? "is-empty" : result ? (isCorrect ? "is-correct" : "is-wrong") : locked ? "is-locked" : "";
  const delay = `${index * 0.16}s`;
  // Blade runs on entry and again when this pane is wiped away; it rests parked otherwise.
  const bladeKey = empty ? "parked" : wrong ? `out-${wipeSeq}` : "in";
  const bladeRuns = !empty && (!result || wrong);
  const shape = "M .025 .025 H .975 V .30 C .87 .66 .48 .86 .025 .975 Z";
  const mirrorX = index % 2 === 0;
  const mirrorY = index >= 2;
  const clipId = `po-concave-${compact ? "preview" : "program"}-${letter}`;
  const unitTransform = `translate(${mirrorX ? 1 : 0} ${mirrorY ? 1 : 0}) scale(${mirrorX ? -1 : 1} ${mirrorY ? -1 : 1})`;
  return (
    <div data-answer={letter} className={["po-shield", concave ? `po-concave-window po-concave-${index}` : "", compact ? "po-shield-compact" : "", state].join(" ")}>
      {concave && <svg className="po-concave-outline" viewBox="0 0 1 1" preserveAspectRatio="none" aria-hidden="true">
        <defs><clipPath id={clipId} clipPathUnits="objectBoundingBox"><path d={shape} transform={unitTransform} /></clipPath></defs>
        <path className="po-concave-edge" d={shape} transform={unitTransform} vectorEffect="non-scaling-stroke" />
        <path className="po-concave-highlight" d={shape} transform={unitTransform} vectorEffect="non-scaling-stroke" />
      </svg>}
      <div className={concave ? "po-concave-surface" : "contents"} style={concave ? { clipPath: `url(#${clipId})` } : undefined}>
      <div className="po-shield-glass" />
      {!empty && (
        <div className={["po-shield-clean", result ? "po-result-visible" : "po-wipe-in"].join(" ")} style={{ animationDelay: result ? "0s" : delay }}>
          <div className="po-shield-tint" />
          {locked && <div className="po-lock-scan absolute inset-0" />}
          {locked && <span className={["po-shield-letter absolute", compact ? "right-1.5 top-0.5 text-[6px]" : "right-5 top-3 text-base"].join(" ")}><LockKeyhole aria-label="נעול" className="po-lock-symbol" /></span>}
          <div className={["relative z-10 flex h-full w-full items-center justify-center text-center", compact ? "px-2" : "px-10"].join(" ")}>
            <span className={["po-shield-text font-black leading-tight", compact ? "text-[9px]" : "text-3xl md:text-4xl xl:text-5xl"].join(" ")}>{text}</span>
          </div>
           {!concave && <div className="po-shield-glare" />}
        </div>
      )}
      {!compact && !concave && (
        <div className="po-shield-wiper-clip">
          <div key={bladeKey} className={["po-shield-blade", bladeRuns ? "run" : ""].join(" ")} style={{ animationDelay: wrong ? "0s" : delay }}>
            <i className="po-shield-arm" /><i className="po-shield-rubber" />
          </div>
          <i className="po-shield-pivot" />
        </div>
      )}
      </div>
    </div>
  );
}
