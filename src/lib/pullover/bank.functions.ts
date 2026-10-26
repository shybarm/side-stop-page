import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { heartbeat } from "@/lib/iso/iso.functions";
import { convertPairPack } from "./pairPack";

const BASE = "https://image-guided-web-maker.lovable.app/api/public/game-export";
const auth = z.object({ code: z.string().min(3).max(20), key: z.string().min(10).max(100) });

async function call(qs: string) {
  const key = process.env['BODEKET_EXPORT_KEY'];
  if (!key) throw new Error("מפתח החיבור למאגר עדיין לא הוגדר");
  const r = await fetch(`${BASE}${qs}`, { headers: { authorization: `Bearer ${key}` }, signal: AbortSignal.timeout(10000) });
  if (r.status === 404) throw new Error("כתובת הייצוא עדיין לא פורסמה באתר הבודקת");
  if (r.status === 401) throw new Error("המפתח לא תואם בין שני האתרים");
  if (!r.ok) throw new Error(`המאגר החזיר שגיאה ${r.status}`);
  if (!r.headers.get("content-type")?.includes("application/json")) throw new Error("כתובת הייצוא עדיין לא זמינה באתר הבודקת");
  return r.json();
}

export const listPairs = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => auth.parse(d))
  .handler(async ({ data }) => {
    await heartbeat({ data }); // Existing SQL authorizes the game role before any private export read.
    return z.object({ pairs: z.array(z.object({ id: z.string().uuid(), name: z.string(), count: z.number().int().nonnegative() })) }).parse(await call("?list=1")).pairs;
  });

export const loadPair = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => auth.extend({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data }) => {
    await heartbeat({ data: { code: data.code, key: data.key } });
    return convertPairPack(await call(`?contestant=${data.id}`));
  });
