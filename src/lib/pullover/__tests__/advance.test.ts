import { describe, expect, test } from 'vitest';
const store = new Map<string,string>();
Object.assign(globalThis, { window: { localStorage: { getItem:(k:string)=>store.get(k)??null,setItem:(k:string,v:string)=>store.set(k,v),removeItem:(k:string)=>store.delete(k) }, addEventListener:()=>{}, setTimeout:()=>0 } });
Object.assign(globalThis, { localStorage: (globalThis as any).window.localStorage });
const { actions, getGameState, canNext } = await import('../gameStore');
const { setQuestions } = await import('../questionStore');
const q = (i:number) => ({ id:`q${i}`, text:`שאלה ${i}`, answerA:'א', answerB:'ב', answerC:'ג', answerD:'ד', correctAnswer:'A' as const });
describe('moving between questions', () => {
  test('"העלה תשובות" on the progress screen goes to the next question, not the same one', () => {
    setQuestions(Array.from({length:7},(_,i)=>q(i))); actions.newGame('t');
    actions.loadQuestion(); expect(getGameState().questionIndex).toBe(0);
    actions.setQuestionOrder([0,1,2,3,4,5,6]);
    (actions as any).goToQuestion(0); // reset to intro of q1
    Object.assign(getGameState(), {}); 
    // jump straight to progress of question 1
    const s = getGameState(); (s as any).phase = 'progress';
    actions.loadQuestion(); expect(getGameState().questionIndex).toBe(1);
  });
  test('an empty slot in the pack blocks moving on instead of reusing another question', () => {
    actions.setQuestionOrder([0,1,2,-1,4,5,6]);
    expect(canNext({ ...getGameState(), phase:'progress', questionIndex:2 })).toBe(false);
  });
});
