import { useRef, useState } from "react";
import { Database, Search, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { listPairs, loadGeneralBank, loadPair } from "@/lib/pullover/bank.functions";
import { getGameState, importNextBankQuestion, useGameState } from "@/lib/pullover/gameStore";
import { getQuestions } from "@/lib/pullover/questionStore";
import { bankFitsSlot, dropOptions, optionKeys } from "@/lib/pullover/pairPack";
import { answerOf, answerCountForQuestion, HE_LETTER, type AnswerKey, type Question } from "@/lib/pullover/types";
import { publisher } from "@/lib/iso/publisher";

export function BankQuestionBrowser() {
  const state = useGameState();
  const [open, setOpen] = useState(false), [busy, setBusy] = useState(false);
  const [pairs, setPairs] = useState<{ id: string; name: string; count: number }[]>([]);
  const [source, setSource] = useState(""), [questions, setQuestions] = useState<Question[]>([]);
  const [query, setQuery] = useState(""), [error, setError] = useState("");
  const [selected, setSelectedRaw] = useState<Question | null>(null);
  const [removed, setRemoved] = useState<AnswerKey[]>([]);
  const [difficulty, setDifficulty] = useState(""), [topic, setTopic] = useState("");
  const setSelected = (q: Question | null) => { setSelectedRaw(q); setRemoved([]); };
  const target = useRef<{ questionIndex: number; gameId: number | undefined } | null>(null);
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
    const current = getGameState(); target.current = { questionIndex: current.questionIndex, gameId: current.gameId };
    setOpen(true); setBusy(true); setError(""); setQuestions([]); setSource(""); setSelected(null); setQuery("");
    try { setPairs(await listPairs({ data: auth })); }
    catch (e) { setError((e as Error).message); }
    finally { setBusy(false); }
  };
  const slot = state.questionIndex + 1, need = answerCountForQuestion(slot);
  const aired = new Set(state.questionOrder.slice(0, state.questionIndex + 1).map(i => getQuestions()[i]?.id));
  const eligible = (q: Question) => bankFitsSlot(q, slot) && !aired.has(q.id);
  const topics = [...new Set(questions.map(q => q.topic).filter((t): t is string => Boolean(t)))].sort();
  const filtered = questions.filter(q => `${q.text} ${q.category ?? ""}`.includes(query.trim())
    && (!difficulty || String(q.difficulty ?? "") === difficulty) && (!topic || q.topic === topic));
  const extra = selected ? optionKeys(selected).length - need : 0;
  const final = selected && removed.length === extra ? dropOptions(selected, removed) : null;
  const toggleRemove = (k: AnswerKey) => setRemoved(r => r.includes(k) ? r.filter(x => x !== k) : r.length < extra ? [...r, k] : [...r.slice(1), k]);
  const commit = () => {
    if (!final) return;
    const current = getGameState();
    if (current.questionIndex !== target.current?.questionIndex || current.gameId !== target.current?.gameId || !importNextBankQuestion(final)) {
      toast.error("השאלה אינה מתאימה לסבב הבא או שכבר הוצגה"); return;
    }
    toast.success(`השאלה נשמרה לסבב ${current.questionIndex + 2}`); setOpen(false);
  };
  return <>
    <Button variant="outline" onClick={show} disabled={state.questionIndex >= 6} className="h-12 w-full border-po-steel-line bg-po-asphalt text-po-white"><Database size={17}/>מאגר הבודקת — שאלה חלופית</Button>
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent dir="rtl" onKeyDown={e => e.stopPropagation()} className="flex max-h-[88dvh] w-[calc(100%-2rem)] max-w-3xl flex-col overflow-hidden border-po-steel-line bg-po-asphalt-deep text-po-white">
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
        <div className="flex flex-wrap gap-2">
          <select aria-label="סינון לפי קושי" value={difficulty} onChange={e => setDifficulty(e.target.value)} className="rounded border border-po-steel-line bg-po-asphalt p-2 text-sm text-po-white">
            <option value="">כל רמות הקושי</option>{[1,2,3,4,5].map(d => <option key={d} value={d}>קושי {d}</option>)}
          </select>
          <select aria-label="סינון לפי נושא" value={topic} onChange={e => setTopic(e.target.value)} className="min-w-0 flex-1 rounded border border-po-steel-line bg-po-asphalt p-2 text-sm text-po-white">
            <option value="">כל הנושאים</option>{topics.map(t => <option key={t} value={t}>{t}</option>)}
          </select>
          {source && !busy && <span className="self-center text-xs text-po-white/50">{filtered.length} מתוך {questions.length}</span>}
        </div>
        {error && <p role="alert" className="text-sm text-po-amber">{error}</p>}
        <div className="min-h-0 flex-1 space-y-2 overflow-y-auto">
          {busy && <p role="status" className="py-4 text-po-white/60">טוען שאלות…</p>}
          {!busy && source && !error && filtered.length === 0 && <p className="py-4 text-po-white/60">לא נמצאו שאלות</p>}
          {filtered.map((q, i) => <Button key={`${q.id}:${q.round}:${i}`} variant="outline" disabled={!eligible(q)} onClick={() => setSelected(q)} className={`h-auto w-full justify-start whitespace-normal p-3 text-right ${selected === q ? "border-po-cyan bg-po-steel" : "border-po-steel-line bg-po-asphalt"}`}>
            <span><b className="block">{q.text}</b><span className="text-xs text-po-white/50">{q.category ?? "ללא קטגוריה"}{q.difficulty ? ` · קושי ${q.difficulty}` : ""}{eligible(q) && optionKeys(q).length > need && ` · ${optionKeys(q).length} תשובות — תבחר מה להוריד`}{!eligible(q) && " · לא מתאים לסבב הבא / כבר הוצגה"}</span></span>
          </Button>)}
        </div>
        {selected && <div className="border-t border-po-steel-line pt-3"><b className="text-sm">{selected.text}</b>
          {extra > 0 && <p className="mt-1 text-xs text-po-amber">בסבב הזה {need} תשובות — בחר {extra === 1 ? "איזו תשובה להוריד" : `${extra} תשובות להוריד`} (אי אפשר להוריד את הנכונה)</p>}
          <div className="mt-2 grid gap-2 sm:grid-cols-2">{optionKeys(selected).map(k => { const correct = k === selected.correctAnswer, off = removed.includes(k);
            return extra > 0 && !correct
              ? <Button key={k} variant="outline" aria-pressed={off} onClick={() => toggleRemove(k)} className={`h-auto justify-start whitespace-normal text-right text-sm ${off ? "border-po-amber text-po-white/40 line-through" : "border-po-steel-line text-po-white/80"}`}>{HE_LETTER[k]}. {answerOf(selected,k)}{off && " · תוסר"}</Button>
              : <div key={k} className={`p-2 text-sm ${correct ? "font-bold text-po-green" : "text-po-white/70"}`}>{answerOf(selected,k)}{correct && " · נכונה"}</div>; })}</div></div>}
        <Button disabled={busy || !final || !eligible(selected!)} onClick={commit} className="shrink-0 bg-po-steel text-po-white">בחר לשאלה הבאה</Button>
      </DialogContent>
    </Dialog>
  </>;
}