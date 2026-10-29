import { z } from "zod";
import { ANSWER_KEYS, answerCountForQuestion, type Question } from "./types";

export const bankQuestionSchema = z.object({
  id: z.string().min(1), round: z.number().int().min(1).max(7),
  text: z.string().min(1), category: z.string().nullable(), difficulty: z.number().int().min(1).max(5).nullable().optional(),
  options: z.array(z.object({ text: z.string().min(1), correct: z.boolean() })).min(2).max(4),
});
export const bankPackSchema = z.object({
  pair: z.object({ id: z.string().uuid(), name: z.string().min(1) }),
  questions: z.array(z.unknown()),
});

/** Converts a bank export into a game pack. Partial packs are allowed: empty rounds get -1 and are listed in `missing`. */
export function convertPairPack(input: unknown) {
  const j = bankPackSchema.parse(input);
  let skipped = 0;
  const questions: Question[] = [];
  for (const raw of j.questions) {
    const r = bankQuestionSchema.safeParse(raw);
    // Never guess a correct answer: questions without exactly one correct option are skipped, not repaired.
    if (!r.success || r.data.options.filter((o) => o.correct).length !== 1) { skipped++; continue; }
    const q = r.data, correctAnswer = ANSWER_KEYS[q.options.findIndex((o) => o.correct)];
    if (!correctAnswer) { skipped++; continue; }
    questions.push({ id: `bank_${q.id}`, text: q.text, round: q.round,
      answerA: q.options[0]?.text ?? "", answerB: q.options[1]?.text ?? "",
      answerC: q.options[2]?.text ?? "", answerD: q.options[3]?.text ?? "",
      correctAnswer, category: [`סבב ${q.round}`, q.category].filter(Boolean).join(" · "),
      ...(q.category ? { topic: q.category } : {}), ...(q.difficulty ? { difficulty: q.difficulty } : {}) });
  }
  const order = Array.from({ length: 7 }, (_, slot) => questions.findIndex((q) => questionFitsSlot(q, slot)));
  const missing = order.flatMap((i, slot) => (i < 0 ? [slot + 1] : []));
  return { pairId: j.pair.id, pairName: j.pair.name, questions, order, missing, skipped };
}
export type ConvertedPack = ReturnType<typeof convertPairPack>;

/** General exports use the same answer format, with no assignment round required. */
export function convertGeneralBank(input: unknown) {
  const rows = z.object({ questions: z.array(z.unknown()) }).parse(input).questions;
  const questions: Question[] = [];
  let skipped = 0;
  for (const row of rows) {
    const parsed = bankQuestionSchema.omit({ round: true }).safeParse(row);
    if (!parsed.success || parsed.data.options.filter(o => o.correct).length !== 1) { skipped++; continue; }
    const q = parsed.data, correctAnswer = ANSWER_KEYS[q.options.findIndex(o => o.correct)];
    if (!correctAnswer) { skipped++; continue; }
    questions.push({ id: `bank_${q.id}`, text: q.text, ...(q.category ? { category: q.category, topic: q.category } : {}), ...(q.difficulty ? { difficulty: q.difficulty } : {}),
      answerA: q.options[0]?.text ?? "", answerB: q.options[1]?.text ?? "",
      answerC: q.options[2]?.text ?? "", answerD: q.options[3]?.text ?? "", correctAnswer });
  }
  return { questions, skipped };
}

/** Imports only a future slot; never trims options, reassigns rounds or changes an aired question. */
export function prepareBankReplacement(questions: Question[], order: number[], currentSlot: number, incoming: Question) {
  const slot = currentSlot + 1;
  if (slot >= 7 || !questionFitsSlot(incoming, slot)) return null;
  const optionCount = [incoming.answerA, incoming.answerB, incoming.answerC, incoming.answerD].filter(a => a.trim()).length;
  if (optionCount !== answerCountForQuestion(slot)) return null;
  if (order.slice(0, currentSlot + 1).some(i => questions[i]?.id === incoming.id)) return null;
  // Append rather than overwrite: every existing slot keeps its original index and contents.
  const nextQuestions = [...questions, { ...incoming, bankImported: true }];
  const nextOrder = [...order]; nextOrder[slot] = nextQuestions.length - 1;
  return { questions: nextQuestions, order: nextOrder, missing: nextOrder.flatMap((i, s) => i < 0 ? [s + 1] : []) };
}

export function questionFitsSlot(q: Question, slot: number) {
  const count = answerCountForQuestion(slot);
  return (!q.round || q.round === slot + 1) && ANSWER_KEYS.indexOf(q.correctAnswer) < count
    && [q.answerA, q.answerB, q.answerC, q.answerD].slice(0, count).every((a) => a.trim());
}

/**
 * Merges a refreshed export into the running game without restarting it.
 * Slots up to `airedThrough` keep exactly the question that already aired; later slots keep their
 * current pick when still assigned and valid, otherwise take the fresh default (filling empty rounds).
 */
export function mergeRefresh(old: { questions: Question[] }, fresh: ConvertedPack, currentOrder: number[], airedThrough: number) {
  const questions = [...fresh.questions];
  for (const imported of old.questions.filter(q => q.bankImported)) {
    const index = questions.findIndex(q => q.id === imported.id && q.round === imported.round);
    if (index < 0) questions.push(imported); else questions[index] = imported;
  }
  const order = Array.from({ length: 7 }, (_, slot) => {
    const prev = old.questions[currentOrder[slot] ?? -1];
    if (prev && slot <= airedThrough) {
      const i = questions.findIndex((q) => q.id === prev.id);
      if (i >= 0) { questions[i] = prev; return i; }
      questions.push(prev); return questions.length - 1;
    }
    if (prev) {
      const i = questions.findIndex((q) => q.id === prev.id);
      const candidate = questions[i];
      if (candidate && questionFitsSlot(candidate, slot)) return i;
    }
    return fresh.order[slot] ?? -1;
  });
  const missing = order.flatMap((i, slot) => (i < 0 ? [slot + 1] : []));
  return { ...fresh, questions, order, missing };
}

export const optionKeys = (q: Question) => ANSWER_KEYS.filter(k => [q.answerA, q.answerB, q.answerC, q.answerD][ANSWER_KEYS.indexOf(k)]?.trim());

/** A bank question can serve a slot when its round matches and it has at least that many options (extra ones are dropped by the operator). */
export function bankFitsSlot(q: Question, slot: number) {
  return slot < 7 && (!q.round || q.round === slot + 1) && optionKeys(q).length >= answerCountForQuestion(slot);
}

/** Operator-chosen answer removal, like the bank's assignment step: the correct answer can never be removed; remaining answers keep their order. */
export function dropOptions(q: Question, remove: string[]): Question | null {
  if (remove.includes(q.correctAnswer)) return null;
  const kept = optionKeys(q).filter(k => !remove.includes(k));
  const texts = kept.map(k => [q.answerA, q.answerB, q.answerC, q.answerD][ANSWER_KEYS.indexOf(k)]);
  return { ...q, answerA: texts[0] ?? "", answerB: texts[1] ?? "", answerC: texts[2] ?? "", answerD: texts[3] ?? "",
    correctAnswer: ANSWER_KEYS[kept.indexOf(q.correctAnswer)] ?? q.correctAnswer };
}
