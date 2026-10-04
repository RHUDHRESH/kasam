import { newSeed, seedToHex, enterLightMode, leaveLightMode, runLight, saveSeal, initOffline } from './code.js';
const $ = id => document.getElementById(id);
let stream, recorder, lock, stopLight, outputUrl, outputFile, active = false, discarded = false;
initOffline();
const message = (text, error = false) => { $('status').textContent = text; $('status').classList.toggle('error', error); };
function page(name) { ['setup', 'recording', 'result'].forEach(id => { $(id).hidden = id !== name; }); }
async function release() {
  stopLight?.(); stopLight = null;
  stream?.getTracks().forEach(track => track.stop()); stream = null;
  $('camera').srcObject = null;
  await leaveLightMode(lock); lock = null;
}
function chooseMime() {
  return ['video/mp4;codecs=avc1', 'video/mp4', 'video/webm;codecs=vp9', 'video/webm'].find(type => MediaRecorder.isTypeSupported(type));
}
function stop(discard = false) {
  if (!active) return;
  discarded ||= discard;
  stopLight?.();
  if (recorder && recorder.state !== 'inactive') recorder.stop();
}
$('seal-form').addEventListener('submit', async event => {
  event.preventDefault();
  if (active) return;
  message(''); $('start').disabled = true;
  if (!window.isSecureContext || !navigator.mediaDevices?.getUserMedia || !window.MediaRecorder) {
    message('Recording needs Chrome on HTTPS or localhost. Try Light-only mode if recording is unavailable.', true); $('start').disabled = false; return;
  }
  const seed = newSeed(), hex = seedToHex(seed), amp = Number($('amp').value), seconds = Number($('seconds').value);
  let chunks = [];
  active = true; discarded = false;
  try {
    lock = await enterLightMode();
    stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user', width: { ideal: 1280 }, height: { ideal: 720 }, frameRate: { ideal: 30 } }, audio: true });
    // Permission can resolve after the user has switched away. Do not create an incomplete seal.
    if (document.hidden || discarded) throw new Error('Keep this tab visible to record the light code.');
    const mimeType = chooseMime();
    recorder = new MediaRecorder(stream, mimeType ? { mimeType } : {});
    $('camera').srcObject = stream;
    await $('camera').play();
    page('recording');
    recorder.addEventListener('dataavailable', event => { if (event.data.size) chunks.push(event.data); });
    recorder.addEventListener('error', event => { message(event.error?.message || 'Recording failed. Please try again.', true); discarded = true; stop(true); });
    recorder.addEventListener('stop', async () => {
      active = false;
      await release(); $('start').disabled = false;
      if (discarded || !chunks.length) { page('setup'); message('Recording discarded. Keep this tab visible for the entire light sequence.', true); return; }
      const type = recorder.mimeType || chunks[0].type || 'video/webm';
      const ext = type.includes('mp4') ? 'mp4' : 'webm';
      const blob = new Blob(chunks, { type });
      outputFile = new File([blob], `kasam-${hex}.${ext}`, { type });
      if (outputUrl) URL.revokeObjectURL(outputUrl);
      outputUrl = URL.createObjectURL(blob);
      const sealedAtISO = new Date().toISOString();
      const saved = saveSeal({ hex, amp, seconds, sealedAtISO });
      $('playback').src = outputUrl;
      $('seal-code').textContent = hex;
      $('sealed-at').textContent = `Sealed ${new Date(sealedAtISO).toLocaleString()} · ${seconds} s light code + 1 s lead-in`;
      $('storage-note').textContent = saved ? 'Saved to recent seals on this device.' : 'Recent-seal storage is unavailable. Save this code yourself.';
      $('download').href = outputUrl; $('download').download = outputFile.name;
      $('verify-now').href = `./verify.html?seal=${hex}&amp=${amp}&s=${seconds}`;
      $('share').hidden = !navigator.canShare?.({ files: [outputFile] });
      page('result'); message(ext === 'webm' ? 'Saved as WebM. WhatsApp may require an MP4 from the native camera on another device.' : 'Your recording is ready. Verify it to check the seal.');
      chunks = [];
    }, { once: true });
    recorder.addEventListener('start', () => {
      const t0 = performance.now();
      stopLight = runLight({ seed, amp, seconds, t0, onTick: (remaining, fraction, lead) => {
        $('countdown').textContent = lead ? 'Steady light · lead-in' : `${Math.ceil(remaining)} s · Keep your face centred`;
        $('countdown-bar').style.transform = `scaleX(${fraction})`;
      }, onDone: () => stop() });
    }, { once: true });
    recorder.start();
  } catch (error) {
    active = false; discarded = true; await release(); page('setup'); $('start').disabled = false;
    message(error.name === 'NotAllowedError' ? 'Allow camera and microphone access in Chrome, then try again.' : error.message, true);
  }
});
$('stop').addEventListener('click', () => stop(true));
$('again').addEventListener('click', () => { $('playback').pause(); page('setup'); message(''); });
$('share').addEventListener('click', async () => {
  try {
    // Downloads use the requested seal filename. Shares keep the code out of it.
    const extension = outputFile.name.endsWith('.mp4') ? 'mp4' : 'webm';
    const shareFile = new File([outputFile], `kasam-video.${extension}`, { type: outputFile.type });
    await navigator.share({ files: [shareFile], title: 'KASAM sealed video' });
  }
  catch (error) { if (error.name !== 'AbortError') message('Sharing is unavailable. Download the video instead.', true); }
});
document.addEventListener('visibilitychange', () => { if (document.hidden && active) stop(true); });
window.addEventListener('pagehide', () => { discarded = true; stop(true); stream?.getTracks().forEach(track => track.stop()); });
