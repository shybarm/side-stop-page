export type AnswerKey = "A" | "B" | "C" | "D";
export const ANSWER_KEYS: AnswerKey[] = ["A", "B", "C", "D"];
export const TOTAL_GAME_QUESTIONS = 7;
export function answerCountForQuestion(index: number): 2 | 3 | 4 { return index < 3 ? 4 : index < 6 ? 3 : 2; }
export function activeAnswerKeys(index: number): AnswerKey[] { return ANSWER_KEYS.slice(0, answerCountForQuestion(index)); }
export interface Question { id:string; text:string; answerA:string; answerB:string; answerC:string; answerD:string; correctAnswer:AnswerKey; category?:string; }
export type GamePhase = "idle" | "intro" | "answers" | "locked" | "wiping" | "revealed" | "transition" | "progress";
export interface GameState { phase:GamePhase; questionIndex:number; questionOrder:number[]; lockedAnswer:AnswerKey|null; wipeSeq:number; updatedAt:number; }
export const DEFAULT_QUESTION_ORDER=[0,1,2,3,4,5,6];
export const PHASE_LABEL:Record<GamePhase,string>={idle:"ממתין",intro:"שאלה באוויר",answers:"ממתין לנעילה",locked:"הלוח נעול",wiping:"חשיפת תשובה",revealed:"תשובה נחשפה",transition:"מעבר",progress:"התקדמות לרכב"};
export function answerOf(q:Question,key:AnswerKey):string{return key==="A"?q.answerA:key==="B"?q.answerB:key==="C"?q.answerC:q.answerD;}
