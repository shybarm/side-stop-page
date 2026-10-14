import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { getIso } from "./iso.functions";
import { withTimeout } from "./timeout";
import type { IsoSnapshot } from "./types";

export interface IsoConn { online: boolean; lastOkAt: number | null; error: string | null; gameHeartbeatAgeMs: number | null; live: boolean }

/**
 * Reads the shared session. Realtime "version changed" pings trigger a fetch of the
 * latest full snapshot (no replay of old updates); polling every 3s is the fallback.
 * Every fetch has a timeout so a hung request can never freeze updates, and the realtime
 * subscription is re-created automatically if it errors or closes.
 * On failure the last good snapshot is kept on screen — never reset, never shown as live.
 */
export function useIsoSession(code: string | null, key: string | null) {
  const [snap, setSnap] = useState<IsoSnapshot | null>(null);
  const [conn, setConn] = useState<IsoConn>({ online: false, lastOkAt: null, error: null, gameHeartbeatAgeMs: null, live: false });
  const offset = useRef(0), inflight = useRef(false), again = useRef(false), waiters = useRef<(() => void)[]>([]);
  const refresh = useCallback((): Promise<void> => {
    if (!code || !key) return Promise.resolve();
    const done = new Promise<void>((r) => waiters.current.push(r));
    if (inflight.current) { again.current = true; return done; }
    inflight.current = true;
    const t0 = Date.now();
    void (async () => {
      try {
        const r = (await withTimeout(getIso({ data: { code, key } }), 8000)) as IsoSnapshot;
        const t1 = Date.now();
        offset.current = (r.server_now ?? t1) - (t0 + t1) / 2;
        setSnap(r);
        setConn((c) => ({ ...c, online: true, lastOkAt: t1, error: null, gameHeartbeatAgeMs: r.heartbeat_at ? (r.server_now ?? 0) - r.heartbeat_at : null }));
      } catch (e) {
        setConn((c) => ({ ...c, online: false, error: (e as Error).message }));
      } finally {
        inflight.current = false;
        if (again.current) { again.current = false; void refresh(); }
        else { const w = waiters.current; waiters.current = []; w.forEach((f) => f()); }
      }
    })();
    return done;
  }, [code, key]);
  useEffect(() => {
    if (!code || !key) return;
    let closed = false, ch: ReturnType<typeof supabase.channel> | null = null, reT = 0 as any;
    const subscribe = () => {
      if (closed) return;
      if (ch) void supabase.removeChannel(ch);
      ch = supabase.channel(`iso:${code.toUpperCase()}`).on("broadcast", { event: "v" }, () => void refresh())
        .subscribe((st) => {
          setConn((c) => ({ ...c, live: st === "SUBSCRIBED" }));
          if (st === "SUBSCRIBED") void refresh(); // catch anything missed while (re)connecting
          if (st === "CHANNEL_ERROR" || st === "TIMED_OUT" || st === "CLOSED") { clearTimeout(reT); reT = setTimeout(subscribe, 2000); }
        });
    };
    void refresh();
    subscribe();
    const t = setInterval(() => void refresh(), 3000);
    const on = () => void refresh();
    window.addEventListener("online", on); window.addEventListener("focus", on);
    return () => { closed = true; clearInterval(t); clearTimeout(reT); if (ch) void supabase.removeChannel(ch); window.removeEventListener("online", on); window.removeEventListener("focus", on); };
  }, [code, key, refresh]);
  const serverNow = useCallback(() => Date.now() + offset.current, []);
  return { snap, conn, refresh, serverNow };
}

export function readCreds(storageKey: string): { code: string; key: string } | null {
  if (typeof window === "undefined") return null;
  const u = new URL(window.location.href);
  const code = u.searchParams.get("s"), key = new URLSearchParams(u.hash.slice(1)).get("k");
  if (code && key) { localStorage.setItem(storageKey, JSON.stringify({ code, key })); return { code, key }; }
  try { return JSON.parse(localStorage.getItem(storageKey) || "null"); } catch { return null; }
}
