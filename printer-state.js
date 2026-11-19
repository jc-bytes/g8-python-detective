import { STARTER } from './case.js';

export const originalPrinterLine = STARTER.trimEnd().split('\n').at(-1);
export function printerState(source) {
  const start = source.indexOf(originalPrinterLine);
  const unique = start >= 0 && source.indexOf(originalPrinterLine, start + 1) < 0
    && (start === 0 || source[start - 1] === '\n')
    && ['', '\n'].includes(source.charAt(start + originalPrinterLine.length));
  return { range: unique ? [start, start + originalPrinterLine.length] : null, metOwner: false, tourStop: -1, tourDone: false, dialogue: 0, visitedBook: false, page: -1, reply: '', replied: false, result: null };
}

// Follow a single edit before, after, or inside the strip. Ask for a new
// selection when edits cross a boundary or duplicate the section.
export function remapPrinter(state, before, after) {
  if (!state?.range || before === after) return;
  const [start, end] = state.range;
  let first = 0;
  while (first < before.length && first < after.length && before[first] === after[first]) first++;
  let oldEnd = before.length, newEnd = after.length;
  while (oldEnd > first && newEnd > first && before[oldEnd - 1] === after[newEnd - 1]) {
    oldEnd--; newEnd--;
  }
  const delta = after.length - before.length;
  let range;
  if (oldEnd <= start && first < start) range = [start + delta, end + delta];
  else if (first > end) range = [start, end];
  else if (first >= start && oldEnd <= end && !after.slice(first,newEnd).includes('\n')) range = [start, end + delta];
  else if (first === end && after[end] === '\n') range = [start, end];
  const candidate = range && after.slice(...range);
  state.range = candidate && after.indexOf(candidate) === after.lastIndexOf(candidate) ? range : null;
}

export function restorePrinter(value, source) {
  const clean = printerState(source);
  if (!value || typeof value !== 'object') return clean;
  const r = value.range;
  clean.range = Array.isArray(r) && r.length===2 && r.every(Number.isSafeInteger) && r[0]>=0 && r[0]<=r[1] && r[1]<=source.length ? r : null;
  clean.metOwner = value.metOwner === true || (value.metOwner === undefined && (value.replied === true || value.dialogue > 0));
  clean.tourDone = value.tourDone === true;
  if(Number.isInteger(value.tourStop) && value.tourStop>=0 && value.tourStop<6)clean.tourStop=value.tourStop;
  clean.visitedBook = value.visitedBook === true;
  if (typeof value.visitedBook === 'boolean' && Number.isInteger(value.dialogue) && value.dialogue>=0 && value.dialogue<=5) clean.dialogue=value.dialogue;
  if (Number.isInteger(value.page) && value.page>=-1 && value.page<5) clean.page=value.page;
  if (typeof value.reply === 'string' && value.reply.length <= 3000) clean.reply = value.reply;
  clean.replied = value.replied === true && Boolean(clean.reply.trim());
  const result=value.result;
  if(result && Number.isSafeInteger(result.revision) && result.revision>=0 &&
    ['candidate','stdout','stderr','error'].every(key=>typeof result[key]==='string' && result[key].length<=40000)) {
    clean.result={candidate:result.candidate,revision:result.revision,stdout:result.stdout,stderr:result.stderr,error:result.error};
  }
  return clean;
}
