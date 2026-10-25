import { useEffect, useState } from "react";
import { DEMO_QUESTIONS } from "./demoQuestions";
import { ANSWER_KEYS, type AnswerKey, type Question } from "./types";

const KEY = "pullover:questions:v1";
const CHANNEL = "pullover:questions";
const PACK_KEY = "pullover:pack:v1";
export interface PairPack { pairId: string; pairName: string; questions: Question[]; loadedAt: number }
let pack: PairPack | null | undefined;
function readPack(): PairPack | null {
  if (typeof window === "undefined") return null;
  try { const p = JSON.parse(localStorage.getItem(PACK_KEY) || "null"); return p && Array.isArray(p.questions) && p.questions.length ? p : null; } catch { return null; }
}
export function getPairPack(): PairPack | null { if (pack === undefined) pack = readPack(); return pack; }
/** Loads a couple's assigned questions as the active game list; the test warehouse is kept untouched. */
export function setPairPack(next: PairPack | null) {
  pack = next;
  if (typeof window !== "undefined") {
    if (next) localStorage.setItem(PACK_KEY, JSON.stringify(next)); else localStorage.removeItem(PACK_KEY);
    ensureChannel(); channel?.postMessage("changed");
  }
  listeners.forEach((l) => l());
}

let cache: Question[] | null = null;
const listeners = new Set<() => void>();
let channel: BroadcastChannel | null = null;

function ensureChannel() {
  if (typeof window === "undefined" || channel) return;
  if ("BroadcastChannel" in window) {
    channel = new BroadcastChannel(CHANNEL);
    channel.onmessage = () => {
      cache = readStorage(); pack = readPack();
      listeners.forEach((l) => l());
    };
  }
  window.addEventListener("storage", (e) => {
    if (e.key === KEY || e.key === PACK_KEY) {
      cache = readStorage(); pack = readPack();
      listeners.forEach((l) => l());
    }
  });
}

function readStorage(): Question[] {
  if (typeof window === "undefined") return DEMO_QUESTIONS;
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return DEMO_QUESTIONS;
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed) || parsed.length === 0) return DEMO_QUESTIONS;
    return parsed.filter(isQuestion);
  } catch {
    return DEMO_QUESTIONS;
  }
}

function isQuestion(q: unknown): q is Question {
  const o = q as Question;
  return !!o && typeof o.text === "string" && ANSWER_KEYS.includes(o.correctAnswer);
}

/** Active game questions: the loaded couple's pack if any, otherwise the test warehouse. */
export function getQuestions(): Question[] {
  return getPairPack()?.questions ?? getWarehouse();
}
export function getWarehouse(): Question[] {
  if (cache) return cache;
  cache = readStorage();
  return cache;
}

export function setQuestions(next: Question[]) {
  cache = next;
  if (typeof window !== "undefined") {
    window.localStorage.setItem(KEY, JSON.stringify(next));
    ensureChannel();
    channel?.postMessage("changed");
  }
  listeners.forEach((l) => l());
}

export function newId() {
  return `q_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`;
}

export function usePairPack(): PairPack | null {
  const [p, setP] = useState<PairPack | null>(null);
  useEffect(() => { ensureChannel(); setP(getPairPack()); const l = () => setP(getPairPack()); listeners.add(l); return () => { listeners.delete(l); }; }, []);
  return p;
}

export function useWarehouse(): [Question[], (next: Question[]) => void] { return useList(getWarehouse); }
export function useQuestions(): [Question[], (next: Question[]) => void] { return useList(getQuestions); }
function useList(get: () => Question[]): [Question[], (next: Question[]) => void] {
  const [items, setItems] = useState<Question[]>(DEMO_QUESTIONS);

  useEffect(() => {
    ensureChannel();
    setItems(get());
    const l = () => setItems(get());
    listeners.add(l);
    return () => {
      listeners.delete(l);
    };
  }, []);

  return [items, setQuestions];
}

/* ---------- import / export ---------- */

export const CSV_HEADER = "id,question,answerA,answerB,answerC,answerD,correctAnswer,category";

export function toCSV(items: Question[]): string {
  const esc = (v: string) => `"${(v ?? "").replace(/"/g, '""')}"`;
  return [
    CSV_HEADER,
    ...items.map((q) =>
      [
        q.id,
        q.text,
        q.answerA,
        q.answerB,
        q.answerC,
        q.answerD,
        q.correctAnswer,
        q.category ?? "",
      ]
        .map(esc)
        .join(","),
    ),
  ].join("\n");
}

function splitCsvLine(line: string): string[] {
  const out: string[] = [];
  let cur = "";
  let quoted = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (quoted) {
      if (c === '"' && line[i + 1] === '"') {
        cur += '"';
        i++;
      } else if (c === '"') quoted = false;
      else cur += c;
    } else if (c === '"') quoted = true;
    else if (c === ",") {
      out.push(cur);
      cur = "";
    } else cur += c;
  }
  out.push(cur);
  return out.map((s) => s.trim());
}

export function parseCSV(text: string): Question[] {
  const lines = text
    .replace(/\r/g, "")
    .split("\n")
    .filter((l) => l.trim().length > 0);
  if (lines.length === 0) return [];
  const header = splitCsvLine(lines[0] ?? "").map((h) => h.toLowerCase());
  const hasHeader = header.includes("question") || header.includes("answera");
  const rows = hasHeader ? lines.slice(1) : lines;
  const idx = (name: string, fallback: number) => {
    const i = header.indexOf(name);
    return hasHeader && i >= 0 ? i : fallback;
  };
  const cols = {
    id: idx("id", 0),
    text: idx("question", 1),
    a: idx("answera", 2),
    b: idx("answerb", 3),
    c: idx("answerc", 4),
    d: idx("answerd", 5),
    correct: idx("correctanswer", 6),
    category: idx("category", 7),
  };

  return rows
    .map((line) => {
      const f = splitCsvLine(line);
      const correct = (f[cols.correct] || "A").toUpperCase() as AnswerKey;
      return {
        id: f[cols.id] || newId(),
        text: f[cols.text] || "",
        answerA: f[cols.a] || "",
        answerB: f[cols.b] || "",
        answerC: f[cols.c] || "",
        answerD: f[cols.d] || "",
        correctAnswer: ANSWER_KEYS.includes(correct) ? correct : "A",
        category: f[cols.category] || undefined,
      } as Question;
    })
    .filter((q) => q.text.length > 0);
}

export function parseJSON(text: string): Question[] {
  const parsed = JSON.parse(text);
  const arr = Array.isArray(parsed) ? parsed : (parsed?.questions ?? []);
  return (arr as Partial<Question>[])
    .map((q) => {
      const correct = String(q.correctAnswer ?? "A").toUpperCase() as AnswerKey;
      return {
        id: q.id ?? newId(),
        text: q.text ?? "",
        answerA: q.answerA ?? "",
        answerB: q.answerB ?? "",
        answerC: q.answerC ?? "",
        answerD: q.answerD ?? "",
        correctAnswer: ANSWER_KEYS.includes(correct) ? correct : "A",
        category: q.category,
      } as Question;
    })
    .filter((q) => q.text.length > 0);
}

export function downloadFile(name: string, content: string, mime: string) {
  const blob = new Blob([content], { type: `${mime};charset=utf-8` });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  URL.revokeObjectURL(url);
}
