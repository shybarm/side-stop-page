import { useState } from "react";
import { Database, Search, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { listPairs, loadGeneralBank, loadPair } from "@/lib/pullover/bank.functions";
import { getGameState, importNextBankQuestion, useGameState } from "@/lib/pullover/gameStore";
import { getQuestions } from "@/lib/pullover/questionStore";
import { prepareBankReplacement } from "@/lib/pullover/pairPack";
import { ANSWER_KEYS, answerOf, answerCountForQuestion, type Question } from "@/lib/pullover/types";
import { publisher } from "@/lib/iso/publisher";

export function BankQuestionBrowser() {
  const state = useGameState();
  const [open, setOpen] = useState(false), [busy, setBusy] = useState(false);
  const [pairs, setPairs] = useState<{ id: string; name: string; count: number }[]>([]);
  const [source, setSource] = useState(""), [questions, setQuestions] = useState<Question[]>([]);
  const [query, setQuery] = useState(""), [error, setError] = useState("");
  const [selected, setSelected] = useState<Question | null>(null);
  const credentials = () => {
    const c = publisher.creds();
    if (!c) { toast.error("פתח סשן ISO לפני כניסה למאגר"); return null; }
    return { code: c.code, key: c.game };
  };
  const fetchSource = async (next: string) => {
    const auth = credentials(); if (!auth) return;
    setBusy(true); setError(""); setSelected(null); setQuestions([]); setSource(next);
    try {
      const result = next === "general" ? await loadGeneralBank({ data: auth }) : await loadPair({ data: { ...auth, id: next } });
      setQuestions(result.questions);
      if (result.skipped) toast.warning(`${result.skipped} שאלות לא תקינות דולגו`);
    } catch (e) { setError((e as Error).message); } finally { setBusy(false); }
  };
  const show = async () => {
    const auth = credentials(); if (!auth) return;
    setOpen(true); setBusy(true); setError(""); setQuestions([]); setSource(""); setSelected(null); setQuery("");
    try { setPairs(await listPairs({ data: auth })); }
    catch (e) { setError((e as Error).message); }
    finally { setBusy(false); }
  };
  const eligible = (q: Question) => Boolean(prepareBankReplacement(getQuestions(), state.questionOrder, state.questionIndex, q));
  const filtered = questions.filter(q => `${q.text} ${q.category ?? ""}`.includes(query.trim()));
  const commit = () => {
    if (!selected) return;
    const current = getGameState();
    if (current.questionIndex !== state.questionIndex || !importNextBankQuestion(selected)) {
      toast.error("השאלה אינה מתאימה לסבב הבא או שכבר הוצגה"); return;
    }
    toast.success(`השאלה נשמרה לסבב ${current.questionIndex + 2}`); setOpen(false);
  };
  return <>
    <Button variant="outline" onClick={show} disabled={state.questionIndex >= 6} className="h-12 w-full border-po-steel-line bg-po-asphalt text-po-white"><Database size={17}/>מאגר הבודקת — שאלה חלופית</Button>
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent dir="rtl" className="flex max-h-[88dvh] w-[calc(100%-2rem)] max-w-3xl flex-col overflow-hidden border-po-steel-line bg-po-asphalt-deep text-po-white">
        <DialogTitle className="pe-5">מאגר הבודקת · החלפת השאלה הבאה</DialogTitle>
        <DialogDescription className="text-po-white/60">סבב {state.questionIndex + 2} · {answerCountForQuestion(state.questionIndex + 1)} תשובות · השאלה שבאוויר נשארת ללא שינוי</DialogDescription>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" disabled={busy} onClick={() => fetchSource("general")} className="border-po-steel-line bg-po-asphalt"><Database size={16}/>מחסן כללי</Button>
          <select aria-label="שאלות של זוג אחר" value={source === "general" ? "" : source} disabled={busy} onChange={e => { if(e.target.value) void fetchSource(e.target.value); }} className="min-w-0 flex-1 rounded border border-po-steel-line bg-po-asphalt p-2 text-sm text-po-white">
            <option value="">שאלות של זוג אחר</option>
            {pairs.map(p => <option key={p.id} value={p.id}>{p.name} · {p.count} שאלות</option>)}
          </select>
          <Button size="icon" variant="outline" aria-label="רענן שאלות" title="רענן שאלות" disabled={busy || !source} onClick={() => fetchSource(source)} className="border-po-steel-line bg-po-asphalt"><RefreshCw size={16}/></Button>
        </div>
        <div className="flex items-center gap-2"><Search size={16} className="shrink-0 text-po-white/50"/><Input aria-label="חיפוש שאלות במאגר" placeholder="חיפוש שאלה או קטגוריה" value={query} onChange={e => setQuery(e.target.value)} className="border-po-steel-line bg-po-asphalt text-po-white"/></div>
        {error && <p role="alert" className="text-sm text-po-amber">{error}</p>}
        <div className="min-h-0 flex-1 space-y-2 overflow-y-auto">
          {busy && <p role="status" className="py-4 text-po-white/60">טוען שאלות…</p>}
          {!busy && source && !error && filtered.length === 0 && <p className="py-4 text-po-white/60">לא נמצאו שאלות</p>}
          {filtered.map((q, i) => <Button key={`${q.id}:${q.round}:${i}`} variant="outline" disabled={!eligible(q)} onClick={() => setSelected(q)} className={`h-auto w-full justify-start whitespace-normal p-3 text-right ${selected === q ? "border-po-cyan bg-po-steel" : "border-po-steel-line bg-po-asphalt"}`}>
            <span><b className="block">{q.text}</b><span className="text-xs text-po-white/50">{q.category ?? "ללא קטגוריה"}{!eligible(q) && " · לא מתאים לסבב הבא / כבר הוצגה"}</span></span>
          </Button>)}
        </div>
        {selected && <div className="border-t border-po-steel-line pt-3"><b className="text-sm">{selected.text}</b><div className="mt-2 grid gap-2 sm:grid-cols-2">{ANSWER_KEYS.filter(k => answerOf(selected,k)).map(k => <div key={k} className={`text-sm ${k === selected.correctAnswer ? "font-bold text-po-green" : "text-po-white/70"}`}>{answerOf(selected,k)}{k === selected.correctAnswer && " · נכונה"}</div>)}</div></div>}
        <Button disabled={busy || !selected || !eligible(selected)} onClick={commit} className="shrink-0 bg-po-steel text-po-white">בחר לשאלה הבאה</Button>
      </DialogContent>
    </Dialog>
  </>;
}