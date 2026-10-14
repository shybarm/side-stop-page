import { useEffect, useRef, useState } from "react";
import { IsoAnswerPane } from "./IsoAnswerPane";
// Clean ISO output graphics (lower third), mirroring what the game board shows (answers first, then question).
import { activeAnswerKeys, answerOf, HE_LETTER, type AnswerKey, type Question } from "@/lib/pullover/types";
import { layoutOf, type IsoSnapshot, type LayoutBox, type Plate } from "@/lib/iso/types";

/** A license plate chip: fixed colour, no number or text. "cq" sizes it relative to the output frame. */
export function PlateChip({ plate, size = "md", dim = false }: { plate: Pick<Plate, "color">; size?: "sm" | "md" | "lg" | "cq"; dim?: boolean }) {
  const s = size === "sm" ? "h-4 w-9" : size === "lg" ? "h-10 w-24" : size === "md" ? "h-7 w-16" : "";
  const style: React.CSSProperties & Record<string, string> = size === "cq"
    ? { ["--plate"]: plate.color, height: "2.3cqh", width: "5.2cqh", borderWidth: "0.25cqh" }
    : { ["--plate"]: plate.color };
  return <span className={["po-plate inline-block shrink-0", s, dim ? "po-plate-out" : ""].join(" ")} style={style} />;
}

const REVEAL = new Set(["wiping", "revealed", "transition", "progress"]);
/** Width of the answer row per answer count, as % of the frame — narrower for fewer answers. */
const ROW_WIDTH: Record<number, number> = { 4: 92, 3: 78, 2: 58 };

/**
 * Lower-third ISO graphic: a compact question bar with the timer road attached to it, and one row of
 * low answer panels (with their plates) beneath it. Everything lives in one group anchored to the bottom
 * of the frame, so the centre and upper frame stay clear for faces. `layout` moves/scales the whole group.
 */
export function IsoOutputView({ snap, serverNow, layout }: { snap: IsoSnapshot | null; serverNow: () => number; compact?: boolean; layout?: LayoutBox }) {
  const st = snap?.game?.state, q = snap?.game?.question as Question | null | undefined;
  const phase = st?.phase ?? "idle", idx = st?.questionIndex ?? 0, keys = activeAnswerKeys(idx);
  const placements = snap?.iso?.placements ?? {};
  const plates = snap?.plates ?? [];
  const revealed = REVEAL.has(phase), correct = (snap?.iso?.correct_answer ?? (revealed ? q?.correctAnswer : null)) as AnswerKey | null;
  // Mirror the game board: it shows the question from "intro", answers from "answers", and a full-screen transition afterwards.
  // Answers go up first ("intro"), then the question ("answers" phase onwards).
  const showQ = Boolean(q?.text) && !["idle", "transition", "progress"].includes(phase);
  const showQText = showQ && phase !== "intro";
  const showA = showQ;
  const locked = phase === "locked" || Boolean(snap?.iso?.locked_snapshot && !revealed);
  const box = layout ?? layoutOf(snap?.layout).current;
  const width = ROW_WIDTH[keys.length] ?? 92;
  const airing = snap?.game?.question_key ?? null;
  const previous = useRef<{ airing: string | null; revealed: boolean } | null>(null);
  const [revealAiring, setRevealAiring] = useState<string | null>(null);
  useEffect(() => {
    const prev = previous.current;
    previous.current = { airing, revealed };
    if (prev?.airing === airing && !prev.revealed && revealed) {
      setRevealAiring(airing);
      const t = setTimeout(() => setRevealAiring(null), 1900);
      return () => clearTimeout(t);
    }
    setRevealAiring(null);
    return undefined;
  }, [airing, revealed]);
  return (
    <div dir="rtl" className="relative h-full w-full overflow-hidden" style={{ containerType: "size" }}>
      {showQ && (
        <div data-iso-group className="absolute bottom-[3.5%] left-1/2 flex flex-col items-center gap-[1.1cqh]"
          style={{ width: `${width}%`, transform: `translate(calc(-50% + ${box.x}cqw), ${box.y}cqh) scale(${box.scale})`, transformOrigin: "50% 100%" }}>
          <div key={showQText ? "q" : "noq"} className="po-rise flex w-full items-stretch gap-[1cqw]" style={{ visibility: showQText ? "visible" : "hidden" }}>
            <div className="po-logo-lockup flex shrink-0 items-center px-[1.2cqw]"><span className="po-logo-text whitespace-nowrap font-black" style={{ fontSize: "2cqh" }}>עצור <b>בצד</b></span></div>
            <div className="po-question-marquee flex min-w-0 flex-1 flex-col justify-center px-[2cqw] py-[1cqh]">
              <h1 className="po-question-type text-center font-black leading-[1.15]" style={{ fontSize: "3.3cqh" }}>{q?.text}</h1>
            </div>
          </div>
          <div className="w-full" style={{ height: "1.9cqh", visibility: phase === "timing" && st?.timerStartedAtServer ? "visible" : "hidden" }}>
            {phase === "timing" && st?.timerStartedAtServer ? <IsoTimer start={st.timerStartedAtServer} duration={st.timerDurationMs ?? 60000} serverNow={serverNow} /> : null}
          </div>
          {showA && (
            <div className="flex w-full items-stretch gap-[1cqw]">
              {keys.map((k) => {
                const scoredPlacements = revealed ? snap?.iso?.locked_snapshot ?? placements : placements;
                const on = plates.filter((p) => scoredPlacements[p.id] === k);
                const isCorrect = revealed && correct === k, isWrong = revealed && correct && correct !== k;
                return (
                  <IsoAnswerPane key={`${airing}:${k}`} letter={k} text={q ? answerOf(q, k) : ""} plates={on} locked={locked} correct={isCorrect} wrong={Boolean(isWrong)} animateReveal={revealAiring === airing && airing !== null} />
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/** Timer as a road strip under the question bar: the car drives right → left over the timer's duration. */
function IsoTimer({ start, duration, serverNow }: { start: number; duration: number; serverNow: () => number }) {
  const [p, setP] = useState(0);
  useEffect(() => { let r = 0; const f = () => { setP(Math.max(0, Math.min(1, (serverNow() - start) / duration))); r = requestAnimationFrame(f); }; f(); return () => cancelAnimationFrame(r); }, [start, duration, serverNow]);
  return (
    <div className="po-iso-road relative h-full w-full rounded-full">
      <div className="po-iso-dashes absolute inset-x-[1.5%] top-1/2 h-[0.25cqh] -translate-y-1/2" />
      <div className="absolute top-1/2 -translate-y-1/2" style={{ right: `calc(${p * 100}% - ${p * 5}cqh)`, width: "5cqh", height: "2.6cqh" }}>
        <div className="absolute left-1/2 top-1/2" style={{ width: "2.6cqh", height: "5cqh", transform: "translate(-50%,-50%) rotate(-90deg)" }}>
          <div className="po-car-body absolute inset-0" style={{ borderWidth: "0.2cqh" }} />
          <div className="po-car-glass absolute inset-x-[18%] top-[16%] h-[26%]" />
          <div className="po-car-glass absolute inset-x-[18%] bottom-[16%] h-[20%]" />
        </div>
      </div>
    </div>
  );
}
