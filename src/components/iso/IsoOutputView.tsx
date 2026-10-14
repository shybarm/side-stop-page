import { useEffect, useState } from "react";
import { activeAnswerKeys, answerOf, HE_LETTER, type AnswerKey, type Question } from "@/lib/pullover/types";
import type { IsoSnapshot, Plate } from "@/lib/iso/types";

/** A license plate chip: fixed colour, no number or text. */
export function PlateChip({ plate, size = "md", dim = false }: { plate: Pick<Plate, "color">; size?: "sm" | "md" | "lg"; dim?: boolean }) {
  const s = size === "sm" ? "h-4 w-9" : size === "lg" ? "h-10 w-24" : "h-7 w-16";
  return <span className={["po-plate inline-block shrink-0", s, dim ? "po-plate-out" : ""].join(" ")} style={{ ["--plate" as string]: plate.color }} />;
}

const REVEAL = new Set(["wiping", "revealed", "transition", "progress"]);

// Answer boxes per layout, as % of the 16:9 frame. Centre (≈ 28%–72% wide) is kept free for host & contestants.
const LAYOUT: Record<number, { l: number; t: number; w: number; h: number }[]> = {
  4: [{ l: 74, t: 26, w: 23, h: 28 }, { l: 3, t: 26, w: 23, h: 28 }, { l: 74, t: 60, w: 23, h: 28 }, { l: 3, t: 60, w: 23, h: 28 }],
  3: [{ l: 74, t: 30, w: 23, h: 32 }, { l: 3, t: 30, w: 23, h: 32 }, { l: 37, t: 79, w: 26, h: 17 }],
  2: [{ l: 72, t: 34, w: 25, h: 40 }, { l: 3, t: 34, w: 25, h: 40 }],
};

export function IsoOutputView({ snap, serverNow, compact = false }: { snap: IsoSnapshot | null; serverNow: () => number; compact?: boolean }) {
  const st = snap?.game?.state, q = snap?.game?.question as Question | null | undefined;
  const phase = st?.phase ?? "idle", idx = st?.questionIndex ?? 0, keys = activeAnswerKeys(idx);
  const placements = snap?.iso?.placements ?? {};
  const plates = snap?.plates ?? [];
  const revealed = REVEAL.has(phase), correct = (snap?.iso?.correct_answer ?? (revealed ? q?.correctAnswer : null)) as AnswerKey | null;
  const showQ = Boolean(q?.text) && phase !== "idle";
  const showA = showQ && phase !== "intro";
  const locked = phase === "locked" || Boolean(snap?.iso?.locked_snapshot && !revealed);
  const boxes = LAYOUT[keys.length];
  return (
    <div dir="rtl" className="relative h-full w-full overflow-hidden" style={{ containerType: "size" }}>
      {showQ && (
        <div className="po-rise absolute inset-x-[14%] top-[4%] flex flex-col items-center gap-[1cqh]">
          <div className="po-logo-lockup px-[2cqw] py-[0.5cqh]"><span className="po-logo-text font-black" style={{ fontSize: "2.2cqh" }}>עצור <b>בצד</b></span></div>
          <div className="po-question-marquee w-full px-[3cqw] py-[1.6cqh] text-center">
            <h1 className="po-question-type font-black leading-tight" style={{ fontSize: "4.2cqh" }}>{q?.text}</h1>
          </div>
          {phase === "timing" && st?.timerStartedAtServer && <IsoTimer start={st.timerStartedAtServer} duration={st.timerDurationMs ?? 60000} serverNow={serverNow} />}
        </div>
      )}
      {showA && boxes && keys.map((k, i) => {
        const b = boxes[i], on = plates.filter((p) => placements[p.id] === k);
        const isCorrect = revealed && correct === k, isWrong = revealed && correct && correct !== k;
        return (
          <div key={k} className={["absolute flex flex-col overflow-hidden rounded-xl border transition-all duration-500", isCorrect ? "po-panel-correct" : isWrong ? "po-panel-wrong po-iso-wrong" : locked ? "po-panel-locked" : "po-panel"].join(" ")}
            style={{ left: `${b.l}%`, top: `${b.t}%`, width: `${b.w}%`, height: `${b.h}%` }}>
            <span className="absolute right-[0.8cqw] top-[0.6cqh] font-black text-po-white/50" style={{ fontSize: "1.8cqh" }}>{HE_LETTER[k]}</span>
            <div className="flex flex-1 items-center justify-center px-[1.2cqw] text-center">
              <span className="font-black leading-tight text-white" style={{ fontSize: keys.length === 3 && i === 2 ? "3cqh" : "3.4cqh" }}>{q ? answerOf(q, k) : ""}</span>
            </div>
            <div className="flex min-h-[22%] flex-wrap items-center justify-center gap-[0.5cqw] px-[0.8cqw] pb-[1cqh]">
              {on.map((p) => <PlateChip key={p.id} plate={p} size={compact ? "sm" : "md"} dim={Boolean(isWrong)} />)}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function IsoTimer({ start, duration, serverNow }: { start: number; duration: number; serverNow: () => number }) {
  const [p, setP] = useState(0);
  useEffect(() => { let r = 0; const f = () => { setP(Math.max(0, Math.min(1, (serverNow() - start) / duration))); r = requestAnimationFrame(f); }; f(); return () => cancelAnimationFrame(r); }, [start, duration, serverNow]);
  return (
    <div dir="ltr" className="po-iso-road relative mt-[0.5cqh] h-[2.2cqh] w-[60%] rounded-full">
      <div className="po-road-dashes absolute inset-x-[2%] top-1/2 h-[2px] -translate-y-1/2" />
      <div className="absolute top-1/2 -translate-y-1/2" style={{ left: `calc(${p * 96}% )`, width: "3.2cqh" }}>
        <div className="relative" style={{ aspectRatio: "1.9 / 1" }}><div className="po-car-body absolute inset-0" style={{ transform: "rotate(90deg) scale(.55,1.9)" }} /></div>
      </div>
    </div>
  );
}
