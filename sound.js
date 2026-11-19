const preference = 'python-detective:sound-effects';
const clips = new Map();
let enabled = true;
try { enabled = localStorage.getItem(preference) !== 'off'; } catch { /* Use session preference. */ }

export function playSound(name, volume = 0.28) {
  if (!enabled || document.hidden) return;
  let clip = clips.get(name);
  if (!clip) {
    clip = new Audio(new URL(`./audio/${name}.wav`, import.meta.url));
    clips.set(name, clip);
  }
  clip.volume = volume;
  clip.currentTime = 0;
  clip.play().catch(() => {});
}

export function setupSoundToggle(button) {
  function update() {
    button.setAttribute('aria-pressed', String(enabled));
    button.textContent = `Sound effects ${enabled ? 'on' : 'off'}`;
  }
  update();
  button.onclick = () => {
    enabled = !enabled;
    try { localStorage.setItem(preference, enabled ? 'on' : 'off'); } catch { /* Still applies to this session. */ }
    if (!enabled) for (const clip of clips.values()) clip.pause();
    update();
    if (enabled) playSound('book_flip_1');
  };
}
