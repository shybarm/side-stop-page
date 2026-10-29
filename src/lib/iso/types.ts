// Shared ISO session types.
import type { AnswerKey, GamePhase, Question } from "@/lib/pullover/types";

/** Game state as published to the shared session (timer already in server time). */
export interface PublishedGameState {
  phase: GamePhase;
  answerEntryMode?: 'automatic' | 'manual';
  visibleAnswers?: number;
  questionIndex: number;
  timerStartedAtServer: number | null;
  timerDurationMs: number;
  teamName?: string;
  gameId?: number | null;
  updatedAt: number;
}
export type PlateStatus = "active" | "eliminated" | "pending";
export interface Plate { id: string; color: string; status: PlateStatus; status_key: string | null }
export interface IsoQuestionState {
  question_key: string;
  pool: string[];
  placements: Record<string, AnswerKey>;
  locked_snapshot: Record<string, AnswerKey> | null;
  correct_answer: AnswerKey | null;
  resolved: boolean;
  version: number;
}
export interface LayoutBox { x: number; y: number; scale: number }
export interface IsoLayout { active: "long" | "close" | "custom"; current: LayoutBox; presets: { long: LayoutBox; close: LayoutBox } }
export const DEFAULT_LAYOUT: IsoLayout = { active: "long", current: { x: 0, y: 0, scale: 1 }, presets: { long: { x: 0, y: 0, scale: 1 }, close: { x: 0, y: 3, scale: 0.82 } } };
export function layoutOf(l: Partial<IsoLayout> | null | undefined): IsoLayout {
  return l && l.current && l.presets ? (l as IsoLayout) : DEFAULT_LAYOUT;
}
export interface IsoSnapshot {
  layout?: Partial<IsoLayout> | null;
  game: { state: Partial<PublishedGameState>; question: (Partial<Question> & { id?: string }) | null; question_key: string | null } | null;
  plates: Plate[];
  iso: IsoQuestionState | null;
  role?: "game" | "director" | "output";
  heartbeat_at?: number | null;
  game_version?: number;
  server_now?: number;
}
export interface IsoEvent { id: number; ts: string; kind: string; question_key: string | null; seq: number | null; client_event_id: string | null; data: Record<string, unknown> & { snapshot?: IsoSnapshot } }

export const ISO_ERRORS: Record<string, string> = {
  forbidden: "מפתח לא תקין לסשן הזה",
  session_not_found: "הסשן לא נמצא",
  version_conflict: "החלוקה השתנתה במקביל, נטען מחדש",
  locked: "הלוח נעול, יש להפעיל מצב תיקון",
  stale_question: "השאלה כבר התחלפה",
  plate_eliminated: "השלט יצא מהמשחק",
  plate_not_in_pool: "השלט אינו משתתף בשאלה זו",
  server_error: "שגיאת שרת",
  timeout: "השרת לא הגיב בזמן",
};
export const errText = (e: unknown) => ISO_ERRORS[(e as Error)?.message] ?? "אין חיבור לשרת";

export function slotOfKey(key: string | null | undefined) { return key ? Number(key.split(":")[0]) : 0; }
