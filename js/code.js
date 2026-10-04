export const CODE_FPS = 15;
export const LEAD_IN_S = 1;
export const DEFAULT_SECONDS = 20;
export const DEFAULT_AMP = 0.10;

export function mulberry32(a) {
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
export function newSeed() { return crypto.getRandomValues(new Uint32Array(1))[0]; }
export function seedToHex(seed) { return (seed >>> 0).toString(16).toUpperCase().padStart(8, '0'); }
export function hexToSeed(hex) {
  if (!/^[0-9a-f]{8}$/i.test(String(hex).trim())) throw new Error('Enter exactly 8 hexadecimal characters (0–9, A–F).');
  return parseInt(hex.trim(), 16) >>> 0;
}
export function codeBits(seed, n) {
  const random = mulberry32(seed);
  return Array.from({ length: n }, () => random() >= 0.5 ? 1 : -1);
}
export function levelFor(c, amp) { return 1 - amp + amp * c; }
export function selfTestCode() {
  const expected = [-1, 1, 1, -1, 1, 1, -1, -1];
  if (JSON.stringify(codeBits(0x12345678, 8)) !== JSON.stringify(expected)) throw new Error('Light-code self-test failed.');
  return expected;
}
export function recentSeals() {
  try {
    const values = JSON.parse(localStorage.getItem('kasam-seals') || '[]');
    return Array.isArray(values) ? values.filter(v => /^[0-9A-F]{8}$/.test(v.hex) && [0.02, 0.05, 0.10, 0.15].includes(v.amp) && [10, 20, 30].includes(v.seconds)).slice(0, 25) : [];
  } catch { return []; }
}
export function saveSeal(value) {
  try {
    localStorage.setItem('kasam-seals', JSON.stringify([value, ...recentSeals().filter(v => v.hex !== value.hex)].slice(0, 25)));
    return true;
  } catch { return false; }
}
export async function enterLightMode() {
  // Fullscreen must be requested during the user's tap, before awaiting camera access.
  const fullscreen = document.documentElement.requestFullscreen?.().catch(() => {});
  let lock;
  try { lock = await navigator.wakeLock?.request('screen'); } catch { /* Optional on some phones. */ }
  await fullscreen;
  return lock;
}
export async function leaveLightMode(lock) {
  document.body.classList.remove('lighting');
  document.body.style.removeProperty('background-color');
  try { await lock?.release(); } catch { /* Lock may already be released. */ }
  try { if (document.fullscreenElement) await document.exitFullscreen(); } catch { /* Browser owns fullscreen. */ }
}
export function runLight({ seed, amp, seconds, t0 = performance.now(), onTick, onDone }) {
  const bits = codeBits(seed, seconds * CODE_FPS);
  const total = LEAD_IN_S + seconds;
  let frame, stopped = false;
  document.body.classList.add('lighting');
  const tick = now => {
    if (stopped) return;
    const elapsed = (now - t0) / 1000;
    const k = Math.floor((now - t0 - LEAD_IN_S * 1000) / (1000 / CODE_FPS));
    if (k >= bits.length) { stopped = true; onDone(); return; }
    const level = k < 0 ? 1 - amp : levelFor(bits[k], amp);
    const l = Math.round(255 * level);
    document.body.style.backgroundColor = `rgb(${l},${l},${l})`;
    onTick?.(Math.max(0, total - elapsed), Math.min(1, elapsed / total), k < 0);
    frame = requestAnimationFrame(tick);
  };
  frame = requestAnimationFrame(tick);
  return () => { stopped = true; cancelAnimationFrame(frame); };
}
export function formatTime(seconds) {
  const s = Math.max(0, Math.round(seconds));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}
export function initOffline() {
  selfTestCode();
  const label = document.querySelector('[data-offline]');
  if (!('serviceWorker' in navigator) || !window.isSecureContext) {
    if (label) label.textContent = 'Use HTTPS or localhost for camera & offline mode';
    return;
  }
  navigator.serviceWorker.register('./sw.js').then(async registration => {
    await navigator.serviceWorker.ready;
    const showReady = () => { if (label) label.textContent = 'Offline ready · Nothing leaves this device'; };
    if (registration.active) showReady();
    else registration.installing?.addEventListener('statechange', showReady);
  }).catch(() => { if (label) label.textContent = 'Offline cache unavailable · Video stays on this device'; });
}
