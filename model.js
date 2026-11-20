import { restoreTasks, trackTaskEdits, stationRange } from './shop-tasks.js';
import { restoreBackpack } from './backpack.js';
import { printerState, restorePrinter } from './printer-state.js';
import { CASE_VERSION, CASES, receiptFor, LEGACY_STARTER, SIMPLIFIED_STARTER, STARTER, TESTS, PRACTICE_SOURCE, TOOLBOX } from './case.js';

export function newAttempt(mode = 'assessment') {
  return { starterRevision: 4, repairReplies: {}, backpacks: {}, order: {price:"", quantity:""}, tasks: restoreTasks(null,mode === 'assessment' ? STARTER : PRACTICE_SOURCE), printer: printerState(mode === 'assessment' ? STARTER : PRACTICE_SOURCE), version: CASE_VERSION, mode, identity: { firstName: '', lastName: '', group: '', character: 'boy' }, source: mode === 'practice' ? PRACTICE_SOURCE : STARTER, revision: 0, inspected: [], evidence: {}, connections: {}, notes: {}, runs: [], kept: {}, updatedAt: null, saveId: null };
}

export function updateSource(attempt, source, sectionEdit) {
  if (typeof source !== 'string' || source.length > 20000) throw new Error('Keep the program below 20,000 characters.');
  if (source !== attempt.source) {
    trackTaskEdits(attempt, source, sectionEdit);
    attempt.source = source;
    attempt.revision += 1;
  }
}

export function insertCodePiece(source, token, start, end) {
  if (!TOOLBOX.includes(token)) throw new Error('Select a piece from the shared toolbox.');
  if (!Number.isSafeInteger(start) || !Number.isSafeInteger(end) || start < 0 || end < start || end > source.length) throw new Error('Choose a position in your program first.');
  return source.slice(0, start) + token + source.slice(end);
}

export function placeEvidence(attempt, clueId, destination) {
  if (!CASES.some(item => item.id === clueId) || !CASES.some(item => item.id === destination)) throw new Error('Choose a clue and a case-board slot.');
  for (const slot of Object.keys(attempt.evidence)) if (attempt.evidence[slot] === clueId) delete attempt.evidence[slot];
  attempt.evidence[destination] = clueId;
}

export function recordRun(attempt, result, source, revision, testId) {
  if (testId !== 'practice' && testId !== 'custom' && !TESTS.some(item => item.id === testId)) throw new Error('Unknown test.');
  const run = { starterRevision: attempt.starterRevision, id: crypto.randomUUID(), testId, source, revision, stdout: String(result.stdout ?? '').slice(0, 40000), stderr: String(result.stderr ?? '').slice(0, 40000), error: String(result.error ?? '').slice(0, 10000), localTime: new Date().toISOString() };
  attempt.runs.push(run);
  if (attempt.runs.length > 30) {
    const removable = attempt.runs.findIndex(item => !Object.values(attempt.kept).includes(item.id));
    if (removable >= 0) attempt.runs.splice(removable, 1);
  }
  return run;
}

export function keptRun(attempt, testId) {
  return attempt.runs.find(run => run.id === attempt.kept[testId] && run.testId === testId);
}

export function checklist(attempt) {
  return [
    { label: 'Name and class entered', done: Boolean(attempt.identity.firstName.trim() && attempt.identity.lastName.trim() && attempt.identity.group) },
    { label: 'Two explanations written', done: ['conversion', 'indent'].every(id => Boolean(attempt.notes[id]?.trim())) },
    ...TESTS.map(test => ({ label: `${test.price}/${test.quantity} actual result kept for this code`, done: keptRun(attempt, test.id)?.source === attempt.source }))
  ];
}

export function fileStem(attempt) {
  const safe = value => value.normalize('NFKD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 50) || 'Unnamed';
  return `G8_PythonDebug_${safe(attempt.identity.firstName)}_${safe(attempt.identity.lastName)}`;
}

function validPrintedReceipt(text) {
  if (typeof text !== 'string') return false;
  // Older backups allow 40,000 UTF-16 units. Python's output limit counts code points.
  if (text.length <= 40000) return true;
  const pythonOutputLimit = 30000;
  return text.length <= 2 * pythonOutputLimit && Array.from(text).length <= pythonOutputLimit;
}

export function validateAttempt(value, expectedMode) {
  const fail = () => { throw new Error('This is not a compatible case backup. Your current work has not changed.'); };
  if (!value || value.version !== CASE_VERSION || value.mode !== expectedMode) fail();
  if (typeof value.source !== 'string' || value.source.length > 20000 || !Number.isSafeInteger(value.revision) || value.revision < 0) fail();
  if (!value.identity || !['firstName', 'lastName', 'group'].every(key => typeof value.identity[key] === 'string' && value.identity[key].length <= 100)) fail();
  if (!['', '8A', '8B'].includes(value.identity.group)) fail();
  const validId = id => CASES.some(item => item.id === id);
  if (!Array.isArray(value.inspected) || value.inspected.length > 5 || !value.inspected.every(validId)) fail();
  if (!value.evidence || typeof value.evidence !== 'object' || Array.isArray(value.evidence) || Object.entries(value.evidence).some(([key, entry]) => !validId(key) || !validId(entry))) fail();
  if (!value.notes || typeof value.notes !== 'object' || Array.isArray(value.notes) || Object.entries(value.notes).some(([key, entry]) => !validId(key) || typeof entry !== 'string' || entry.length > (['conversion', 'indent'].includes(key) ? 9002 : 3000))) fail();
  if (value.connections !== undefined && (!value.connections || typeof value.connections !== 'object' || Array.isArray(value.connections) || Object.entries(value.connections).some(([key, entry]) => !validId(key) || !entry || typeof entry.line !== 'string' || !/^\d{0,5}$/.test(entry.line) || typeof entry.reason !== 'string' || entry.reason.length > 1000))) fail();
  if (!Array.isArray(value.runs) || value.runs.length > 30 || !value.kept || typeof value.kept !== 'object' || Array.isArray(value.kept)) fail();
  if (value.runs.some(run => !run || typeof run.id !== 'string' || run.id.length > 100 || !['practice', 'custom', ...TESTS.map(item => item.id)].includes(run.testId) || typeof run.source !== 'string' || run.source.length > 20000 || !Number.isSafeInteger(run.revision) || run.revision < 0 || typeof run.stdout !== 'string' || run.stdout.length > 40000 || typeof run.stderr !== 'string' || run.stderr.length > 40000 || typeof run.error !== 'string' || run.error.length > 10000 || typeof run.localTime !== 'string' || run.localTime.length > 100)) fail();
  for(const run of value.runs){
    if(run.printed!==undefined && (!validPrintedReceipt(run.printed) || ![run.price,run.quantity].every(v=>typeof v==='string' && /^\d{1,8}$/.test(v))))fail();
  }
  if (new Set(value.runs.map(run => run.id)).size !== value.runs.length) fail();
  if (Object.entries(value.kept).some(([testId, id]) => !value.runs.some(run => run.testId === testId && run.id === id))) fail();
  const clean = newAttempt(expectedMode);
  for (const key of ['identity', 'source', 'revision', 'inspected', 'evidence', 'notes', 'runs', 'kept']) clean[key] = structuredClone(value[key]);
  clean.starterRevision = value.starterRevision === 4 ? 4 : 3;
  for (const id of ['indent', 'bracket', 'name', 'operator']) {
    const reply = value.repairReplies?.[id];
    if (reply && typeof reply.text === 'string' && reply.text.length <= 3000) {
      clean.repairReplies[id] = {text: reply.text, ...(reply.questionVersion === 2 || reply.questionVersion === 3 ? {questionVersion: reply.questionVersion} : {}), sent: reply.sent === true && Boolean(reply.text.trim())};
    }
  }
  clean.identity.character = value.identity.character === 'girl' ? 'girl' : 'boy';
  clean.connections = structuredClone(value.connections ?? {});
  if(typeof value.earlierEntryNote==='string')clean.earlierEntryNote=value.earlierEntryNote.slice(0,3000);
  if (expectedMode === 'assessment' && value.starterRevision === 2) {
    if(clean.notes.conversion?.trim()){
      clean.earlierEntryNote=clean.notes.conversion;
      delete clean.notes.conversion;
    }
    // Only replace untouched, uniquely identifiable starter lines. Keep custom code and every historical run verbatim.
    const before = SIMPLIFIED_STARTER.trimEnd().split('\n');
    const after = LEGACY_STARTER.trimEnd().split('\n');
    const lines = clean.source.split('\n');
    before.forEach((line, i) => {
      const row = lines.indexOf(line);
      if (row >= 0 && lines.lastIndexOf(line) === row && (row === i || clean.source === SIMPLIFIED_STARTER)) lines[row] = after[i];
    });
    if (lines.join('\n') !== clean.source) { clean.source = lines.join('\n'); clean.revision++; }
  }
  for (const key of ['price','quantity']) if (typeof value.order?.[key] === 'string' && /^\d{0,8}$/.test(value.order[key])) clean.order[key] = value.order[key];
  if (expectedMode === 'assessment' && clean.source === LEGACY_STARTER && !clean.revision &&
      !clean.runs.length && !Object.keys(clean.notes).length && !Object.keys(clean.repairReplies).length) {
    clean.source = STARTER;
    clean.starterRevision = 4;
  }
  const {starter} = receiptFor(clean);
  clean.tasks = restoreTasks(value.tasks, clean.source, starter);
  clean.printer = restorePrinter(value.printer, clean.source, starter);
  if (clean.source !== value.source) {
    const migrated = restoreTasks(null, clean.source, starter);
    for (const id of Object.keys(migrated)) clean.tasks[id].range = migrated[id].range;
    clean.printer.range = printerState(clean.source, starter).range;
  }
  for (const station of ['indent','bracket','conversion','name','operator']) {
    const range = stationRange(clean,station);
    const state = range && restoreBackpack(station,value.backpacks?.[station],clean.source.slice(...range));
    if (state) clean.backpacks[station] = state;
  }
  return clean;
}
