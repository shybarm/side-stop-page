import { describe, expect, it } from 'vitest';
import { remoteGame } from '../../iso/remoteGame';
import type { IsoSnapshot } from '../../iso/types';

const snapshot = (state: NonNullable<IsoSnapshot['game']>['state']): IsoSnapshot => ({ game: { state, question: { id: 'q4', text: 'Question', answerA: 'One', answerB: 'Two', answerC: 'Three', answerD: '', correctAnswer: 'C' }, question_key: '3:q4:123' }, plates: [], iso: null });
describe('read-only remote game screen', () => {
  it('renders questions while the output role hides the correct answer, then uses the revealed answer', () => {
    const snap = snapshot({ phase: 'answers' });
    if (snap.game?.question) delete snap.game.question.correctAnswer;
    expect(remoteGame(snap, 0).question?.text).toBe('Question');
    snap.iso = { question_key: '3:q4:123', pool: [], placements: {}, locked_snapshot: {}, correct_answer: 'C', resolved: true, version: 1 };
    expect(remoteGame(snap, 0).question?.correctAnswer).toBe('C');
  });
  it('preserves the control computer phase and selected question', () => {
    const game = remoteGame(snapshot({ phase: 'locked', questionIndex: 3, wipeSeq: 2, airedAt: 123 }), 0);
    expect(game.state.phase).toBe('locked'); expect(game.state.questionIndex).toBe(3);
    expect(game.question?.id).toBe('q4'); expect(game.question?.correctAnswer).toBe('C');
    expect(game.state.wipeSeq).toBe(2); expect(game.state.airedAt).toBe(123);
  });
  it('uses the server clock for the same timer progress on another computer', () => {
    const game = remoteGame(snapshot({ phase: 'timing', timerStartedAtServer: 100000, timerDurationMs: 90000 }), 5000);
    expect(game.state.timerStartedAt).toBe(95000); expect(game.state.timerDurationMs).toBe(90000);
  });
  it('preserves opening and manual answer entry', () => {
    const game = remoteGame(snapshot({ phase: 'idle', openingStep: 1, answerEntryMode: 'manual', visibleAnswers: 2 }), 0);
    expect(game.state.openingStep).toBe(1); expect(game.state.answerEntryMode).toBe('manual'); expect(game.state.visibleAnswers).toBe(2);
  });
});