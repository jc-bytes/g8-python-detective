import { STARTER } from './case.js';

const lines = STARTER.trimEnd().split('\n');
const repairs = {
  bracket: { first: 6, count: 1, stock: [')'], fixed: lines[6] + ')' },
  indent: {
    first: 4,
    count: 2,
    stock: ['    '],
    fixed: lines[4] + '\n    ' + lines[5],
  },
  conversion: {
    first: 0,
    count: 2,
    stock: ['int', '(', ')'],
    fixed: lines[0] + '\nquantity = int(input("Quantity: "))',
  },
  name: {
    first: 3,
    count: 1,
    stock: ['total'],
    fixed: lines[3].replace('totl', 'total'),
  },
  operator: {
    first: 2,
    count: 1,
    stock: ['*'],
    fixed: lines[2].replace('+', '*'),
  },
};
export function suppliedCode(station) {
  const { first, count } = repairs[station];
  return lines.slice(first, first + count).join('\n');
}
export function tokens(line) {
  return (
    line.match(
      /"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'|[a-zA-Z_]\w*|\d+|[ \t]+|./gu,
    ) || []
  );
}
function kind(t) {
  if (/^["']/.test(t)) return 'string';
  if (/^\s+$/.test(t)) return 'space';
  if (['int', 'input', 'print'].includes(t)) return 'function';
  if (t === 'if') return 'keyword';
  if (/^\d/.test(t)) return 'number';
  if (/^\w/.test(t)) return 'name';
  return 'symbol';
}
export function colorCode(node, code) {
  node.replaceChildren();
  code.split('\n').forEach((line, i) => {
    if (i) node.append('\n');
    for (const t of tokens(line)) {
      const span = document.createElement('span');
      span.className = 'py-' + kind(t);
      span.textContent = t;
      node.append(span);
    }
  });
}
function signature(source) {
  return JSON.stringify(
    source.split('\n').map((line) => [
      Boolean(line.match(/^\s/)),
      ...tokens(line)
        .filter((t) => t.trim())
        .map((t) => (/^'.*'$/.test(t) ? '"' + t.slice(1, -1) + '"' : t)),
    ]),
  );
}
export function fixedSection(station, source) {
  return signature(source) === signature(repairs[station].fixed);
}
function display(t) {
  return t === '    ' ? '4 spaces' : t;
}
function operations(piece, t) {
  const ops = ['before', 'after'];
  if (['*', 'total'].includes(piece) && kind(t) === kind(piece) && t !== piece)
    ops.push('replace');
  return ops;
}
// Rebuild the board from its supplied text and at most three inventory moves.
// Offsets refer to tokens, so int and input remain separately clickable while building int(input(...)).
function board(station, base, moves) {
  const rows = base.split('\n').map(tokens);
  const bag = [...repairs[station].stock];
  if (fixedSection(station, base)) bag.length = 0;
  for (const m of moves) {
    if (!Number.isInteger(m?.row) || !Number.isInteger(m?.col)) return null;
    const row = rows[m.row],
      token = row?.[m.col],
      slot = bag.indexOf(m.piece);
    if (
      slot < 0 ||
      !token?.trim() ||
      !operations(m.piece, token).includes(m.op)
    )
      return null;
    row.splice(
      m.col + Number(m.op === 'after'),
      Number(m.op === 'replace'),
      m.piece,
    );
    bag.splice(slot, 1);
  }
  return { rows, bag, source: rows.map((row) => row.join('')).join('\n') };
}
export function restoreBackpack(station, saved, current) {
  if (
    !Object.hasOwn(repairs, station) ||
    !saved ||
    typeof saved.base !== 'string' ||
    saved.base.length > 2000 ||
    !Array.isArray(saved.moves) ||
    saved.moves.length > repairs[station].stock.length
  )
    return null;
  if (board(station, saved.base, saved.moves)?.source !== current) return null;
  return {
    base: saved.base,
    moves: saved.moves.map(({ row, col, piece, op }) => ({
      row,
      col,
      piece,
      op,
    })),
  };
}
export function inventory(station, source, saved) {
  const state = restoreBackpack(station, saved, source);
  return board(station, state?.base ?? source, state?.moves || []).bag;
}
export function makeBackpack(
  root,
  { station, read, saved, write, allowed, example },
) {
  let picked = null,
    aimed = null;
  const button = (label, fn) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.textContent = label;
    b.onclick = fn;
    return b;
  };
  root.innerHTML =
    '<div class="pack-code" role="group" aria-label="Machine code"></div><div class="pack-tray"><strong>Backpack</strong> <span class="pack-count" aria-live="polite"></span><div class="pack-pieces"></div><small class="pack-help"></small><div class="pack-actions"></div><button class="pack-undo" type="button">Undo last move</button></div><details open class="pack-example"><summary>Rule book example</summary><pre><code></code></pre></details>';
  const find = (s) => root.querySelector(s),
    code = find('.pack-code'),
    pieces = find('.pack-pieces'),
    actions = find('.pack-actions'),
    help = find('.pack-help'),
    undo = find('.pack-undo');
  colorCode(find('.pack-example code'), example || '');
  function render() {
    const source = read(),
      state = restoreBackpack(station, saved(), source) || {
        base: source,
        moves: [],
      };
    const { rows, bag } = board(station, state.base, state.moves);
    const compatible =
      signature(state.base) === signature(suppliedCode(station)) ||
      fixedSection(station, state.base);
    const active = allowed() && compatible;
    const paint = (text, cls, fn) => {
      const b = button(display(text), fn);
      b.className = cls + ' py-' + kind(text);
      return b;
    };
    function apply(moves) {
      if (!allowed() || read() !== source) return;
      const next = board(station, state.base, moves);
      if (!next) return;
      picked = null;
      aimed = null;
      if (write(next.source, { base: state.base, moves })) {
        render();
        (
          pieces.querySelector('button') ||
          document.querySelector('#order-form button')
        )?.focus();
      }
    }
    function aim(row, col) {
      if (!active || !allowed()) return;
      if (!picked) {
        help.textContent = 'Pick a piece from your backpack first.';
        pieces.querySelector('button')?.focus();
        return;
      }
      aimed = { row, col };
      render();
      actions.querySelector('button')?.focus();
    }
    code.replaceChildren();
    pieces.replaceChildren();
    actions.replaceChildren();
    rows.forEach((row, r) => {
      const line = document.createElement('div');
      line.className = 'pack-line';
      row.forEach((t, c) => {
        if (!t.trim() || !active || !bag.length) {
          const span = document.createElement('span');
          span.className = 'py-' + kind(t);
          span.textContent = t;
          line.append(span);
          return;
        }
        const b = paint(t, 'pack-token', () => aim(r, c));
        b.setAttribute('aria-label', `${t}, line ${r + 1}, position ${c + 1}`);
        b.setAttribute(
          'aria-pressed',
          String(aimed?.row === r && aimed.col === c),
        );
        b.ondragover = (e) => {
          if (picked) e.preventDefault();
        };
        b.ondrop = (e) => {
          e.preventDefault();
          if (e.dataTransfer.getData('text/plain') === picked) aim(r, c);
        };
        line.append(b);
      });
      code.append(line);
    });
    find('.pack-tray').hidden = !active || (!bag.length && !state.moves.length);
    find('.pack-example').hidden = !example || !active;
    find('.pack-count').textContent =
      `${bag.length} of ${repairs[station].stock.length} left`;
    for (const t of bag) {
      const b = paint(t, 'pack-piece', () => {
        picked = t;
        aimed = null;
        render();
        code.querySelector('button')?.focus();
      });
      b.append(' ×1');
      b.draggable = true;
      b.dataset.token = t;
      b.setAttribute('aria-pressed', String(picked === t));
      b.ondragstart = (e) => {
        picked = t;
        aimed = null;
        e.dataTransfer.setData('text/plain', t);
        e.dataTransfer.effectAllowed = 'copy';
      };
      pieces.append(b);
    }
    help.textContent = bag.length
      ? picked
        ? `Choose where ${display(picked)} goes.`
        : 'Drag a piece onto the code, or select it and tap its place.'
      : 'All pieces placed. Select Run order.';
    if (aimed && picked && active) {
      const { row, col } = aimed;
      const t = rows[row]?.[col];
      if (t)
        for (const op of operations(picked, t))
          actions.append(
            button(op === 'replace' ? `Replace ${t}` : `Add ${op} ${t}`, () =>
              apply([...state.moves, { row, col, op, piece: picked }]),
            ),
          );
    }
    undo.hidden = !state.moves.length;
    undo.onclick = () => apply(state.moves.slice(0, -1));
    if (!compatible && allowed()) {
      find('.pack-tray').hidden = false;
      find('.pack-count').textContent = '';
      pieces.replaceChildren();
      help.textContent =
        'This saved section has different lines. Start this machine with its supplied pieces to use the backpack.';
      actions.append(
        button('Restore this machine’s supplied lines', () => {
          if (
            allowed() &&
            confirm(
              'Restore just this machine’s supplied lines? Your earlier runs and answers stay in the case folder.',
            )
          )
            write(suppliedCode(station), null);
        }),
      );
    }
  }
  render();
  return {
    render,
    focus: () => {
      const tray = find('.pack-tray');
      const target = tray.hidden
        ? root
        : tray.querySelector('button:not([hidden])');
      (target || root).focus();
    },
  };
}
