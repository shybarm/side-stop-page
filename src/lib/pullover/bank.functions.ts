import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { heartbeat } from "@/lib/iso/iso.functions";
import { convertPairPack } from "./pairPack";

// The bank's lovable.app address redirects to its custom domain, and fetch drops the Authorization
// header on cross-origin redirects — so call the final domain directly and only follow known hosts.
const BASE = "https://habodeket.online/api/public/game-export";
const BANK_HOSTS = new Set(["habodeket.online", "www.habodeket.online", "image-guided-web-maker.lovable.app"]);
const auth = z.object({ code: z.string().min(3).max(20), key: z.string().min(10).max(100) });

async function call(qs: string) {
  const key = process.env['BODEKET_EXPORT_KEY'];
  if (!key) throw new Error("מפתח החיבור למאגר עדיין לא הוגדר");
  let url = `${BASE}${qs}`, r: Response | null = null;
  for (let hop = 0; hop < 3; hop++) {
    r = await fetch(url, { headers: { authorization: `Bearer ${key}` }, redirect: "manual", signal: AbortSignal.timeout(10000) });
    if (r.status < 300 || r.status >= 400) break;
    const next = new URL(r.headers.get("location") || "", url);
    if (next.protocol !== "https:" || !BANK_HOSTS.has(next.hostname)) throw new Error("כתובת המאגר הועברה למקום לא מוכר");
    url = next.toString();
  }
  if (!r) throw new Error("המאגר לא הגיב");
  if (r.status >= 300 && r.status < 400) throw new Error("יותר מדי הפניות בכתובת המאגר");
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
