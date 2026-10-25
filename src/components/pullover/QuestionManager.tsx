import { useRef, useState } from "react";
import { Link } from "@tanstack/react-router";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  CSV_HEADER,
  downloadFile,
  newId,
  parseCSV,
  parseJSON,
  toCSV,
  useWarehouse,
} from "@/lib/pullover/questionStore";
import { DEMO_QUESTIONS } from "@/lib/pullover/demoQuestions";
import { ANSWER_KEYS, answerOf, type AnswerKey, type Question } from "@/lib/pullover/types";

const EMPTY: Question = {
  id: "",
  text: "",
  answerA: "",
  answerB: "",
  answerC: "",
  answerD: "",
  correctAnswer: "A",
  category: "",
};

export function QuestionManager() {
  const [questions, save] = useWarehouse();
  const [draft, setDraft] = useState<Question | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const startNew = () => setDraft({ ...EMPTY, id: newId() });

  const commitDraft = () => {
    if (!draft) return;
    if (!draft.text.trim()) {
      toast.error("חסר טקסט שאלה");
      return;
    }
    const exists = questions.some((q) => q.id === draft.id);
    save(exists ? questions.map((q) => (q.id === draft.id ? draft : q)) : [...questions, draft]);
    toast.success(exists ? "השאלה עודכנה" : "השאלה נוספה");
    setDraft(null);
  };

  const remove = (id: string) => {
    save(questions.filter((q) => q.id !== id));
    toast.success("השאלה נמחקה");
  };

  const onFile = async (file: File) => {
    const text = await file.text();
    try {
      const parsed = file.name.toLowerCase().endsWith(".json") ? parseJSON(text) : parseCSV(text);
      if (parsed.length === 0) {
        toast.error("לא נמצאו שאלות בקובץ");
        return;
      }
      save(parsed);
      toast.success(`יובאו ${parsed.length} שאלות`);
    } catch {
      toast.error("הקובץ לא נקרא. בדקו את הפורמט.");
    }
  };

  return (
    <div dir="rtl" className="min-h-screen bg-po-asphalt-deep p-6 text-po-white">
      <header className="mb-6 flex flex-wrap items-center gap-3">
        <span className="text-sm font-black tracking-[0.3em]">עצור בצד</span>
        <span className="text-xs font-semibold tracking-[0.25em] text-po-amber">מחסן שאלות</span>
        <span className="font-mono text-sm text-po-white/50">{questions.length} שאלות</span>
        <div className="ms-auto flex flex-wrap gap-2">
          <Link
            to="/control"
            className="rounded-md border border-po-steel-line px-3 py-1.5 text-xs font-semibold hover:bg-po-steel"
          >
            חזרה לחדר בקרה
          </Link>
          <ToolButton onClick={startNew}>שאלה חדשה</ToolButton>
          <ToolButton onClick={() => fileRef.current?.click()}>ייבוא CSV / JSON</ToolButton>
          <ToolButton onClick={() => downloadFile("pullover-questions.csv", toCSV(questions), "text/csv")}>
            ייצוא CSV
          </ToolButton>
          <ToolButton
            onClick={() =>
              downloadFile(
                "pullover-questions.json",
                JSON.stringify(questions, null, 2),
                "application/json",
              )
            }
          >
            ייצוא JSON
          </ToolButton>
          <ToolButton onClick={() => downloadFile("pullover-template.csv", `${CSV_HEADER}\n`, "text/csv")}>
            תבנית CSV
          </ToolButton>
          <ToolButton
            onClick={() => {
              save(DEMO_QUESTIONS);
              toast.success("הוחזרו שאלות הדמו");
            }}
          >
            שחזור דמו
          </ToolButton>
        </div>
        <input
          ref={fileRef}
          type="file"
          accept=".csv,.json,text/csv,application/json"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) void onFile(f);
            e.target.value = "";
          }}
        />
      </header>

      {draft && (
        <div className="mb-6 rounded-xl border border-po-amber bg-po-asphalt p-5">
          <div className="mb-4 text-xs font-bold tracking-widest text-po-amber">עריכת שאלה</div>
          <Textarea
            value={draft.text}
            onChange={(e) => setDraft({ ...draft, text: e.target.value })}
            placeholder="טקסט השאלה"
            className="mb-4 min-h-20 border-po-steel-line bg-po-steel text-lg font-bold text-po-white"
          />
          <div className="mb-4 grid gap-3 sm:grid-cols-2">
            {ANSWER_KEYS.map((key) => {
              const correct = draft.correctAnswer === key;
              return (
                <div
                  key={key}
                  className="flex items-center gap-2 rounded-lg border p-2"
                  style={{
                    borderColor: correct ? "var(--po-green)" : "var(--po-steel-line)",
                    background: correct ? "oklch(0.32 0.05 152 / 35%)" : "transparent",
                  }}
                >
                  <button
                    type="button"
                    onClick={() => setDraft({ ...draft, correctAnswer: key })}
                    title="סמן כתשובה הנכונה"
                    className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md text-sm font-black"
                    style={{
                      background: correct ? "var(--po-green)" : "var(--po-steel)",
                      color: correct ? "oklch(0.15 0 0)" : "var(--po-white)",
                    }}
                  >
                    {key}
                  </button>
                  <Input
                    value={answerOf(draft, key)}
                    onChange={(e) =>
                      setDraft({ ...draft, [`answer${key}`]: e.target.value } as Question)
                    }
                    placeholder={`תשובה ${key}`}
                    className="border-po-steel-line bg-po-steel text-po-white"
                  />
                </div>
              );
            })}
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <Input
              value={draft.category ?? ""}
              onChange={(e) => setDraft({ ...draft, category: e.target.value })}
              placeholder="קטגוריה (אופציונלי)"
              className="max-w-56 border-po-steel-line bg-po-steel text-po-white"
            />
            <span className="text-xs text-po-white/50">
              תשובה נכונה: <b className="text-po-green">{draft.correctAnswer}</b>
            </span>
            <div className="ms-auto flex gap-2">
              <Button
                onClick={commitDraft}
                style={{ background: "var(--po-green)", color: "oklch(0.15 0 0)" }}
              >
                שמור
              </Button>
              <Button variant="outline" onClick={() => setDraft(null)}>
                ביטול
              </Button>
            </div>
          </div>
        </div>
      )}

      <div className="overflow-x-auto rounded-xl border border-po-steel-line">
        <table className="w-full text-right text-sm">
          <thead className="bg-po-asphalt text-xs tracking-widest text-po-white/50">
            <tr>
              <th className="p-3">#</th>
              <th className="p-3">שאלה</th>
              <th className="p-3">A</th>
              <th className="p-3">B</th>
              <th className="p-3">C</th>
              <th className="p-3">D</th>
              <th className="p-3">נכונה</th>
              <th className="p-3">קטגוריה</th>
              <th className="p-3" />
            </tr>
          </thead>
          <tbody>
            {questions.map((q, i) => (
              <tr key={q.id} className="border-t border-po-steel-line/60 hover:bg-po-asphalt/70">
                <td className="p-3 font-mono text-po-white/40">{i + 1}</td>
                <td className="max-w-80 p-3 font-semibold">{q.text}</td>
                {ANSWER_KEYS.map((k) => (
                  <td
                    key={k}
                    className="p-3"
                    style={{
                      color: q.correctAnswer === k ? "var(--po-green)" : "oklch(0.985 0 0 / 70%)",
                      fontWeight: q.correctAnswer === k ? 700 : 400,
                    }}
                  >
                    {answerOf(q, k)}
                  </td>
                ))}
                <td className="p-3">
                  <span
                    className="rounded-md px-2 py-0.5 text-xs font-black"
                    style={{ background: "var(--po-green)", color: "oklch(0.15 0 0)" }}
                  >
                    {q.correctAnswer as AnswerKey}
                  </span>
                </td>
                <td className="p-3 text-po-white/50">{q.category ?? "—"}</td>
                <td className="p-3">
                  <div className="flex gap-2">
                    <ToolButton onClick={() => setDraft(q)}>עריכה</ToolButton>
                    <ToolButton onClick={() => remove(q.id)} danger>
                      מחיקה
                    </ToolButton>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p className="mt-4 text-xs leading-relaxed text-po-white/40">
        ייבוא CSV לפי הכותרות: <span className="font-mono">{CSV_HEADER}</span> — אפשר לייצא מ־Excel
        כ־CSV (UTF-8). ייבוא מחליף את המחסן הקיים.
      </p>
    </div>
  );
}

function ToolButton({
  children,
  onClick,
  danger,
}: {
  children: React.ReactNode;
  onClick: () => void;
  danger?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      className="rounded-md border px-3 py-1.5 text-xs font-semibold transition-colors hover:bg-po-steel"
      style={{
        borderColor: danger ? "var(--po-red)" : "var(--po-steel-line)",
        color: danger ? "var(--po-red)" : "var(--po-white)",
      }}
    >
      {children}
    </button>
  );
}
