import { describe, expect, test } from 'vitest';
import { convertPairPack, mergeRefresh, questionFitsSlot } from '../pairPack';
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
 test('loads an incomplete pair and lists the empty rounds', () => {const p=convertPairPack({...input,questions:input.questions.filter(q=>q.round!==7)});expect(p.order[6]).toBe(-1);expect(p.missing).toEqual([7]);});
 test('loads a pair with no assigned questions at all', () => {const p=convertPairPack({pair,questions:[]});expect(p.questions).toHaveLength(0);expect(p.missing).toEqual([1,2,3,4,5,6,7]);});
 test('never guesses a missing correct answer',()=>{const p=convertPairPack({...input,questions:input.questions.map(q=>({...q,options:q.options.map(o=>({...o,correct:false}))}))});expect(p.questions).toHaveLength(0);expect(p.skipped).toBe(12);});
 test('refresh fills a newly assigned round without touching aired questions', () => {
   const partial=convertPairPack({...input,questions:input.questions.filter(q=>q.round!==7)});
   const fresh=convertPairPack({pair,questions:[row(7,'late'),...input.questions.filter(q=>q.round!==7).map(q=>q.id==='reserve'?{...q,text:'נערך'}:q)]});
   const m=mergeRefresh(partial,fresh,partial.order,0);
   expect(m.questions[m.order[0]!]?.text).toBe('שאלה reserve');
   expect(m.questions[m.order[6]!]?.id).toBe('bank_late');
   expect(m.missing).toEqual([]);
 });
});
