import { useState } from "react";
import { toast } from "sonner";
import { createIsoSession } from "@/lib/iso/iso.functions";
import { publisher, usePublisher } from "@/lib/iso/publisher";
import { Button } from "@/components/ui/button";
import { Monitor } from "lucide-react";

/** Game-computer panel: opens a shared ISO session and shows background sync status. Never blocks game controls. */
export function IsoSessionPanel() {
  const { status, creds } = usePublisher();
  const [busy, setBusy] = useState(false);
  const origin = typeof window !== "undefined" ? window.location.origin : "";
  const open = async () => {
    setBusy(true);
    try { publisher.attach(await createIsoSession()); toast.success("סשן ISO נפתח"); } catch { toast.error("לא ניתן לפתוח סשן כעת. המשחק ממשיך לעבוד מקומית."); }
    finally { setBusy(false); }
  };
  const copy = (t: string) => { void navigator.clipboard?.writeText(t); toast.success("הקישור הועתק"); };
  if (!creds) return <button onClick={open} disabled={busy} className="h-12 w-full rounded-xl border border-po-steel-line bg-po-asphalt text-sm font-bold disabled:opacity-40">{busy ? "פותח סשן..." : "פתח סשן ISO"}</button>;
   const dir = `${origin}/iso-control?s=${creds.code}#k=${creds.director}`, out = `${origin}/iso-output?s=${creds.code}#k=${creds.output}`;
   const game = `${origin}/game-remote?s=${creds.code}#k=${creds.output}`;
  return (
    <div className="space-y-2 rounded-xl border border-po-steel-line bg-po-asphalt p-3 text-xs">
      <div className="flex items-center gap-2">
        <i className="h-2.5 w-2.5 rounded-full" style={{ background: status.connected ? "var(--po-green)" : "var(--po-red)" }} />
        <b>ISO</b><span dir="ltr" className="font-mono text-sm">{creds.code}</span>
        <span className="text-po-white/50">{status.connected ? "מסונכרן" : "לא מסונכרן — המשחק ממשיך מקומית"}</span>
      </div>
      {status.queue > 0 && <div className="font-bold text-po-amber">{status.queue} אירועים ממתינים לשליחה</div>}
       <Button variant="outline" onClick={() => copy(game)} className="h-auto w-full whitespace-normal py-2"><Monitor />העתק קישור מסך משחק למחשב אחר</Button>
       <div className="flex gap-2">
        <button onClick={() => copy(dir)} className="flex-1 rounded border px-2 py-1">העתק קישור עוזר במאי</button>
        <button onClick={() => copy(out)} className="flex-1 rounded border px-2 py-1">העתק קישור יציאה</button>
      </div>
      <button onClick={() => { if (confirm("לנתק את מחשב המשחק מסשן ה-ISO?")) publisher.detach(); }} className="text-po-white/40 underline">נתק סשן</button>
    </div>
  );
}
