import { useState } from "react";
import { toast } from "sonner";
import { actions } from "@/lib/pullover/gameStore";
import { listPairs, loadPair } from "@/lib/pullover/bank.functions";
import { setPairPack, usePairPack } from "@/lib/pullover/questionStore";
import { answerCountForQuestion, ANSWER_KEYS } from "@/lib/pullover/types";

/** Loads a couple's assigned questions from the "הבודקת" bank as the active game list. */
export function PairLoader() {
  const pack = usePairPack();
  const [pairs, setPairs] = useState<{ id: string; name: string; count: number }[] | null>(null);
  const [busy, setBusy] = useState(false);
  const open = async () => {
    setBusy(true);
    try { setPairs(await listPairs()); } catch (e) { toast.error((e as Error).message); } finally { setBusy(false); }
  };
  const pick = async (id: string, name: string) => {
    if (!confirm(`לטעון את השאלות של "${name}"? זה מתחיל משחק חדש.`)) return;
    setBusy(true);
    try {
      const p = await loadPair({ data: { id } });
      if (p.questions.length < 7) toast.warning(`לזוג יש רק ${p.questions.length} שאלות`);
      p.questions.slice(0, 7).forEach((q, i) => {
        if (ANSWER_KEYS.indexOf(q.correctAnswer) >= answerCountForQuestion(i)) toast.warning(`בשאלה ${i + 1} התשובה הנכונה לא תוצג (יש פחות תשובות בשלב הזה)`);
      });
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
        <button disabled={busy} onClick={open} className="h-9 flex-1 rounded border border-po-amber font-black text-po-amber disabled:opacity-40">{busy ? "טוען…" : "טען זוג מהמאגר"}</button>
        {pack && <button onClick={() => confirm("לחזור למחסן הבדיקות? זה מתחיל משחק חדש.") && (setPairPack(null), actions.newGame(""))} className="h-9 rounded border px-2">מחסן בדיקות</button>}
      </div>
      {pairs && (
        <div className="max-h-56 space-y-1 overflow-y-auto">
          {pairs.length === 0 && <div className="text-po-white/50">אין זוגות פעילים</div>}
          {pairs.map((p) => (
            <button key={p.id} disabled={busy} onClick={() => pick(p.id, p.name)} className="flex w-full justify-between rounded border border-po-steel-line p-2 text-right hover:border-po-white/60">
              <b>{p.name}</b><span className="text-po-white/50">{p.count} שאלות</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
