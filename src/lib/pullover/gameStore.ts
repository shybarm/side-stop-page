import { useEffect, useState } from "react";
import { hardware, WIPE_DURATION_MS } from "./hardwareAdapter";
import { getQuestions } from "./questionStore";
import { ANSWER_KEYS, type AnswerKey, type GamePhase, type GameState } from "./types";

const KEY = "pullover:state:v1";
const CHANNEL = "pullover:state";

const INITIAL: GameState = { phase: "idle", questionIndex: 0, wipeSeq: 0, updatedAt: 0 };

let state: GameState = INITIAL;
let hydrated = false;
let channel: BroadcastChannel | null = null;
const listeners = new Set<() => void>();

function emit() {
  listeners.forEach((l) => l());
}

function read(): GameState {
  if (typeof window === "undefined") return INITIAL;
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return INITIAL;
    return { ...INITIAL, ...(JSON.parse(raw) as GameState) };
  } catch {
    return INITIAL;
  }
}

function hydrate() {
  if (hydrated || typeof window === "undefined") return;
  hydrated = true;
  state = read();
  if ("BroadcastChannel" in window) {
    channel = new BroadcastChannel(CHANNEL);
    channel.onmessage = (e) => {
      const incoming = e.data as GameState;
      if (incoming && incoming.updatedAt >= state.updatedAt) {
        state = incoming;
        emit();
      }
    };
  }
  window.addEventListener("storage", (e) => {
    if (e.key !== KEY) return;
    const incoming = read();
    if (incoming.updatedAt >= state.updatedAt) {
      state = incoming;
      emit();
    }
  });
}

function commit(patch: Partial<GameState>) {
  hydrate();
  state = { ...state, ...patch, updatedAt: Date.now() };
  if (typeof window !== "undefined") {
    window.localStorage.setItem(KEY, JSON.stringify(state));
    channel?.postMessage(state);
  }
  emit();
}

export function getGameState(): GameState {
  hydrate();
  return state;
}

export function useGameState(): GameState {
  const [snap, setSnap] = useState<GameState>(INITIAL);
  useEffect(() => {
    hydrate();
    setSnap(getGameState());
    const l = () => setSnap(getGameState());
    listeners.add(l);
    return () => {
      listeners.delete(l);
    };
  }, []);
  return snap;
}

/* ---------- transitions (single source of truth for game logic) ---------- */

export function canLoadQuestion(s: GameState) {
  return s.phase === "idle" || s.phase === "revealed";
}
export function canShowAnswers(s: GameState) {
  return s.phase === "intro";
}
export function canLock(s: GameState) {
  return s.phase === "answers";
}
export function canReveal(s: GameState) {
  return s.phase === "answers" || s.phase === "locked";
}
export function canNext(s: GameState) {
  return s.questionIndex < getQuestions().length - 1;
}

export const actions = {
  loadQuestion() {
    const s = getGameState();
    if (!canLoadQuestion(s)) return;
    commit({ phase: "intro" });
  },
  showAnswers() {
    if (!canShowAnswers(getGameState())) return;
    commit({ phase: "answers" });
  },
  lock() {
    if (!canLock(getGameState())) return;
    commit({ phase: "locked" });
  },
  reveal() {
    const s = getGameState();
    if (!canReveal(s)) return;
    const q = getQuestions()[s.questionIndex];
    if (!q) return;
    const wrong: AnswerKey[] = ANSWER_KEYS.filter((k) => k !== q.correctAnswer);
    hardware().triggerWipers({ wrongAnswers: wrong, durationMs: WIPE_DURATION_MS });
    commit({ phase: "wiping", wipeSeq: s.wipeSeq + 1 });
    window.setTimeout(() => {
      if (getGameState().phase === "wiping") commit({ phase: "revealed" });
    }, WIPE_DURATION_MS + 350);
  },
  nextQuestion() {
    const s = getGameState();
    const total = getQuestions().length;
    const next = Math.min(s.questionIndex + 1, total - 1);
    hardware().park();
    commit({ phase: "intro", questionIndex: next });
  },
  goToQuestion(index: number) {
    hardware().park();
    commit({ phase: "intro", questionIndex: index });
  },
  reset() {
    hardware().park();
    commit({ phase: "idle" });
  },
  /** Space – advance to the logical next state */
  advance() {
    const s = getGameState();
    const map: Partial<Record<GamePhase, () => void>> = {
      idle: actions.loadQuestion,
      intro: actions.showAnswers,
      answers: actions.lock,
      locked: actions.reveal,
      revealed: actions.nextQuestion,
    };
    map[s.phase]?.();
  },
};
