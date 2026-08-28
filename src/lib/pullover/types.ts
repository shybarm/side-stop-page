export type AnswerKey = "A" | "B" | "C" | "D";

export const ANSWER_KEYS: AnswerKey[] = ["A", "B", "C", "D"];

export interface Question {
  id: string;
  text: string;
  answerA: string;
  answerB: string;
  answerC: string;
  answerD: string;
  correctAnswer: AnswerKey;
  category?: string;
}

/**
 * Broadcast phases of the show.
 * idle      – nothing on air (bumper / show mark only)
 * intro     – question rising on screen, answers hidden
 * answers   – all four answers on air; operator records contestant choice
 * locked    – contestant answer is locked, no more changes
 * wiping    – wipers physically sweeping the wrong answers
 * revealed  – only the correct answer remains, confirmed
 */
export type GamePhase = "idle" | "intro" | "answers" | "locked" | "wiping" | "revealed";

export interface GameState {
  phase: GamePhase;
  questionIndex: number;
  /** contestant answer selected by Q; becomes final once phase is locked */
  lockedAnswer: AnswerKey | null;
  /** increments on every wiper trigger so displays can restart animations */
  wipeSeq: number;
  updatedAt: number;
}

export const PHASE_LABEL: Record<GamePhase, string> = {
  idle: "ממתין",
  intro: "שאלה באוויר",
  answers: "ממתין לבחירת מתמודד",
  locked: "תשובת מתמודד נעולה",
  wiping: "מגבים פועלים",
  revealed: "תשובה נחשפה",
};

export function answerOf(q: Question, key: AnswerKey): string {
  return key === "A" ? q.answerA : key === "B" ? q.answerB : key === "C" ? q.answerC : q.answerD;
}
