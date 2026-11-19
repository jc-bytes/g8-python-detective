import { setupAnswerField } from './answer-field.js';
import { playSound, setupSoundToggle } from './sound.js';
import { paint } from './shop-art.js';
import { currentOrderRun, judge, stationHint, studentDiagnostic } from './task-scene.js';
import { setupPrinter } from './printer-scene.js';
import { CASE_VERSION, CASES, STARTER, TESTS, RULES, PRACTICE_SOURCE, TOOLBOX, EXPLANATIONS } from './case.js';
import { newAttempt, updateSource, insertCodePiece, placeEvidence, recordRun, keptRun, validateAttempt, fileStem } from './model.js';
import { PythonRunner } from './runtime.js';
import { exhibitPrint, downloadBlob, filingDate, caseDisposition, reportSections, submissionFiles } from './export.js';

const byId = id => document.getElementById(id);
setupSoundToggle(byId('sound-toggle'));
const dialog = byId('work-dialog');
const dialogBody = byId('dialog-body');
const storageKey = mode => `python-detective:${CASE_VERSION}:${mode}`;
let mode = 'assessment';
let damagedSave = null;
let noticeTimer;
let attempt = loadAttempt(mode);
let selection = null;
let running = false;
let conflict = false;
let undoHistory = [];
let exportedUrls = [];
let dialogOpener;
const runner = new PythonRunner(message => {
  const output = byId('task-result') || byId('printer-status') || byId(mode === 'practice' ? 'practice-output' : 'runtime-status');
  if (output) output.textContent = message;
});

const printer = setupPrinter({
  getAttempt: () => attempt, save, canEdit, edit: (source, range) => setSource(source, true, range), openDialog, openFolder: openSubmission,
  visit: () => {
    if (canEdit() && !attempt.inspected.includes('bracket')) {
      attempt.inspected.push('bracket');
      save(); refresh();
    }
  },
  run: async (candidate,inputs=[],probe) => {
    if (running) throw new Error('Another Python test is running.');
    running = true;
    updateRunButtons();
    try { return await runner.run(candidate, inputs,probe); }
    finally { running = false; updateRunButtons(); }
  }
});

function loadAttempt(currentMode) {
  let saved;
  try {
    saved = localStorage.getItem(storageKey(currentMode));
    if (saved) {
      const raw = JSON.parse(saved);
      const restored = validateAttempt(raw, currentMode);
      restored.saveId = raw.saveId;
      restored.updatedAt = raw.updatedAt;
      return restored;
    }
  } catch {
    if (saved) damagedSave = { mode: currentMode, raw: saved };
    queueMicrotask(() => announce('Saved work could not be read. It has not been overwritten. Download a backup or ask your teacher before starting again.'));
  }
  return newAttempt(currentMode);
}

function announce(message) {
  const notice = byId('notice');
  clearTimeout(noticeTimer);
  notice.textContent = message;
  noticeTimer = setTimeout(() => { notice.textContent = ''; }, 8000);
}

function canEdit() {
  if (damagedSave?.mode === mode) {
    announce('Recover the damaged saved case or restore a valid backup before editing. The original save has not been overwritten.');
    return false;
  }
  if (!conflict) return true;
  announce('Editing is paused because another tab saved this case. Back up this work and load the saved attempt.');
  return false;
}

function save() {
  if (conflict || damagedSave?.mode === mode) return;
  attempt.updatedAt = new Date().toISOString();
  attempt.saveId = crypto.randomUUID();
  try {
    localStorage.setItem(storageKey(mode), JSON.stringify(attempt));
    byId('save-status').textContent = `Saved on this browser · ${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
  } catch {
    announce('Local saving failed. Open Menu to download a progress backup.');
    byId('save-status').textContent = 'Not saved. Download a progress backup now.';
  }
}

function rememberSource() {
  undoHistory.push(attempt.source);
  if (undoHistory.length > 30) undoHistory.shift();
}

function setSource(source, remember = true, printerRange) {
  if (!canEdit()) return false;
  try {
    if (remember && source !== attempt.source) rememberSource();
    updateSource(attempt, source);
    if (printerRange) attempt.printer.range = printerRange;
    save();
    refresh();
    return true;
  } catch (error) {
    announce(error.message);
    return false;
  }
}

function statusFor(station) {
  if (attempt.inspected.includes(station.id)) return 'Clue collected';
  return 'Not collected';
}

let atMaterials = false;
let entered = false;
const settings = byId('settings');
function updateCaseMenu() {
  const inShop = entered && mode === 'assessment' && !atMaterials;
  byId('other-objects').hidden = !inShop || printer.needsWelcome();
  byId('menu-export').hidden = mode === 'practice' || printer.needsWelcome();
}
byId('game-menu').onclick = () => { updateCaseMenu(); settings.showModal(); };
byId('menu-close').onclick = () => settings.close();
byId('menu-export').onclick = () => { settings.close(); openSubmission(byId('game-menu')); };
byId('edit-identity').onclick = () => {
  settings.close(); entered = false; refresh(); byId('first-name').focus();
};
byId('identity-form').onsubmit = event => {
  event.preventDefault();
  if (!canEdit()) return;
  const first = byId('first-name');
  if (!first.value.trim()) { first.setCustomValidity('Enter your first name.'); first.reportValidity(); return; }
  attempt.identity.firstName = first.value.trim();
  playSound('door_open_1');
  entered = true;
  save(); refresh(); printer.walkToCounter();
};

function refresh() {
  byId('mode-label').textContent = mode === 'practice' ? 'Ungraded controls rehearsal' : 'Independent assessment · 40 points';
  if (mode === 'assessment' && !attempt.identity.firstName.trim()) entered = false;
  byId('arrival').hidden = entered;
  byId('edit-identity').hidden = !entered || mode === 'practice';
  byId('practice-panel').hidden = mode !== 'practice';
  byId('shop-scene').hidden = !entered || mode === 'practice' || atMaterials;
  updateCaseMenu();
  byId('existing-case').hidden = !entered || mode === 'practice' || !atMaterials;
  document.querySelector('.workspace').hidden = mode === 'practice';

  byId('practice-mode').hidden = !entered || mode === 'practice';
  byId('conflict').hidden = !conflict;
  byId('damaged-save').hidden = damagedSave?.mode !== mode;
  byId('first-name').value = attempt.identity.firstName;
  byId('last-name').value = attempt.identity.lastName;
  byId('group').value = attempt.identity.group;
  const blocked = conflict || damagedSave?.mode === mode;
  byId('detective-choices').disabled = blocked;
  for (const choice of byId('detective-choices').querySelectorAll('input')) choice.checked = choice.value === attempt.identity.character;
  for (const field of ['first-name', 'last-name', 'group']) byId(field).disabled = blocked;
  if (mode === 'practice') {
    if (document.activeElement !== byId('practice-code')) byId('practice-code').value = attempt.source;
    byId('practice-code').readOnly = blocked;
    if (!running) {
      const lastRun = attempt.runs.at(-1);
      byId('practice-output').textContent = lastRun ? `${lastRun.source === attempt.source ? '' : 'Earlier code version\n'}${[lastRun.stdout, lastRun.stderr, lastRun.error].filter(Boolean).join('\n') || 'No output'}` : 'Not run';
    }
    return;
  }
  printer.refresh();
  const caseList = byId('case-list');
  caseList.replaceChildren();
  for (const station of CASES) {
    const button = document.createElement('button');
    button.className = 'case-link';
    button.dataset.station = station.id;
    const number = document.createElement('span');
    number.textContent = station.tag;
    const body = document.createElement('span');
    body.textContent = station.title;
    const progress = document.createElement('small');
    progress.textContent = statusFor(station);
    body.append(progress);
    button.append(number, body);
    caseList.append(button);
  }
  const tray = byId('clue-tray');
  tray.replaceChildren();
  for (const station of CASES.filter(item => attempt.inspected.includes(item.id))) {
    const card = document.createElement('button');
    card.className = 'clue-card';
    card.dataset.clueCard = station.id;
    card.draggable = true;
    card.textContent = `${station.tag} · ${station.title}`;
    card.setAttribute('aria-pressed', String(selection?.kind === 'clue' && selection.id === station.id));
    if (selection?.kind === 'clue' && selection.id === station.id) card.classList.add('selected');
    tray.append(card);
  }
  const board = byId('board-slots');
  board.replaceChildren();
  for (const [index, station] of CASES.entries()) {
    const investigation = document.createElement('div');
    investigation.className = 'board-investigation';
    const slot = document.createElement('button');
    slot.className = 'board-slot';
    slot.dataset.caseSlot = station.id;
    const label = document.createElement('strong');
    label.textContent = `Investigation ${index + 1}`;
    const name = document.createElement('div');
    name.textContent = 'Your evidence connection';
    const card = CASES.find(item => item.id === attempt.evidence[station.id]);
    const attached = document.createElement('span');
    attached.textContent = card ? `${card.tag} · ${card.title}` : 'Place any clue here';
    if (card) slot.classList.add('occupied');
    slot.setAttribute('aria-label', `Investigation ${index + 1}. ${attached.textContent}`);
    slot.append(label, name, attached);
    investigation.append(slot);
    if (card) {
      const evidence = document.createElement('p');
      evidence.className = 'board-evidence';
      evidence.textContent = card.evidence;
      investigation.append(evidence);
    }
    const lineLabel = document.createElement('label');
    lineLabel.textContent = `Suspected line for investigation ${index + 1} (optional)`;
    const line = document.createElement('input');
    line.type = 'text';
    line.inputMode = 'numeric';
    line.maxLength = 5;
    line.value = attempt.connections[station.id]?.line || '';
    line.disabled = blocked;
    const reasonLabel = document.createElement('label');
    reasonLabel.textContent = `My suspicion for investigation ${index + 1} (optional)`;
    const reason = document.createElement('textarea');
    reason.setAttribute('aria-describedby', 'suspicion-hint');
    reason.rows = 2;
    reason.maxLength = 1000;
    reason.value = attempt.connections[station.id]?.reason || '';
    reason.disabled = blocked;
    const storeConnection = () => {
      if (!canEdit()) return;
      line.value = line.value.replace(/\D/g, '');
      attempt.connections[station.id] = { line: line.value, reason: reason.value };
      save();
    };
    line.addEventListener('input', storeConnection);
    reason.addEventListener('input', storeConnection);
    lineLabel.append(line);
    reasonLabel.append(reason);
    const feedback = document.createElement('small');
    feedback.id = `reason-feedback-${station.id}`;
    setupAnswerField(reason, feedback);
    investigation.append(lineLabel, reasonLabel, feedback);
    board.append(investigation);
  }
  const count = Object.keys(attempt.evidence).length;
  byId('evidence-count').textContent = `${count} / 5 cards attached`;
  byId('board-message').textContent = selection?.kind === 'clue' ? 'Clue selected. Select a board slot to attach it.' : attempt.inspected.length ? `${attempt.inspected.length} clues collected. ${count} cards attached. Select a tray card to place or move it.` : 'No evidence collected yet. Inspect an object in the room.';
  if (byId('desk-code') && document.activeElement !== byId('desk-code')) byId('desk-code').value = attempt.source;
  if (byId('desk-code')) byId('desk-code').readOnly = blocked;
  document.querySelectorAll('[data-explanation]').forEach(field => { field.readOnly = blocked; });
  if (byId('line-numbers')) byId('line-numbers').textContent = attempt.source.split('\n').map((line, index) => index + 1).join('\n');
  renderRuns();
}

function openDialog(title, eyebrow, content, opener) {
  printer.restoreBag();
  byId('dialog-kit')?.remove();
  selection = null;
  dialogOpener = opener || document.activeElement;
  byId('dialog-title').textContent = title;
  byId('dialog-eyebrow').textContent = eyebrow;
  dialogBody.innerHTML = content;
  if (!dialog.open) dialog.showModal();
  byId('dialog-close').focus();
  dialog.scrollTop = 0;
}

function openStation(caseId, opener) {
  const station = CASES.find(item => item.id === caseId);
  if (!station || mode !== 'assessment') return;
  if (caseId === 'bracket') return showShop();
  openDialog(station.title, `Case ${station.tag} / ${station.object}`, `
    <section class="evidence-note"><p class="eyebrow">Evidence found</p><h3 id="station-object"></h3><p id="station-evidence"></p><pre id="archive-program" class="output" hidden></pre><button id="collect-clue">Collect this clue</button></section>
    <p>What does this tell you about the program? Decide which line to investigate. An object may help with more than one problem.</p><p id="station-message" class="panel-status" aria-live="polite">Collect the card to move it onto your board. Your board notes are optional and not graded.</p><div class="station-bottom button-row"><button id="station-desk" class="primary">Open the complete program</button><button id="station-board">Return to the room and board</button></div>`, opener);
  const last=currentOrderRun(attempt);
  const hint=last && stationHint(caseId,judge(last,last.price,last.quantity));
  if(hint){
    const guidance=document.createElement('p');
    const speaker=document.createElement('strong');
    speaker.textContent='Store owner';
    guidance.append(speaker,document.createElement('br'),hint);
    byId('station-message').before(guidance);
  }
  byId('station-object').textContent = station.object;
  byId('station-evidence').textContent = station.evidence;
  if (station.program) {
    byId('archive-program').hidden = false;
    byId('archive-program').textContent = STARTER;
  }
  byId('collect-clue').addEventListener('click', () => {
    if (!canEdit()) return;
    if (!attempt.inspected.includes(caseId)) attempt.inspected.push(caseId);
    save(); refresh();
    byId('station-message').textContent = 'Clue collected. Your card is on the tray below the room.';
  });
  byId('station-desk').addEventListener('click', () => openDesk(dialogOpener));
  byId('station-board').addEventListener('click', () => dialog.close());
  refresh();
}

function selectPiece(token) {
  if (!TOOLBOX.includes(token)) return;
  selection = { kind: 'piece', token };
  document.querySelectorAll('[data-piece]').forEach(piece => {
    piece.classList.toggle('selected', piece.dataset.piece === token);
    piece.setAttribute('aria-pressed', String(piece.dataset.piece === token));
  });
  byId('toolbox-message').textContent = `${token === '    ' ? 'Four spaces' : token} selected. Choose a position or select text in the editor, then use Insert selected piece. You decide where it belongs.`;
}

function applySelectedPiece() {
  if (!canEdit()) return;
  if (selection?.kind !== 'piece') {
    byId('toolbox-message').textContent = 'Select a code piece first.';
    return;
  }
  try {
    const editor = byId('desk-code');
    if (editor.dataset.positionChosen !== 'true') {
      byId('toolbox-message').textContent = 'Choose a cursor position or select text in your program first. The toolbox will not choose a location for you.';
      return;
    }
    const cursor = editor.selectionStart + selection.token.length;
    const source = insertCodePiece(attempt.source, selection.token, editor.selectionStart, editor.selectionEnd);
    if (setSource(source)) {
      editor.value = source;
      editor.focus();
      editor.setSelectionRange(cursor, cursor);
      byId('toolbox-message').textContent = 'Piece inserted exactly where you chose. Run Python to investigate what changed. No repair was checked for you.';
    }
  } catch (error) {
    byId('toolbox-message').textContent = error.message;
  }
}

function undoEdit() {
  if (!canEdit()) return;
  const source = undoHistory.pop();
  if (source === undefined) { announce('No earlier code edit is available in this session.'); return; }
  setSource(source, false);
}

function openDesk(opener) {
  if (mode !== 'assessment') return;
  if(printer.needsWelcome()){if(dialog.open)dialog.close();showShop();printer.inviteToTalk();return;}
  openDialog('The repair desk', 'One program / Three real tests', `
    <div class="desk-grid"><section><label for="desk-code">Your complete Python program</label><p class="small">Find and repair five errors. Type your edits, or use the shared toolbox below. Nothing chooses the line or the repair for you. Tab inserts four spaces.</p><div class="editor-wrap"><pre class="line-numbers" id="line-numbers" aria-hidden="true"></pre><textarea id="desk-code" class="code-editor" rows="12" maxlength="20000" spellcheck="false" autocapitalize="off" autocomplete="off" wrap="off"></textarea></div><div class="button-row"><button id="desk-undo">Undo last code edit</button><button id="reset-case">Reset the program</button></div><section id="toolbox"><h3>Code pieces</h3><p>These are general Python pieces, not a list of answers. Select text to replace it, or choose a cursor position. Select a piece, then insert it. You may also drag a piece onto the editor to insert it at your last chosen cursor position.</p><div class="pieces" id="desk-pieces"></div><button id="insert-piece">Insert selected piece</button><p id="toolbox-message" class="panel-status" aria-live="polite">Choose where to edit. No code position is selected for you.</p></section><p class="small">Changing the code does not change an earlier run. Run your tests again when you finish editing.</p></section>
    <section><h3>Test an order</h3><p class="small">Run one order at a time. Does the printed total equal price × quantity? A positive total should print “Order recorded”. A zero total should skip that line. Every receipt should end with “Debug check complete”. If Python stops early, check the error and try again. Keep the result you want to report.</p><div class="test-buttons" id="test-buttons"></div><div class="button-row" style="margin-top:10px"><button id="stop-run">Stop run</button></div><p id="runtime-status" class="panel-status" aria-live="polite"></p><div id="run-history" aria-label="Actual run results"></div></section></div><section id="explanations"><h3>Your two explanations</h3><p class="small">Explain your decisions in complete sentences using your own words. These are the required written explanations. Board notes are optional.</p></section><div class="station-bottom button-row"><button id="desk-review" class="primary">Review submission files</button><button id="desk-return">Return to investigation</button></div>`, opener);
  byId('desk-code').value = attempt.source;
  byId('desk-code').readOnly = conflict;
  byId('desk-code').addEventListener('input', event => setSource(event.target.value));
  byId('desk-code').addEventListener('keydown', insertTab);
  byId('desk-code').addEventListener('scroll', event => { byId('line-numbers').scrollTop = event.target.scrollTop; });
  for (const eventName of ['select', 'pointerup', 'keyup', 'input']) {
    byId('desk-code').addEventListener(eventName, event => {
      if (document.activeElement === event.target) event.target.dataset.positionChosen = 'true';
    });
  }
  for (const token of TOOLBOX) {
    const piece = document.createElement('button');
    piece.className = 'piece';
    piece.draggable = true;
    piece.dataset.piece = token;
    piece.textContent = token === '    ' ? '4 spaces' : token;
    piece.setAttribute('aria-pressed', 'false');
    byId('desk-pieces').append(piece);
  }
  printer.useBag(selectPiece);
  byId('insert-piece').addEventListener('click', applySelectedPiece);
  for (const explanation of EXPLANATIONS) {
    const label = document.createElement('label');
    label.className = 'station-note';
    label.textContent = explanation.title;
    const field = document.createElement('textarea');
    field.id = `explanation-${explanation.id}`;
    field.dataset.explanation = explanation.id;
    field.maxLength = 9002;
    field.rows = 3;
    field.value = attempt.notes[explanation.id] || '';
    field.addEventListener('input', () => {
      if (!canEdit()) return;
      attempt.notes[explanation.id] = field.value;
      save();
    });
    label.append(field);
    const feedback = document.createElement('small');
    feedback.id = `explanation-feedback-${explanation.id}`;
    setupAnswerField(field, feedback);
    byId('explanations').append(label, feedback);
  }
  for (const test of TESTS) {
    const button = document.createElement('button');
    button.textContent = `Run ${test.price} / ${test.quantity}`;
    button.dataset.runTest = test.id;
    button.disabled = running || conflict;
    button.addEventListener('click', () => runTest(test));
    byId('test-buttons').append(button);
  }
  byId('stop-run').disabled = !running;
  byId('stop-run').addEventListener('click', () => runner.stop());
  byId('desk-undo').addEventListener('click', undoEdit);
  byId('reset-case').addEventListener('click', () => {
    if (!canEdit() || !confirm('Download a backup and restore the starter code? Your notes, evidence cards, and earlier runs will stay.')) return;
    backup();
    setSource(STARTER);
  });
  byId('desk-review').addEventListener('click', () => openSubmission(dialogOpener));
  byId('desk-return').addEventListener('click', () => dialog.close());
  refresh();
}

function insertTab(event) {
  if (event.key !== 'Tab' || event.shiftKey || event.target.readOnly) return;
  event.preventDefault();
  const editor = event.target;
  editor.setRangeText('    ', editor.selectionStart, editor.selectionEnd, 'end');
  editor.dispatchEvent(new Event('input', { bubbles: true }));
}

async function runTest(test) {
  if (running || !canEdit()) return;
  running = true;
  const source = attempt.source;
  const revision = attempt.revision;
  const activeAttempt = attempt;
  const inputs = test.id === 'practice' ? [] : [test.price, test.quantity];
  updateRunButtons();
  try {
    const result = await runner.run(source, inputs);
    if (attempt !== activeAttempt) return;
    const run = recordRun(attempt, result, source, revision, test.id);
    if(test.id!=='practice')Object.assign(run,{price:test.price,quantity:test.quantity,printed:result.printed});
    save();
    if (mode === 'practice') {
      byId('practice-output').textContent = [run.stdout, run.stderr, run.error].filter(Boolean).join('\n') || 'No output';
      byId('practice-feedback').textContent = run.error ? 'Python found an error. Read the message, edit the practice line, then try again.' : 'Your program ran. Keep the real result, then try the practice download.';
    } else if (byId('runtime-status')) byId('runtime-status').textContent = 'Run finished. Inspect the output and choose whether to keep it. No grade has been assigned.';
    refresh();
  } catch (error) {
    announce(error.message);
    const output = byId(mode === 'practice' ? 'practice-output' : 'runtime-status');
    if (output) output.textContent = error.message;
  } finally {
    running = false;
    updateRunButtons();
  }
}

function updateRunButtons() {
  document.querySelectorAll('[data-run-test], #practice-run').forEach(button => { button.disabled = running || conflict; });
  for (const id of ['stop-run', 'practice-stop']) if (byId(id)) byId(id).disabled = !running;
}

function renderRuns() {
  const history = byId('run-history');
  if (!history) return;
  const focusedRun = document.activeElement?.dataset.keepRun;
  history.replaceChildren();
  if (!attempt.runs.length) {
    const empty = document.createElement('p');
    empty.className = 'small'; empty.textContent = 'No actual runs yet. Choose an order above.';
    history.append(empty);
  }
  for (const run of [...attempt.runs].reverse()) {
    const card = document.createElement('article'); card.className = 'run-card';
    const test = TESTS.find(item => item.id === run.testId);
    const heading = document.createElement('h4');
    heading.textContent = test ? `Price ${test.price} / Quantity ${test.quantity}` : run.testId==='custom'?`Price ${run.price} / Quantity ${run.quantity}`:'Practice';
    const version = document.createElement('p');
    version.className = run.source === attempt.source ? 'current-version' : 'old-version';
    version.textContent = run.source === attempt.source ? 'Recorded using your current code' : 'Earlier code version. Rerun after your edits.';
    const output = document.createElement('pre'); output.className = 'output';
    output.textContent = [run.printed ?? run.stdout, run.stderr, studentDiagnostic(run.error)].filter(Boolean).join('\n') || 'No output';
    const keep = document.createElement('button');
    keep.textContent = attempt.kept[run.testId] === run.id ? 'Result kept for report' : 'Keep this actual result';
    keep.dataset.keepRun = run.id;
    keep.disabled = conflict;
    keep.addEventListener('click', () => {
      if (!canEdit()) return;
      attempt.kept[run.testId] = run.id;
      save(); printer.refresh(); renderRuns();
    });
    card.append(heading, version, output);
    if(run.testId!=='custom')card.append(keep);
    history.append(card);
  }
  if (focusedRun) [...history.querySelectorAll('[data-keep-run]')].find(button => button.dataset.keepRun === focusedRun)?.focus();
}

function openSubmission(opener) {
  const filedAt = new Date();
  openDialog('Case folder', 'Shop investigations', `<article class="case-report"><div class="case-paper"><header><div class="file-mast"><span>SHOP INVESTIGATIONS</span><span>FILE № 001</span></div><h3>The Broken Order</h3><dl class="file-fields"><div><dt>Investigating detective</dt><dd id="case-byline"></dd></div><div><dt>Location</dt><dd>Shop counter</dd></div><div><dt>Disposition</dt><dd id="case-status"></dd></div></dl><p class="file-date">Filed ${filingDate(filedAt)}</p></header><div id="report-sections"></div></div><div class="report-actions"><button id="download-submission" class="primary">Download report and till code</button><button id="report-edit">Examine the till</button><button id="submission-return">Back to the shop</button></div><p id="export-status" role="status"></p><div id="submission-links" class="submission-links"></div><details><summary>View PDF pages</summary><section class="file-reader" aria-label="Case report pages"><nav aria-label="Report pages"><button class="previous" disabled>Previous page</button><span role="status">Opening case file…</span><button class="next" disabled>Next page</button></nav><canvas aria-hidden="true"></canvas></section></details></article>`, opener);
  const reader = dialog.querySelector('.file-reader');
  const files = submissionFiles(attempt, filedAt);
  Promise.all([files, import('./report-view.js')]).then(([pair, view]) => {
    if (reader.isConnected && dialog.open) return view.showPages(reader, pair.report);
  }).catch(() => { reader.querySelector('[role=status]').textContent = 'The PDF preview could not open. The case file is shown above.'; });
  byId('case-byline').textContent = [attempt.identity.firstName, attempt.identity.lastName, attempt.identity.group].filter(Boolean).join(' ');
  byId('case-status').textContent = caseDisposition(attempt);
  byId('report-edit').onclick = () => openDesk(opener);
  for (const {title, entries} of reportSections(attempt)) {
    const lead = title === 'Statement of the store owner' || title === 'Detective’s findings' || title === 'Student answers';
    const section = document.createElement(lead ? 'section' : 'details');
    const summary = document.createElement(lead ? 'h4' : 'summary');
    if (title.startsWith('Exhibit 01')) section.open = true;
    summary.textContent = title;
    section.append(summary);
    for (const exhibit of entries) {
      const {kind,value} = exhibit;
      if (kind === 'exhibit') {
        const figure = document.createElement('figure');
        figure.className = 'file-exhibit';
        const image = document.createElement('img');
        image.src = exhibitPrint(exhibit.subject);
        image.alt = '';
        const caption = document.createElement('figcaption');
        const add = (tag,text) => {
          const part = document.createElement(tag);
          part.textContent = text;
          caption.append(part);
        };
        add('h5',value);
        if (exhibit.detail) {
          add('p',exhibit.detail);
          if (exhibit.error) { add('pre',exhibit.sample); add('pre',exhibit.error); }
        }
        if (exhibit.original !== undefined) {
          if (!exhibit.error) { add('strong','Recovered line'); add('pre',exhibit.original); }
          if (exhibit.revised === null) add('p','See the full till listing in Exhibit 02.');
          else { add('strong','Line now in the till'); add('pre',exhibit.revised); }
        }
        figure.append(image,caption);
        section.append(figure);
        continue;
      }
      if (kind === 'answer') {
        const card = document.createElement('div');
        card.className = 'file-answer';
        if (exhibit.prompt) {
          const prompt = document.createElement('strong');
          prompt.textContent = exhibit.prompt;
          card.append(prompt);
        }
        const author = document.createElement('b');
        author.textContent = exhibit.author;
        const written = document.createElement('p');
        written.textContent = value;
        card.append(author, written);
        section.append(card);
        continue;
      }
      const line = document.createElement(kind === 'code' ? 'pre' : kind === 'label' ? 'strong' : kind === 'quote' ? 'blockquote' : 'p');
      line.textContent = value;
      section.append(line);
    }
    byId('report-sections').append(section);
  }
  byId('download-submission').addEventListener('click', () => exportFiles(true, files));
  byId('submission-return').addEventListener('click', () => dialog.close());
}

async function exportFiles(showLinks = false, preparedFiles) {
  const button = byId(showLinks ? 'download-submission' : 'practice-export');
  const status = byId(showLinks ? 'export-status' : 'practice-feedback');
  button.disabled = true;
  status.textContent = 'Preparing a Python file and PDF report from one snapshot…';
  try {
    const files = await (preparedFiles || submissionFiles(attempt));
    if (showLinks && byId('submission-links')) {
      exportedUrls.forEach(url => URL.revokeObjectURL(url));
      exportedUrls = [];
      byId('submission-links').replaceChildren();
      for (const [blob, extension, title] of [[files.python, 'py', 'Download Python program'], [files.report, 'pdf', 'Download PDF case report']]) {
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        exportedUrls.push(link.href);
        link.download = `${files.stem}.${extension}`;
        link.textContent = title;
        byId('submission-links').append(link);
      }
    }
    downloadBlob(files.python, `${files.stem}.py`);
    downloadBlob(files.report, `${files.stem}.pdf`);
    status.textContent = 'Both downloads requested. Your case report and till code are ready.';
  } catch (error) {
    status.textContent = `Export failed: ${error.message}. Your work is still here. Download a progress backup before closing.`;
  } finally {
    button.disabled = false;
  }
}

function backup() {
  downloadBlob(new Blob([JSON.stringify(attempt, null, 2)], { type: 'application/json' }), `${mode}_${fileStem(attempt)}_backup.json`);
}

function switchMode(nextMode) {
  if (running) { announce('Stop the current run before switching between practice and assessment.'); return; }
  if (conflict) { announce('Resolve the other-tab warning before switching modes.'); return; }
  if (damagedSave?.mode === mode) { announce('Recover the damaged saved case before switching modes.'); return; }
  save();
  const player = structuredClone(attempt.identity);
  mode = nextMode;
  attempt = loadAttempt(mode);
  if (mode === 'practice') attempt.identity = player;
  selection = null;
  undoHistory = [];
  announce(mode === 'practice' ? 'Practice is ungraded and saved separately. Your assessed work has not changed.' : 'You are back in your assessed case. Practice answers were not copied here.');
  refresh();
  if (mode === 'practice') byId('practice-code').focus();
  else if (entered) printer.walkToCounter();
  else byId('first-name').focus();
}

document.addEventListener('click', event => {
  const stationButton = event.target.closest('[data-station]');
  if (stationButton) openStation(stationButton.dataset.station, stationButton);
  const piece = event.target.closest('[data-piece]');
  if (piece) selectPiece(piece.dataset.piece);
  const clue = event.target.closest('[data-clue-card]');
  if (clue) {
    selection = { kind: 'clue', id: clue.dataset.clueCard };
    byId('board-message').textContent = 'Clue selected. Select a board slot to attach it. Select an occupied slot without a selected clue to return its card.';
    refresh();
    [...byId('clue-tray').children].find(button => button.dataset.clueCard === selection.id)?.focus();
  }
  const slot = event.target.closest('[data-case-slot]');
  if (slot) attachClue(slot.dataset.caseSlot);
});

function attachClue(destination) {
  if (!canEdit()) return;
  if (selection?.kind !== 'clue') {
    if (attempt.evidence[destination]) {
      delete attempt.evidence[destination];
      save(); refresh();
      byId('board-message').textContent = 'Card returned to the tray. Your code and notes have not changed.';
    } else byId('board-message').textContent = 'Collect and select a clue card first.';
    return;
  }
  if (!attempt.inspected.includes(selection.id)) return;
  placeEvidence(attempt, selection.id, destination);
  selection = null;
  save(); refresh();
  byId('board-message').textContent = 'Evidence attached. This records your choice, not a correct answer.';
  byId('board-slots').querySelector(`[data-case-slot="${destination}"]`)?.focus();
}

document.addEventListener('dragstart', event => {
  const piece = event.target.closest('[data-piece]');
  const clue = event.target.closest('[data-clue-card]');
  if (piece) { selectPiece(piece.dataset.piece); event.dataTransfer.setData('text/plain', JSON.stringify(selection)); }
  else if (clue) event.dataTransfer.setData('text/plain', JSON.stringify({ kind: 'clue', id: clue.dataset.clueCard }));
  else if (event.target.id === 'practice-piece') event.dataTransfer.setData('text/plain', JSON.stringify({ kind: 'practice' }));
});
document.addEventListener('dragover', event => {
  const target = event.target.closest('[data-case-slot], #desk-code, #practice-target');
  if (target) { event.preventDefault(); target.classList.add('drag-over'); }
});
document.addEventListener('dragleave', event => event.target.closest('[data-case-slot], #desk-code, #practice-target')?.classList.remove('drag-over'));
document.addEventListener('drop', event => {
  const target = event.target.closest('[data-case-slot], #desk-code, #practice-target');
  if (!target) return;
  event.preventDefault();
  target.classList.remove('drag-over');
  try {
    const text = event.dataTransfer.getData('text/plain');
    if (text.length > 500) return;
    const payload = JSON.parse(text);
    if (target.dataset.caseSlot && payload.kind === 'clue') { selection = payload; attachClue(target.dataset.caseSlot); }
    if (target.id === 'desk-code' && payload.kind === 'piece' && TOOLBOX.includes(payload.token)) { selection = payload; applySelectedPiece(); }
    if (target.id === 'practice-target' && payload.kind === 'practice') fixPractice();
  } catch { announce('That item could not be placed. Select a piece or clue, then select its destination.'); }
});

function showShop() {
  atMaterials = false;
  refresh();
  printer.walkToCounter();
}
byId('back-shop').onclick = showShop;
byId('other-objects').onclick = () => { settings.close(); atMaterials = true; refresh(); byId('back-shop').focus(); };
for (const button of document.querySelectorAll('[data-info]')) {
  button.onclick = () => openDialog(button.textContent.trim().slice(1).trim(), 'Case materials', byId(button.dataset.info).innerHTML, button);
}
byId('dialog-close').addEventListener('click', () => dialog.close());
dialog.addEventListener('close', () => { if(dialog.open)return; printer.restoreBag(); selection = null; dialogOpener?.focus({ preventScroll: true }); });
byId('desk-open').addEventListener('click', event => openDesk(event.currentTarget));
byId('submit-open').addEventListener('click', event => openSubmission(event.currentTarget));
byId('help-open').addEventListener('click', event => { settings.close(); openDialog('How to investigate', 'Your mission', `<ol><li>Ask the owner what happened. Walk along the counter with him. You can use the Python rule book when you investigate.</li><li>Enter the customer’s price and quantity and select Run order. Read the receipt or the Python error.</li><li>Choose an object that fits the evidence, inspect its code, and try the same order again. Walk to the book stand to read the Python rule book. You can use your detective bag at any station.</li><li>Try all three customer orders and reply to the owner’s two questions. Your matching receipts and replies go into the case report.</li><li>Open the case folder to download your program and PDF report for Google Classroom.</li></ol><p>Python can stop at its first error, so one run may not reveal all five bugs. Placing a card or code piece does not check an answer.</p><p>Need to learn the controls? Close this panel and select <strong>Practice the controls</strong>. That example is ungraded and separate.</p>`, byId('game-menu')); });

for (const choice of document.querySelectorAll('#detective-choices input')) {
  paint(choice.nextElementSibling, 'detective', 'right', null, choice.value);
  choice.onchange = () => {
    if (!canEdit()) return;
    attempt.identity.character = choice.value;
    save();
  };
}
for (const [id, field] of [['first-name', 'firstName'], ['last-name', 'lastName'], ['group', 'group']]) {
  byId(id).addEventListener('input', event => {
    if (!canEdit()) return;
    event.target.setCustomValidity('');
    attempt.identity[field] = event.target.value;
    save();
  });
}
byId('backup').addEventListener('click', backup);
byId('restore').addEventListener('change', async event => {
  const file = event.target.files[0];
  event.target.value = '';
  if (!file || running || conflict) return;
  try {
    if (file.size > 25000000) throw new Error('This backup is too large. Choose a case backup below 25 MB.');
    const restored = validateAttempt(JSON.parse(await file.text()), mode);
    if (!confirm('Replace this attempt with the backup? Download a backup of your current work first if you need to keep it.')) return;
    if (damagedSave?.mode === mode) downloadBlob(new Blob([damagedSave.raw], { type: 'application/json' }), 'damaged_python_detective_save.json');
    else backup();
    damagedSave = null;
    settings.close();
    attempt = restored;
    undoHistory = [];
    save(); refresh();
    announce('Backup restored. Inspect the code, explanations, and run records before continuing.');
  } catch (error) { announce(`Restore failed: ${error.message}`); }
});
byId('clear-data').addEventListener('click', () => {
  if (running || !canEdit() || !confirm('Clear both practice and assessment work from this device? Back up any work you need first. This cannot be undone.')) return;
  try {
    localStorage.removeItem(storageKey('practice'));
    localStorage.removeItem(storageKey('assessment'));
  } catch { announce('Browser storage could not be cleared. Ask your teacher before leaving a shared device.'); return; }
  mode = 'assessment'; entered = false; atMaterials = false; settings.close();
  attempt = newAttempt(mode);
  undoHistory = [];
  runner.stop();
  byId('save-status').textContent = 'Local work cleared. New changes will be saved.';
  if (dialog.open) dialog.close();
  dialogBody.replaceChildren();
  exportedUrls.forEach(url => URL.revokeObjectURL(url));
  exportedUrls = [];
  byId('practice-feedback').textContent = '';
  refresh();
  announce('Practice and assessment work were cleared from this browser. Delete downloaded student files too before leaving a shared device.');
});
byId('recover-damaged').addEventListener('click', () => {
  if (!damagedSave || !confirm('Download the damaged save, then start a new attempt? Keep the download in case your teacher can recover it.')) return;
  downloadBlob(new Blob([damagedSave.raw], { type: 'application/json' }), 'damaged_python_detective_save.json');
  damagedSave = null;
  attempt = newAttempt(mode);
  undoHistory = [];
  if (dialog.open) dialog.close();
  save(); refresh();
  announce('A new attempt is ready. Keep the damaged-save download until you know whether its work can be recovered.');
});
window.addEventListener('storage', event => {
  if (event.key !== storageKey(mode)) return;
  conflict = true;
  refresh(); updateRunButtons();
});
byId('load-other').addEventListener('click', () => {
  runner.stop();
  backup();
  attempt = loadAttempt(mode);
  conflict = false;
  undoHistory = [];
  if (dialog.open) dialog.close();
  refresh();
  announce('Loaded the other tab\'s saved work. Your previous in-memory attempt was offered as a backup download.');
});
window.addEventListener('beforeunload', event => {
  if (running || conflict || byId('save-status').textContent.startsWith('Not saved')) { event.preventDefault(); event.returnValue = ''; }
});

byId('practice-mode').addEventListener('click', () => { settings.close(); switchMode('practice'); });
byId('assessment-mode').addEventListener('click', () => switchMode('assessment'));
let practicePieceSelected = false;
byId('practice-piece').addEventListener('click', () => {
  practicePieceSelected = true;
  byId('practice-piece').classList.add('selected');
  byId('practice-feedback').textContent = 'Word selected. Place it on the practice sign.';
});
function fixPractice() {
  if (!canEdit()) return;
  if (!attempt.source.includes('The shop is quiet')) {
    byId('practice-feedback').textContent = 'You can edit the sign directly in the practice program.';
    return;
  }
  setSource(attempt.source.replace('The shop is quiet', 'The shop is open'));
  byId('practice-feedback').textContent = 'Run the program to read your sign.';
}
byId('practice-target').addEventListener('click', () => {
  if (practicePieceSelected) fixPractice();
  else byId('practice-feedback').textContent = 'Select the word first, then place it on the sign.';
});
byId('practice-code').addEventListener('input', event => setSource(event.target.value));
byId('practice-code').addEventListener('keydown', insertTab);
byId('practice-run').addEventListener('click', () => runTest({ id: 'practice' }));
byId('practice-stop').addEventListener('click', () => runner.stop());
byId('practice-keep').addEventListener('click', () => {
  if (!canEdit()) return;
  const run = attempt.runs.at(-1);
  if (!run) { byId('practice-feedback').textContent = 'Run your practice program first.'; return; }
  attempt.kept.practice = run.id;
  save();
  byId('practice-feedback').textContent = 'Practice result kept. It belongs only to the ungraded practice.';
});
byId('practice-export').addEventListener('click', () => exportFiles(false));

RULES.forEach(rule => { const item = document.createElement('li'); item.textContent = rule; byId('rules-list').append(item); });
refresh();
updateRunButtons();
byId('save-status').textContent = attempt.saveId ? 'Restored saved work on this browser' : 'New local attempt. Changes will be saved here.';

if ('serviceWorker' in navigator && location.protocol !== 'file:') {
  navigator.serviceWorker.register('./sw.js').then(async registration => {
    const ready = await navigator.serviceWorker.ready;
    if (!ready.active) return;
    const updateOffline = () => { byId('offline-status').textContent = 'Offline files cached on this browser.'; };
    if (registration.active) updateOffline();
    else navigator.serviceWorker.addEventListener('controllerchange', updateOffline, { once: true });
  }).catch(() => { byId('offline-status').textContent = 'Offline cache unavailable. Keep a progress backup.'; });
} else byId('offline-status').textContent = 'Open through a web server. Offline cache unavailable here.';
