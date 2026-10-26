import { useState } from "react";
import { toast } from "sonner";
import { actions } from "@/lib/pullover/gameStore";
import { listPairs, loadPair } from "@/lib/pullover/bank.functions";
import { setPairPack, usePairPack } from "@/lib/pullover/questionStore";
import { publisher } from "@/lib/iso/publisher";
import { Button } from "@/components/ui/button";

/** Loads a couple's assigned questions from the "הבודקת" bank as the active game list. */
export function PairLoader() {
  const pack = usePairPack();
  const [pairs, setPairs] = useState<{ id: string; name: string; count: number }[] | null>(null);
  const [busy, setBusy] = useState(false);
  const open = async () => {
    const creds = publisher.creds();
    if (!creds) { toast.error("פתח סשן ISO לפני טעינת זוג"); return; }
    setBusy(true);
    try { setPairs(await listPairs({ data: { code: creds.code, key: creds.game } })); } catch (e) { toast.error((e as Error).message); } finally { setBusy(false); }
  };
  const pick = async (id: string, name: string) => {
    const creds = publisher.creds();
    if (!creds) return;
    if (!confirm(`לטעון את השאלות של "${name}"? זה מתחיל משחק חדש.`)) return;
    setBusy(true);
    try {
      const p = await loadPair({ data: { id, code: creds.code, key: creds.game } });
      setPairPack({ ...p, loadedAt: Date.now() });
      actions.newGame(p.pairName);
      setPairs(null);
      toast.success(`נטענו ${p.questions.length} שאלות של ${p.pairName}`);
    } catch (e) { toast.error((e as Error).message); } finally { setBusy(false); }
  };
  return (
    <div className="space-y-2 rounded-xl border border-po-steel-line bg-po-asphalt p-3 text-xs">
      <div className="text-po-white/50">שאלות המשחק</div>
      <div className="font-bold">{pack ? `${pack.pairName} · ${pack.questions.length} שאלות מהמאגר` : "מחסן הבדיקות"}</div>
      <div className="flex gap-2">
        <Button variant="outline" disabled={busy} onClick={open} className="h-9 flex-1 border-po-amber bg-transparent font-black text-po-amber">{busy ? "טוען…" : "טען זוג מהמאגר"}</Button>
        {pack && <Button variant="outline" disabled={busy} onClick={() => { if (confirm("לחזור למחסן הבדיקות? זה מתחיל משחק חדש.")) { setPairPack(null); actions.newGame(""); } }} className="h-9 bg-transparent px-2">מחסן בדיקות</Button>}
      </div>
      {pairs && (
        <div className="max-h-56 space-y-1 overflow-y-auto">
          {pairs.length === 0 && <div className="text-po-white/50">אין זוגות פעילים</div>}
          {pairs.map((p) => (
            <Button variant="outline" key={p.id} disabled={busy} onClick={() => pick(p.id, p.name)} className="flex h-auto w-full justify-between whitespace-normal border-po-steel-line bg-transparent p-2 text-right hover:border-po-white/60">
              <b>{p.name}</b><span className="text-po-white/50">{p.count} שאלות</span>
            </Button>
          ))}
        </div>
      )}
    </div>
  );
}
