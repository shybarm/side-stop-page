import { activeAnswerKeys, type GameState } from './types';

export function visibleAnswerCount(s: Pick<GameState, 'phase' | 'questionIndex' | 'answerEntryMode' | 'visibleAnswers'>): number {
  if (s.phase === 'idle') return 0;
  const total = activeAnswerKeys(s.questionIndex).length;
  return s.phase === 'intro' && s.answerEntryMode === 'manual'
    ? Math.max(0, Math.min(total, s.visibleAnswers ?? 1)) : total;
}

export function previousStage(s: GameState): Partial<GameState> | null {
  if (s.phase === 'timing') return { phase: 'answers', timerStartedAt: null };
  if (s.phase === 'answers') return { phase: 'intro', timerStartedAt: null };
  if (s.phase === 'intro') {
    const count = visibleAnswerCount(s);
    if (s.answerEntryMode === 'manual' && count > 1) return { visibleAnswers: count - 1 };
    return { phase: 'idle', visibleAnswers: 0, timerStartedAt: null };
  }
  return null;
}