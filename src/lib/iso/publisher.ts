/** (also queues a durable "new_game" event when the operator starts a new game)
 *
 * Game-computer side of the shared ISO session.
 * Runs entirely in the background: it never blocks the local game controls.
 * - Critical events (lock / reveal / next question) go into a durable localStorage queue.
 *   Each event id is deterministic (kind + question airing key), so every game tab produces the
 *   same id for the same moment and the server applies it exactly once, in queue order.
 * - Plain state is coalesced: only the latest state is sent.
 * - Every network call has a timeout, so a hung request can never freeze the queue.
 * - Heartbeat every 3s also measures the clock offset to the server and re-kicks the queue.
 */
import { useEffect, useState } from "react";
import { getGameState, questionForSlot, subscribeGameState } from "@/lib/pullover/gameStore";
import { TIMER_DURATION_MS, type GameState } from "@/lib/pullover/types";
import { heartbeat, publishGame } from "./iso.functions";
import type { PublishedGameState } from "./types";
import { withTimeout } from "./timeout";

export interface GameSessionCreds { code: string; game: string; director: string; output: string }
interface QueuedEvent { id: string; seq: number; kind: "lock" | "reveal" | "next" | "new_game"; question_key: string | null; correct?: string; at: number }
interface Persist { creds: GameSessionCreds | null; queue: QueuedEvent[]; seq: number; lastPhase: string | null; lastKey: string | null; lastGameId?: number | null }

const KEY = "pullover:iso:publisher:v1";
const FATAL = new Set(["forbidden", "session_not_found"]);
const empty = (): Persist => ({ creds: null, queue: [], seq: 0, lastPhase: null, lastKey: null });
let p: Persist = empty();
let loaded = false, offset = 0, sentVersion = 0, busy = false, retryT = 0 as any, hbT = 0 as any, unsub: (() => void) | null = null, failures = 0;
export interface PublisherStatus { connected: boolean; lastOkAt: number | null; queue: number; error: string | null }
let status: PublisherStatus = { connected: false, lastOkAt: null, queue: 0, error: null };
const ls = new Set<() => void>();
const emit = () => { status = { ...status, queue: p.queue.length }; ls.forEach((l) => l()); };
function readStored(): Persist { try { return { ...empty(), ...JSON.parse(localStorage.getItem(KEY) || "{}") }; } catch { return empty(); } }
function load() {
  if (loaded || typeof window === "undefined") return; loaded = true; p = readStored();
  // Another game tab opened / closed a session: follow it instead of overwriting it with stale creds.
  window.addEventListener("storage", (e) => {
    if (e.key !== KEY) return;
    const x = readStored();
    if (x.creds?.code !== p.creds?.code) { stop(); p = x; sentVersion = 0; status = { connected: false, lastOkAt: null, queue: 0, error: null }; start(); emit(); }
    else if (x.creds) {
      // Same session: merge queued events we don't have yet (ids are deterministic, so no duplicates).
      const have = new Set(p.queue.map((q) => q.id));
      for (const q of x.queue) if (!have.has(q.id)) p.queue.push(q);
      p.seq = Math.max(p.seq, x.seq);
    }
  });
}
function save() {
  // Re-read before writing so a second tab's newer session is never clobbered by this tab.
  const cur = readStored();
  if (cur.creds && p.creds && cur.creds.code !== p.creds.code) return;
  localStorage.setItem(KEY, JSON.stringify({ ...p, seq: Math.max(p.seq, cur.creds?.code === p.creds?.code ? cur.seq : 0) }));
}

/** Identity of one airing of a question: slot + question id + airing time. */
export const keyOf = (s: GameState) => { const q = questionForSlot(s); return q ? `${s.questionIndex}:${q.id}:${s.airedAt ?? 0}` : null; };
function published(s: GameState): PublishedGameState {
  return { phase: s.phase, questionIndex: s.questionIndex, teamName: s.teamName ?? "", gameId: s.gameId ?? null, timerStartedAtServer: s.timerStartedAt ? s.timerStartedAt + offset : null, timerDurationMs: TIMER_DURATION_MS, updatedAt: s.updatedAt };
}
function onState() {
  const s = getGameState(), key = keyOf(s), q = questionForSlot(s);
  const push = (kind: QueuedEvent["kind"], extra: Partial<QueuedEvent> = {}) => {
    const id = `${kind}@${key}`;
    if (p.queue.some((e) => e.id === id)) return;
    p.queue.push({ id, seq: ++p.seq, kind, question_key: key, at: Date.now() + offset, ...extra });
  };
  // New game first, so the server restores all plates before the new airing's pool is built.
  if (s.gameId && s.gameId !== p.lastGameId) { const id = `new_game@${s.gameId}`; if (!p.queue.some((e) => e.id === id)) p.queue.push({ id, seq: ++p.seq, kind: "new_game", question_key: key, at: Date.now() + offset }); }
  if (key && key !== p.lastKey) push("next");
  if (s.phase === "locked" && p.lastPhase !== "locked") push("lock");
  if (s.phase === "wiping" && p.lastPhase !== "wiping" && q) { push("lock"); push("reveal", { correct: q.correctAnswer }); }
  p.lastPhase = s.phase; p.lastKey = key; p.lastGameId = s.gameId ?? p.lastGameId ?? null; save(); emit();
  void flush();
}
const send = (c: GameSessionCreds, s: GameState, version: number, event: QueuedEvent | null) =>
  withTimeout(publishGame({ data: { code: c.code, key: c.game, version, state: published(s), question: questionForSlot(s) ?? null, questionKey: keyOf(s), event } }), 8000);

/** Publish the latest local state; if the server holds a higher version (clock jump on this computer), bump past it. */
async function sendState(c: GameSessionCreds, event: QueuedEvent | null) {
  let s = getGameState();
  let r = await send(c, s, s.updatedAt, event);
  if (!r.state_applied && r.game_version > s.updatedAt) {
    await new Promise((res) => setTimeout(res, 300));
    if (getGameState().updatedAt === s.updatedAt) { s = getGameState(); r = await send(c, s, r.game_version + 1, null); }
  }
  sentVersion = Math.max(sentVersion, s.updatedAt);
  return r;
}
async function flush() {
  if (busy || !p.creds) return; busy = true;
  const c = p.creds;
  try {
    while (p.queue.length && p.creds === c) {
      const ev = p.queue[0]!, last = p.queue.length === 1;
      // Older events are applied first in order; only the last one carries the latest state.
      if (last) await sendState(c, ev);
      else await send(c, getGameState(), 0, ev);
      if (p.queue[0]?.id === ev.id) p.queue.shift();
      save(); ok();
    }
    if (getGameState().updatedAt > sentVersion && p.creds === c) { await sendState(c, null); ok(); }
    failures = 0;
  } catch (e) {
    const msg = (e as Error).message;
    status = { ...status, connected: false, error: msg }; emit();
    failures++;
    clearTimeout(retryT);
    if (!FATAL.has(msg)) retryT = setTimeout(() => void flush(), Math.min(1000 * failures, 5000));
  } finally { busy = false; }
}
function ok() { status = { ...status, connected: true, lastOkAt: Date.now(), error: null }; emit(); }
async function beat() {
  if (!p.creds) return;
  const t0 = Date.now();
  try {
    const r = await withTimeout(heartbeat({ data: { code: p.creds.code, key: p.creds.game } }), 6000);
    const t1 = Date.now(); offset = r.server_now - (t0 + t1) / 2; ok(); void flush();
  } catch (e) { status = { ...status, connected: false, error: (e as Error).message }; emit(); }
}
function start() {
  if (unsub || !p.creds) return;
  const s = getGameState(); if (p.lastPhase === null) { p.lastPhase = s.phase; p.lastKey = keyOf(s); p.lastGameId = s.gameId ?? null; save(); }
  unsub = subscribeGameState(onState);
  void beat().then(() => { sentVersion = 0; void flush(); });
  hbT = setInterval(beat, 3000);
}
function stop() { unsub?.(); unsub = null; clearInterval(hbT); clearTimeout(retryT); }

export const publisher = {
  init() { load(); start(); },
  attach(creds: GameSessionCreds) { load(); stop(); p = { ...empty(), creds }; localStorage.setItem(KEY, JSON.stringify(p)); sentVersion = 0; start(); },
  detach() { stop(); p = empty(); localStorage.setItem(KEY, JSON.stringify(p)); status = { connected: false, lastOkAt: null, queue: 0, error: null }; emit(); },
  creds: () => (load(), p.creds),
};
export function usePublisher() {
  const [, setN] = useState(0);
  useEffect(() => { publisher.init(); const l = () => setN((n) => n + 1); ls.add(l); l(); return () => { ls.delete(l); }; }, []);
  return { status, creds: p.creds };
}

// Dev hot-reload: stop this module instance's timers/subscription so an old copy can't keep publishing.
if (import.meta.hot) import.meta.hot.dispose(() => stop());
