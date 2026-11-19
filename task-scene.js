import { sentenceReminder, setupAnswerField } from './answer-field.js';
import { playSound } from './sound.js';
import { ruleTopics, chapterIndex } from './rule-book.js';
import { speak, finishSpeech } from './speech.js';
import { TESTS, EXPLANATIONS, repairQuestions, repairLines, repairRow } from './case.js';
import { keptRun, recordRun } from './model.js';

const stations = {
  indent: 'Order notice',
  bracket: 'Printer',
  conversion: 'Input terminal',
  name: 'Ledger',
  operator: 'Calculator',
};
const inspectionQuestions = {
  indent: 'When should this notice appear?',
  bracket: 'How does the printer know where its instruction ends?',
  conversion: 'What does Python get when you type a quantity?',
  name: 'Look at the line that prints the total. Does the name it uses match the name from the calculation?',
  operator: 'Look at the calculation. Would it give the right total for this many items at this price?',
};
export function currentOrderRun(attempt) {
  const last=attempt.runs.at(-1);
  if(last?.source===attempt.source && typeof last.printed==='string' && last.price===attempt.order.price && last.quantity===attempt.order.quantity && /^\d{1,8}$/.test(last.price) && /^\d{1,8}$/.test(last.quantity)) return last;
}
export function stationHint(station, [target, clue]) {
  if (!stations[station] || !stations[target]) return '';
  const question = station === target
    ? `${inspectionQuestions[station]} Read “${ruleTopics[station]}” in the rule book and compare its example with your code.`
    : clue;
  return `You’re at the ${stations[station].toLowerCase()}. ${question}`;
}
export function studentDiagnostic(trace) {
  return trace.replace(/(NameError:[^\n]*)\. Did you mean: [^\n]+\?(?=\s*$)/, '$1');
}
const transfer = [TESTS[0], TESTS[2], TESTS[1]];
const id = (key) => document.getElementById(key);
export function judge(run, price, quantity) {
  const error = run.error.trim().split('\n').at(-1);
  const printed = run.printed.trimEnd();
  const total = BigInt(price) * BigInt(quantity);
  if (error) {
    const frame = [...run.error.matchAll(/File "student_order\.py", line (\d+)/g)].at(-1);
    const stoppedLine = frame ? run.source.split('\n')[Number(frame[1]) - 1] || '' : '';

    if (
      error.startsWith('IndentationError') &&
      error.includes('if') &&
      stoppedLine.includes('Order recorded')
    )
      return [
        'indent',
        'The line in the error says “Order recorded”. Shall we look at the order notice?',
      ];
    if (error.includes('was never closed') && stoppedLine.includes('Debug check complete'))
      return [
        'bracket',
        'Python points to the closing message. Shall we check the printer?',
      ];
    if (error.startsWith('TypeError') && /str/.test(error) && /price.*quantity/.test(stoppedLine))
      return [
        'conversion',
        error.includes("'int'") && error.includes("'str'")
          ? 'Python sees a number and some text. Could one entry have come in as text? Let’s check the input terminal.'
          : 'Python mentions text in the calculation. How did the input terminal read our entries?',
      ];
    if (error.startsWith('NameError') && stoppedLine.includes('Total:'))
      return [
        'name',
        'The till can’t find the name it uses for the total. Which name does the ledger use?',
      ];
    return [
      null,
      'Python stopped at the error shown here. Check the line it mentions and run this order again.',
    ];
  }
  const lines = printed.split('\n');
  if (/^Total: -?\d+$/.test(lines[0]) && lines[0] !== `Total: ${total}`)
    return [
      'operator',
      `The receipt says “${lines[0]}”. Does that fit ${quantity} items at ${price} each? How did the calculator get that total?`,
    ];
  if (lines[0] !== `Total: ${total}`)
    return [
      'name',
      'Can you find the total on this receipt? Let’s check how the ledger labels it.',
    ];
  if (lines.includes('Order recorded') !== total > 0n)
    return [
      'indent',
      'Should this order say “Order recorded”? Let’s compare the receipt with the order notice.',
    ];
  if (lines.at(-1) !== 'Debug check complete')
    return [
      'bracket',
      'Look at the last line. Is that the closing message we saw at the printer?',
    ];
  const expected = [
    `Total: ${total}`,
    ...(total > 0n ? ['Order recorded'] : []),
    'Debug check complete',
  ];
  if (printed !== expected.join('\n'))
    return [
      null,
      'Compare the lines and their order with the rule book. There is an extra or misplaced line.',
    ];
  return [
    'ok',
    `This receipt matches. ${total === 0n ? 'The empty order skipped the order notice.' : `The customer owes ${total}.`}`,
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
  return EXPLANATIONS.find(q => !attempt.notes[q.id]?.trim());
}
const clueGoals = {
  indent: [2, 'Check the order notice', 'When should the receipt say “Order recorded”?'],
  bracket: [3, 'Check the closing message', 'Look at the last line the printer should print.'],
  conversion: [4, 'Check the input terminal', 'How did the till read the price and quantity?'],
  name: [5, 'Check the ledger', 'Where does the receipt get its total?'],
  operator: [6, 'Check the calculator', 'Compare the printed total with the order.'],
};
export function investigationGoal(attempt, current, customer, question) {
  const initial = [1, 'Check what the printer shows', 'Enter 6 for Price and 3 for Quantity. Select Run order.'];
  const run = attempt.runs.at(-1);
  if (!run || typeof run.printed !== 'string' || !/^\d{1,8}$/.test(run.price) || !/^\d{1,8}$/.test(run.quantity)) return initial;
  const [target] = judge(run, run.price, run.quantity);
  const repair = current && confirmedRepair(attempt, run, target);
  if (repair && needsRepairReply(attempt, repair)) {
    return [clueGoals[repair][0], `Explain the ${stations[repair].toLowerCase()} repair`, 'Tell the owner why your change worked.'];
  }
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
const repairProgress = {
  indent: 'Python got past the order notice.',
  bracket: 'The till starts now.',
  conversion: 'The calculation ran this time.',
  name: 'We have a printed total now.',
  operator: 'That total matches the order.',
};
function confirmedRepair(attempt, record, target) {
  const index = attempt.runs.indexOf(record);
  let previousIndex = index - 1;
  while (previousIndex >= 0 && attempt.runs[previousIndex].source === record.source) previousIndex--;
  const previous = attempt.runs[previousIndex];
  if (!previous || previous.price !== record.price || previous.quantity !== record.quantity || typeof previous.printed !== 'string') return;
  const [before] = judge(previous, previous.price, previous.quantity);
  const order = ['indent', 'bracket', 'conversion', 'name', 'operator', 'ok'];
  if (order.includes(before) && order.indexOf(target) > order.indexOf(before)) return before;
}
function needsRepairReply(attempt, repair) {
  return repair === 'conversion' ? !attempt.notes.conversion?.trim() : !attempt.repairReplies[repair]?.sent;
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
    openFolder,
    paint,
  },
) {
  const attempt = getAttempt();
  openDialog(
    stations[station] || 'Shop counter',
    'Customer order',
    `<div class="order-work"><section class="order-machine"><p class="order-slip"><strong>Handwritten receipt</strong> · 3 notebooks at 6 each = 18</p><label for="order-code">Till program</label><textarea id="order-code" spellcheck="false" rows="8" maxlength="20000"></textarea><form id="order-form"><label>Price<input id="order-price" inputmode="numeric" pattern="[0-9]{1,8}" maxlength="8" required></label><label>Quantity<input id="order-quantity" inputmode="numeric" pattern="[0-9]{1,8}" maxlength="8" required></label><button class="primary">Run order</button></form><div id="order-result" aria-live="polite"></div></section><aside class="order-owner"><canvas width="36" height="60" aria-hidden="true"></canvas><div><strong>Store owner</strong><p id="order-dialogue" aria-live="polite" aria-atomic="true"></p></div><section class="order-choices" aria-label="Your choices"><button id="reveal-line" type="button">Show full line</button><label id="order-reply" hidden><span id="reply-label">Your reply</span><small id="reply-hint">Answer in a complete sentence.</small><textarea rows="3" maxlength="3000" aria-labelledby="reply-label" aria-describedby="reply-hint"></textarea><span id="reply-feedback"></span></label><button id="order-next" hidden></button></section></aside></div>`,
    opener,
  );
  const editor = id('order-code'),
    form = id('order-form'),
    result = id('order-result'),
    dialogue = id('order-dialogue'),
    next = id('order-next'),
    reply = id('order-reply');
  const feedback = id('reply-feedback');
  setupAnswerField(reply.querySelector('textarea'), feedback, false);
  id('reveal-line').onclick=()=>{finishSpeech(dialogue);id('work-dialog').focus({preventScroll:true});};
  paint(document.querySelector('.order-owner canvas'), 'owner');
  const repair = repairLines.find((item) => item.id === station);
  const lines = attempt.source.split('\n');
  const row = repair ? repairRow(attempt.source, repair) : null;
  const startRow =
    row === null ? 0 : Math.max(0, row - (['conversion', 'indent'].includes(station) ? 1 : 0));
  const start = lines.slice(0, startRow).reduce((n, line) => n + line.length + 1, 0);
  let end =
    row === null ? attempt.source.length : start + lines.slice(startRow, row + 1).join('\n').length;
  editor.value = attempt.source.slice(start, end);
  if (row !== null) {
    editor.labels[0].textContent = stations[station] + ' code';
    editor.rows = Math.max(2, row - startRow + 1);
  }

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
  function clear() {
    form.hidden = false;
    result.replaceChildren();
    next.hidden = true;
    reply.hidden = true;
    speak(dialogue, entryPrompt());
  }
  editor.oninput = () => {
    const source = attempt.source.slice(0, start) + editor.value + attempt.source.slice(end);
    if (edit(source)) {
      end = start + editor.value.length;
      clear();
    } else editor.value = attempt.source.slice(start, end);
  };
  function insert(token) {
    if (editor.disabled || !canEdit()) return;
    editor.setRangeText(token, editor.selectionStart, editor.selectionEnd, 'end');
    editor.oninput();
    editor.focus();
  }
  useBag(insert);
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
    action('Back to the shop', () => id('work-dialog').close());
    return true;
  }
  function backToShop() {
    action('Back to the shop', () => id('work-dialog').close());
  }
  function needsReading(station) {
    const topic = ruleTopics[station];
    if (attempt.printer.chaptersRead.includes(chapterIndex(topic))) return false;
    speak(dialogue, `${dialogue.textContent} Read “${topic}” at the rule book stand, then come back with your answer.`);
    backToShop();
    return true;
  }
  function show(record, opening = false) {
    clear();
    id('calculator-reference')?.remove();
    function output(title, text) {
      const block = document.createElement('section'),
        h = document.createElement('strong'),
        pre = document.createElement('pre');
      h.textContent = title;
      pre.textContent = text;
      block.append(h, pre);
      result.append(block);
    }
    output('Printed receipt', record.printed || 'No receipt printed.');
    if (record.error) {
      const trace = record.error.trim();
      const position = trace.lastIndexOf('File "student_order.py"');
      const diagnostic = position < 0 ? trace.split('\n').at(-1) : trace.slice(position);
      output('Python error', studentDiagnostic(diagnostic)); 
    }
    if (record.stderr) output('Python messages', record.stderr);
    const [target, message] = judge(record, record.price, record.quantity);
    const repair = confirmedRepair(attempt, record, target);
    if (repair && needsRepairReply(attempt, repair) && (!station || station === repair)) {
      const context = repairProgress[repair] + ' ';
      if (repair === 'conversion') ask(EXPLANATIONS.find(item => item.id === repair), record, context);
      else {
        const saved = attempt.repairReplies[repair] ??= {text: '', sent: false};
        speak(dialogue, context + repairQuestions[repair]);
        if (needsReading(repair)) return;
        collectReply(saved.text, text => { saved.text = text; }, text => {
          saved.text = text;
          saved.sent = true;
        }, record);
      }
      return;
    }
    if (target === 'name' && record.error.includes('NameError')) {
      function guide(prompt) {
        speak(dialogue, prompt);
        backToShop();
      }
      if (station === 'name' && record.nameComparison === 'ledger') {
        const calculation = repairLines.find(item => item.id === 'operator');
        const calculationRow = repairRow(record.source, calculation);
        if (calculationRow !== null) {
          const reference = document.createElement('p');
          reference.id = 'calculator-reference';
          const code = document.createElement('code');
          code.textContent = record.source.split('\n')[calculationRow];
          reference.append('Line you saw at the calculator', document.createElement('br'), code);
          editor.labels[0].before(reference);
        }
        speak(dialogue, 'Read “Names” in the rule book. Compare the two lines. Why couldn’t Python find the value?');
        backToShop();
      } else if (station === 'name') {
        if (canEdit()) { record.nameComparison = 'calculator'; save(); refresh(); }
        guide('Read the name after the comma in the ledger. Python couldn’t find it. Let’s see what name the calculator gave its result.');
      } else if (station === 'operator' && record.nameComparison) {
        if (canEdit()) { record.nameComparison = 'ledger'; save(); refresh(); }
        guide('Look to the left of the equals sign. That’s the name the calculator gives its result. Take that line back to the ledger and compare the spelling.');
      } else if (record.nameComparison === 'calculator') {
        guide('We saw the name in the ledger. Which name does the calculator use?');
      } else {
        guide('Python couldn’t find the name on the receipt line. Let’s read that line in the ledger.');
      }
      return;
    }
    const hint = (opening || station === target) && stationHint(station, [target, message]);
    speak(dialogue, hint || message);
    if (station && station === target) backToShop();
    if (target && target !== 'ok' && station !== target) {
      action('Explore the counter', () => id('work-dialog').close());
    }
    if (target !== 'ok') return;
    const test = nextOrder(attempt);
    if (returnToPrinter(test)) return;
    if (test) {
      action('Enter the next order', () => {
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
    if (!question) {
      speak(dialogue, `Thank you, Detective ${attempt.identity.firstName.trim()}. I can use my till again. Your repairs, receipts and replies are in your case folder.`);
      action('Review case folder', () => openFolder(opener));
      return;
    }
    ask(question,record);
  }
  function ask(question, record, context = '') {
    const task = attempt.tasks[question.id];
    const part = task.replies.length;
    speak(dialogue, (part === 0 ? context : '') + question.questions[part]);
    if (needsReading(question.id)) return;
    collectReply(task.draft, text => { task.draft = text; }, answer => {
      if (part + 1 < question.questions.length) {
        task.replies.push(answer);
      } else {
        task.completedReplies = [...task.replies, answer];
        attempt.notes[question.id] = task.completedReplies.join('\n');
        task.replies = [];
      }
      task.draft = '';
    }, record);
  }
  function collectReply(draft, onDraft, onReply, record) {
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
    action('Reply', () => {
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
      save();
      refresh();
      show(record);
      if (!reply.hidden) field.focus(); else next.focus();
    });
  }
  const last = currentOrderRun(attempt);
  if (last)
    show(last, true);
  else if (!returnToPrinter(nextCustomer)) speak(dialogue, entryPrompt());
  form.onsubmit = async (e) => {
    e.preventDefault();
    if (!canEdit() || returnToPrinter(nextOrder(attempt))) return;
    const { price, quantity } = attempt.order,
      source = attempt.source,
      revision = attempt.revision;
    if (![price, quantity].every((v) => /^\d{1,8}$/.test(v))) return;
    const controls = [editor, ...form.elements];
    controls.forEach((el) => (el.disabled = true));
    clear();
    speak(dialogue, 'Running the order…');
    try {
      const outcome = await run(source, [price, quantity]);
      if (getAttempt() !== attempt || !canEdit()) return;
      const test = TESTS.find((t) => t.price === price && t.quantity === quantity);
      const record = recordRun(attempt, outcome, source, revision, test?.id || 'custom');
      Object.assign(record, { price, quantity, printed: outcome.printed });
      if (test && (!isFinalOrder(test) || station === 'bracket') && judge(record, price, quantity)[0] === 'ok') {
        attempt.kept[test.id] = record.id;
        playSound('handle_coins');
      }
      save();
      refresh();
      if (editor.isConnected) show(record);
    } catch (err) {
      speak(dialogue, err.message);
    } finally {
      controls.forEach((el) => (el.disabled = false));
    }
  };
}
