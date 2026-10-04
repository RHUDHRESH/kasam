import { hexToSeed, seedToHex, recentSeals, formatTime, initOffline } from './code.js';
import { sampleVideo, removeCut, analyzeSignals, syntheticSignals } from './analyze.js';
const $ = id => document.getElementById(id);
const params = new URLSearchParams(location.search);
let controller, report, cached, reportUrl, demoMode = false;
initOffline();
function status(text, error = false) { $('status').textContent = text; $('status').classList.toggle('error', error); }
function prefill(hex, amp, seconds) {
  $('seal').value = hex || '';
  if ([0.02, 0.05, 0.10, 0.15].includes(Number(amp))) $('amp').value = String(Number(amp));
  if ([10, 20, 30].includes(Number(seconds))) $('seconds').value = String(Number(seconds));
}
const seals = recentSeals();
if (seals.length) {
  $('recent-label').hidden = false;
  seals.forEach((value, index) => {
    const option = document.createElement('option'); option.value = index;
    option.textContent = `${value.hex} · ${new Date(value.sealedAtISO).toLocaleDateString()}`; $('recent').append(option);
  });
}
if (params.has('seal')) prefill(params.get('seal').toUpperCase(), params.get('amp'), params.get('s'));
else if (seals.length) prefill(seals[0].hex, seals[0].amp, seals[0].seconds);
$('recent').addEventListener('change', () => { const value = seals[Number($('recent').value)]; if ($('recent').value !== '' && value) prefill(value.hex, value.amp, value.seconds); });
$('simulate').addEventListener('change', () => { $('cut-fields').hidden = !$('simulate').checked; });
$('file').addEventListener('change', () => {
  demoMode = false; cached = null; $('demo-note').hidden = true;
  $('results').hidden = true; $('waiting').hidden = false; status('');
});
function busy(value) {
  $('analyse').disabled = value; $('demo').disabled = value; $('cancel').hidden = !value;
  $('progress-panel').hidden = !value;
  $('verify-form').querySelectorAll('input,select').forEach(element => { element.disabled = value; });
}
async function analyse() {
  if (controller) return;
  let seed;
  try { seed = hexToSeed($('seal').value); } catch (error) { status(error.message, true); return; }
  const file = $('file').files[0];
  if (!file && !demoMode) { status('Choose a video file first, or try the synthetic demo.', true); return; }
  const seconds = Number($('seconds').value), amp = Number($('amp').value);
  controller = new AbortController(); busy(true); status(''); $('results').hidden = true; $('waiting').hidden = true;
  $('progress').value = 0; $('progress-label').textContent = 'Reading video frames…';
  try {
    let samples;
    if (demoMode) {
      const raw = syntheticSignals();
      samples = { ...raw, frames: raw.times.length, duration: 21, effectiveFps: 30, sampling: 'synthetic samples' };
    } else if (cached?.file === file) samples = cached.samples;
    else {
      samples = await sampleVideo(file, { signal: controller.signal, onProgress: value => { $('progress').value = value; $('progress-label').textContent = `Reading frames · ${Math.round(value * 100)}%`; } });
      cached = { file, samples };
    }
    if (controller.signal.aborted) throw new DOMException('Analysis cancelled', 'AbortError');
    let input = samples;
    const cut = $('simulate').checked ? { from: Number($('cut-a').value), to: Number($('cut-b').value) } : null;
    if (cut) input = removeCut(samples.times, samples.bright, cut.from, cut.to);
    const result = analyzeSignals(input.times, input.bright, seed, seconds);
    report = { schema: 'kasam-report-v1', prototype: true, synthetic: demoMode, seal: seedToHex(seed), amp, seconds, fileName: demoMode ? 'synthetic-demo' : file.name, verifiedAtISO: new Date().toISOString(), simulatedCut: cut, framesAnalysed: samples.frames, samplesAfterCut: input.times.length, effectiveFps: samples.effectiveFps, sampling: samples.sampling, ...result };
    render(report);
    $('results').hidden = false;
    status(demoMode ? 'Synthetic test complete. This demonstrates the maths; it does not measure phone or WhatsApp performance.' : 'Verified offline. The video was never uploaded.');
  } catch (error) {
    $('waiting').hidden = false;
    status(error.name === 'AbortError' ? 'Analysis cancelled.' : error.message, error.name !== 'AbortError');
  } finally { controller = null; busy(false); }
}
$('verify-form').addEventListener('submit', event => { event.preventDefault(); analyse(); });
$('cancel').addEventListener('click', () => controller?.abort());
$('demo').addEventListener('click', () => {
  demoMode = true; $('file').value = ''; cached = null; $('demo-note').hidden = false;
  prefill('12345678', 0.10, 20); analyse();
});
document.addEventListener('visibilitychange', () => { if (document.hidden && controller) controller.abort(); });
function editText(edit) {
  return `${Math.abs(edit.shiftSeconds).toFixed(1)} s ${edit.shiftSeconds < 0 ? 'removed' : 'inserted'} near ${formatTime(edit.boundaryTime ?? edit.atVideoTime)}`;
}
function certificate(r) {
  const when = new Date(r.verifiedAtISO).toLocaleString();
  const prefix = r.synthetic ? 'SYNTHETIC DEMO — NOT A CAMERA CERTIFICATE\n\n' : '';
  let english, hindi;
  if (r.verdict === 'GO') {
    english = `KASAM certificate: this video carries seal ${r.seal}. The sampled light code matches with no detected timing breaks (match strength z = ${r.z.toFixed(1)}). Verified offline on this device at ${when}.`;
    hindi = 'इस वीडियो में कसम का प्रकाश संकेत मिला। जाँचे गए हिस्सों में कोई समय-संबंधी काट-छाँट नहीं मिली।';
  } else if (r.verdict === 'TAMPERED') {
    english = `KASAM: the oath is broken. Seal ${r.seal} is present, but the timeline jumps: ${r.edits.map(editText).join('; ')}. The signal indicates an edit. Verified offline at ${when}.`;
    hindi = `कसम टूट गई: ${r.edits.map(e => `${formatTime(e.boundaryTime ?? e.atVideoTime)} के पास लगभग ${Math.abs(e.shiftSeconds).toFixed(1)} सेकंड ${e.shiftSeconds < 0 ? 'हटाए गए हैं' : 'जोड़े गए हैं'}`).join('; ')}।`;
  } else if (r.verdict === 'WEAK') {
    english = `KASAM: seal ${r.seal} is faint (z = ${r.z.toFixed(1)}). Try a higher amplitude or a less brightly lit room. Verified offline at ${when}.`;
    hindi = 'कसम का संकेत कमज़ोर है। प्रकाश का बदलाव बढ़ाएँ या कम रोशनी वाले कमरे में फिर रिकॉर्ड करें।';
  } else {
    english = `KASAM: no seal found for code ${r.seal} (z = ${r.z.toFixed(1)}). This may be the wrong code, weak lighting, or a video without this seal. Verified offline at ${when}.`;
    hindi = 'इस कोड के लिए कसम का संकेत नहीं मिला। कोड गलत हो सकता है या प्रकाश का संकेत बहुत कमज़ोर हो सकता है।';
  }
  return `${prefix}${english}\n\n${hindi}\n\nPrototype result: a light-code match does not authenticate identity, audio, or the truth of spoken claims. Checks use 4-second windows and can miss edits.`;
}
function render(r) {
  const titles = { GO: 'Sealed and untouched', TAMPERED: 'Oath broken', WEAK: 'The seal is faint', 'NO-GO': 'No seal' };
  const descriptions = { GO: 'The light code matched. No timing breaks were detected in the checked windows.', TAMPERED: 'Kasam toot gayi. The code is present, but its timing jumps.', WEAK: 'A possible match. Try a higher amplitude for a stronger seal.', 'NO-GO': 'No KASAM seal found for this seal code. Check the code and recording conditions.' };
  $('source-note').textContent = r.synthetic ? 'SYNTHETIC DEMO / MATHS CHECK' : r.simulatedCut ? 'YOUR VIDEO / SIMULATED CUT' : 'YOUR VIDEO / OFFLINE ANALYSIS';
  $('verdict-card').className = `verdict-card ${r.verdict.toLowerCase()}`;
  $('verdict').textContent = r.verdict; $('verdict-title').textContent = titles[r.verdict]; $('verdict-description').textContent = descriptions[r.verdict];
  $('z-score').textContent = r.z.toFixed(2); $('lag').textContent = r.lagSeconds.toFixed(2); $('frames').textContent = r.framesAnalysed;
  $('fps').textContent = `${r.effectiveFps.toFixed(1)} fps · ${r.sampling}`;
  $('edit-list').replaceChildren();
  r.edits.forEach(edit => { const li = document.createElement('li'); li.textContent = editText(edit); $('edit-list').append(li); });
  $('timeline-note').textContent = r.rows.length ? `${r.rows.filter(row => row.sealed).length} of ${r.rows.length} windows carry the code. Locations are approximate; overlapping windows can shift the marker.` : 'No timeline: the whole-clip match did not reach the seal threshold.';
  report.certificate = certificate(r); $('certificate').textContent = report.certificate;
  if (reportUrl) URL.revokeObjectURL(reportUrl);
  reportUrl = URL.createObjectURL(new Blob([JSON.stringify(report, null, 2)], { type: 'application/json' }));
  $('report').href = reportUrl; $('report').download = `kasam-report-${report.seal}.json`;
  timeline(r); correlation(r);
}
function timeline(r) {
  const canvas = $('timeline'), ctx = canvas.getContext('2d'); ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.font = '18px Arial'; ctx.fillStyle = '#b6b0be';
  if (!r.rows.length) { ctx.fillText('No matched windows', 20, 60); canvas.setAttribute('aria-label', 'No matched windows'); return; }
  const pad = 15, width = (canvas.width - pad * 2) / r.rows.length;
  r.rows.forEach((row, i) => {
    ctx.fillStyle = row.sealed ? '#5BC48A' : '#504859'; ctx.fillRect(pad + i * width, 20, Math.max(2, width - 4), 48);
    if (i % 3 === 0) { ctx.fillStyle = '#b6b0be'; ctx.fillText(formatTime(row.codeTime), pad + i * width, 96); }
    if (row.edit) {
      const x = pad + i * width + width / 2;
      ctx.strokeStyle = '#EF6A5B'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(x, 8); ctx.lineTo(x, 110); ctx.stroke();
      ctx.fillStyle = '#EF6A5B'; ctx.font = '16px Arial'; ctx.fillText(editText(row.edit), Math.max(10, Math.min(x - 90, canvas.width - 320)), 138); ctx.font = '18px Arial';
    }
  });
  canvas.setAttribute('aria-label', `${r.rows.filter(row => row.sealed).length} sealed windows. ${r.edits.map(editText).join('. ')}`);
}
function correlation(r) {
  const canvas = $('correlation'), ctx = canvas.getContext('2d'), pad = 35;
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  const low = Math.min(0, ...r.corr), high = Math.max(...r.corr) + 0.05;
  const x = i => pad + i / Math.max(1, r.corr.length - 1) * (canvas.width - 2 * pad);
  const y = v => 15 + (high - v) / Math.max(1e-9, high - low) * (canvas.height - 60);
  ctx.strokeStyle = '#36313f'; ctx.beginPath(); ctx.moveTo(pad, y(0)); ctx.lineTo(canvas.width - pad, y(0)); ctx.stroke();
  ctx.strokeStyle = '#F4C95D'; ctx.lineWidth = 2; ctx.beginPath(); r.corr.forEach((v, i) => { if (i) ctx.lineTo(x(i), y(v)); else ctx.moveTo(x(i), y(v)); }); ctx.stroke();
  ctx.fillStyle = '#F8F4EF'; ctx.beginPath(); ctx.arc(x(r.peakIndex), y(r.corr[r.peakIndex]), 5, 0, Math.PI * 2); ctx.fill();
  ctx.font = '17px Arial'; ctx.fillStyle = '#b6b0be'; ctx.fillText('0 s', pad, canvas.height - 12); ctx.fillText(`${((r.corr.length - 1) / 15).toFixed(1)} s lag`, canvas.width - 140, canvas.height - 12);
  canvas.setAttribute('aria-label', `Correlation peak at ${r.lagSeconds.toFixed(2)} seconds; z-score ${r.z.toFixed(2)}`);
}
$('copy').addEventListener('click', async () => {
  try { await navigator.clipboard.writeText(report.certificate); status('Certificate copied.'); }
  catch { status('Copy is unavailable. Select the certificate text and copy it manually.', true); }
});
if (params.get('demo') === '1') $('demo').click();
