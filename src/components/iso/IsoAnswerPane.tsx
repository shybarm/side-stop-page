import type { CSSProperties } from "react";
import { LockKeyhole } from "lucide-react";
import { type AnswerKey } from "@/lib/pullover/types";
import type { Plate } from "@/lib/iso/types";

/** Presentation only: scoring and plate identity remain in the shared snapshot. */
export function IsoAnswerPane({ letter, text, plates, numbers = {}, locked, correct, wrong, animateReveal }: {
  letter: AnswerKey; text: string; plates: Plate[]; numbers?: Record<string, number>; locked: boolean;
  correct: boolean; wrong: boolean; animateReveal: boolean;
}) {
  const wiping = wrong && animateReveal;
  return (
    <div data-iso-answer={letter} className={`po-iso-answer relative min-w-0 flex-1 ${correct ? "is-correct" : wrong ? "is-wrong" : locked ? "is-locked" : ""}`}>
      <div className="po-shield-glass" />
      <div className={`po-shield-clean ${correct || wrong ? "po-result-visible" : "po-wipe-in"}`}>
        <div className="po-shield-tint" />
        {locked && !correct && !wrong && <div data-iso-lock-scan className="po-lock-scan absolute inset-0" />}
        <div className="po-shield-glare" />
      </div>
      <div className="po-iso-answer-content">
        {locked && !correct && !wrong && <span className="po-shield-letter po-iso-answer-letter"><LockKeyhole aria-label="נעול" className="po-lock-symbol" /></span>}
        <div className="po-iso-answer-text"><span>{text}</span></div>
      </div>
      <div className="po-shield-wiper-clip">
        <div key={wiping ? "reveal" : "entry"} className={`po-shield-blade ${!wrong || wiping ? "run" : ""}`}><i className="po-shield-arm" /><i className="po-shield-rubber" /></div>
        <i className="po-shield-pivot" />
      </div>
      <div className="po-iso-plate-row">
        {plates.map((p, i) => (
          <span key={p.id} data-iso-plate={p.id} className={`po-iso-plate-wrap ${wiping ? "po-iso-dispersing" : wrong ? "po-iso-plate-gone" : ""}`} style={{ "--plate": p.color, "--drift-x": `${(i % 2 ? 1 : -1) * (5 + i * 1.2)}cqh`, "--drift-y": `${-5 - (i % 3) * 2}cqh`, "--drift-r": `${(i % 2 ? 1 : -1) * 22}deg` } as CSSProperties}>
            <span className="po-plate po-remote po-iso-plate-chip"><i className="po-remote-light" /><b dir="ltr" className="po-remote-number">{numbers[p.id]}</b></span>
            {wiping && <span className="po-iso-stardust" aria-hidden="true">{Array.from({ length: 8 }, (_, n) => <i key={n} style={{ "--ray": `${n * 45}deg`, "--reach": `${3 + n % 3}cqh` } as CSSProperties} />)}</span>}
          </span>
        ))}
      </div>
    </div>
  );
}