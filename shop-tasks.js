import { STARTER, EXPLANATIONS, repairLines, repairRow } from './case.js';
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
    // A saved answer or draft for the retired question still belongs to that question.
    const usedOldFollowup = old?.completedReplies?.length === 3 || old?.replies?.length >= 2 || (old?.replies?.length === 1 && old?.draft);
    const legacyFollowup = task.id === 'indent' && (old?.receiptQuestionCount === 3 || (!old?.receiptQuestionCount && usedOldFollowup));
    const questionCount = legacyFollowup ? 3 : (EXPLANATIONS.find(item => item.id === task.id)?.questions.length || 0);
    const replies = Array.isArray(old?.replies) ? old.replies.slice(0, Math.max(0, questionCount - 1)) : [];
    const validReplies = replies.every(text => typeof text === 'string' && text.trim() && text.length <= 3000);
    const completedReplies = old?.completedReplies;
    const complete = Array.isArray(completedReplies) && completedReplies.length === questionCount && completedReplies.every(text => typeof text === 'string' && text.trim() && text.length <= 3000);
    // Keep the original question with a written answer or draft from an older save.
    const started = old?.draft || replies.length || complete;
    const zeroOrderVersion = old?.zeroOrderVersion === 2 || (!started && old?.zeroOrderVersion !== 1) ? 2 : 1;
    const startedFinal = complete || (replies.length === questionCount - 1 && Boolean(old?.draft));
    const receiptPrediction = old?.receiptPrediction === true || !startedFinal;
    return [task.id,{range,proof,records,...(task.id === 'indent' ? {zeroOrderVersion, receiptQuestionCount:questionCount, receiptPrediction} : {}),completedReplies:complete ? [...completedReplies] : [],replies:validReplies ? replies : [],last:Object.hasOwn(records,old?.last)?old.last:null,report:typeof old?.report==='string'?old.report.slice(0,40000):'',draft:typeof old?.draft==='string'?old.draft.slice(0,3000):''}];
  }));
}
export function trackTaskEdits(attempt, source, sectionEdit) {
  const delta = source.length - attempt.source.length;
  for (const id of [...tasks.map(task => task.id), 'bracket']) {
    const section = id === 'bracket' ? attempt.printer : attempt.tasks[id];
    if (!sectionEdit) remapPrinter(section, attempt.source, source);
    else if (id === sectionEdit.station) section.range = [...sectionEdit.range];
    else if (section.range && section.range[0] > sectionEdit.range[0]) {
      section.range = section.range.map(offset => offset + delta);
    }
  }
}

// An empty editor still owns a position between its two neighbouring stations.
export function stationRange(attempt, station) {
  const sections = [...tasks.map(task => attempt.tasks[task.id]), attempt.printer];
  const index = station === 'bracket' ? tasks.length : tasks.findIndex(task => task.id === station);
  const stored = sections[index]?.range;
  const source = attempt.source;
  const before = sections[index - 1]?.range;
  const after = sections[index + 1]?.range;
  if (stored && (!before || before[1] < stored[0]) && (!after || stored[1] < after[0])) return stored;
  // Older saves could lose the range when a student deleted or renamed a line.
  if ((index > 0 && !before) || (index < sections.length - 1 && !after)) {
    const repair = repairLines.find(item => item.id === station);
    const row = repair && repairRow(source, repair);
    if (row == null) return null;
    const lines = source.split('\n');
    let first = row;
    if (station === 'conversion' || station === 'indent') {
      const preceding = station === 'conversion' ? /^\s*price\s*=/ : /^\s*if\b/;
      if (!row || !preceding.test(lines[row - 1])) return null;
      first--;
    }
    const start = lines.slice(0, first).reduce((offset, line) => offset + line.length + 1, 0);
    const end = start + lines.slice(first, row + 1).join('\n').length;
    if (sections.some((part, i) => i !== index && part.range && start <= part.range[1] && end >= part.range[0])) return null;
    return [start, end];
  }
  const start = before ? before[1] + 1 : 0;
  const end = after ? after[0] - 1 : source.length - Number(source.endsWith('\n'));
  if (start > end || (before && source[start - 1] !== '\n') || (after && source[end] !== '\n')) return null;
  return [start, end];
}
