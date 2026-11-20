import { paint as paintArt } from './shop-art.js';
import { stationRange } from './shop-tasks.js';
import { STARTER, LEGACY_STARTER, receiptFor } from './case.js';

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
export function suppliedCode(station, starter = STARTER) {
  const { first, count } = repairs[station];
  return starter.trimEnd().split('\n').slice(first, first + count).join('\n');
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
    for (const [index, t] of tokens(line).entries()) {
      const span = document.createElement('span');
      span.className = 'py-' + kind(t);
      if (index === 0 && /^ +$/.test(t)) span.classList.add('py-indent');
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
  const actual = signature(source);
  if (actual === signature(repairs[station].fixed)) return true;
  if (station === 'bracket') return actual === signature(suppliedCode(station, LEGACY_STARTER) + ')');
  if (station === 'indent') return actual === signature(suppliedCode(station, LEGACY_STARTER).replace('\n', '\n    '));
  return false;
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
const allStock = Object.values(repairs).flatMap(repair => repair.stock);
const slotOrder = [...new Set(allStock)];

export function carriedPieces(attempt) {
  return Object.keys(repairs).flatMap(station => {
    const range = stationRange(attempt, station);
    if (!range) return repairs[station].stock;
    return inventory(station, attempt.source.slice(...range), attempt.backpacks[station]);
  });
}

export function inventoryCount(remaining) {
  return `${remaining.length} of ${allStock.length} left`;
}

export function renderInventory(container, remaining, available = [], makePiece) {
  container.replaceChildren();
  for (const token of slotOrder) {
    const count = remaining.filter(piece => piece === token).length;
    const usable = available.includes(token) && count > 0;
    const slot = usable ? makePiece(token) : document.createElement('span');
    slot.classList.add('inventory-slot', 'py-' + kind(token));
    slot.classList.toggle('slot-used', count === 0);
    const label = document.createElement('span');
    label.className = 'slot-label';
    label.textContent = token;
    if (token === '    ') label.classList.add('indent-piece');
    const quantity = document.createElement('small');
    quantity.className = 'slot-quantity';
    quantity.textContent = `×${count}`;
    slot.replaceChildren(label, quantity);
    if (makePiece && count && !usable) {
      slot.classList.add('slot-stored');
      slot.title = 'For another repair';
    }
    if (!usable) slot.setAttribute('role', 'img');
    slot.setAttribute('aria-label', [display(token), `${count} left`, slot.title].filter(Boolean).join(', '));
    container.append(slot);
  }
}
// Use the same spots for dragging, tapping and keyboard placement.
function nearestSpot(code, x, y) {
  const bounds = code.getBoundingClientRect();
  if (x < bounds.left || x > bounds.right || y < bounds.top || y > bounds.bottom) return null;
  let nearest = null;
  let best = 30;
  for (const spot of code.querySelectorAll('.pack-spot')) {
    const rect = spot.getBoundingClientRect();
    if (rect.right <= bounds.left || rect.left >= bounds.right) continue;
    const dx = Math.max(rect.left - x, 0, x - rect.right);
    const dy = Math.max(rect.top - y, 0, y - rect.bottom);
    const distance = Math.hypot(dx, dy);
    if (distance < best) {
      nearest = spot;
      best = distance;
    }
  }
  return nearest;
}

export function makeBackpack(
  root,
  { station, read, saved, write, allowed, onHint, attempt },
) {
  let picked = null;
  let cancelDrag;
  const button = (label, fn) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.textContent = label;
    b.onclick = fn;
    return b;
  };
  root.innerHTML =
    '<div class="pack-code" role="group" aria-label="Machine code"></div><div class="pack-tray" role="group" aria-label="Backpack"><header class="pack-header"><canvas width="28" height="25" aria-hidden="true"></canvas><div><strong>Backpack</strong><span class="pack-count" aria-live="polite"></span></div></header><div class="pack-pieces"></div><div class="pack-tools"><button class="pack-undo" type="button">Undo last move</button><button class="pack-hint" type="button">Hint</button></div></div><div class="pack-guidance"><small class="pack-help" role="status"></small><div class="pack-actions"></div></div>';
  const find = (s) => root.querySelector(s),
    code = find('.pack-code'),
    pieces = find('.pack-pieces'),
    actions = find('.pack-actions'),
    help = find('.pack-help'),
    undo = find('.pack-undo');
  paintArt(find('.pack-header canvas'), 'satchel');
  find('.pack-hint').onclick = onHint;
  function render() {
    cancelDrag?.();
    const source = read(),
      state = restoreBackpack(station, saved(), source) || {
        base: source,
        moves: [],
      };
    const { rows, bag } = board(station, state.base, state.moves);
    const compatible =
      signature(state.base) === signature(suppliedCode(station, receiptFor(attempt).starter)) ||
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
      if (write(next.source, { base: state.base, moves })) {
        render();
        (
          pieces.querySelector('button') ||
          document.querySelector('#order-form button')
        )?.focus();
      }
    }
    function showCode() {
      code.replaceChildren();
      for (const [r, row] of rows.entries()) {
        const line = document.createElement('div');
        line.className = 'pack-line';
        for (const [c, token] of row.entries()) {
          const selecting = active && bag.includes(picked) && token.trim();
          function spot(op) {
            const piece = picked;
            const replace = op === 'replace';
            const target = button(replace ? token : '', () =>
              apply([...state.moves, { row: r, col: c, op, piece }]));
            target.className = replace ? 'pack-spot pack-swap py-' + kind(token) : 'pack-spot pack-gap';
            target.dataset.preview = piece === '    ' ? '····' : piece;
            const place = replace ? 'Replace' : 'Place ' + op;
            target.setAttribute('aria-label', `${place} ${token}, line ${r + 1}, position ${c + 1}`);
            return target;
          }
          if (selecting) line.append(spot('before'));
          if (selecting && operations(picked, token).includes('replace')) {
            line.append(spot('replace'));
          } else {
            const span = document.createElement('span');
            span.className = 'py-' + kind(token);
            span.textContent = token;
            line.append(span);
          }
          // Adjacent tokens share a gap. Keep both sides of real spaces available.
          if (selecting && !row[c + 1]?.trim()) line.append(spot('after'));
        }
        code.append(line);
      }
    }
    function updateGuidance() {
      if (active && station === 'indent') {
        if (state.moves.length) help.textContent = 'Select Check code to test your change.';
        else if (picked) help.textContent = 'Choose the spot in the code where you want to place your piece.';
        else help.textContent = 'Drag a piece from your Backpack onto the code. You can also select the piece, then select a spot.';
      } else {
        help.textContent = bag.length
          ? picked ? 'Pick a spot in the code.' : 'Drag a piece to the code.'
          : 'Try your code.';
      }
    }
    function select(piece) {
      picked = piece;
      showCode();
      for (const slot of pieces.querySelectorAll('button'))
        slot.setAttribute('aria-pressed', String(slot.dataset.token === piece));
      updateGuidance();
    }
    function startPointer(event, slot, piece) {
      if (event.button !== 0 || !event.isPrimary || !allowed() || cancelDrag) return;
      const { clientX: startX, clientY: startY, pointerId } = event;
      let x = startX, y = startY;
      let ghost, target, frame;
      const previous = picked;
      slot.setPointerCapture(pointerId);

      function preview() {
        const next = nearestSpot(code, x, y);
        target?.classList.remove('pack-near');
        target = next;
        target?.classList.add('pack-near');
        ghost.hidden = Boolean(target);
      }
      function scrollEdge() {
        const bounds = code.getBoundingClientRect();
        if (y >= bounds.top && y <= bounds.bottom && x >= bounds.left && x <= bounds.right) {
          const direction = x < bounds.left + 20 ? -1 : x > bounds.right - 20 ? 1 : 0;
          if (direction) {
            code.scrollLeft += direction * 5;
            preview();
          }
        }
        frame = requestAnimationFrame(scrollEdge);
      }
      function move(e) {
        if (e.pointerId !== pointerId) return;
        x = e.clientX;
        y = e.clientY;
        if (!ghost) {
          if (Math.hypot(x - startX, y - startY) < 5) return;
          slot.dataset.dragged = 'true';
          select(piece);
          ghost = document.createElement('span');
          ghost.className = 'pack-ghost';
          ghost.setAttribute('aria-hidden', 'true');
          ghost.textContent = piece;
          if (piece === '    ') ghost.classList.add('indent-piece');
          root.append(ghost);
          frame = requestAnimationFrame(scrollEdge);
        }
        ghost.style.left = x + 'px';
        ghost.style.top = y + 'px';
        preview();
      }
      function clear() {
        cancelAnimationFrame(frame);
        ghost?.remove();
        target?.classList.remove('pack-near');
        slot.onpointermove = slot.onpointerup = slot.onpointercancel = slot.onlostpointercapture = null;
        window.removeEventListener('blur', cancel);
        root.removeEventListener('keydown', escape, true);
        if (slot.hasPointerCapture(pointerId)) slot.releasePointerCapture(pointerId);
        cancelDrag = null;
      }
      function cancel() {
        clear();
        if (ghost) select(previous);
      }
      function escape(e) {
        if (e.key === 'Escape') {
          e.preventDefault();
          e.stopPropagation();
          cancel();
        }
      }
      cancelDrag = cancel;
      window.addEventListener('blur', cancel);
      root.addEventListener('keydown', escape, true);
      slot.onpointercancel = slot.onlostpointercapture = cancel;
      slot.onpointermove = move;
      slot.onpointerup = e => {
        if (e.pointerId !== pointerId) return;
        const drop = ghost && nearestSpot(code, e.clientX, e.clientY);
        clear();
        if (!ghost) return; // A short press uses the ordinary click handler.
        if (drop) drop.click();
        else select(previous);
      };
    }
    showCode();
    actions.replaceChildren();
    find('.pack-tray').hidden = !active || (!bag.length && !state.moves.length);
    const remaining = carriedPieces(attempt);
    find('.pack-count').textContent = inventoryCount(remaining);
    renderInventory(pieces, remaining, active ? bag : [], t => {
      const b = paint(t, 'pack-piece', e => {
        // After pointer capture, a drag can also send a click to the starting slot.
        if (e.detail && b.dataset.dragged) return;
        select(picked === t ? null : t);
        if (picked && !e.detail) code.querySelector('button')?.focus();
      });
      b.dataset.token = t;
      b.setAttribute('aria-pressed', String(picked === t));
      b.onpointerdown = e => {
        delete b.dataset.dragged;
        startPointer(e, b, t);
      };
      return b;
    });
    find('.pack-guidance').hidden = find('.pack-tray').hidden;
    updateGuidance();
    undo.hidden = !state.moves.length;
    undo.onclick = () => apply(state.moves.slice(0, -1));
    if (!compatible && allowed()) {
      find('.pack-guidance').hidden = false;
      find('.pack-tray').hidden = false;
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
            write(suppliedCode(station, receiptFor(attempt).starter), null);
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
