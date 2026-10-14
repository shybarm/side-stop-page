// ISO director console: plates, timer, layout and log. Mirrors the board: answers first, then question.
import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { IsoOutputView, PlateChip } from "./IsoOutputView";
import { IsoLayoutPanel } from "./IsoLayoutPanel";
import { getIsoEvents, placePlate, setPlateStatus } from "@/lib/iso/iso.functions";
import { readCreds, useIsoSession } from "@/lib/iso/useIsoSession";
import { usePlateMoves } from "@/lib/iso/usePlateMoves";
import { errText, slotOfKey, type IsoEvent, type IsoSnapshot, type Plate } from "@/lib/iso/types";
import { activeAnswerKeys, answerOf, HE_LETTER, PHASE_LABEL, type AnswerKey, type Question } from "@/lib/pullover/types";

const STORE = "pullover:iso:director";
const REVEAL = new Set(["wiping", "revealed", "transition", "progress"]);
interface UndoItem { plate: string; from: AnswerKey | null; key: string }

export function IsoControl() {
  const [creds, setCreds] = useState<{ code: string; key: string } | null>(null);
  useEffect(() => setCreds(readCreds(STORE)), []);
  if (!creds) return <Connect onConnect={(c) => { localStorage.setItem(STORE, JSON.stringify(c)); setCreds(c); }} />;
  return <Console creds={creds} onLeave={() => { localStorage.removeItem(STORE); history.replaceState(null, "", "/iso-control"); setCreds(null); }} />;
}

function Connect({ onConnect }: { onConnect: (c: { code: string; key: string }) => void }) {
  const [code, setCode] = useState(""), [key, setKey] = useState("");
  return (
    <div dir="rtl" className="flex min-h-screen items-center justify-center bg-po-asphalt-deep p-6 text-po-white">
      <form className="w-full max-w-md space-y-4 rounded-2xl border border-po-steel-line bg-po-asphalt p-8" onSubmit={(e) => { e.preventDefault(); if (code && key) onConnect({ code: code.trim().toUpperCase(), key: key.trim() }); }}>
        <div className="po-logo-lockup mx-auto w-max px-6 py-1"><span className="po-logo-text text-2xl font-black">עצור <b>בצד</b></span></div>
        <h1 className="text-center text-xl font-black">התחברות לסשן ISO</h1>
        <p className="text-center text-sm text-po-white/50">את קוד הסשן ומפתח עוזר הבמאי מקבלים ממסך השליטה במחשב המשחק.</p>
        <label className="block text-sm">קוד סשן<input dir="ltr" value={code} onChange={(e) => setCode(e.target.value)} placeholder="PO-1234" className="mt-1 w-full rounded-lg border border-po-steel-line bg-po-asphalt-deep px-3 py-2 font-mono" /></label>
        <label className="block text-sm">מפתח עוזר במאי<input dir="ltr" value={key} onChange={(e) => setKey(e.target.value)} className="mt-1 w-full rounded-lg border border-po-steel-line bg-po-asphalt-deep px-3 py-2 font-mono" /></label>
        <button className="h-12 w-full rounded-xl bg-po-amber font-black text-po-asphalt-deep">התחבר</button>
      </form>
    </div>
  );
}

function Console({ creds, onLeave }: { creds: { code: string; key: string }; onLeave: () => void }) {
  const { snap, conn, refresh, serverNow } = useIsoSession(creds.code, creds.key);
  const plateMoves = usePlateMoves(creds, snap, refresh);
  const [correction, setCorrection] = useState(false);
  const [selected, setSelected] = useState<string | null>(null), [busy, setBusy] = useState(false);
  const [undo, setUndo] = useState<UndoItem[]>([]);
  const [now, setNow] = useState(Date.now());
  useEffect(() => { const t = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(t); }, []);
  const key = snap?.game?.question_key ?? null, iso = snap?.iso, st = snap?.game?.state, q = snap?.game?.question as Question | null;
  const keys = activeAnswerKeys(st?.questionIndex ?? 0), phase = st?.phase ?? "idle";
  const revealed = REVEAL.has(phase) || Boolean(iso?.resolved);
  const locked = phase === "locked" || Boolean(iso?.locked_snapshot);
  // Mirror the game board: question from "intro", answers from "answers" — never earlier.
  const showA = Boolean(q) && phase !== "idle", showQ = showA && phase !== "intro";
  useEffect(() => { setUndo([]); setSelected(null); }, [key]);
  const plates = snap?.plates ?? [], byId = new Map(plates.map((p) => [p.id, p]));
  const pool = (iso?.pool ?? []).map((id) => byId.get(id)).filter(Boolean) as Plate[];
  const placements = plateMoves.placements;
  const unplaced = pool.filter((p) => !placements[p.id] && p.status !== "eliminated");
  const pendingOld = plates.filter((p) => p.status === "pending" && p.status_key && p.status_key !== key);
  const canCorrect = correction && (locked || revealed);
  const canDrag = (phase === "timing" && !locked && !revealed) || canCorrect;
  useEffect(() => { if (!canDrag) setSelected(null); }, [canDrag]);
  useEffect(() => { setCorrection(false); }, [key]);
  const stale = !conn.online, gameDown = conn.gameHeartbeatAgeMs != null && conn.gameHeartbeatAgeMs > 9000;
  if (snap?.role && snap.role !== "director" && snap.role !== "game") return <div className="p-10 text-po-red">מפתח לקריאה בלבד</div>;

  async function move(plate: string, target: AnswerKey | null, opts: { qkey?: string; undo?: boolean; forceCorrection?: boolean } = {}) {
    const qkey = opts.qkey ?? key; if (!qkey || !iso) return;
    if (busy || (!opts.qkey && !canDrag)) return;
    const isCorrection = Boolean(opts.forceCorrection ?? canCorrect);
    const from = (placements[plate] ?? null) as AnswerKey | null;
    if (from === target && !opts.qkey) return;
    if (qkey === key) {
      plateMoves.enqueue(plate, target, isCorrection, Boolean(opts.undo));
      if (!opts.undo) setUndo((u) => [...u.slice(-30), { plate, from, key: qkey }]);
      setSelected(null);
      return;
    }
    setBusy(true);
    try {
      // pending completion of an older question: -1 tells the server to skip the version check for that plate only
      const expected = qkey === key ? iso.version : -1;
      await placePlate({ data: { code: creds.code, key: creds.key, questionKey: qkey, plate, target, expected, correction: isCorrection, note: "", undo: Boolean(opts.undo) } });
      if (!opts.undo && qkey === key) setUndo((u) => [...u.slice(-30), { plate, from, key: qkey }]);
    } catch (e) { toast.error(errText(e)); }
    finally { setSelected(null); await refresh(); setBusy(false); }
  }
  async function doUndo() { const u = undo[undo.length - 1]; if (!u || u.key !== key) return; setUndo((x) => x.slice(0, -1)); await move(u.plate, u.from, { undo: true }); }
  async function status(plate: string, s: "active" | "eliminated") {
    try { await setPlateStatus({ data: { code: creds.code, key: creds.key, plate, status: s, note: "" } }); toast.success("התיקון נרשם ביומן"); } catch (e) { toast.error(errText(e)); }
    void refresh();
  }
  const drop = (target: AnswerKey | null) => ({
    onDragOver: (e: React.DragEvent) => { if (canDrag) { e.preventDefault(); e.currentTarget.classList.add("over"); } },
    onDragLeave: (e: React.DragEvent) => e.currentTarget.classList.remove("over"),
    onDrop: (e: React.DragEvent) => { e.currentTarget.classList.remove("over"); if (!canDrag || busy) return; e.preventDefault(); const id = e.dataTransfer.getData("text/plate"); if (id) void move(id, target); },
    onClick: () => { if (selected && canDrag) void move(selected, target); },
  });
  const chip = (p: Plate) => {
    const out = p.status === "eliminated";
    return (
      <button key={p.id} type="button" draggable={canDrag && !busy && !out} disabled={busy || !canDrag || out}
        onDragStart={(e) => e.dataTransfer.setData("text/plate", p.id)}
        onClick={(e) => { e.stopPropagation(); if (canDrag && !out) setSelected(selected === p.id ? null : p.id); }}
        className={["rounded-md p-0.5", selected === p.id ? "ring-2 ring-po-amber" : "", canDrag && !out ? "cursor-grab" : "cursor-not-allowed"].join(" ")} aria-label="שלט">
        <PlateChip plate={p} size="lg" dim={out} />
      </button>
    );
  };

  return (
    <div dir="rtl" className="min-h-screen bg-po-asphalt-deep text-po-white">
      <header className="flex flex-wrap items-center gap-4 border-b border-po-steel-line bg-po-asphalt px-6 py-3">
        <b>עצור בצד</b><span className="text-xs text-po-amber">ISO CONTROL</span>
        <span dir="ltr" className="font-mono text-sm">{creds.code}</span>
        <Light ok={conn.online} label={conn.online ? `מסונכרן · ${Math.max(0, Math.round((now - (conn.lastOkAt ?? now)) / 1000))}ש׳` : "מנותק מהשרת"} />
        <Light ok={!gameDown && conn.gameHeartbeatAgeMs != null} label={gameDown ? `מחשב המשחק לא משדר (${Math.round((conn.gameHeartbeatAgeMs ?? 0) / 1000)}ש׳)` : "מחשב המשחק מחובר"} />
        <span className="rounded-full border border-po-steel-line px-3 py-1 text-sm font-bold">{PHASE_LABEL[phase]}</span>
        <span className="font-mono text-sm text-po-white/60">שאלה {(st?.questionIndex ?? 0) + 1} / 7 · {keys.length} תשובות</span>
        {st?.teamName && <span className="rounded-full bg-po-amber px-3 py-1 text-sm font-black text-po-asphalt-deep">קבוצה: {st.teamName}</span>}
        <button onClick={onLeave} className="ms-auto rounded border px-3 py-1.5 text-xs">החלף סשן</button>
      </header>
      {(stale || gameDown) && <div className="bg-po-red px-6 py-2 text-center font-black">{stale ? "אזהרה: אין סנכרון עם השרת — המצב המוצג אינו עדכני" : "אזהרה: אין דופק ממחשב המשחק — ייתכן שהמצב אינו עדכני"}</div>}
      <div className="grid gap-6 p-6 xl:grid-cols-[1fr_420px]">
        <section className="space-y-4">
          <div className="rounded-xl border border-po-steel-line bg-po-asphalt p-5">
            <div className="flex items-start gap-4">
              <div className="min-w-0 flex-1">
                <small className="text-po-white/40">שאלה נוכחית</small>
                <h2 className="text-2xl font-black">{showQ ? q?.text : "ממתין לשאלה ממחשב המשחק"}</h2>
              </div>
              <DirectorTimer phase={phase} start={st?.timerStartedAtServer ?? null} duration={st?.timerDurationMs ?? 60000} serverNow={serverNow} />
            </div>
            {locked && <div className="mt-2 text-sm font-bold text-po-amber">הלוח נעול — צילום החלוקה נשמר. {correction ? "מצב תיקון פעיל." : "גרירה חסומה."}</div>}
            {showA && !showQ && <div className="mt-2 text-sm text-po-white/50">התשובות באוויר — השאלה תוצג כשמחשב המשחק יעלה אותה.</div>}
          </div>
          <div className={["grid gap-3", keys.length === 4 ? "sm:grid-cols-2" : keys.length === 3 ? "sm:grid-cols-3" : "sm:grid-cols-2"].join(" ")}>
            {showA && q && keys.map((k) => {
              const on = pool.filter((p) => placements[p.id] === k), isC = revealed && (iso?.correct_answer ?? null) === k, isW = revealed && iso?.correct_answer && iso.correct_answer !== k;
              return (
                <div key={k} {...drop(k)} className={["po-dropzone min-h-40 rounded-xl border p-4", isC ? "po-panel-correct" : isW ? "po-panel-wrong" : locked ? "po-panel-locked" : "po-panel", selected ? "cursor-pointer" : ""].join(" ")}>
                  <div className="flex items-center gap-2"><b className="flex h-7 w-7 items-center justify-center rounded bg-po-steel text-sm">{HE_LETTER[k]}</b><span className="font-black">{answerOf(q, k)}</span>{q.correctAnswer === k && <small className="ms-auto text-po-green">נכונה</small>}</div>
                  <div className="mt-3 flex flex-wrap gap-2">{on.map(chip)}</div>
                </div>
              );
            })}
          </div>
          <div {...drop(null)} className="po-dropzone rounded-xl border border-dashed border-po-steel-line bg-po-asphalt p-4">
            <div className="mb-2 flex items-center gap-2 text-xs text-po-white/50">מאגר השלטים {plateMoves.pending > 0 && <span role="status" className="text-po-amber">שומר {plateMoves.pending}…</span>}</div>
            <div className="flex min-h-12 flex-wrap gap-2">{unplaced.map(chip)}{!unplaced.length && <span className="text-sm text-po-white/30">כל השלטים הוקצו</span>}</div>
          </div>
          {unplaced.length > 0 && q && <Alert>{unplaced.length} שלטים עדיין לא הוקצו לתשובה. {revealed ? "הם ממתינים להשלמת מיקום." : ""}</Alert>}
          {pendingOld.map((p) => {
            const slot = slotOfKey(p.status_key);
            const pendingKey = p.status_key;
            return <Alert key={p.id}><span className="flex flex-wrap items-center gap-2">שלט ממתין להשלמת מיקום משאלה {slot + 1}: <PlateChip plate={p} size="sm" />{activeAnswerKeys(slot).map((k) => <button key={k} disabled={busy} onClick={() => { if (pendingKey) void move(p.id, k, { qkey: pendingKey, forceCorrection: true }); }} className="rounded border border-po-amber px-2 text-xs">{HE_LETTER[k]}</button>)}</span></Alert>;
          })}
          <IsoLayoutPanel snap={snap} serverNow={serverNow} creds={creds} onSaved={() => void refresh()} />
        </section>
        <aside className="space-y-3">
          <button onClick={() => void doUndo()} disabled={!undo.length || busy || !canDrag} className="h-14 w-full rounded-xl border border-po-steel-line bg-po-steel text-lg font-bold disabled:opacity-30">בטל פעולה אחרונה</button>
          <div className={["rounded-xl border p-4", correction ? "border-po-amber bg-po-amber/10" : "border-po-steel-line bg-po-asphalt"].join(" ")}>
            <label className="flex items-center gap-2 font-black"><input type="checkbox" checked={correction} onChange={(e) => setCorrection(e.target.checked)} />מצב תיקון מפעיל</label>
            <p className="mt-1 text-xs text-po-white/50">לתיקון חלוקה אחרי נעילה או חשיפה, ולתיקון סטטוס שלט. כל פעולה נרשמת ביומן.</p>
            {correction && <div className="mt-3 space-y-1.5">{plates.map((p) => <div key={p.id} className="flex items-center gap-2 text-sm"><PlateChip plate={p} size="sm" dim={p.status === "eliminated"} /><span className="flex-1 text-po-white/70">{p.status === "active" ? "פעיל" : p.status === "eliminated" ? "יצא מהמשחק" : "ממתין להשלמה"}</span>{p.status !== "eliminated" ? <button onClick={() => void status(p.id, "eliminated")} className="rounded border border-po-red px-2 text-xs text-po-red">סמן כיצא</button> : <button onClick={() => void status(p.id, "active")} className="rounded border border-po-green px-2 text-xs text-po-green">החזר למשחק</button>}</div>)}</div>}
          </div>
          <div className="rounded-xl border border-po-steel-line bg-po-asphalt p-4 text-sm">
            <div className="mb-2 font-black">שלטים בסשן</div>
            <div className="flex flex-wrap gap-3">{plates.map((p) => <span key={p.id} className="flex items-center gap-1"><PlateChip plate={p} size="sm" dim={p.status === "eliminated"} />{p.status === "pending" && <i className="text-po-amber">!</i>}</span>)}</div>
            <div className="mt-2 text-xs text-po-white/40">פעילים {plates.filter((p) => p.status === "active").length} · יצאו {plates.filter((p) => p.status === "eliminated").length} · ממתינים {plates.filter((p) => p.status === "pending").length}</div>
          </div>
          <LogPanel creds={creds} version={`${iso?.version}-${snap?.game_version ?? ""}-${phase}-${JSON.stringify(snap?.layout ?? null)}-${plates.map((p) => `${p.id}:${p.status}:${p.status_key}`).join(",")}`} />
          <ReplayPanel />
        </aside>
      </div>
    </div>
  );
}

function Light({ ok, label }: { ok: boolean; label: string }) {
  return <span className="flex items-center gap-2 rounded-full border border-po-steel-line px-3 py-1 text-xs font-bold"><i className="h-2.5 w-2.5 rounded-full" style={{ background: ok ? "var(--po-green)" : "var(--po-red)" }} />{label}</span>;
}
function Alert({ children }: { children: React.ReactNode }) { return <div className="rounded-lg border border-po-amber bg-po-amber/10 px-4 py-2 text-sm font-bold text-po-amber">{children}</div>; }

const KIND: Record<string, string> = { move: "הזזת שלט", undo: "ביטול", correction: "תיקון מפעיל", pending_completion: "השלמת מיקום", status_correction: "תיקון סטטוס", layout: "שינוי פריסה", lock: "נעילה", reveal: "חשיפה", next: "מעבר שאלה", session_created: "פתיחת סשן" };

function LogPanel({ creds, version }: { creds: { code: string; key: string }; version: string }) {
  const [ev, setEv] = useState<IsoEvent[]>([]);
  useEffect(() => { getIsoEvents({ data: creds }).then((x) => setEv(x as IsoEvent[])).catch(() => {}); }, [creds, version]);
  const exportLog = () => {
    const blob = new Blob([JSON.stringify({ session: creds.code, exportedAt: new Date().toISOString(), events: ev }, null, 2)], { type: "application/json" });
    const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = `iso-log-${creds.code}.json`; a.click();
  };
  return (
    <div className="rounded-xl border border-po-steel-line bg-po-asphalt p-4">
      <div className="mb-2 flex items-center"><b className="text-sm">יומן פעולות</b><button onClick={exportLog} className="ms-auto rounded border px-2 py-0.5 text-xs">ייצוא JSON</button></div>
      <div className="max-h-64 space-y-1 overflow-y-auto font-mono text-[11px]">
        {[...ev].reverse().slice(0, 80).map((e) => (
          <div key={e.id} className="flex gap-2 border-b border-po-steel-line/30 py-0.5">
            <span className="text-po-white/40">{new Date(e.ts).toLocaleTimeString("he-IL")}</span>
            <span className="font-bold">{KIND[e.kind] ?? e.kind}</span>
            <span className="text-po-white/50">ש{e.question_key ? slotOfKey(e.question_key) + 1 : "-"}</span>
            {typeof e.data["plate"] === "string" && <span>{e.data["plate"]}{e.data["from"] !== undefined || e.data["to"] !== undefined ? ` ${e.data["from"] ?? "מאגר"}→${e.data["to"] ?? "מאגר"}` : ""}</span>}
            {typeof e.data["note"] === "string" && e.data["note"] && <span className="text-po-amber">“{e.data["note"]}”</span>}
          </div>
        ))}
      </div>
    </div>
  );
}

function ReplayPanel() {
  const [ev, setEv] = useState<IsoEvent[] | null>(null), [i, setI] = useState(0);
  const ref = useRef<HTMLInputElement>(null);
  const cur = ev?.[i];
  const snap = useMemo<IsoSnapshot | null>(() => (cur?.data.snapshot ?? null), [cur]);
  const frozenNow = () => (cur ? new Date(cur.ts).getTime() : Date.now());
  return (
    <div className="rounded-xl border border-po-steel-line bg-po-asphalt p-4">
      <div className="mb-2 flex items-center"><b className="text-sm">שחזור מיומן</b><button onClick={() => ref.current?.click()} className="ms-auto rounded border px-2 py-0.5 text-xs">טען קובץ</button>
        <input ref={ref} type="file" accept="application/json" className="hidden" onChange={async (e) => { const f = e.target.files?.[0]; if (!f) return; try { const j = JSON.parse(await f.text()); setEv(j.events ?? j); setI(0); } catch { toast.error("קובץ יומן לא תקין"); } }} /></div>
      {ev && ev.length > 0 && <>
        <input type="range" min={0} max={ev.length - 1} value={i} onChange={(e) => setI(Number(e.target.value))} className="w-full" />
        <div className="mb-2 text-xs text-po-white/60">{i + 1}/{ev.length} · {cur && (KIND[cur.kind] ?? cur.kind)} · {cur && new Date(cur.ts).toLocaleTimeString("he-IL")}</div>
        <div className="po-iso-checker aspect-video overflow-hidden rounded border border-po-steel-line"><IsoOutputView snap={snap} serverNow={frozenNow} compact /></div>
      </>}
    </div>
  );
}

/** Director's view of the game timer, derived from the game computer's start time in server time. */
function DirectorTimer({ phase, start, duration, serverNow }: { phase: string; start: number | null; duration: number; serverNow: () => number }) {
  const [left, setLeft] = useState(duration);
  useEffect(() => {
    if (phase !== "timing" || !start) return;
    const f = () => setLeft(Math.max(0, duration - (serverNow() - start)));
    f(); const t = setInterval(f, 200); return () => clearInterval(t);
  }, [phase, start, duration, serverNow]);
  const running = phase === "timing" && Boolean(start);
  const shown = running ? left : phase === "answers" || phase === "intro" || phase === "idle" ? duration : 0;
  const sec = Math.ceil(shown / 1000);
  return (
    <div data-testid="director-timer" className={["w-32 shrink-0 rounded-xl border p-2 text-center", running ? (sec <= 10 ? "border-po-red" : "border-po-amber") : "border-po-steel-line opacity-60"].join(" ")}>
      <div className="text-[10px] text-po-white/50">{running ? "זמן רץ" : phase === "locked" ? "ננעל" : "טיימר"}</div>
      <div dir="ltr" className={["font-mono text-3xl font-black", running && sec <= 10 ? "text-po-red" : ""].join(" ")}>{Math.floor(sec / 60)}:{String(sec % 60).padStart(2, "0")}</div>
      <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-po-steel"><div className="h-full bg-po-amber" style={{ width: `${(shown / duration) * 100}%` }} /></div>
    </div>
  );
}
