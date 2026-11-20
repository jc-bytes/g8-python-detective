import { sentenceReminder, setupAnswerField } from './answer-field.js';
import { playSound, voiceHint } from './sound.js';
import { makeBackpack, fixedSection, inventory, colorCode } from './backpack.js';
import { ruleTopics, chapterExample, chapterIndex } from './rule-book.js';
import { speak, finishSpeech } from './speech.js';
import { TESTS, EXPLANATIONS, receiptFor, receiptLines, explanationsFor, withoutExtraLines, repairQuestionFor, repairLines, repairRow } from './case.js';
import { stationRange, tasks } from './shop-tasks.js';
import { keptRun, recordRun } from './model.js';

const stations = {
  indent: 'Order notice',
  bracket: 'Printer',
  conversion: 'Input terminal',
  name: 'Ledger',
  operator: 'Calculator',
};
const repairHints = {
  indent: 'The line under if needs to start four spaces in.',
  bracket: 'Each opening ( needs a closing ).',
  conversion: 'input() gives you text. Wrap it in int() to get a number.',
  name: 'The name on the print line needs to match the name on the calculator.',
  operator: 'Each notebook costs the same. Use the sign for multiplication.',
};
const bookClues = {
  indent: 'An indentation error! Indentation means the space at the start of a line. In the rule book, look where `print` starts under `if`.',
  bracket: 'A parenthesis is a curved mark, like `(`. In the rule book, look at the last mark on the `print` line.',
  conversion: 'Text and numbers are two types of data. In the rule book, what helps Python use the `age` you type as a number?',
  name: 'A variable is a name for a value. Find `shelf` on both lines in the rule book. Do the letters match?',
  operator: 'An operator is a math sign, like `+`. In the rule book, which sign goes between `hours` and `60`?',
};
export function hasReadStationClue(record, station) {
  return record.stationClueRead === station || (station === 'indent' && record.noticeBoardRead === true);
}
export function currentOrderRun(attempt) {
  const last=attempt.runs.at(-1);
  if(last?.source===attempt.source && typeof last.printed==='string' && last.price===attempt.order.price && last.quantity===attempt.order.quantity && /^\d{1,8}$/.test(last.price) && /^\d{1,8}$/.test(last.quantity)) return last;
}
export function stationHint(station, [target, clue]) {
  if (!stations[station] || !stations[target]) return '';
  return station === target ? 'Look at the code.' : clue;
}
export function studentDiagnostic(trace) {
  return trace.replace(/(NameError:[^\n]*)\. Did you mean: [^\n]+\?(?=\s*$)/, '$1');
}
function pythonDiagnostic(record) {
  const trace = record.error.trim();
  const frame = trace.lastIndexOf('File "student_order.py"');
  return studentDiagnostic(frame < 0 ? trace.split('\n').at(-1) : trace.slice(frame));
}

function repairEvidence(record, target) {
  if (record.backpackRetry) return;
  if (target === 'operator' && !record.error) {
    const lines = record.printed.trimEnd().split('\n');
    return {title:'Receipt', lines, row:0,
      clue:`It printed! But the total says ${lines[0].slice('Total: '.length)}. At ${record.price} each, ${record.price} × ${record.quantity} should be ${BigInt(record.price) * BigInt(record.quantity)}. Let’s check the calculator.`};
  }
  if (!record.error) return;
  const lines = pythonDiagnostic(record).split('\n');
  const frame = lines[0].match(/^File "student_order\.py", line (\d+)/);
  if (!frame) return;
  const sourceLine = record.source.split('\n')[Number(frame[1]) - 1]?.trim();
  if (!sourceLine) return;
  // Runtime errors can give just the line number. Show the line from this run's saved code.
  if (lines[1]?.trim() !== sourceLine) lines.splice(1, 0, '    ' + sourceLine);
  const receipt = receiptFor(record);
  let clue;
  switch (target) {
    case 'indent':
      clue = `Look, it says “${receipt.item.replace(/:$/, '')}.” I’ve seen this error on the order notice before. Let’s check there.`;
      break;
    case 'bracket':
      clue = `I put “${receipt.last}” at the end of my receipts. Let’s check the printer.`;
      break;
    case 'conversion':
      clue = `We typed ${record.quantity} for the quantity. Let’s see how the input terminal read it.`;
      break;
    case 'name': {
      const name = record.error.match(/NameError: name '([^']+)' is not defined/)?.[1];
      const missing = name ? `the name “${name}”` : 'a name on this line';
      clue = `Python can’t find ${missing}. Let’s look in the ledger. Does it use the same name the calculator used to save the total?`;
      break;
    }
    default: return;
  }
  return {title:'Python error', lines, row:1, clue};
}
const transfer = [TESTS[0], TESTS[2], TESTS[1]];
const id = (key) => document.getElementById(key);
export function judge(run, price, quantity) {
  if (Object.hasOwn(stations, run.backpackRetry)) return [run.backpackRetry, 'That spot didn’t work. Select Undo last move.'];
  const receipt = receiptFor(run);
  const error = run.error.trim().split('\n').at(-1);
  const printed = run.printed.trimEnd();
  const total = BigInt(price) * BigInt(quantity);
  if (error) {
    const frame = [...run.error.matchAll(/File "student_order\.py", line (\d+)/g)].at(-1);
    const stoppedLine = frame ? run.source.split('\n')[Number(frame[1]) - 1] || '' : '';

    if (
      error.startsWith('IndentationError') &&
      error.includes('if') &&
      stoppedLine.includes(receipt.item)
    )
      return [
        'indent',
        'Walk to the order notice.',
      ];
    if (error.includes('was never closed') && stoppedLine.includes(receipt.last))
      return [
        'bracket',
        'Walk to the printer.',
      ];
    if (error.startsWith('TypeError') && /str/.test(error) && /price.*quantity/.test(stoppedLine))
      return [
        'conversion',
        'Walk to the input terminal.',
      ];
    if (error.startsWith('NameError') && stoppedLine.includes('Total:'))
      return [
        'name',
        'Walk to the ledger.',
      ];
    return [
      null,
      'Open Python error to see which line stopped the order.',
    ];
  }
  const lines = printed.split('\n');
  if (/^Total: -?\d+$/.test(lines[0]) && lines[0] !== `Total: ${total}`)
    return [
      'operator',
      'Walk to the calculator.',
    ];
  if (lines[0] !== `Total: ${total}`)
    return [
      'name',
      'Walk to the ledger.',
    ];
  if (lines.includes(receipt.saleLine(quantity)) !== (total > 0n))
    return [
      'indent',
      'Walk to the order notice.',
    ];
  if (lines.at(-1) !== receipt.last)
    return [
      'bracket',
      'Walk to the printer.',
    ];
  const expected = receiptLines(receipt, total, quantity);
  if (printed !== expected.join('\n'))
    return [
      null,
      'Compare the lines and their order with the rule book. There is an extra or misplaced line.',
    ];
  return [
    'ok',
    `Yes! This receipt matches. ${total === 0n ? 'The empty order skipped the order notice.' : `The customer owes ${total}.`}`,
  ];
}
export function nextOrder(attempt) {
  return transfer.find((test) => {
    const run = keptRun(attempt, test.id);
    return (
      run?.source !== attempt.source ||
      typeof run.printed !== 'string' ||
      judge(run, test.price, test.quantity)[0] !== 'ok'
    );
  });
}
function isFinalOrder(test) {
  return test === transfer[1] || test === transfer[2];
}
export function pendingQuestion(attempt) {
  return explanationsFor(attempt).find(q => !attempt.notes[q.id]?.trim());
}
const clueGoals = {
  indent: [2, 'Check the order notice', 'Walk to the order notice.'],
  bracket: [3, 'Check the closing message', 'Look at the last line the printer should print.'],
  conversion: [4, 'Check the input terminal', 'Walk to the input terminal.'],
  name: [5, 'Check the ledger', 'Walk to the ledger.'],
  operator: [6, 'Check the calculator', 'Compare the printed total with the order.'],
};
function stationLineLimit(station) {
  return station === 'bracket' ? 1 : tasks.find(task => task.id === station)?.count;
}
function oversizedStation(attempt) {
  return Object.keys(stations).find(station => {
    const range = stationRange(attempt, station);
    return range && attempt.source.slice(...range).split('\n').length > stationLineLimit(station);
  });
}
export function investigationGoal(attempt, current, customer, question) {
  const initial = [1, 'Check what the printer shows', 'Enter 6 for Price and 3 for Quantity. Select Run order.'];
  const run = attempt.runs.at(-1);
  if (!run || typeof run.printed !== 'string' || !/^\d{1,8}$/.test(run.price) || !/^\d{1,8}$/.test(run.quantity)) return initial;
  const [target] = judge(run, run.price, run.quantity);
  const repair = current && confirmedRepair(attempt, run, target);
  if (repair && needsRepairReply(attempt, repair)) {
    return [clueGoals[repair][0], `Explain the ${stations[repair].toLowerCase()} repair`, 'Tell the owner why your change worked.'];
  }
  const oversized = oversizedStation(attempt);
  if (oversized) return [clueGoals[oversized][0], `Check the ${stations[oversized].toLowerCase()}`, 'Remove the extra lines in your saved code.'];
  if (current && target === 'name' && run.error.includes('NameError')) {
    if (run.nameComparison === 'calculator') return [5, 'Read the calculator', 'Find the name to the left of the equals sign.'];
    if (run.nameComparison === 'ledger') return [5, 'Compare the names', 'Check the spelling in the ledger.'];
  }
  if (target !== 'ok') {
    const [number,title,hint] = clueGoals[target] || [1,'Read the Python result','Check the reported line and try again.'];
    if (!current) return [number,title,'Run the order again to check your changes.'];
    return [number,title,hint];
  }
  if (customer===transfer[0]) return [1,initial[1],'Test the handwritten order with your current code.'];
  if (customer) return [customer===transfer[1]?7:8,customer===transfer[1]?'Test an order at the printer':'Print the empty order',customer===transfer[1]?'Check the total on the receipt.':'Check which messages print for zero items.'];
  if (question) return [9,'Explain your findings',question.id==='indent'?'Tell the owner what printed for zero items.':'Tell the owner how the till read the quantity.'];
  return [10,'Review your case folder','Check your receipts and replies before submitting.'];
}
function confirmedRepair(attempt, record, target) {
  const index = attempt.runs.indexOf(record);
  let previousIndex = index - 1;
  while (previousIndex >= 0 && attempt.runs[previousIndex].source === record.source) previousIndex--;
  const previous = attempt.runs[previousIndex];
  if (!previous || previous.price !== record.price || previous.quantity !== record.quantity || typeof previous.printed !== 'string') return;
  const [before] = judge(previous, previous.price, previous.quantity);
  const order = ['indent', 'bracket', 'conversion', 'name', 'operator', 'ok'];
  if (!order.includes(before) || order.indexOf(target) <= order.indexOf(before)) return;
  const repair = repairLines.find(item => item.id === before);
  const oldRow = repairRow(previous.source, repair);
  const newRow = repairRow(record.source, repair);
  if (previous.backpackRetry === before && record.station === before && newRow !== null) return before;
  if (oldRow === null || newRow === null) return;
  if (previous.source.split('\n')[oldRow] !== record.source.split('\n')[newRow]) return before;
}
function needsRepairReply(attempt, repair) {
  return repair === 'conversion' ? !attempt.notes.conversion?.trim() : !attempt.repairReplies[repair]?.sent;
}
// The floor uses the same evidence and outstanding replies as the objective.
export function requiredStation(attempt, current, customer, question) {
  const run = current || attempt.runs.at(-1);
  if (typeof run?.printed !== 'string' || !/^\d{1,8}$/.test(run.price) || !/^\d{1,8}$/.test(run.quantity)) return 'bracket';
  const [target] = judge(run, run.price, run.quantity);
  const repair = current && confirmedRepair(attempt, current, target);
  if (repair && needsRepairReply(attempt, repair)) return repair;
  const oversized = oversizedStation(attempt);
  if (oversized) return oversized;
  if (target === 'name' && run.nameComparison === 'calculator') return 'operator';
  if (target === 'ok') return customer || question ? 'bracket' : null;
  if (target) return target;
  if (Object.hasOwn(stations, run.station)) return run.station;
  const frame = [...run.error.matchAll(/File "student_order\.py", line (\d+)/g)].at(-1);
  if (frame && run.source === attempt.source) {
    const offset = run.source.split('\n').slice(0, Number(frame[1]) - 1).reduce((n,line) => n + line.length + 1, 0);
    for (const id of Object.keys(stations)) {
      const range = stationRange(attempt, id);
      if (range && range[0] <= offset && offset <= range[1]) return id;
    }
  }
  return 'bracket';
}
export function openOrder(
  station,
  opener,
  {
    getAttempt,
    canEdit,
    edit,
    save,
    refresh,
    openDialog,
    run,
    useBag,
    openBag,
    openFolder,
    paint,
    pointTo,
  },
) {
  const attempt = getAttempt();
  const last = currentOrderRun(attempt);
  if (station === 'operator' && last?.nameComparison && judge(last, last.price, last.quantity)[0] === 'name') {
    const range = stationRange(attempt, station);
    openDialog('Calculator', 'Customer order', `<div class="order-work"><section class="order-machine" aria-labelledby="calculation-title">
      <h3 id="calculation-title">${range ? 'Calculator code' : 'Order program'}</h3>
      <pre class="pack-code"><code id="calculator-source"></code></pre>
      <button class="primary" id="find-ledger" aria-describedby="calculator-source">Find the ledger</button>
    </section></div>`, opener);
    colorCode(id('calculator-source'), range ? last.source.slice(...range) : last.source);
    if (canEdit()) { last.nameComparison = 'ledger'; save(); }
    pointTo('name', undefined, station);
    useBag();
    const findLedger = id('find-ledger');
    findLedger.onclick = () => id('work-dialog').close();
    findLedger.focus();
    return;
  }
  const receipt = receiptFor(attempt);
  const shopBackdrop = '<canvas class="owner-backdrop" width="480" height="168" aria-hidden="true"></canvas>';
  const ownerPortrait = '<canvas class="owner-portrait" width="36" height="60" aria-hidden="true"></canvas>';
  openDialog(
    stations[station] || 'Shop counter',
    'Customer order',
    `<div class="order-work"><section class="print-attempt" hidden><div class="print-graphic" aria-hidden="true"><canvas width="46" height="34"></canvas><i></i></div><p role="status" tabindex="-1"></p><div id="printed-order" hidden>
      <section class="receipt-slip" aria-labelledby="receipt-title"><h3 id="receipt-title">Receipt</h3><pre id="receipt-output"></pre></section>
      <p id="receipt-message" hidden></p>
      <button class="primary" id="check-receipt" aria-describedby="receipt-output">Check the total</button>
    </div></section><section class="order-machine"><p class="order-slip"><strong>Handwritten receipt</strong> · 3 notebooks at 6 each = 18</p><strong id="station-label"></strong><small id="station-scope"></small><section id="order-code" tabindex="-1" aria-labelledby="station-label"></section><small id="repair-limit" role="status"></small><p id="machine-step" role="status" tabindex="-1"></p><form id="order-form"><label>Price<input id="order-price" inputmode="numeric" pattern="[0-9]{1,8}" maxlength="8" required></label><label>Quantity<input id="order-quantity" inputmode="numeric" pattern="[0-9]{1,8}" maxlength="8" required></label><button class="primary">Run order</button></form><div id="order-result" aria-live="polite"></div></section><aside class="order-owner owner-conversation">${shopBackdrop}${ownerPortrait}<div class="owner-card"><span class="owner-name">Store owner</span><strong class="repair-success" role="status"></strong><p id="order-dialogue" tabindex="-1" aria-live="polite" aria-atomic="true"></p><section class="python-screen" hidden aria-labelledby="python-screen-title"><h3 id="python-screen-title">Python error</h3><pre id="python-screen-text"></pre></section><pre id="owner-evidence" hidden></pre><section class="order-choices" aria-label="Your choices"><button id="reveal-line" type="button">Show full line</button><label id="order-reply" hidden><span id="reply-label">Your reply</span><small id="reply-hint">Answer in a complete sentence.</small><textarea rows="3" maxlength="3000" aria-labelledby="reply-label" aria-describedby="reply-hint"></textarea><span id="reply-feedback"></span></label><button id="order-next" hidden></button></section></div></aside></div>`,
    opener,
  );
  const editor = id('order-code'),
    form = id('order-form'),
    result = id('order-result'),
    dialogue = id('order-dialogue'),
    next = id('order-next'),
    reply = id('order-reply');
  const panel = dialogue.closest('.order-work');
  const speaker = panel.querySelector('.order-owner strong');
  const machineStep = id('machine-step');
  const evidence = id('owner-evidence');
  const errorScreen = panel.querySelector('.python-screen');
  const printStage = panel.querySelector('.print-attempt');
  const printStatus = printStage.querySelector('p');
  paint(printStage.querySelector('canvas'), 'printer');
  const feedback = id('reply-feedback');
  setupAnswerField(reply.querySelector('textarea'), feedback, false);
  id('reveal-line').onclick=()=>{finishSpeech(dialogue);id('work-dialog').focus({preventScroll:true});};
  paint(panel.querySelector('.order-owner .owner-portrait'), 'owner');
  paint(panel.querySelector('.order-owner .owner-backdrop'), 'shop');
  const range = station ? stationRange(attempt, station) : [0, attempt.source.length];
  const topic = ruleTopics[station];
  const needsChapter = topic && !attempt.printer.chaptersRead.includes(chapterIndex(topic));
  const [start, initialEnd] = range || [0, 0];
  let end = initialEnd, paused = false, busy = false;
  const readSection = () => attempt.source.slice(start,end);
  function canPlace() {
    if (!range || needsChapter || paused || busy || !canEdit()) return false;
    const run = attempt.runs.at(-1);
    if (tooManyLines(readSection())) return true;
    if (typeof run?.printed !== 'string' || !/^\d{1,8}$/.test(run.price) || !/^\d{1,8}$/.test(run.quantity)) return false;
    const [target] = judge(run,run.price,run.quantity);
    return target === station || (!target && requiredStation(attempt,currentOrderRun(attempt),nextOrder(attempt),pendingQuestion(attempt)) === station);
  }
  id('station-label').textContent = stations[station] + ' code';
  id('station-scope').textContent = !range ? 'Open the full program in your case folder to review this saved section.' : needsChapter ? `To edit this code, read “${topic}” in the rule book first.` : '';
  const nextCustomer=nextOrder(attempt);
  let requested=(!attempt.runs.length || !attempt.order.quantity || !attempt.order.price) ? nextCustomer : null;
  function updateOrderSlip() {
    const { price, quantity } = attempt.order;
    const slip=form.parentElement.querySelector('.order-slip');
    if(requested?.id===TESTS[0].id){slip.textContent='Handwritten receipt · 3 notebooks at 6 each = 18';return;}
    if(requested){slip.textContent=`Customer order · Price ${requested.price} · Quantity ${requested.quantity}`;return;}
    slip.textContent = price === '6' && quantity === '3' ? 'Handwritten receipt · 3 notebooks at 6 each = 18' : price && quantity ? `Customer order · Price ${price} · Quantity ${quantity}` : 'Enter a price and quantity.';

  }
  updateOrderSlip();
  function entryPrompt() {
    if (requested) return `Enter ${requested.price} for Price and ${requested.quantity} for Quantity. Then select Run order.`;
    return 'Check the price and quantity, then select Run order.';
  }
  function ownerView() {
    panel.classList.add('owner-question');
    id('dialog-title').textContent = 'Store owner';
    dialogue.focus({preventScroll:true});
  }
  function ownerQuestion(repair) {
    ownerView();
    speaker.textContent = `Yes! You fixed the ${stations[repair].toLowerCase()}.`;
    reply.querySelector('textarea').setAttribute('aria-describedby', 'order-dialogue reply-hint');
  }
  function clear() {
    panel.classList.remove('owner-question', 'printing', 'retry-placement');
    printStage.hidden = true;
    id('printed-order').hidden = true;
    printStatus.hidden = false;
    errorScreen.hidden = true;
    next.removeAttribute('aria-describedby');
    evidence.hidden = true;
    evidence.textContent = '';
    machineStep.textContent = canPlace() ? '' : entryPrompt();
    id('dialog-title').textContent = stations[station] || 'Shop counter';
    speaker.textContent = '';
    reply.querySelector('textarea').setAttribute('aria-describedby', 'reply-hint');
    pointTo(null);
    paused = false;
    updateCleanup();
    form.hidden = false;
    result.replaceChildren();
    next.hidden = true;
    reply.hidden = true;
    panel.querySelector('.printer-answers')?.remove();
    next.disabled = false;
    dialogue.textContent = '';
  }
  const lineLimit = stationLineLimit(station);
  const tooManyLines = value => lineLimit && value.split('\n').length > lineLimit;
  const oldLinesMessage = `This machine uses ${lineLimit} ${lineLimit === 1 ? 'line' : 'lines'}. Delete the extra lines in your saved code before you run it.`;
  function writeSection(text, backpack, restore = false) {
    if (!canPlace()) return false;
    const source = attempt.source.slice(0,start) + text + attempt.source.slice(end);
    if (!edit(source,{station,range:[start,start+text.length],backpack,restore})) return false;
    end = start + text.length;
    clear();
    machineStep.textContent = '';
    return true;
  }
  const hint = document.createElement('dialog');
  hint.className = 'owner-hint';
  hint.setAttribute('aria-labelledby', 'hint-speaker');
  hint.setAttribute('aria-describedby', 'hint-line');
  hint.innerHTML = `${shopBackdrop}
    <div class="owner-conversation">${ownerPortrait}
      <section class="owner-card"><span class="owner-name" id="hint-speaker">Store owner</span><p id="hint-line"></p>
      <details class="pack-example"><summary>Rule book example</summary><pre><code></code></pre></details>
      <button class="primary" type="button">Back to code</button> <button class="hint-inventory" type="button">Backpack</button></section></div>`;
  panel.append(hint);
  let stopVoice;
  function openHint() {
    if (!canPlace() || hint.open) return;
    paint(hint.querySelector('.owner-backdrop'), 'shop');
    paint(hint.querySelector('.owner-portrait'), 'owner');
    hint.querySelector('details').open = false;
    colorCode(hint.querySelector('code'), chapterExample(topic));
    const text = repairHints[station];
    const line = hint.querySelector('#hint-line');
    if (station === 'bracket') {
      line.classList.add('repair-rule');
      hint.querySelector('.pack-example code').classList.add('parenthesis-example');
    }
    hint.showModal();
    speak(line, text);
    stopVoice = voiceHint(text);
    hint.querySelector('button').focus({preventScroll:true});
  }
  hint.querySelector('button').onclick = () => hint.close();
  hint.querySelector('.hint-inventory').onclick = openBag;
  hint.onclose = () => {
    stopVoice?.();
    hint.querySelector('p').replaceChildren();
    panel.querySelector('.pack-hint').focus({preventScroll:true});
  };
  const pack = makeBackpack(editor,{station,attempt,read:readSection,saved:()=>attempt.backpacks[station],
    write:(text,state)=>writeSection(text,state,!state),allowed:canPlace,onHint:openHint});
  const cleanup = document.createElement('button');
  cleanup.type='button';cleanup.textContent='Remove extra lines';id('repair-limit').after(cleanup);
  const first = station === 'bracket' ? 6 : tasks.find(task=>task.id===station).first;
  function updateCleanup() {
    pack.render();
    const repairing = canPlace();
    form.querySelector('button').textContent = repairing ? 'Check code' : 'Run order';
    panel.classList.toggle('order-entry', station === 'bracket' && !repairing);
    cleanup.hidden = !canPlace() || !tooManyLines(readSection()) || withoutExtraLines(readSection(),first,lineLimit,receipt.starter)===null;
  }
  cleanup.onclick=()=>{const text=withoutExtraLines(readSection(),first,lineLimit,receipt.starter);if(text!==null)writeSection(text,null);};
  updateCleanup();
  useBag();
  for (const key of ['price', 'quantity']) {
    const input = id('order-' + key);
    input.value = attempt.order[key];
    input.oninput = () => {
      if (canEdit()) {
        attempt.order[key] = input.value;
        save();
        refresh();
        clear();
        updateOrderSlip();
      }
    };
  }
  function action(label, fn) {
    next.hidden = false;
    next.textContent = label;
    next.onclick = fn;
  }
  function returnToPrinter(test) {
    if (station === 'bracket' || !isFinalOrder(test)) return false;
    form.hidden = true;
    speak(dialogue, 'The till is ready. Meet me at the printer and we’ll check the last two receipts.');
    backToShop('bracket');
    return true;
  }
  function backToShop(destination, chapter, returnStation = station, bookClue = bookClues[returnStation]) {
    if (destination === 'book') {
      speak(dialogue, bookClue, {inlineCode:true});
      paused = true;
      form.hidden = true;
      updateCleanup();
    }
    ownerView();
    pointTo(destination, chapter, returnStation);
    action(`Find the ${destination === 'book' ? 'rule book' : stations[destination].toLowerCase()}`, () => id('work-dialog').close());
  }
  function needsReading(repairStation) {
    const topic = ruleTopics[repairStation];
    if (attempt.printer.chaptersRead.includes(chapterIndex(topic))) return false;
    backToShop('book', topic, station || repairStation, bookClues[repairStation]);
    return true;
  }
  function showPrintedReceipt(record, message, buttonLabel, onContinue) {
    panel.classList.add('printing');
    id('dialog-title').textContent = 'Printer';
    printStage.hidden = false;
    printStatus.hidden = true;
    id('receipt-message').textContent = message;
    id('receipt-message').hidden = !message;
    id('receipt-output').textContent = record.printed;
    id('printed-order').hidden = false;
    const button = id('check-receipt');
    button.textContent = buttonLabel;
    button.onclick = onContinue;
    button.focus({preventScroll:true});
  }
  function showEvidence(record, target, problem, alreadyRead) {
    function giveClue() {
      errorScreen.hidden = true;
      next.removeAttribute('aria-describedby');
      speak(dialogue, problem.clue);
      if (station === target) {
        ownerView();
        action('Look at the code', () => show(record));
      } else backToShop(target);
    }
    if (alreadyRead) {
      giveClue();
      return;
    }
    if (problem.title === 'Receipt') {
      showPrintedReceipt(record, '', 'Check the total', () => {
        if (!canEdit()) return;
        record.clueRead = target;
        save();
        show(record);
      });
      return;
    }
    let message = 'Look where Python stopped.';
    if (target === 'indent') message = 'Not again! Look at the error on the screen.';
    if (target === 'bracket') message = `Well, that’s a different error! It says to print “${receiptFor(record).last}”`;
    if (target === 'conversion') message = 'The till stopped here. It tried to add a number and some text.';
    if (target === 'name') message = 'Oh no, another error! How many more can there be? This time it stopped while printing the total.';
    evidenceScreen(problem, message, () => {
      if (!canEdit()) return;
      record.clueRead = target;
      save();
      giveClue();
    });
  }
  function evidenceScreen(problem, message, onContinue) {
    ownerView();
    speak(dialogue, message);
    finishSpeech(dialogue);
    id('python-screen-title').textContent = problem.title;
    const screenText = id('python-screen-text');
    screenText.replaceChildren();
    problem.lines.forEach((line, index) => {
      if (index) screenText.append('\n');
      let content = document.createTextNode(line);
      if (problem.code || (problem.title === 'Python error' && index === problem.row)) {
        content = document.createElement('code');
        colorCode(content, line);
      }
      if (index === problem.row) {
        const mark = document.createElement('mark');
        mark.append(content);
        screenText.append(mark);
      } else screenText.append(content);
    });
    errorScreen.hidden = false;
    action('Continue', onContinue);
    const key = document.createElement('kbd');
    key.textContent = 'Enter';
    key.setAttribute('aria-hidden', 'true');
    next.append(' ', key);
    next.setAttribute('aria-describedby', 'order-dialogue python-screen-title python-screen-text');
    next.focus({preventScroll:true});
  }
  function inspectStation(record, calculatorLine) {
    const title = stations[station];
    const source = readSection();
    const lines = source.split('\n');
    let row = repairRow(source, repairLines.find(item => item.id === station));
    if (row == null) {
      if (lines.length !== 1) return false;
      row = 0;
    }
    if (calculatorLine) {
      lines.unshift(calculatorLine);
      row++;
    }
    const messages = {
      indent: 'The order stopped on this line.',
      bracket: record.error ? 'The printer stopped on this line.' : 'Check the last line on the receipt.',
      conversion: 'This line reads how many notebooks you want.',
      name: calculatorLine ? 'Look at the name on each line.' : 'This line prints the total.',
      operator: 'This line works out the total on the receipt.',
    };
    function giveClue() {
      errorScreen.hidden = true;
      next.removeAttribute('aria-describedby');
      if (needsChapter) backToShop('book', topic);
      else {
        ownerView();
        speak(dialogue, bookClues[station], {inlineCode:true});
        action('Look at the code', () => show(record));
      }
    }
    if (hasReadStationClue(record, station)) {
      if (needsChapter) giveClue();
      return needsChapter;
    }
    panel.classList.add('printing', 'checking-station');
    printStage.hidden = false;
    printStage.classList.remove('stopped');
    paint(printStage.querySelector('canvas'), station === 'bracket' ? 'printer' : station);
    printStatus.textContent = `Checking the ${title.toLowerCase()}…`;
    printStatus.focus({preventScroll:true});
    setTimeout(() => {
      if (!panel.isConnected || !panel.closest('dialog')?.open || getAttempt() !== attempt) return;
      panel.classList.remove('printing', 'checking-station');
      printStage.hidden = true;
      paint(printStage.querySelector('canvas'), 'printer');
      evidenceScreen({title, lines, row, code:true}, messages[station], () => {
        if (!canEdit()) return;
        record.stationClueRead = station;
        record.clueRead = station;
        save();
        giveClue();
      });
    }, 850);
    return true;
  }
  function show(record) {
    clear();
    id('calculator-reference')?.remove();
    function output(title, text) {
      const isError = title === 'Python error';
      const block = document.createElement(isError ? 'details' : 'section'),
        h = document.createElement(isError ? 'summary' : 'strong'),
        pre = document.createElement('pre');
      h.textContent = title;
      pre.textContent = text;
      block.append(h, pre);
      result.append(block);
    }
    const [target, message] = judge(record, record.price, record.quantity);
    const repair = confirmedRepair(attempt, record, target);
    if (repair && needsRepairReply(attempt, repair) && (!station || station === repair)) {
      paused = true;
      updateCleanup();
      form.hidden = true;
      if (needsReading(repair)) return;
      ownerQuestion(repair);
      if (repair === 'conversion') ask(EXPLANATIONS.find(item => item.id === repair), record);
      else {
        const saved = attempt.repairReplies[repair] ??= {text: '', sent: false};
        if (!saved.text.trim()) saved.questionVersion = 3;
        const question = repairQuestionFor(repair, saved.questionVersion, receipt);
        speak(dialogue, question, {inlineCode: saved.questionVersion === 3});
        let choices;
        if (repair === 'bracket' && saved.questionVersion === 3) {
          const row = repairRow(record.source, repairLines.find(item => item.id === repair));
          if (row != null) {
            colorCode(evidence, record.source.split('\n')[row].trim());
            evidence.hidden = false;
          }
          choices = ['It ends the words inside the quotes.', 'It closes the ( after print.', 'It starts a new line of code.'];
        }
        collectReply(saved.text, text => { saved.text = text; }, text => {
          saved.text = text;
          saved.sent = true;
        }, record, choices);
      }
      finishSpeech(dialogue);
      dialogue.focus({preventScroll:true});
      return;
    }
    if (tooManyLines(readSection())) {
      if (needsChapter) {
        backToShop('book', topic);
      } else machineStep.textContent = oldLinesMessage;
      return;
    }
    if (record.backpackRetry === station) {
      panel.classList.add('retry-placement');
      machineStep.textContent = message;
      return;
    }
    const comparingNames = target === 'name' && record.error.includes('NameError');
    if (target === station && !comparingNames && inspectStation(record)) return;
    const alreadyRead = record.clueRead === target || (target === 'indent' && record.noticeErrorRead === true);
    if (!record.nameComparison && (target !== station || (record.station && !alreadyRead))) {
      const problem = repairEvidence(record, target);
      if (problem) {
        showEvidence(record, target, problem, alreadyRead);
        return;
      }
    }
    if (target === station && !comparingNames) {
      if (needsReading(station)) return;
      machineStep.textContent = '';
      return;
    }
    if (record.printed || !record.error) output('Printed receipt', record.printed || 'No receipt printed.');
    if (record.error) output('Python error', pythonDiagnostic(record));
    if (record.stderr) output('Python messages', record.stderr);
    if (comparingNames) {
      function guide(destination, prompt) {
        speak(dialogue, prompt);
        backToShop(destination);
      }
      if (station === 'name' && record.nameComparison === 'ledger') {
        const calculation = repairLines.find(item => item.id === 'operator');
        const calculationRow = repairRow(record.source, calculation);
        const calculatorLine = calculationRow == null ? '' : record.source.split('\n')[calculationRow];
        if (inspectStation(record, calculatorLine)) return;
        if (calculatorLine) {
          const reference = document.createElement('p');
          reference.id = 'calculator-reference';
          const code = document.createElement('code');
          code.textContent = calculatorLine;
          reference.append('Line you saw at the calculator', document.createElement('br'), code);
          id('station-label').before(reference);
        }
        if (needsReading('name')) return;
        result.replaceChildren();
        machineStep.textContent = '';
      } else if (station === 'name') {
        if (canEdit()) { record.nameComparison = 'calculator'; save(); refresh(); }
        const row = repairRow(record.source, repairLines.find(item => item.id === 'name'));
        if (row != null) { evidence.hidden = false; evidence.textContent = record.source.split('\n')[row]; }
        guide('operator', 'Let’s see how the calculator spells the name for the total.');
      } else if (record.nameComparison === 'calculator') {
        guide('operator', 'Let’s see how the calculator spells the name for the total.');
      } else {
        guide('name', 'Walk to the ledger.');
      }
      return;
    }
    if (target && target !== 'ok') {
      speak(dialogue, message);
      backToShop(target);
      return;
    }
    if (target !== 'ok') {
      if (!target) machineStep.textContent = message;
      return;
    }
    const test = nextOrder(attempt);
    if (returnToPrinter(test)) return;
    if (test) {
      showPrintedReceipt(record, message, 'Enter the next order', () => {
        requested=test;
        for (const key of ['price', 'quantity']) {
          attempt.order[key] = '';
          id('order-' + key).value = '';
        }
        save();
        refresh();
        clear();
        updateOrderSlip();
        id('order-price').focus();
      });
      return;
    }
    const question = pendingQuestion(attempt);
    if (question && !record.receiptRead && !attempt.tasks[question.id].replies.length && !attempt.tasks[question.id].draft) {
      showPrintedReceipt(record, message, 'Continue', () => {
        if (!canEdit()) return;
        record.receiptRead = true;
        save();
        show(record);
      });
      return;
    }
    ownerView();
    evidence.hidden = false;
    evidence.textContent = record.printed;
    if (!question) {
      evidence.hidden = true;
      speak(dialogue, `Thank you, Detective ${attempt.identity.firstName.trim()}. I can use my till again. Your repairs, receipts and replies are in your case folder.`);
      action('Review case folder', () => openFolder(opener));
      return;
    }
    ask(question,record);
  }
  function ask(question, record) {
    const task = attempt.tasks[question.id];
    const part = task.replies.length;
    const current = question.questions[part];
    if (current.example) {
      const sample = document.createElement('code');
      colorCode(sample, current.example);
      evidence.replaceChildren(sample);
    } else if (current.evidence === 'condition') {
      const lines = record.source.split('\n');
      const condition = lines.findIndex(line => /^\s*if\b/.test(line));
      const code = document.createElement('code');
      colorCode(code, condition < 0 ? record.source : lines.slice(condition).join('\n').trimEnd());
      evidence.replaceChildren(code);
    } else if (current.evidence === 'compare-receipts') {
      const previous = keptRun(attempt, transfer[1].id);
      if (previous?.printed) {
        evidence.textContent = `2 items\n${previous.printed.trimEnd()}\n\n0 items\n${record.printed.trimEnd()}`;
      }
    }
    if (needsReading(question.id)) return;
    speak(dialogue, current.prompt);
    collectReply(task.draft, text => { task.draft = text; }, answer => {
      if (part + 1 < question.questions.length) {
        task.replies.push(answer);
      } else {
        task.completedReplies = [...task.replies, answer];
        attempt.notes[question.id] = task.completedReplies.join('\n');
        task.replies = [];
      }
      task.draft = '';
    }, record, current.choices);
  }
  function stillOpen() {
    return panel.isConnected && panel.closest('dialog')?.open && getAttempt() === attempt;
  }
  function wait(ms) { return new Promise(resolve => setTimeout(resolve, ms)); }
  function startPrinting() {
    clear();
    panel.classList.add('printing');
    id('dialog-title').textContent = 'Printer';
    printStage.hidden = false;
    printStage.classList.remove('stopped');
    printStatus.textContent = 'Printing the order…';
    printStatus.focus({preventScroll:true});
  }
  function showPrinterStop() {
    printStage.classList.add('stopped');
    printStatus.textContent = 'The printer stopped.';
    return wait(850);
  }
  async function finishReply(record) {
    save();
    refresh();
    const [target] = judge(record, record.price, record.quantity);
    const repair = record.error && confirmedRepair(attempt, record, target);
    if (repair && !needsRepairReply(attempt, repair)) {
      busy = true;
      try {
        startPrinting();
        await wait(650);
        if (!stillOpen()) return;
        await showPrinterStop();
        if (!stillOpen()) return;
      } finally {
        busy = false;
      }
    }
    show(record);
  }
  function chooseAnswer(answers, draft, onDraft, onReply, record) {
    const group = document.createElement('div');
    group.className = 'printer-answers';
    group.setAttribute('role', 'radiogroup');
    group.setAttribute('aria-labelledby', 'order-dialogue');
    for (const answer of answers) {
      const label = document.createElement('label');
      const radio = document.createElement('input');
      radio.type = 'radio';
      radio.name = 'owner-answer';
      radio.value = answer;
      radio.checked = draft === answer;
      radio.onchange = () => {
        if (!canEdit()) return;
        draft = answer;
        onDraft(answer);
        save();
        next.disabled = false;
      };
      label.append(radio, answer);
      group.append(label);
    }
    next.before(group);
    action('Reply', () => {
      if (!canEdit() || !answers.includes(draft)) return;
      onReply(draft);
      finishReply(record);
    });
    next.disabled = !answers.includes(draft);
  }
  function collectReply(draft, onDraft, onReply, record, choices) {
    // Let students finish a written draft saved before this question had choices.
    if (choices && (!draft || choices.includes(draft))) {
      chooseAnswer(choices, draft, onDraft, onReply, record);
      return;
    }
    reply.hidden = false;
    const field = reply.querySelector('textarea');
    field.value = draft;
    feedback.textContent = '';
    let reviewed = false;
    field.oninput = () => {
      reviewed = false;
      next.textContent = 'Reply';
      if (canEdit()) { onDraft(field.value); save(); }
    };
    action('Reply', async () => {
      if (!canEdit() || !field.value.trim()) { field.focus(); return; }
      const reminder = sentenceReminder(field.value);
      if (reminder && !reviewed) {
        feedback.textContent = reminder;
        reviewed = true;
        next.textContent = 'Send as written';
        field.focus();
        return;
      }
      onReply(field.value.trim());
      await finishReply(record);
      if (!stillOpen()) return;
      if (!reply.hidden) field.focus(); else next.focus();
    });
  }
  if (last)
    show(last);
  else if (!returnToPrinter(nextCustomer) && !canPlace()) machineStep.textContent = entryPrompt();
  form.onsubmit = async (e) => {
    e.preventDefault();
    if (tooManyLines(readSection())) {
      id('repair-limit').textContent = oldLinesMessage;
      editor.focus();
      return;
    }
    if (busy || !canEdit() || returnToPrinter(nextOrder(attempt))) return;
    const { price, quantity } = attempt.order,
      source = attempt.source,
      revision = attempt.revision;
    if (![price, quantity].every((v) => /^\d{1,8}$/.test(v))) return;
    const backpack = attempt.backpacks[station];
    if (backpack?.moves.length && inventory(station, readSection(), backpack).length) {
      machineStep.textContent = 'Pick another piece from your backpack.';
      pack.focus();
      return;
    }
    const retryPlacement = backpack?.moves.length && !fixedSection(station, readSection());
    busy = true;
    const controls = [...form.elements];
    controls.forEach((el) => (el.disabled = true));
    startPrinting();
    const started = performance.now();
    try {
      const outcome = await run(source, [price, quantity]);
      if (getAttempt() !== attempt || !canEdit()) return;
      const test = TESTS.find((t) => t.price === price && t.quantity === quantity);
      const record = recordRun(attempt, outcome, source, revision, test?.id || 'custom');
      Object.assign(record, { price, quantity, printed: outcome.printed, station });
      if (retryPlacement) record.backpackRetry = station;
      if (test && (!isFinalOrder(test) || station === 'bracket') && judge(record, price, quantity)[0] === 'ok') {
        attempt.kept[test.id] = record.id;
        playSound('handle_coins');
      }
      save();
      refresh();
      if (!stillOpen()) return;
      await wait(Math.max(0, 650 - (performance.now() - started)));
      if (!stillOpen()) return;
      const [target] = judge(record, price, quantity);
      const repair = confirmedRepair(attempt, record, target);
      if (record.error && !(repair && needsRepairReply(attempt, repair))) {
        await showPrinterStop();
      }
      if (stillOpen()) {
        show(record);
        if (!panel.classList.contains('owner-question')) machineStep.focus({preventScroll:true});
      }
    } catch (err) {
      if (stillOpen()) { clear(); machineStep.textContent = err.message; }
    } finally {
      busy = false;
      if (editor.isConnected) updateCleanup();
      controls.forEach((el) => (el.disabled = false));
    }
  };
}
