import { describe, expect, test } from 'vitest';
import { bankFitsSlot, dropOptions, convertGeneralBank, convertPairPack, mergeRefresh, prepareBankReplacement, questionFitsSlot } from '../pairPack';
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

describe('general bank replacements', () => {
 const pack = () => convertPairPack(input);
 test('accepts a question from another pair without changing already-aired slots', () => {
   const p = pack(), incoming = convertPairPack({pair:{...pair,name:'זוג אחר'},questions:[row(2,'other')]}).questions[0];
   if (!incoming) throw Error('fixture');
   const result = prepareBankReplacement(p.questions,p.order,0,incoming);
   expect(result?.questions[result.order[1] ?? -1]?.id).toBe('bank_other');
   expect(result?.questions[result.order[0] ?? -1]).toEqual(p.questions[p.order[0] ?? -1]);
   expect(result?.order.slice(2)).toEqual(p.order.slice(2));
 });
 test('rejects an already-aired question', () => {
   const p=pack(), q=p.questions[p.order[0] ?? -1]; if(!q)throw Error('fixture');
   expect(prepareBankReplacement(p.questions,p.order,0,{...q,round:2})).toBeNull();
 });
 test('preserves imported selection when refreshing the current pair', () => {
   const p=pack(), q=convertPairPack({pair,questions:[row(2,'outside')]}).questions[0];if(!q)throw Error('fixture');
   const imported=prepareBankReplacement(p.questions,p.order,0,q);if(!imported)throw Error('fixture');
   const refreshed=mergeRefresh(imported,p,imported.order,0);
   expect(refreshed.questions[refreshed.order[1] ?? -1]?.id).toBe('bank_outside');
 });
 test('general bank includes questions without a pair or round', () => {
   const {round,...q}=row(1,'unassigned');
   expect(convertGeneralBank({questions:[q]}).questions[0]?.round).toBeUndefined();
   expect(convertGeneralBank({questions:[q]}).questions[0]?.id).toBe('bank_unassigned');
 });
 test('never truncates four options for a three-answer round', () => {
   const p=pack(), {round,...raw}=row(1,'four');const q=convertGeneralBank({questions:[raw]}).questions[0];if(!q)throw Error('fixture');
   expect(prepareBankReplacement(p.questions,p.order,2,q)).toBeNull();
 });
 test('skips general questions without a single correct answer', () => {
   const q=row(1,'invalid');
   expect(convertGeneralBank({questions:[{...q,options:q.options.map(o=>({...o,correct:false}))}]}).skipped).toBe(1);
 });
 test('no replacement beyond final round', () => {
   const p=pack(),q=p.questions[0];if(!q)throw Error('fixture');
   expect(prepareBankReplacement(p.questions,p.order,6,q)).toBeNull();
 });
});

describe('dropping an extra answer for a 3-answer round', () => {
 const four = { id:'g', text:'ש', answerA:'א', answerB:'ב', answerC:'ג', answerD:'ד', correctAnswer:'C' as const };
 test('a 4-answer bank question is offered for question 4', () => { expect(bankFitsSlot(four, 3)).toBe(true); });
 test('removing B leaves three answers with the correct one remapped', () => {
   const q = dropOptions(four, ['B']); expect([q?.answerA,q?.answerB,q?.answerC,q?.answerD]).toEqual(['א','ג','ד','']); expect(q?.correctAnswer).toBe('B'); });
 test('the correct answer can never be removed', () => { expect(dropOptions(four, ['C'])).toBeNull(); });
 test('general bank keeps difficulty and topic', () => { const r = convertGeneralBank({questions:[{id:'1',text:'ש',category:'ספורט',difficulty:3,options:[{text:'א',correct:true},{text:'ב',correct:false}]}]}); expect(r.questions[0]?.difficulty).toBe(3); expect(r.questions[0]?.topic).toBe('ספורט'); });
});
