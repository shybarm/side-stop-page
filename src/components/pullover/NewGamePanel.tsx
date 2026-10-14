import { useEffect, useState } from "react";
import { toast } from "sonner";
import { actions, useGameState } from "@/lib/pullover/gameStore";
import { NEW_GAME_PASSWORD } from "@/lib/pullover/types";

/** Team (session) name + guarded "new game" that restarts every screen, including ISO plates. */
export function NewGamePanel() {
  const state = useGameState();
  const [team, setTeam] = useState("");
  const [open, setOpen] = useState(false), [pw, setPw] = useState(""), [newTeam, setNewTeam] = useState("");
  useEffect(() => { setTeam(state.teamName ?? ""); }, [state.teamName]);
  const start = () => {
    if (pw !== NEW_GAME_PASSWORD) { toast.error("סיסמה שגויה"); setPw(""); return; }
    actions.newGame(newTeam || team);
    setOpen(false); setPw(""); setNewTeam("");
    toast.success("משחק חדש התחיל — כל המסכים אופסו");
  };
  return (
    <div className="space-y-2 rounded-xl border border-po-steel-line bg-po-asphalt p-3 text-xs">
      <label className="block text-po-white/50">שם הקבוצה (שם הסשן)</label>
      <input value={team} onChange={(e) => setTeam(e.target.value)} onBlur={() => team.trim() !== (state.teamName ?? "") && actions.setTeamName(team)}
        onKeyDown={(e) => { if (e.key === "Enter") (e.target as HTMLInputElement).blur(); e.stopPropagation(); }}
        placeholder="לדוגמה: משפחת כהן" className="h-9 w-full rounded border border-po-steel-line bg-po-asphalt-deep px-2 text-sm font-bold" />
      {!open ? (
        <button onClick={() => { setOpen(true); setNewTeam(""); }} className="h-10 w-full rounded-lg border border-po-red font-black text-po-red">איפוס — משחק חדש</button>
      ) : (
        <form onSubmit={(e) => { e.preventDefault(); start(); }} className="space-y-2 rounded-lg border border-po-red p-2" onKeyDown={(e) => e.stopPropagation()}>
          <div className="font-bold">משחק חדש מאפס את כל המסכים ומחזיר את כל השלטים.</div>
          <input value={newTeam} onChange={(e) => setNewTeam(e.target.value)} placeholder="שם הקבוצה החדשה (לא חובה)" className="h-9 w-full rounded border border-po-steel-line bg-po-asphalt-deep px-2 text-sm" />
          <input autoFocus type="password" inputMode="numeric" value={pw} onChange={(e) => setPw(e.target.value)} placeholder="סיסמה" aria-label="סיסמה" className="h-9 w-full rounded border border-po-steel-line bg-po-asphalt-deep px-2 text-sm" />
          <div className="flex gap-2">
            <button type="submit" className="h-9 flex-1 rounded bg-po-red font-black">אישור משחק חדש</button>
            <button type="button" onClick={() => { setOpen(false); setPw(""); }} className="h-9 rounded border px-3">ביטול</button>
          </div>
        </form>
      )}
    </div>
  );
}
