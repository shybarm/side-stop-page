import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { IsoOutputView } from "./IsoOutputView";
import { setIsoLayout } from "@/lib/iso/iso.functions";
import { errText, layoutOf, type IsoLayout, type IsoSnapshot, type LayoutBox } from "@/lib/iso/types";

const clamp = (b: LayoutBox): LayoutBox => ({
  x: Math.max(-50, Math.min(50, Math.round(b.x * 10) / 10)),
  y: Math.max(-60, Math.min(20, Math.round(b.y * 10) / 10)),
  scale: Math.max(0.4, Math.min(1.6, Math.round(b.scale * 100) / 100)),
});
const PRESET_LABEL = { long: "לונגשוט", close: "קלוז־אפ" } as const;

/**
 * Position & size of the ISO graphics group, with long-shot / close-up presets.
 * Layout is stored separately from plates and timer, so moving the group never touches them.
 * The test photo is a local object URL shown only in this preview — it is never uploaded,
 * never sent to the output and never written to the log.
 */
export function IsoLayoutPanel({ snap, serverNow, creds, onSaved }: { snap: IsoSnapshot | null; serverNow: () => number; creds: { code: string; key: string }; onSaved: () => void }) {
  const server = layoutOf(snap?.layout);
  const [draft, setDraft] = useState<IsoLayout | null>(null);
  const [photo, setPhoto] = useState<string | null>(null), [showPhoto, setShowPhoto] = useState(true);
  const lay = draft ?? server;
  const sendT = useRef<ReturnType<typeof setTimeout> | undefined>(undefined), fileRef = useRef<HTMLInputElement>(null), frame = useRef<HTMLDivElement>(null);
  const drag = useRef<{ x: number; y: number; box: LayoutBox } | null>(null);

  // Drop the local draft once the server echoes it back.
  useEffect(() => { if (draft && JSON.stringify(server) === JSON.stringify(draft)) setDraft(null); }, [snap?.layout]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => () => { if (photo) URL.revokeObjectURL(photo); }, [photo]);

  function update(next: IsoLayout, immediate = false) {
    setDraft(next);
    clearTimeout(sendT.current);
    sendT.current = setTimeout(async () => {
      try { await setIsoLayout({ data: { ...creds, layout: next } }); onSaved(); }
      catch (e) { toast.error(`הפריסה לא נשמרה: ${errText(e)}`); }
    }, immediate ? 0 : 250);
  }
  const move = (b: Partial<LayoutBox>) => update({ ...lay, active: "custom", current: clamp({ ...lay.current, ...b }) });
  const apply = (k: "long" | "close") => update({ ...lay, active: k, current: lay.presets[k] }, true);
  const savePreset = (k: "long" | "close") => { update({ ...lay, active: k, presets: { ...lay.presets, [k]: lay.current } }, true); toast.success(`נשמר כפריסט ${PRESET_LABEL[k]}`); };

  const onDown = (e: React.PointerEvent) => { drag.current = { x: e.clientX, y: e.clientY, box: lay.current }; (e.target as HTMLElement).setPointerCapture(e.pointerId); };
  const onMove = (e: React.PointerEvent) => {
    const d = drag.current, f = frame.current; if (!d || !f) return;
    const r = f.getBoundingClientRect();
    setDraft({ ...lay, active: "custom", current: clamp({ ...d.box, x: d.box.x - ((e.clientX - d.x) / r.width) * 100 * -1, y: d.box.y + ((e.clientY - d.y) / r.height) * 100 }) });
  };
  const onUp = () => { if (drag.current && draft) update(draft, true); drag.current = null; };

  const btn = "rounded border border-po-steel-line bg-po-steel px-2.5 py-1 text-sm font-bold disabled:opacity-30";
  return (
    <div className="rounded-xl border border-po-steel-line bg-po-asphalt p-4">
      <div className="mb-2 flex flex-wrap items-center gap-2 text-xs">
        <span className="text-po-white/40">PREVIEW · ISO OUTPUT</span>
        <span className="text-po-white/40">· גרור את הגרפיקה כדי להזיז</span>
        <span className="ms-auto flex items-center gap-2">
          <button onClick={() => fileRef.current?.click()} className="rounded border px-2 py-0.5">{photo ? "החלף צילום בדיקה" : "בחר צילום בדיקה"}</button>
          {photo && <label className="flex items-center gap-1"><input type="checkbox" checked={showPhoto} onChange={(e) => setShowPhoto(e.target.checked)} />הצג צילום</label>}
          {photo && <button onClick={() => setPhoto(null)} className="text-po-white/50 underline">הסר</button>}
        </span>
        <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) { setPhoto(URL.createObjectURL(f)); setShowPhoto(true); } e.target.value = ""; }} />
      </div>
      <div ref={frame} data-testid="iso-preview" onPointerDown={onDown} onPointerMove={onMove} onPointerUp={onUp} onPointerCancel={onUp}
        className={["relative mx-auto aspect-video max-w-3xl cursor-move touch-none select-none overflow-hidden rounded-lg border border-po-steel-line", photo && showPhoto ? "po-iso-photo" : "po-iso-checker"].join(" ")}
        style={photo && showPhoto ? { backgroundImage: `url(${photo})` } : undefined}>
        <IsoOutputView snap={snap} serverNow={serverNow} layout={lay.current} />
        {photo && showPhoto && <span className="pointer-events-none absolute left-2 top-2 rounded bg-po-asphalt-deep/80 px-2 py-0.5 text-[10px] font-bold text-po-amber">צילום בדיקה · לא משודר</span>}
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        {(["long", "close"] as const).map((k) => (
          <button key={k} onClick={() => apply(k)} className={["rounded-lg border px-3 py-1.5 text-sm font-black", lay.active === k ? "border-po-amber bg-po-amber text-po-asphalt-deep" : "border-po-steel-line"].join(" ")}>{PRESET_LABEL[k]}</button>
        ))}
        <span className="mx-1 h-6 w-px bg-po-steel-line" />
        <button className={btn} aria-label="הזז למעלה" onClick={() => move({ y: lay.current.y - 1 })}>↑</button>
        <button className={btn} aria-label="הזז למטה" onClick={() => move({ y: lay.current.y + 1 })}>↓</button>
        <button className={btn} aria-label="הזז ימינה" onClick={() => move({ x: lay.current.x + 1 })}>→</button>
        <button className={btn} aria-label="הזז שמאלה" onClick={() => move({ x: lay.current.x - 1 })}>←</button>
        <button className={btn} aria-label="הקטן" onClick={() => move({ scale: lay.current.scale - 0.05 })}>−</button>
        <span dir="ltr" className="w-12 text-center font-mono text-xs">{Math.round(lay.current.scale * 100)}%</span>
        <button className={btn} aria-label="הגדל" onClick={() => move({ scale: lay.current.scale + 0.05 })}>+</button>
        <button className={btn} onClick={() => move({ x: 0, y: 0 })}>מרכז</button>
      </div>
      <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
        <span className="text-po-white/50">שמור את המיקום הנוכחי כפריסט:</span>
        <button onClick={() => savePreset("long")} className="rounded border border-po-amber px-2 py-0.5 text-po-amber">שמור ללונגשוט</button>
        <button onClick={() => savePreset("close")} className="rounded border border-po-amber px-2 py-0.5 text-po-amber">שמור לקלוז־אפ</button>
        <span className="ms-auto text-po-white/40">הזזת הגרפיקה לא משנה את חלוקת השלטים או את הטיימר.</span>
      </div>
    </div>
  );
}
