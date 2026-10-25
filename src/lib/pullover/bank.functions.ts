import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import type { AnswerKey, Question } from "./types";

const BASE = "https://image-guided-web-maker.lovable.app/api/public/game-export";
const KEYS: AnswerKey[] = ["A", "B", "C", "D"];

async function call(qs: string) {
  const key = process.env.BODEKET_EXPORT_KEY;
  if (!key) throw new Error("מפתח החיבור למאגר עדיין לא הוגדר");
  const r = await fetch(`${BASE}${qs}`, { headers: { authorization: `Bearer ${key}` } });
  if (r.status === 404) throw new Error("כתובת הייצוא עדיין לא פורסמה באתר הבודקת");
  if (r.status === 401) throw new Error("המפתח לא תואם בין שני האתרים");
  if (!r.ok) throw new Error(`המאגר החזיר שגיאה ${r.status}`);
  return r.json();
}

export const listPairs = createServerFn({ method: "GET" }).handler(async () => {
  const j = (await call("?list=1")) as { pairs: { id: string; name: string; count: number }[] };
  return j.pairs ?? [];
});

export const loadPair = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data }) => {
    const j = (await call(`?contestant=${data.id}`)) as {
      pair: { id: string; name: string };
      questions: { id: string; round: number; text: string; category: string | null; options: { text: string; correct: boolean }[] }[];
    };
    const questions: Question[] = j.questions.map((q) => {
      const o = q.options.slice(0, 4);
      const ci = Math.max(0, o.findIndex((x) => x.correct));
      return {
        id: `bank_${q.id}`, text: q.text,
        answerA: o[0]?.text ?? "", answerB: o[1]?.text ?? "", answerC: o[2]?.text ?? "", answerD: o[3]?.text ?? "",
        correctAnswer: KEYS[ci] ?? "A",
        category: [`סבב ${q.round}`, q.category].filter(Boolean).join(" · "),
      };
    });
    return { pairId: j.pair.id, pairName: j.pair.name, questions };
  });
