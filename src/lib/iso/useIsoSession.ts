import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { getIso } from "./iso.functions";
import type { IsoSnapshot } from "./types";

export interface IsoConn { online: boolean; lastOkAt: number | null; error: string | null; gameHeartbeatAgeMs: number | null }

/**
 * Reads the shared session. Realtime "version changed" pings trigger a fetch of the
 * latest full snapshot (no replay of old updates); polling every 3s is the fallback.
 * On failure the last good snapshot is kept on screen — never reset, never shown as live.
 */
export function useIsoSession(code: string | null, key: string | null) {
  const [snap, setSnap] = useState<IsoSnapshot | null>(null);
  const [conn, setConn] = useState<IsoConn>({ online: false, lastOkAt: null, error: null, gameHeartbeatAgeMs: null });
  const offset = useRef(0), inflight = useRef(false), again = useRef(false);
  const refresh = useCallback(async () => {
    if (!code || !key) return;
    if (inflight.current) { again.current = true; return; }
    inflight.current = true;
    const t0 = Date.now();
    try {
      const r = (await getIso({ data: { code, key } })) as IsoSnapshot;
      const t1 = Date.now();
      offset.current = (r.server_now ?? t1) - (t0 + t1) / 2;
      setSnap(r);
      setConn({ online: true, lastOkAt: t1, error: null, gameHeartbeatAgeMs: r.heartbeat_at ? (r.server_now ?? 0) - r.heartbeat_at : null });
    } catch (e) {
      setConn((c) => ({ ...c, online: false, error: (e as Error).message }));
    } finally {
      inflight.current = false;
      if (again.current) { again.current = false; void refresh(); }
    }
  }, [code, key]);
  useEffect(() => {
    if (!code || !key) return;
    void refresh();
    const ch = supabase.channel(`iso:${code.toUpperCase()}`).on("broadcast", { event: "v" }, () => void refresh()).subscribe();
    const t = setInterval(() => void refresh(), 3000);
    const on = () => void refresh();
    window.addEventListener("online", on); window.addEventListener("focus", on);
    return () => { clearInterval(t); supabase.removeChannel(ch); window.removeEventListener("online", on); window.removeEventListener("focus", on); };
  }, [code, key, refresh]);
  return { snap, conn, refresh, serverNow: () => Date.now() + offset.current };
}

export function readCreds(storageKey: string): { code: string; key: string } | null {
  if (typeof window === "undefined") return null;
  const u = new URL(window.location.href);
  const code = u.searchParams.get("s"), key = new URLSearchParams(u.hash.slice(1)).get("k");
  if (code && key) { localStorage.setItem(storageKey, JSON.stringify({ code, key })); return { code, key }; }
  try { return JSON.parse(localStorage.getItem(storageKey) || "null"); } catch { return null; }
}
