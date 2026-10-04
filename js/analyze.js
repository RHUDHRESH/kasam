import { CODE_FPS, codeBits } from './code.js';

const mean = a => a.length ? a.reduce((sum, v) => sum + v, 0) / a.length : 0;
const deviation = a => { const avg = mean(a); return Math.sqrt(mean(a.map(v => (v - avg) ** 2))); };

export function removeCut(times, bright, a, b) {
  if (!(Number.isFinite(a) && Number.isFinite(b) && a >= 0 && b > a && b <= times.at(-1))) {
    throw new Error('The cut must end after it starts and fit inside the video.');
  }
  const t = [], y = [];
  times.forEach((time, i) => {
    if (time < a || time >= b) { t.push(time >= b ? time - (b - a) : time); y.push(bright[i]); }
  });
  return { times: t, bright: y };
}
export function resample(times, bright) {
  const count = Math.floor(times.at(-1) * CODE_FPS + 1e-7) + 1;
  const values = [];
  let j = 0;
  for (let i = 0; i < count; i++) {
    const t = i / CODE_FPS;
    while (j + 1 < times.length && times[j + 1] <= t) j++;
    if (t <= times[0] || j + 1 === times.length) values.push(bright[j]);
    else {
      const f = (t - times[j]) / (times[j + 1] - times[j]);
      values.push(bright[j] * (1 - f) + bright[j + 1] * f);
    }
  }
  return values;
}
export function detrend(values) {
  const prefix = [0];
  values.forEach(v => prefix.push(prefix.at(-1) + v));
  // Centre a one-second (15 sample) box filter; truncate it at clip edges.
  const residual = values.map((v, i) => {
    const a = Math.max(0, i - 7), b = Math.min(values.length, i + 8);
    return v - (prefix[b] - prefix[a]) / (b - a);
  });
  const sd = deviation(residual) + 1e-9;
  return residual.map(v => v / sd);
}
function dotAt(s, code, position, start = 0, length = code.length - start) {
  let sum = 0;
  for (let i = 0; i < length; i++) sum += s[position + i] * code[start + i];
  return sum / length;
}
function editBoundary(s, code, lag, start, before, after) {
  // A 4-second match identifies a window, not an exact cut boundary. Within that
  // window, fit one switch between the old and new alignments on the VIDEO clock.
  const low = Math.max(0, lag + start + Math.min(before, after));
  const high = Math.min(s.length, lag + start + Math.max(before, after) + 60);
  const score = (p, offset) => {
    const k = p - lag - offset;
    return k >= 0 && k < code.length ? s[p] * code[k] : 0;
  };
  let total = 0;
  for (let p = low; p < high; p++) total += score(p, after);
  let best = total, boundary = low;
  for (let p = low; p < high; p++) {
    total += score(p, before) - score(p, after);
    if (total > best + 1e-9) { best = total; boundary = p + 1; }
  }
  return boundary / CODE_FPS;
}
export function analyzeSignals(times, bright, seed, seconds = 20) {
  if (![10, 20, 30].includes(seconds)) throw new Error('Choose a code duration of 10, 20 or 30 seconds.');
  if (times.length !== bright.length || times.length < 2 || times.some((t, i) => !Number.isFinite(t) || t < 0 || (i && t <= times[i - 1])) || bright.some(v => !Number.isFinite(v))) {
    throw new Error('Frame samples must contain finite brightness values and increasing timestamps.');
  }
  const s = detrend(resample(times, bright));
  const code = codeBits(seed, seconds * CODE_FPS), n = code.length;
  if (s.length < Math.floor(n / 2) + 6) throw new Error('Video is too short for this duration. Choose a shorter code duration or a longer video.');
  const corr = [];
  for (let lag = 0; lag <= s.length - Math.floor(n / 2); lag++) {
    corr.push(dotAt(s, code, lag, 0, Math.min(n, s.length - lag)));
  }
  let lag = 0;
  corr.forEach((r, i) => { if (r > corr[lag]) lag = i; });
  const rest = corr.filter((_, i) => Math.abs(i - lag) > 2);
  const z = (corr[lag] - mean(rest)) / (deviation(rest) + 1e-9);
  const rows = [], edits = [], win = 60;
  let prev;
  if (z >= 3.5) {
    for (let start = 0; start + win <= n; start += CODE_FPS) {
      const rAt = pos => pos < 0 || pos + win > s.length ? -1 : dotAt(s, code, pos, start, win);
      const low = Math.max(0, lag + start - 45), high = Math.min(s.length - win, lag + start + 45);
      let pos = low, r = -1;
      for (let candidate = low; candidate <= high; candidate++) {
        const score = rAt(candidate);
        if (score > r) { r = score; pos = candidate; }
      }
      const offset = pos - (lag + start);
      if (prev === undefined) prev = offset;
      const row = { codeTime: start / CODE_FPS, r, sealed: r > 0.2 };
      const r0 = rAt(lag + start + prev);
      if (Math.abs(offset - prev) >= 3 && r > 0.3 && r > r0 + 0.15) {
        row.edit = { atVideoTime: pos / CODE_FPS, shiftSeconds: (offset - prev) / CODE_FPS };
        row.edit.boundaryTime = editBoundary(s, code, lag, start, prev, offset);
        edits.push(row.edit);
        prev = offset;
      }
      rows.push(row);
    }
  }
  const verdict = z < 3.5 ? 'NO-GO' : edits.length ? 'TAMPERED' : z > 5 ? 'GO' : 'WEAK';
  return { verdict, z, lagSeconds: lag / CODE_FPS, rows, edits, corr, peakIndex: lag };
}

export function frameLuma(ctx, width, height) {
  const x = Math.floor(width / 4), y = Math.floor(height / 4);
  const w = Math.floor(width / 2), h = Math.floor(height / 2);
  const pixels = ctx.getImageData(x, y, w, h).data;
  let sum = 0;
  for (let i = 0; i < pixels.length; i += 4) sum += 0.299 * pixels[i] + 0.587 * pixels[i + 1] + 0.114 * pixels[i + 2];
  return sum / (w * h);
}
function waitEvent(target, name, signal, action, timeout = 15000) {
  return new Promise((resolve, reject) => {
    const cleanup = () => {
      clearTimeout(timer); target.removeEventListener(name, done); target.removeEventListener('error', error); signal?.removeEventListener('abort', abort);
    };
    const done = () => { cleanup(); resolve(); };
    const error = () => { cleanup(); reject(new Error('This browser could not decode the video. Try an MP4/H.264 file.')); };
    const abort = () => { cleanup(); reject(new DOMException('Analysis cancelled', 'AbortError')); };
    const timer = setTimeout(() => { cleanup(); reject(new Error('Video decoding timed out. Try another file.')); }, timeout);
    target.addEventListener(name, done, { once: true }); target.addEventListener('error', error, { once: true }); signal?.addEventListener('abort', abort, { once: true });
    if (signal?.aborted) abort(); else action?.();
  });
}
export async function sampleVideo(file, { onProgress = () => {}, signal, forceSeeking = false } = {}) {
  const video = document.createElement('video'), canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  const url = URL.createObjectURL(file);
  video.muted = true; video.playsInline = true; video.preload = 'auto'; video.className = 'analysis-source';
  document.body.append(video);
  const times = [], bright = [];
  try {
    await waitEvent(video, 'loadedmetadata', signal, () => { video.src = url; video.load(); });
    if (!Number.isFinite(video.duration)) {
      // MediaRecorder WebM often omits its duration. Seeking forces Chrome to discover it.
      await waitEvent(video, 'seeked', signal, () => { video.currentTime = 1e10; });
    }
    const duration = video.duration;
    if (!(duration > 0 && duration <= 300)) throw new Error('Choose a video between 1 second and 5 minutes long.');
    canvas.width = 160; canvas.height = Math.max(2, Math.round(160 * video.videoHeight / video.videoWidth));
    if (video.currentTime > 0) await waitEvent(video, 'seeked', signal, () => { video.currentTime = 0; });
    const capture = t => {
      if (times.length && t <= times.at(-1)) return;
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      times.push(t); bright.push(frameLuma(ctx, canvas.width, canvas.height)); onProgress(Math.min(1, t / duration));
    };
    if (video.requestVideoFrameCallback && !forceSeeking) {
      await new Promise((resolve, reject) => {
        let callback, watchdog;
        const cleanup = () => {
          clearTimeout(watchdog); video.cancelVideoFrameCallback(callback);
          video.removeEventListener('ended', done); video.removeEventListener('error', failed); signal?.removeEventListener('abort', aborted);
        };
        const done = () => { cleanup(); resolve(); };
        const failed = () => { cleanup(); reject(new Error('Video playback failed during analysis.')); };
        const aborted = () => { cleanup(); reject(new DOMException('Analysis cancelled', 'AbortError')); };
        const arm = () => { clearTimeout(watchdog); watchdog = setTimeout(() => { cleanup(); reject(new Error('Playback stalled. Keep this tab visible and try again.')); }, 15000); };
        const next = (_, meta) => { capture(meta.mediaTime); arm(); callback = video.requestVideoFrameCallback(next); };
        video.addEventListener('ended', done, { once: true }); video.addEventListener('error', failed, { once: true }); signal?.addEventListener('abort', aborted, { once: true });
        callback = video.requestVideoFrameCallback(next); arm();
        if (signal?.aborted) aborted(); else video.play().catch(error => { cleanup(); reject(error); });
      });
    } else {
      for (let t = 0; t < duration; t += 1 / 30) {
        // Seek just inside a frame, avoiding codec rounding at exact boundaries.
        // Preserve the actual requested time, rather than pretending the seek was exact.
        const seekTime = Math.min(duration - 0.00001, t + 0.001);
        await waitEvent(video, 'seeked', signal, () => { video.currentTime = seekTime; });
        capture(seekTime);
      }
    }
    if (times.length < 2) throw new Error('No usable video frames were decoded.');
    onProgress(1);
    return { times, bright, duration, frames: times.length, effectiveFps: (times.length - 1) / (times.at(-1) - times[0]), sampling: video.requestVideoFrameCallback && !forceSeeking ? 'decoded frames' : '30 Hz seeking' };
  } finally {
    video.pause(); video.removeAttribute('src'); video.load(); video.remove(); URL.revokeObjectURL(url);
  }
}

export function syntheticSignals(seed = 0x12345678, seconds = 20) {
  const bits = codeBits(seed, seconds * CODE_FPS), times = [], bright = [];
  let noise = 99;
  for (let frame = 0; frame < (seconds + 1) * 30; frame++) {
    const t = frame / 30, k = Math.floor(frame / 2) - CODE_FPS;
    noise = (Math.imul(noise, 1664525) + 1013904223) >>> 0;
    times.push(t);
    bright.push(Math.round(120 + (k < 0 ? 0 : bits[k]) * 5 + 2 * Math.sin(t * 0.4) + (noise / 4294967296 - 0.5) * 2));
  }
  return { times, bright };
}
