import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { placePlate } from "./iso.functions";
import { withTimeout } from "./timeout";
import { errText, type IsoSnapshot } from "./types";
import type { AnswerKey } from "@/lib/pullover/types";

interface Move {
  id: number; questionKey: string; plate: string; target: AnswerKey | null;
  correction: boolean; undo: boolean; version: number | null;
}

/** Immediate director feedback; ordered writes still use the server's atomic version checks. */
export function usePlateMoves(creds: { code: string; key: string }, snap: IsoSnapshot | null, refresh: () => Promise<IsoSnapshot | null>) {
  const [moves, setMoves] = useState<Move[]>([]);
  const items = useRef<Move[]>([]), running = useRef(false), nextId = useRef(0);
  const latest = useRef(snap), version = useRef({ key: "", value: 0 });
  latest.current = snap;
  const questionKey = snap?.game?.question_key;
  const serverVersion = snap?.iso?.version ?? 0;
  if (questionKey && version.current.key !== questionKey) version.current = { key: questionKey, value: serverVersion };
  else if (questionKey) version.current.value = Math.max(version.current.value, serverVersion);

  function update(next: Move[]) { items.current = next; setMoves([...next]); }
  useEffect(() => {
    update(items.current.filter((m) => m.questionKey === questionKey && (m.version === null || m.version > serverVersion)));
  }, [questionKey, serverVersion]);

  async function drain() {
    if (running.current) return;
    running.current = true;
    try {
      let move = items.current.find((m) => m.version === null);
      while (move) {
        const task = move;
        try {
          for (let attempt = 0; ; attempt++) {
            const current = latest.current;
            if (task.questionKey !== current?.game?.question_key) throw new Error("stale_question");
            if (!task.correction && (current.game.state.phase !== "timing" || current.iso?.locked_snapshot)) throw new Error("locked");
            try {
              const result = await withTimeout(placePlate({ data: { ...creds, questionKey: task.questionKey, plate: task.plate, target: task.target, expected: version.current.value, correction: task.correction, note: "", undo: task.undo } }), 8000) as { version: number };
              if (version.current.key === task.questionKey) version.current.value = Math.max(version.current.value, result.version);
              update(items.current.map((m) => m.id === task.id ? { ...m, version: result.version } : m));
              break;
            } catch (e) {
              if ((e as Error).message !== "version_conflict" || attempt >= 2) throw e;
              const fresh = await refresh();
              if (!fresh || fresh.game?.question_key !== task.questionKey) throw new Error("stale_question");
              latest.current = fresh;
              version.current = { key: task.questionKey, value: fresh.iso?.version ?? 0 };
            }
          }
        } catch (e) {
          update(items.current.filter((m) => m.id !== task.id));
          toast.error(`השלט לא נשמר: ${errText(e)}`);
          const fresh = await refresh();
          if (fresh) latest.current = fresh;
        }
        move = items.current.find((m) => m.version === null);
      }
    } finally { running.current = false; void refresh(); }
  }

  function enqueue(plate: string, target: AnswerKey | null, correction: boolean, undo = false) {
    if (!questionKey) return;
    update([...items.current, { id: ++nextId.current, questionKey, plate, target, correction, undo, version: null }]);
    void drain();
  }
  const placements = { ...snap?.iso?.placements };
  for (const m of moves) {
    if (m.questionKey !== questionKey) continue;
    if (m.target === null) delete placements[m.plate]; else placements[m.plate] = m.target;
  }
  return { placements, enqueue, pending: moves.filter((m) => m.questionKey === questionKey).length };
}