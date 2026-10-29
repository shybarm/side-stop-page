import { describe, expect, test } from 'vitest';
import { previousStage, visibleAnswerCount } from '../presentation';
import { type GameState } from '../types';
const base: GameState = {phase:'intro',questionIndex:0,questionOrder:[0,1,2,3,4,5,6],lockedAnswer:null,wipeSeq:0,timerStartedAt:null,updatedAt:1};
describe('stage presentation',()=>{
  test('question returns to answers-only without changing its airing',()=>{
    const s={...base,phase:'answers' as const,airedAt:100};
    expect({...s,...previousStage(s)}).toMatchObject({phase:'intro',airedAt:100,questionIndex:0});
  });
  test('automatic entry shows every active answer in the 4, 3 and 2 answer rounds',()=>{
    expect([0,3,6].map(questionIndex=>visibleAnswerCount({...base,questionIndex,answerEntryMode:'automatic'}))).toEqual([4,3,2]);
  });
  test('manual entry starts with one and reveals one per count increment',()=>{
    const s={...base,answerEntryMode:'manual' as const,visibleAnswers:1};
    expect(visibleAnswerCount(s)).toBe(1);
    expect(visibleAnswerCount({...s,visibleAnswers:2})).toBe(2);
    expect(visibleAnswerCount({...s,visibleAnswers:99})).toBe(4);
  });
  test('manual previous removes only the most recently shown answer',()=>{
    expect(previousStage({...base,answerEntryMode:'manual',visibleAnswers:3})).toEqual({visibleAnswers:2});
  });
  test('returning from a running timer cancels its start',()=>{
    expect(previousStage({...base,phase:'timing',timerStartedAt:100})).toEqual({phase:'answers',timerStartedAt:null});
  });
  test('locked and revealed states cannot undo authoritative placements or eliminations',()=>{
    for(const phase of ['locked','wiping','revealed','transition','progress'] as const) expect(previousStage({...base,phase})).toBeNull();
  });
});