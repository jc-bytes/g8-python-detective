import { paint } from './shop-art.js';
import { tasks } from './shop-tasks.js';
import { CASES, PRINTER_QUESTION, STARTER, TESTS, RULES, EXPLANATIONS, repairQuestions, repairLines, repairRow } from './case.js';
import { fileStem, keptRun } from './model.js';

export function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
  setTimeout(() => URL.revokeObjectURL(url), 30000);
}

const schoolZone = 'America/Panama';
export function filingDate(date) {
  return date.toLocaleDateString('en-US', { timeZone: schoolZone, dateStyle: 'long' });
}
const testClock = new Intl.DateTimeFormat('en-US', { timeZone: schoolZone, dateStyle: 'medium', timeStyle: 'medium' });

export function caseDisposition(snapshot) {
  if (snapshot.mode === 'practice') return 'Practice file';
  const verified = TESTS.every(test => {
    const run = keptRun(snapshot, test.id);
    const total = Number(test.price) * Number(test.quantity);
    const expected = [`Total: ${total}`, ...(total ? ['Order recorded'] : []), 'Debug check complete'].join('\n');
    return run?.source === snapshot.source && !run.error && (run.printed ?? run.stdout).trimEnd() === expected;
  });
  return verified ? 'Receipts verified' : 'Open investigation';
}

// File the same exhibit print in the browser folder and the downloadable report.
export function exhibitPrint(subject) {
  const canvas = document.createElement('canvas');
  canvas.width = 340;
  canvas.height = 204;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#fffdf4';
  ctx.fillRect(0, 0, 340, 204);
  ctx.save();
  ctx.beginPath();
  ctx.rect(9, 9, 322, 186);
  ctx.clip();
  ctx.fillStyle = '#43625c';
  ctx.fillRect(9, 9, 322, 186);
  ctx.fillStyle = '#395651';
  for (let x = 18; x < 331; x += 38) ctx.fillRect(x, 9, 2, 186);
  ctx.fillStyle = '#bc9069';
  ctx.fillRect(9, 145, 322, 50);
  if (subject === 'receipt') {
    ctx.translate(170, 100);
    ctx.rotate(-0.055);
    ctx.fillStyle = '#514539';
    ctx.fillRect(-107, -73, 221, 156);
    ctx.fillStyle = '#fff2ce';
    ctx.fillRect(-111, -77, 221, 156);
    ctx.fillStyle = '#55462f';
    ctx.font = 'bold 15px monospace';
    ctx.fillText('COUNTER RECEIPT', -90, -46);
    ctx.fillRect(-91, -35, 179, 1);
    ctx.font = 'italic 24px Georgia, serif';
    ctx.fillText('3 notebooks', -91, -2);
    ctx.fillText('6 each', -91, 24);
    ctx.fillRect(-91, 33, 179, 1);
    ctx.fillText('Total   18', -91, 62);
  } else {
    const sprite = document.createElement('canvas');
    sprite.width = subject === 'printer' ? 46 : 40;
    sprite.height = 32;
    paint(sprite, subject);
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(sprite, (340 - sprite.width * 4) / 2, 29, sprite.width * 4, 128);
  }
  ctx.restore();
  return canvas.toDataURL('image/png');
}

export function reportSections(snapshot) {
  const sections = [];
  const heading = title => sections.push({title, entries: []});
  const entry = (kind, value) => sections.at(-1).entries.push({kind, value: String(value)});
  const note = value => entry('text', value);
  const label = value => entry('label', value);
  const code = value => entry('code', value);
  const assessment = snapshot.mode === 'assessment';
  if (assessment) {
    heading('Statement of the store owner');
    entry('quote', '“A customer brought me three notebooks. Each one cost 6. The till gave me no receipt. I wrote one by hand for 18.”');
    sections.at(-1).entries.push({kind:'exhibit',subject:'receipt',value:'Owner’s handwritten receipt',detail:'Three notebooks at 6 each. Total 18.'});
    heading('Detective’s findings');
    const first = snapshot.runs[0];
    if (!first) note('The till has yet to be tested. The owner’s handwritten receipt is the first lead.');
    else {
      label('Earliest test on file');
      if (first.error) {
        const frame = [...first.error.matchAll(/File "student_order\.py", line (\d+)/g)].at(-1);
        const row = frame ? Number(frame[1]) - 1 : -1;
        const repair = repairLines.find(item => repairRow(first.source,item) === row);
        const error = first.error.trim().split('\n').at(-1);
        if (repair) sections.at(-1).entries.push({kind:'exhibit',subject:repair.id==='bracket'?'printer':repair.id,
          value:CASES.find(item => item.id===repair.id).object,detail:`The till stopped on line ${row+1}.`,sample:first.source.split('\n')[row],error});
        else { note('The till stopped with this error.'); code(error); }
      }
      else { note('The till produced this record.'); code(first.printed ?? first.stdout ?? ''); }
    }
    for (const repair of repairLines) {
      const before = repairRow(STARTER, repair), after = repairRow(snapshot.source, repair);
      const original = STARTER.split('\n')[before];
      const revised = after === null ? null : snapshot.source.split('\n')[after];
      if (revised === original) continue;
      const subject = repair.id==='bracket'?'printer':repair.id;
      const existing = sections.at(-1).entries.find(item => item.subject===subject && item.sample===original);
      if (existing) Object.assign(existing,{original,revised});
      else sections.at(-1).entries.push({kind:'exhibit',subject,
        value:CASES.find(item => item.id===repair.id).object,original,revised});

    }
    if (caseDisposition(snapshot) === 'Receipts verified') {
      label('Finding at the counter');
      note('The repaired till printed 18 for the three notebooks, matching the owner’s handwritten receipt. A second purchase printed 10. With an empty order, the till printed 0 and left out “Order recorded”. The three receipts are filed together in Exhibit 01.');
    }
    for (const [id, question] of Object.entries(repairQuestions)) {
      const reply = snapshot.repairReplies?.[id];
      if (reply?.text) { label(`Store owner: ${question}`); note(`${reply.sent ? 'Detective' : 'Notebook draft'}: ${reply.text}`); }
    }
    for (const explanation of EXPLANATIONS) {
      label(explanation.title);
      const replies = snapshot.tasks?.[explanation.id]?.replies || [];
      note(snapshot.notes[explanation.id]?.trim() || [...replies, 'Statement pending.'].join('\n'));
      const draft = snapshot.tasks?.[explanation.id]?.draft;
      if (draft) note(`Notebook draft: ${draft}`);
    }
    if (snapshot.printer?.reply?.trim()) { label(PRINTER_QUESTION); note(`${snapshot.printer.replied ? 'Detective' : 'Notebook draft'}: ${snapshot.printer.reply}`); }
  }
  heading('Exhibit 01 · Printer receipts');
  for (const test of assessment ? [TESTS[0], TESTS[2], TESTS[1]] : [{id:'practice'}]) {
    label(assessment ? `${test.quantity} items at ${test.price} each` : 'Counter rehearsal');
    const run = keptRun(snapshot, test.id);
    if (!run) {note('No receipt filed.'); continue;}
    note(`Till revision ${run.revision} · ${run.source === snapshot.source ? 'Matches the code in Exhibit 02' : 'Earlier version of the till'}`);
    code(run.printed ?? run.stdout); if (run.error) code(run.error); if (run.stderr) code(run.stderr);
  }
  heading('Exhibit 02 · Till source code');
  label(`Python listing · Revision ${snapshot.revision}`); code(snapshot.source);
  if (assessment) {
    heading('Exhibit 03 · Evidence recovered at the shop');
    label('Handwritten receipt'); code('3 notebooks × 6 = 18');
    label('Program recovered from the printer'); code(STARTER);
    label('Instructions posted at the shop'); RULES.forEach(note);
    const objects = CASES.filter(item => snapshot.inspected.includes(item.id));
    if (objects.length) { label('Objects inspected'); note(objects.map(item => item.object).join(' · ')); }
    if (snapshot.printer?.visitedBook) note('Consulted the rule book.');
    if (snapshot.printer?.tourDone) note('Completed the shop tour.');
    const strip = snapshot.printer?.result;
    if (strip) { label(`Printer strip test · Revision ${strip.revision}`); code(strip.candidate); [strip.stdout, strip.stderr, strip.error].filter(Boolean).forEach(code); }
    for (const slot of CASES) {
      const card = CASES.find(item => item.id === snapshot.evidence[slot.id]);
      const connection = snapshot.connections?.[slot.id];
      if (card || connection?.line || connection?.reason) {
        label(slot.title); if (card) note(`Attached evidence: ${card.title}`);
        if (connection?.line) note(`Line under investigation: ${connection.line}`);
        if (connection?.reason) note(connection.reason);
      }
      if (!EXPLANATIONS.some(item => item.id === slot.id) && snapshot.notes[slot.id]) note(snapshot.notes[slot.id]);
    }
    if(snapshot.earlierEntryNote) note(snapshot.earlierEntryNote);
    for (const task of tasks) for (const [kind, record] of Object.entries(snapshot.tasks?.[task.id]?.records || {})) {
      label(`${task.title} · ${kind} test · Revision ${record.revision}`); code(record.candidate); code(record.output);
      if (record.ownerLine) note(record.ownerLine);
    }
  }
  heading('Field log · Tests in order');
  if (!snapshot.runs.length) note('No tests recorded.');
  snapshot.runs.forEach((run, index) => {
    label(`Test ${index + 1} · Till revision ${run.revision}`);
    const stamp = Date.parse(run.localTime);
    note(Number.isFinite(stamp) ? `${testClock.format(stamp)} · Panama time` : 'Test time unavailable.');
    if (run.price != null && run.quantity != null) note(`Price ${run.price} · Quantity ${run.quantity}`);
    if (snapshot.kept[run.testId] === run.id) note('Receipt filed in Exhibit 01.');
    else {code(run.printed ?? run.stdout); if(run.error) code(run.error); if(run.stderr) code(run.stderr);}
    if(run.source !== snapshot.source) {note('Code used in this test'); code(run.source);}
  });
  return sections;
}

export function createReport(snapshot, filedAt = new Date()) {
  const pdf = globalThis.pdfMake;
  if (!pdf) throw new Error('The PDF library could not load. Reload the game and try again.');
  const title = snapshot.mode === 'practice' ? 'Practice investigation' : 'The Broken Order';
  const detective = [snapshot.identity.firstName, snapshot.identity.lastName].filter(Boolean).join(' ') || 'Name pending';
  const field = (name, value) => ({stack: [{text:name, font:'Mono', fontSize:8, color:'#665436'}, {text:value, bold:true, margin:[0,3,0,0]}]});
  const rule = color => ({canvas:[{type:'line', x1:0, y1:0, x2:552, y2:0, lineWidth:1, lineColor:color}]});
  const content = [
    {columns:['SHOP INVESTIGATIONS', {text:'FILE № 001', alignment:'right'}], font:'Mono', fontSize:9, characterSpacing:0.6, margin:[0,0,0,6]},
    rule('#b2a58b'),
    {text:title, font:'Serif', bold:true, fontSize:31, margin:[0,3,0,9]},
    {columns:[field('INVESTIGATING DETECTIVE', [detective,snapshot.identity.group].filter(Boolean).join(' ')), field('LOCATION','Shop counter'), field('DISPOSITION',caseDisposition(snapshot))], columnGap:10},
    {text:`Filed ${filingDate(filedAt)}`, font:'Mono', fontSize:9, margin:[0,7,0,8]},
    rule('#31594f')
  ];
  for (const section of reportSections(snapshot)) {
    content.push({text: section.title, pageBreak: section.title.startsWith('Exhibit 02') && snapshot.mode === 'assessment' ? 'before' : undefined, headlineLevel: 1, font: 'Serif', fontSize: 15, bold: true, color: '#24564b', margin: [0, 12, 0, 5]});
    for (const exhibit of section.entries) {
      const {kind,value} = exhibit;
      if (kind === 'exhibit') {
        const lines = [{text:value,font:'Serif',bold:true,fontSize:13,margin:[0,0,0,4]}];
        if (exhibit.detail) {
          lines.push({text:exhibit.detail});
          if (exhibit.error) lines.push({text:exhibit.sample,font:'Mono',preserveLeadingSpaces:true},{text:exhibit.error,font:'Mono'});
        }
        if (exhibit.original !== undefined) {
          if (!exhibit.error) lines.push({text:'Recovered line',bold:true}, {text:exhibit.original,font:'Mono',preserveLeadingSpaces:true});
          lines.push(exhibit.revised === null ? {text:'See the full till listing in Exhibit 02.'} :
            {stack:[{text:'Line now in the till',bold:true},{text:exhibit.revised,font:'Mono',preserveLeadingSpaces:true}],margin:[0,5,0,0]});
        }
        content.push({table:{widths:[110,'*'],body:[[{image:exhibitPrint(exhibit.subject),width:110},{stack:lines}]]},
          layout:'lightHorizontalLines',margin:[0,5,0,9]});
        continue;
      }
      if (kind === 'code' || kind === 'quote') {
        const quote = kind === 'quote';
        content.push({table:{widths:['*'],body:[[{text:value || ' ', font:quote ? 'Serif' : 'Mono', italics:quote, fontSize:quote ? 13 : 10, preserveLeadingSpaces:true,
          fillColor:quote ? '#f5ecd5' : '#efede2', border:[true,false,false,false], margin:[7,5,6,5]}]]},
          layout:{vLineColor:()=>'#ad824b',vLineWidth:()=>2}, margin:[0,3,0,6]});
      } else content.push({text:value, bold:kind === 'label', fontSize:11, margin:[0,2,0,3]});
    }
  }
  const definition = {info: {title: `${title} · Case report`, author: detective}, pageSize: 'LETTER', pageMargins: [30, 30, 30, 46],
    background: (_, size) => ({canvas: [
      {type:'rect', x:0, y:0, w:size.width, h:size.height, color:'#fff9e9'},
      {type:'line', x1:44, y1:size.height-40, x2:size.width-44, y2:size.height-40, lineWidth:0.6, lineColor:'#ac9974'}
    ]}),
    defaultStyle: {fontSize: 10, color: '#243b36', lineHeight: 1.16}, content,
    footer: (page, count) => ({columns: ['PYTHON DETECTIVE   /   CASE REPORT', {text: `${page} / ${count}`, alignment: 'right'}], margin: [44, 12], fontSize: 8, color: '#566963'}),
    pageBreakBefore: (node, after) => node.headlineLevel === 1 && after.length === 0};
  const fonts = {Serif:{bold:'DejaVuSerif-Bold.ttf', italics:'DejaVuSerif-Italic.ttf'}, Roboto: {normal: 'Roboto-Regular.ttf', bold: 'Roboto-Medium.ttf'}, Mono: {normal: 'DejaVuSansMono.ttf'}};
  return new Promise((resolve, reject) => {
    const stream = pdf.createPdf(definition, undefined, fonts).getStream();
    const chunks = [];
    stream.on('data', chunk => chunks.push(chunk));
    stream.on('error', reject);
    stream.on('end', () => resolve(new Blob(chunks, {type:'application/pdf'})));
    stream.end();
  });
}

export async function submissionFiles(attempt, filedAt = new Date()) {
  const snapshot = structuredClone(attempt);
  const stem = `${snapshot.mode === 'practice' ? 'PRACTICE_' : ''}${fileStem(snapshot)}_${filedAt.toLocaleDateString('sv-SE', {timeZone:schoolZone})}`;
  return { snapshot, stem, python: new Blob([snapshot.source], { type: 'text/x-python;charset=utf-8' }), report: await createReport(snapshot, filedAt) };
}
