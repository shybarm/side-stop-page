// ISO session server actions. Every call is authorised in SQL by the per-role key hash.
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

async function sha(t: string) {
  const b = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(t));
  return Array.from(new Uint8Array(b)).map((x) => x.toString(16).padStart(2, "0")).join("");
}
function rand(n: number, alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789") {
  const a = crypto.getRandomValues(new Uint8Array(n));
  return Array.from(a, (x) => alphabet[x % alphabet.length]).join("");
}
async function rpc(fn: string, args: Record<string, unknown>) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data, error } = await (supabaseAdmin.rpc as unknown as (f: string, a: unknown) => Promise<{ data: unknown; error: { message: string } | null }>)(fn, args);
  if (error) {
    const known = ["forbidden", "session_not_found", "version_conflict", "locked", "stale_question", "plate_eliminated", "plate_not_in_pool", "question_not_found", "bad_target", "bad_status", "bad_layout"];
    const code = known.find((k) => error.message.includes(k));
    if (!code) console.error(fn, error.message);
    throw new Error(code ?? "server_error");
  }
  return data as any;
}
const auth = z.object({ code: z.string().min(3).max(20), key: z.string().min(10).max(100) });

export const createIsoSession = createServerFn({ method: "POST" }).handler(async () => {
  const code = "PO-" + rand(4, "0123456789");
  const keys = { game: rand(24), director: rand(24), output: rand(24) };
  await rpc("iso_create_session", { _code: code, _g: await sha(keys.game), _d: await sha(keys.director), _o: await sha(keys.output) });
  return { code, ...keys };
});

export const publishGame = createServerFn({ method: "POST" })
  .inputValidator((d) => auth.extend({ version: z.number(), state: z.any(), question: z.any(), questionKey: z.string().nullable(), event: z.any().nullable() }).parse(d))
  .handler(async ({ data }) =>
    rpc("iso_game_publish", { _code: data.code, _hash: await sha(data.key), _version: data.version, _state: data.state, _question: data.question, _key: data.questionKey, _event: data.event }) as Promise<{ ok: boolean; event_applied: boolean; state_applied: boolean; game_version: number; server_now: number }>,
  );

export const heartbeat = createServerFn({ method: "POST" })
  .inputValidator((d) => auth.parse(d))
  .handler(async ({ data }) => rpc("iso_heartbeat", { _code: data.code, _hash: await sha(data.key) }) as Promise<{ server_now: number }>);

export const getIso = createServerFn({ method: "POST" })
  .inputValidator((d) => auth.parse(d))
  .handler(async ({ data }) => rpc("iso_get", { _code: data.code, _hash: await sha(data.key) }));

export const placePlate = createServerFn({ method: "POST" })
  .inputValidator((d) => auth.extend({ questionKey: z.string(), plate: z.string(), target: z.enum(["A", "B", "C", "D"]).nullable(), expected: z.number(), correction: z.boolean(), note: z.string().max(300), undo: z.boolean() }).parse(d))
  .handler(async ({ data }) =>
    rpc("iso_place", { _code: data.code, _hash: await sha(data.key), _key: data.questionKey, _plate: data.plate, _target: data.target, _expected: data.expected, _correction: data.correction, _note: data.note, _undo: data.undo }),
  );

export const setPlateStatus = createServerFn({ method: "POST" })
  .inputValidator((d) => auth.extend({ plate: z.string(), status: z.enum(["active", "eliminated"]), note: z.string().max(300) }).parse(d))
  .handler(async ({ data }) => rpc("iso_set_plate_status", { _code: data.code, _hash: await sha(data.key), _plate: data.plate, _status: data.status, _note: data.note }));

export const getIsoEvents = createServerFn({ method: "POST" })
  .inputValidator((d) => auth.parse(d))
  .handler(async ({ data }) => rpc("iso_get_events", { _code: data.code, _hash: await sha(data.key) }));

const layoutBox = z.object({ x: z.number().min(-50).max(50), y: z.number().min(-60).max(20), scale: z.number().min(0.4).max(1.6) });
export const setIsoLayout = createServerFn({ method: "POST" })
  .inputValidator((d) => auth.extend({ layout: z.object({ active: z.enum(["long", "close", "custom"]), current: layoutBox, presets: z.object({ long: layoutBox, close: layoutBox }) }) }).parse(d))
  .handler(async ({ data }) => rpc("iso_set_layout", { _code: data.code, _hash: await sha(data.key), _layout: data.layout }));
