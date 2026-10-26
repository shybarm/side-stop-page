import { z } from "zod";
import { ANSWER_KEYS, answerCountForQuestion, type Question } from "./types";

export const bankQuestionSchema = z.object({
  id: z.string().min(1), round: z.number().int().min(1).max(7),
  text: z.string().min(1), category: z.string().nullable(),
  options: z.array(z.object({ text: z.string().min(1), correct: z.boolean() })).min(2).max(4),
});
export const bankPackSchema = z.object({
  pair: z.object({ id: z.string().uuid(), name: z.string().min(1) }),
  questions: z.array(bankQuestionSchema).min(1),
});
export function convertPairPack(input: unknown) {
  const j = bankPackSchema.parse(input);
  const questions: Question[] = j.questions.map((q) => {
    if (q.options.filter((o) => o.correct).length !== 1) throw new Error("שאלה במאגר חסרה תשובה נכונה יחידה");
    const correctAnswer = ANSWER_KEYS[q.options.findIndex((o) => o.correct)];
    if (!correctAnswer) throw new Error("תשובה נכונה לא תקינה");
    return { id: `bank_${q.id}`, text: q.text, round: q.round,
      answerA: q.options[0]?.text ?? "", answerB: q.options[1]?.text ?? "",
      answerC: q.options[2]?.text ?? "", answerD: q.options[3]?.text ?? "",
      correctAnswer, category: [`סבב ${q.round}`, q.category].filter(Boolean).join(" · ") };
  });
  const order = Array.from({ length: 7 }, (_, i) => questions.findIndex((q) => q.round === i + 1));
  if (order.some((i) => i < 0)) throw new Error("נדרשת לפחות שאלה מוקצית אחת לכל אחד משבעת הסבבים");
  order.forEach((index, slot) => {
    const q = questions[index];
    if (!q || !questionFitsSlot(q, slot)) throw new Error(`מספר התשובות בשאלה של סבב ${slot + 1} אינו מתאים ללוח`);
  });
  return { pairId: j.pair.id, pairName: j.pair.name, questions, order };
}
export function questionFitsSlot(q: Question, slot: number) {
  const count = answerCountForQuestion(slot);
  return (!q.round || q.round === slot + 1) && ANSWER_KEYS.indexOf(q.correctAnswer) < count
    && [q.answerA, q.answerB, q.answerC, q.answerD].slice(0, count).every((a) => a.trim());
}