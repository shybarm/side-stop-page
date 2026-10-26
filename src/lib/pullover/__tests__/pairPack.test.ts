import { describe, expect, test } from 'vitest';
import { convertPairPack, questionFitsSlot } from '../pairPack';
import { getWarehouse, getQuestions, setPairPack, setQuestions } from '../questionStore';
const pair = { id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', name: 'זוג בדיקה' };
const row = (round: number, id: string) => ({ id, round, text: `שאלה ${id}`, category: null, options: Array.from({length: round < 4 ? 4 : round < 7 ? 3 : 2}, (_, i) => ({text:`תשובה ${i}`,correct:i===0})) });
const input = { pair, questions: [row(1,'reserve'), ...Array.from({length:7},(_,i)=>row(i+1,`main${i}`)), ...Array.from({length:4},(_,i)=>row(i+2,`extra${i}`))] };
describe('assigned pair packs', () => {
 test('keeps all 12 assigned questions including five reserves', () => { expect(convertPairPack(input).questions).toHaveLength(12); });
 test('selects one question per round despite duplicate assignments', () => {const p=convertPairPack(input);expect(p.order.map(i=>p.questions[i]?.round)).toEqual([1,2,3,4,5,6,7]);});
 test('keeps the testing warehouse unchanged when a pair is loaded', () => {
   const storage = new Map<string,string>();
   Object.assign(globalThis, { window: { localStorage: { getItem:(k:string)=>storage.get(k)??null,setItem:(k:string,v:string)=>storage.set(k,v),removeItem:(k:string)=>storage.delete(k) }, addEventListener:()=>{} } });
   Object.assign(globalThis, { localStorage: window.localStorage });
   const original = {id:'test',text:'בדיקה',answerA:'א',answerB:'ב',answerC:'ג',answerD:'ד',correctAnswer:'A' as const};
   setQuestions([original]);const before=storage.get('pullover:questions:v1');
   setPairPack({...convertPairPack(input),loadedAt:1});
   expect(getQuestions()).toHaveLength(12);expect(getWarehouse()).toEqual([original]);expect(storage.get('pullover:questions:v1')).toBe(before);
   setPairPack(null);expect(getQuestions()).toEqual([original]);
 });
 test('reserves are eligible for their assigned round only', () => {const p=convertPairPack(input);const q=p.questions[0];if(!q)throw Error('fixture');expect(questionFitsSlot(q,0)).toBe(true);expect(questionFitsSlot(q,1)).toBe(false);});
 test('blocks incomplete games without inventing questions', () => {expect(()=>convertPairPack({...input,questions:input.questions.filter(q=>q.round!==7)})).toThrow('שבעת הסבבים');});
 test('never guesses a missing correct answer',()=>{expect(()=>convertPairPack({...input,questions:input.questions.map(q=>({...q,options:q.options.map(o=>({...o,correct:false}))}))})).toThrow('יחידה');});
});
