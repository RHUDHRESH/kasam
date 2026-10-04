import { newSeed, seedToHex, enterLightMode, leaveLightMode, runLight, saveSeal, initOffline } from './code.js';
const $ = id => document.getElementById(id);
let seed = newSeed(), active = false, lock, stopLight;
initOffline();
function fresh() { seed = newSeed(); $('seal-code').textContent = seedToHex(seed); }
function page(name) { ['setup', 'lighting', 'done'].forEach(id => { $(id).hidden = id !== name; }); }
function message(text) { $('status').textContent = text; }
$('seal-code').textContent = seedToHex(seed);
$('new-code').addEventListener('click', fresh);
$('start').addEventListener('click', async () => {
  if (active) return;
  active = true; $('start').disabled = true; message('');
  const hex = seedToHex(seed), amp = Number($('amp').value), seconds = Number($('seconds').value);
  lock = await enterLightMode();
  if (!active || document.hidden) { await end(true); return; }
  page('lighting');
  stopLight = runLight({ seed, amp, seconds, onTick: (remaining, fraction, lead) => {
    $('countdown').textContent = lead ? '1 s lead-in · Recording camera should already be running' : `${Math.ceil(remaining)} s · Light sequence running`;
    $('countdown-bar').style.transform = `scaleX(${fraction})`;
  }, onDone: async () => {
    const saved = saveSeal({ hex, amp, seconds, sealedAtISO: new Date().toISOString() });
    await end(false);
    $('done-code').textContent = hex;
    $('storage-note').textContent = saved ? 'Saved to recent seals on this device.' : 'Save this code yourself; local storage is unavailable.';
    $('verify-now').href = `./verify.html?seal=${hex}&amp=${amp}&s=${seconds}`;
    page('done');
  } });
});
async function end(discard) {
  active = false; stopLight?.(); stopLight = null;
  await leaveLightMode(lock); lock = null; $('start').disabled = false;
  if (discard) { page('setup'); message('Sequence interrupted. Start again with a fresh code and keep this screen visible.'); fresh(); }
}
$('stop').addEventListener('click', () => end(true));
$('again').addEventListener('click', () => { fresh(); page('setup'); message(''); });
document.addEventListener('visibilitychange', () => { if (document.hidden && active) end(true); });
window.addEventListener('pagehide', () => { stopLight?.(); lock?.release().catch(() => {}); });
