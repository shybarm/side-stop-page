import { useState } from "react";
import { toast } from "sonner";
import { actions, getGameState } from "@/lib/pullover/gameStore";
import { listPairs, loadPair } from "@/lib/pullover/bank.functions";
import { mergeRefresh, type ConvertedPack } from "@/lib/pullover/pairPack";
import { getPairPack, setPairPack, usePairPack } from "@/lib/pullover/questionStore";
import { publisher } from "@/lib/iso/publisher";
import { Button } from "@/components/ui/button";

function describe(p: ConvertedPack) {
  const parts = [`${p.questions.length} שאלות`];
  if (p.missing.length) parts.push(`חסרים סבבים ${p.missing.join(", ")}`);
  if (p.skipped) parts.push(`${p.skipped} שאלות דולגו (בלי תשובה נכונה יחידה)`);
  return parts.join(" · ");
}

/** Loads a couple's assigned questions from the "הבודקת" bank; incomplete pairs load too and can be refreshed later. */
export function PairLoader() {
  const pack = usePairPack();
  const [pairs, setPairs] = useState<{ id: string; name: string; count: number }[] | null>(null);
  const [busy, setBusy] = useState(false);
  const creds = () => { const c = publisher.creds(); if (!c) toast.error("פתח סשן ISO לפני טעינת זוג"); return c; };
  const open = async () => {
    const c = creds(); if (!c) return;
    setBusy(true);
    try { setPairs(await listPairs({ data: { code: c.code, key: c.game } })); } catch (e) { toast.error((e as Error).message); } finally { setBusy(false); }
  };
  const pick = async (id: string, name: string) => {
    const c = creds(); if (!c) return;
    if (!confirm(`לטעון את השאלות של "${name}"? זה מתחיל משחק חדש.`)) return;
    setBusy(true);
    try {
      const p = await loadPair({ data: { id, code: c.code, key: c.game } });
      setPairPack({ ...p, loadedAt: Date.now() });
      actions.newGame(p.pairName);
      setPairs(null);
      (p.missing.length || p.skipped ? toast.warning : toast.success)(`${p.pairName}: ${describe(p)}`);
    } catch (e) { toast.error((e as Error).message); } finally { setBusy(false); }
  };
  const refresh = async () => {
    const current = getPairPack(), c = creds();
    if (!current || !c) return;
    setBusy(true);
    try {
      const fresh = await loadPair({ data: { id: current.pairId, code: c.code, key: c.game } });
      const s = getGameState(), aired = s.phase === "idle" ? s.questionIndex - 1 : s.questionIndex;
      const merged = mergeRefresh(current, fresh, s.questionOrder ?? current.order, aired);
      setPairPack({ ...merged, loadedAt: Date.now() });
      actions.setQuestionOrder(merged.order);
      (merged.missing.length || merged.skipped ? toast.warning : toast.success)(`רוענן: ${describe(merged)}`);
    } catch (e) { toast.error((e as Error).message); } finally { setBusy(false); }
  };
  return (
    <div className="space-y-2 rounded-xl border border-po-steel-line bg-po-asphalt p-3 text-xs">
      <div className="text-po-white/50">שאלות המשחק</div>
      <div className="font-bold">{pack ? `${pack.pairName} · ${pack.questions.length} שאלות מהמאגר` : "מחסן הבדיקות"}</div>
      {pack && (pack.missing?.length ?? 0) > 0 && <div className="text-po-amber">חסרות שאלות לסבבים {pack.missing!.join(", ")} — הוסיפו בבודקת ולחצו "רענן"</div>}
      <div className="flex gap-2">
        <Button variant="outline" disabled={busy} onClick={open} className="h-9 flex-1 border-po-amber bg-transparent font-black text-po-amber">{busy ? "טוען…" : "טען זוג מהמאגר"}</Button>
        {pack && <Button variant="outline" disabled={busy} onClick={refresh} className="h-9 bg-transparent px-3 font-bold">רענן</Button>}
        {pack && <Button variant="outline" disabled={busy} onClick={() => { if (confirm("לחזור למחסן הבדיקות? זה מתחיל משחק חדש.")) { setPairPack(null); actions.newGame(""); } }} className="h-9 bg-transparent px-2">מחסן בדיקות</Button>}
      </div>
      {pairs && (
        <div className="max-h-56 space-y-1 overflow-y-auto">
          {pairs.length === 0 && <div className="text-po-white/50">אין זוגות פעילים</div>}
          {pairs.map((p) => (
            <Button variant="outline" key={p.id} disabled={busy} onClick={() => pick(p.id, p.name)} className="flex h-auto w-full justify-between whitespace-normal border-po-steel-line bg-transparent p-2 text-right hover:border-po-white/60">
              <b>{p.name}</b><span className={p.count ? "text-po-white/50" : "text-po-amber"}>{p.count ? `${p.count} שאלות` : "עדיין אין שאלות"}</span>
            </Button>
          ))}
        </div>
      )}
    </div>
  );
}
