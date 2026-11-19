// A writing reminder, not a grammar or correctness score.
export function sentenceReminder(text) {
  const value = text.trim();
  if (!value) return '';
  const words = value.match(/[\p{L}\p{N}_]+(?:['’][\p{L}]+)*/gu) || [];
  if (words.length < 2 || /^(?:to\s+\w+|because\b)[^,;.!?]*[.!?]?$/i.test(value)) {
    return 'This looks like part of a sentence. Say what happened in your own words.';
  }
  if (!/[.!?]["'”’)]*$/.test(value)) return 'Check your sentence. Does it express a complete thought and end with a period, question mark, or exclamation mark?';
  return '';
}

export function setupAnswerField(field, feedback, checkOnBlur = true) {
  feedback.setAttribute('role', 'status');
  feedback.classList.add('answer-feedback');
  const descriptions = [field.getAttribute('aria-describedby'), feedback.id].filter(Boolean);
  field.setAttribute('aria-describedby', descriptions.join(' '));
  function blockClipboard(event) {
    event.preventDefault();
    feedback.textContent = 'Type your answer in your own words. Copying and pasting are turned off in this field.';
  }
  for (const type of ['copy', 'cut', 'paste', 'drop']) field.addEventListener(type, blockClipboard);
  field.addEventListener('beforeinput', event => {
    if (['insertFromPaste', 'insertFromPasteAsQuotation', 'insertFromDrop', 'deleteByCut'].includes(event.inputType)) blockClipboard(event);
  });
  field.addEventListener('input', () => { feedback.textContent = ''; });
  if (checkOnBlur) field.addEventListener('blur', () => { feedback.textContent = sentenceReminder(field.value); });
}
