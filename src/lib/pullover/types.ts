export type AnswerKey = "A" | "B" | "C" | "D";
export const ANSWER_KEYS: AnswerKey[] = ["A", "B", "C", "D"];
export const TOTAL_GAME_QUESTIONS = 7;
export const TIMER_DURATION_MS = 60000;
export function answerCountForQuestion(index: number): 2 | 3 | 4 { return index < 3 ? 4 : index < 6 ? 3 : 2; }
export function activeAnswerKeys(index: number): AnswerKey[] { return ANSWER_KEYS.slice(0, answerCountForQuestion(index)); }
export interface Question { id:string; text:string; answerA:string; answerB:string; answerC:string; answerD:string; correctAnswer:AnswerKey; category?:string; }
export type GamePhase = "idle" | "intro" | "answers" | "timing" | "locked" | "wiping" | "revealed" | "transition" | "progress";
export interface GameState { phase:GamePhase; questionIndex:number; questionOrder:number[]; lockedAnswer:AnswerKey|null; wipeSeq:number; timerStartedAt:number|null; updatedAt:number; /** Unique per airing of a question (load/next/jump), so re-running a slot is a new ISO question. */ airedAt?:number|null; }
export const DEFAULT_QUESTION_ORDER=[0,1,2,3,4,5,6];
export const PHASE_LABEL:Record<GamePhase,string>={idle:"ממתין",intro:"שאלה באוויר",answers:"ממתין לנעילה",timing:"זמן רץ",locked:"הלוח נעול",wiping:"חשיפת תשובה",revealed:"תשובה נחשפה",transition:"מעבר",progress:"התקדמות לרכב"};
export function answerOf(q:Question,key:AnswerKey):string{return key==="A"?q.answerA:key==="B"?q.answerB:key==="C"?q.answerC:q.answerD;}
export const HE_LETTER: Record<AnswerKey, string> = { A: "א", B: "ב", C: "ג", D: "ד" };
