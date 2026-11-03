import type { GameState, Question } from '@/lib/pullover/types';
import { normalizeTimerDuration } from '@/lib/pullover/types';
import type { IsoSnapshot } from './types';

/** Read-only projection; never initializes or writes the local game store. */
export function remoteGame(snap: IsoSnapshot, clockOffset: number): { state: GameState; question: Question | undefined } {
  const s = snap.game?.state ?? {};
  const q = snap.game?.question;
  const question: Question | undefined = q?.id && q.text && q.correctAnswer ? {
    id: q.id, text: q.text, correctAnswer: q.correctAnswer,
    answerA: q.answerA ?? '', answerB: q.answerB ?? '', answerC: q.answerC ?? '', answerD: q.answerD ?? '',
  } : undefined;
  return { question, state: {
    phase: s.phase ?? 'idle', questionIndex: s.questionIndex ?? 0, questionOrder: [],
    lockedAnswer: null, wipeSeq: s.wipeSeq ?? 0,
    timerStartedAt: s.timerStartedAtServer == null ? null : s.timerStartedAtServer - clockOffset,
    timerDurationMs: normalizeTimerDuration(s.timerDurationMs), updatedAt: s.updatedAt ?? 0,
    airedAt: s.airedAt ?? null, openingStep: s.openingStep ?? 0,
    answerEntryMode: s.answerEntryMode ?? 'automatic', visibleAnswers: s.visibleAnswers ?? 1,
    teamName: s.teamName ?? '', ...(s.gameId == null ? {} : { gameId: s.gameId }),
  } };
}