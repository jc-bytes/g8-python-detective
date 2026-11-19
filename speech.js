// Keep the complete line in the live region. Only its visual reveal is staggered.
export function finishSpeech(element) {
  const playing = element.hasAttribute('data-revealing');
  element.removeAttribute('data-revealing');
  return playing;
}

export function speak(element, text) {
  if (element.textContent === text) return;
  finishSpeech(element);
  const words = text.match(/\S+\s*/g) || [];
  if (words.length < 3 || matchMedia('(prefers-reduced-motion: reduce)').matches) {
    element.textContent = text;
    return;
  }
  const parts = document.createDocumentFragment();
  for (let i = 0; i < words.length; i += 2) {
    const span = document.createElement('span');
    span.textContent = words.slice(i, i + 2).join('');
    span.style.setProperty('--speech-delay', `${i * 44}ms`);
    parts.append(span);
  }
  const last = parts.lastChild;
  last.addEventListener('animationend', () => finishSpeech(element), {once:true});
  element.setAttribute('data-revealing', '');
  element.replaceChildren(parts);
}
