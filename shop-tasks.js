import { STARTER, EXPLANATIONS } from './case.js';
import { remapPrinter } from './printer-state.js';

export const tasks = [
  {id:'conversion', title:'Input terminal', center:148, first:0, count:2},
  {id:'operator', title:'Calculator', center:191, first:2, count:1},
  {id:'name', title:'Ledger', center:285, first:3, count:1},
  {id:'indent', title:'Order notice', center:399, first:4, count:2}
];
export function restoreTasks(saved,source,starter=STARTER){
  const lines=starter.split('\n');
  return Object.fromEntries(tasks.map(task=>{
    const old=saved?.[task.id], original=lines.slice(task.first,task.first+task.count).join('\n');
    const index=source.indexOf(original);
    let range=index>=0 && source.lastIndexOf(original)===index?[index,index+original.length]:null;
    if(old){
      const r=old.range;
      range=Array.isArray(r) && r.length===2 && r.every(Number.isSafeInteger) && r[0]>=0 && r[0]<=r[1] && r[1]<=source.length?r:null;
    }
    const proof={}, records={};
    for(const key of ['entry','zero','positive','order']){
      const record=old?.records?.[key];
      if(record && Number.isSafeInteger(record.revision) && record.revision>=0 && typeof record.candidate==='string' && record.candidate.length<=20100 && typeof record.output==='string' && record.output.length<=40000)records[key]={revision:record.revision,candidate:record.candidate,output:record.output,...(typeof record.ownerLine==='string'?{ownerLine:record.ownerLine.slice(0,800)}:{})};
      if(typeof old?.proof?.[key]==='string' && old.proof[key].length<=20000)proof[key]=old.proof[key];
    }
    const questionCount = EXPLANATIONS.find(item => item.id === task.id)?.questions.length || 0;
    const replies = Array.isArray(old?.replies) ? old.replies.slice(0, Math.max(0, questionCount - 1)) : [];
    const validReplies = replies.every(text => typeof text === 'string' && text.trim() && text.length <= 3000);
    const completedReplies = old?.completedReplies;
    const complete = Array.isArray(completedReplies) && completedReplies.length === questionCount && completedReplies.every(text => typeof text === 'string' && text.trim() && text.length <= 3000);
    return [task.id,{range,proof,records,completedReplies:complete ? [...completedReplies] : [],replies:validReplies ? replies : [],last:Object.hasOwn(records,old?.last)?old.last:null,report:typeof old?.report==='string'?old.report.slice(0,40000):'',draft:typeof old?.draft==='string'?old.draft.slice(0,3000):''}];
  }));
}
export function trackTaskEdits(attempt,source){
  for(const task of tasks)remapPrinter(attempt.tasks[task.id],attempt.source,source);
}
