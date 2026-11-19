export const CASE_VERSION = 'broken-order-1';
export const LEGACY_STARTER = 'price = int(input("Price: "))\nquantity = input("Quantity: ")\ntotal = price + quantity\nprint("Total:", totl)\nif total > 0:\nprint("Order recorded")\nprint("Debug check complete"\n';
export const SIMPLIFIED_STARTER = 'price = int(input("Price: "))\nquantity = int(input("Quantity: "))\ntotal = price + quantity\n("Total:", total)\nif total > 0:\n    print("Order recorded")\n("Debug check complete")\n';

export const STARTER = LEGACY_STARTER;

export const PRINTER_QUESTION = 'That’s the last line my receipts were missing! What did you change to make it print?';

export const RULES = [
  'Ask for a price and a quantity.',
  'Treat both answers as whole numbers.',
  'Multiply price by quantity to calculate the total.',
  'Always display the total.',
  'Display Order recorded only when total > 0.',
  'Finish by displaying Debug check complete.'
];

export const CASES = [
  { id: 'bracket', title: 'Printer archive', object: 'Printer strip', tag: 'A', evidence: 'This is the original program recovered from the shop printer. It has not been repaired.', program: true },
  { id: 'name', title: 'Shop ledger', object: 'Storage drawer', tag: 'B', evidence: 'The ledger needs a price, a quantity, and a total for each order. The final printed total must match the calculated total.' },
  { id: 'conversion', title: 'Customer entry log', object: 'Input terminal', tag: 'C', evidence: 'Customer entries from three orders:\nPrice: 6   Quantity: 3\nPrice: 4   Quantity: 0\nPrice: 5   Quantity: 2\nThese are the entries customers typed, not program results.' },
  { id: 'operator', title: 'Counter receipt', object: 'Calculator and receipt', tag: 'D', evidence: 'A handwritten receipt lists 3 items at a price of 6 each. The customer paid 18. This receipt was written separately from the broken program.' },
  { id: 'indent', title: 'Shop notice', object: 'Order notice', tag: 'E', evidence: 'Display the total for every order. Display Order recorded only for a positive total. Finish every order by displaying Debug check complete.' }
];

export const TOOLBOX = ['(', ')', '[', ']', ':', ',', '"', '+', '-', '*', '/', '=', '==', '>', '<', 'int', 'str', 'input', 'print', 'price', 'quantity', 'total', '    '];

export const repairQuestions = {
  indent: 'When does Python run the line inside “if total > 0”?',
  bracket: 'Why do we need a ) at the end of the print line?',
  name: 'Why do we use the same name, total, on both lines?',
  operator: 'Why do we multiply the price by the number of items?',
};

export const EXPLANATIONS = [
  { id: 'conversion', title: 'Inputs and calculation', questions: ['When you type 3, does input() give Python text or a number?', 'Why do we need the quantity as a number to find the total?'] },
  { id: 'indent', title: 'The zero order', questions: ['What total printed when you ordered 0 items?', 'What printed below that total?', 'Look at the receipt for 2 items. Name the message that disappeared for 0 items. Why did “Debug check complete” still print?'] }
];

export const TESTS = [
  { id: 'order-1', price: '6', quantity: '3' },
  { id: 'order-2', price: '4', quantity: '0' },
  { id: 'order-3', price: '5', quantity: '2' }
];

export const PRACTICE_SOURCE = 'print("The shop is quiet")\n';

// Identify the student's own lines after insertions or comments move them.
export const repairLines = [
  {id:'bracket', label:'Missing parenthesis', pattern:/Debug check complete/},
  {id:'conversion', label:'Quantity conversion', pattern:/^\s*quantity\s*=/},
  {id:'operator', label:'Total calculation', pattern:/^\s*total\s*=/},
  {id:'name', label:'Printed total', pattern:/["']Total:/},
  {id:'indent', label:'Order notice indentation', pattern:/Order recorded/}
];
export function repairRow(source, repair){
  const lines=source.split('\n');
  const rows=lines.flatMap((line,index)=>!line.trimStart().startsWith('#') && repair.pattern.test(line)?[index]:[]);
  return rows.length===1?rows[0]:null;
}

// Each repair stays inside the statement printed on the worksheet. Accept
// unfinished tokens while typing and let Python judge whether a repair works.
const inputLine = /^\s*(?:price|quantity)\s*=\s*(?:(?:i|in|int|s|st|str|f|fl|flo|floa|float)\s*\(?\s*)?input\s*\(\s*["'](?:Price|Quantity): ?["']\s*\)?\s*\)?\s*$/;
const repairShapes = [
  inputLine, inputLine,
  /^\s*total\s*=\s*\w*\s*[+*/%\-]{0,2}\s*\w*\s*$/,
  /^\s*print\s*\(\s*["']Total:["']\s*,\s*\w*\s*\)?\s*$/,
  /^\s*if\s+\w+\s*[<>=!]{0,2}\s*\d*\s*:?\s*$/,
  /^\s*print\s*\(\s*["']Order recorded["']\s*\)?\s*$/,
  /^\s*print\s*\(\s*["']Debug check complete["']\s*\)?\s*$/,
];
const suppliedLines = STARTER.trimEnd().split('\n');
export const repairReminder = 'Fix the line that is already here. You can change its pieces or spaces. Extra instructions won’t be added.';

// Keep the student's exact spelling and spacing when every supplied line is identifiable.
export function withoutExtraLines(text, first, count) {
  const lines = text.split('\n');
  if (lines.length <= count) return null;
  const rows = repairShapes.slice(first, first + count).map(shape =>
    lines.flatMap((line, row) => shape.test(line) ? [row] : [])
  );
  // The two inputs share a shape. Identify each by its variable name.
  if (first === 0) {
    rows[0] = rows[0].filter(row => /^\s*price\s*=/.test(lines[row]));
    rows[1] = rows[1].filter(row => /^\s*quantity\s*=/.test(lines[row]));
  }
  if (rows.some((matches, i) => matches.length !== 1 || (i && matches[0] <= rows[i - 1][0]))) return null;
  return rows.map(([row]) => lines[row]).join('\n');
}

export function allowsRepair(before, after) {
  if (before === after) return true;
  const oldLines = before.split('\n');
  const newLines = after.split('\n');
  // Older saves may contain extra lines. Students can remove them, and the
  // original saved work remains available until they choose to edit it.
  if (newLines.length > oldLines.length) return false;
  const standardLayout = oldLines.length === 7 || (oldLines.length === 8 && oldLines.at(-1) === '');
  if (standardLayout && newLines.length !== oldLines.length) return false;
  return newLines.every((line, i) => {
    if (line === oldLines[i]) return true;
    if (standardLayout && i >= suppliedLines.length) return line === '';
    if (line.trim() === '') return true;
    if (line.length > 256) return false;
    const slots = standardLayout ? [i] : suppliedLines.map((_, index) => index);
    // Permit clearing a line and retyping the supplied statement from scratch.
    return slots.some(slot => {
      if (repairShapes[slot].test(line)) return true;
      const original = suppliedLines[slot];
      const trimmed = line.trimStart();
      for (let end = 0; end < original.length; end++) {
        if (repairShapes[slot].test(trimmed + original.slice(end))) return true;
      }
      return false;
    });
  });
}
