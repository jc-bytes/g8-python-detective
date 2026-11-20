import { colorCode } from './backpack.js';

// Keep the complete line in the live region. Only its visual reveal is staggered.
export function finishSpeech(element) {
  const playing = element.hasAttribute('data-revealing');
  element.removeAttribute('data-revealing');
  return playing;
}

function writeChunk(node, text, inlineCode) {
  if (!inlineCode) {
    node.textContent = text;
    return;
  }
  node.replaceChildren();
  for (const part of text.split(/(`[^`\n]+`)/)) {
    if (part.startsWith('`') && part.endsWith('`')) {
      const code = document.createElement('code');
      colorCode(code, part.slice(1, -1));
      node.append(code);
    } else node.append(part);
  }
}

export function speak(element, text, {inlineCode = false} = {}) {
  const plainText = inlineCode ? text.replace(/`([^`\n]+)`/g, '$1') : text;
  if (element.textContent === plainText && Boolean(element.querySelector('code')) === inlineCode) return;
  finishSpeech(element);
  const words = text.match(inlineCode ? /(?:`[^`\n]+`|[^`\s])+\s*/g : /\S+\s*/g) || [];
  if (words.length < 3 || matchMedia('(prefers-reduced-motion: reduce)').matches) {
    writeChunk(element, text, inlineCode);
    return;
  }
  const parts = document.createDocumentFragment();
  for (let i = 0; i < words.length; i += 2) {
    const span = document.createElement('span');
    writeChunk(span, words.slice(i, i + 2).join(''), inlineCode);
    span.style.setProperty('--speech-delay', `${i * 44}ms`);
    parts.append(span);
  }
  const last = parts.lastChild;
  last.addEventListener('animationend', () => finishSpeech(element), {once:true});
  element.setAttribute('data-revealing', '');
  element.replaceChildren(parts);
}
