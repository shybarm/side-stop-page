/**
 * Game-computer side of the shared ISO session.
 * Runs entirely in the background: it never blocks the local game controls.
 * - Critical events (lock / reveal / next question) go into a durable localStorage queue
 *   with unique ids and a monotonic sequence, replayed in order after reconnect.
 * - Plain state is coalesced: only the latest state is sent.
 * - Heartbeat every 3s also measures the clock offset to the server.
 */
import { useEffect, useState } from "react";
import { getGameState, questionForSlot, subscribeGameState } from "@/lib/pullover/gameStore";
import { TIMER_DURATION_MS, type GameState } from "@/lib/pullover/types";
import { heartbeat, publishGame } from "./iso.functions";
import type { PublishedGameState } from "./types";

export interface GameSessionCreds { code: string; game: string; director: string; output: string }
interface QueuedEvent { id: string; seq: number; kind: "lock" | "reveal" | "next"; question_key: string | null; correct?: string; at: number }
interface Persist { creds: GameSessionCreds | null; queue: QueuedEvent[]; seq: number; lastPhase: string | null; lastKey: string | null }

const KEY = "pullover:iso:publisher:v1";
let p: Persist = { creds: null, queue: [], seq: 0, lastPhase: null, lastKey: null };
let loaded = false, offset = 0, sentVersion = 0, busy = false, retryT = 0 as any, hbT = 0 as any, unsub: (() => void) | null = null;
export interface PublisherStatus { connected: boolean; lastOkAt: number | null; queue: number; error: string | null }
let status: PublisherStatus = { connected: false, lastOkAt: null, queue: 0, error: null };
const ls = new Set<() => void>();
const emit = () => { status = { ...status, queue: p.queue.length }; ls.forEach((l) => l()); };
function load() { if (loaded || typeof window === "undefined") return; loaded = true; try { p = { ...p, ...JSON.parse(localStorage.getItem(KEY) || "{}") }; } catch { /* keep default */ } }
function save() { localStorage.setItem(KEY, JSON.stringify(p)); }

export const keyOf = (s: GameState) => { const q = questionForSlot(s); return q ? `${s.questionIndex}:${q.id}` : null; };
function published(s: GameState): PublishedGameState {
  return { phase: s.phase, questionIndex: s.questionIndex, timerStartedAtServer: s.timerStartedAt ? s.timerStartedAt + offset : null, timerDurationMs: TIMER_DURATION_MS, updatedAt: s.updatedAt };
}
function onState() {
  const s = getGameState(), key = keyOf(s), q = questionForSlot(s);
  const push = (kind: QueuedEvent["kind"], extra: Partial<QueuedEvent> = {}) =>
    p.queue.push({ id: crypto.randomUUID(), seq: ++p.seq, kind, question_key: key, at: Date.now() + offset, ...extra });
  if (p.lastKey !== null && key !== p.lastKey && key) push("next");
  if (s.phase === "locked" && p.lastPhase !== "locked") push("lock");
  if (s.phase === "wiping" && p.lastPhase !== "wiping" && q) {
    if (p.lastPhase !== "locked") push("lock");
    push("reveal", { correct: q.correctAnswer });
  }
  p.lastPhase = s.phase; p.lastKey = key; save(); emit();
  void flush();
}
async function flush() {
  if (busy || !p.creds) return; busy = true;
  const c = p.creds;
  try {
    while (p.queue.length) {
      const ev = p.queue[0], last = p.queue.length === 1, s = getGameState();
      // Only the last queued event carries the latest state, so older events are applied in order first.
      await publishGame({ data: { code: c.code, key: c.game, version: last ? s.updatedAt : 0, state: published(s), question: questionForSlot(s) ?? null, questionKey: keyOf(s), event: ev } });
      if (last) sentVersion = s.updatedAt;
      p.queue.shift(); save(); ok();
    }
    const s = getGameState();
    if (s.updatedAt > sentVersion) {
      await publishGame({ data: { code: c.code, key: c.game, version: s.updatedAt, state: published(s), question: questionForSlot(s) ?? null, questionKey: keyOf(s), event: null } });
      sentVersion = s.updatedAt; ok();
    }
  } catch (e) {
    status = { ...status, connected: false, error: (e as Error).message }; emit();
    clearTimeout(retryT); retryT = setTimeout(() => void flush(), 2000);
  } finally { busy = false; }
}
function ok() { status = { ...status, connected: true, lastOkAt: Date.now(), error: null }; emit(); }
async function beat() {
  if (!p.creds) return;
  const t0 = Date.now();
  try {
    const r = await heartbeat({ data: { code: p.creds.code, key: p.creds.game } });
    const t1 = Date.now(); offset = r.server_now - (t0 + t1) / 2; ok(); void flush();
  } catch (e) { status = { ...status, connected: false, error: (e as Error).message }; emit(); }
}
function start() {
  if (unsub || !p.creds) return;
  const s = getGameState(); if (p.lastPhase === null) { p.lastPhase = s.phase; p.lastKey = keyOf(s); save(); }
  unsub = subscribeGameState(onState);
  void beat().then(() => { sentVersion = 0; void flush(); });
  hbT = setInterval(beat, 3000);
}
function stop() { unsub?.(); unsub = null; clearInterval(hbT); clearTimeout(retryT); }

export const publisher = {
  init() { load(); start(); },
  attach(creds: GameSessionCreds) { load(); stop(); p = { creds, queue: [], seq: 0, lastPhase: null, lastKey: null }; save(); start(); },
  detach() { stop(); p = { creds: null, queue: [], seq: 0, lastPhase: null, lastKey: null }; save(); status = { connected: false, lastOkAt: null, queue: 0, error: null }; emit(); },
  creds: () => (load(), p.creds),
};
export function usePublisher() {
  const [, setN] = useState(0);
  useEffect(() => { publisher.init(); const l = () => setN((n) => n + 1); ls.add(l); l(); return () => { ls.delete(l); }; }, []);
  return { status, creds: p.creds };
}
