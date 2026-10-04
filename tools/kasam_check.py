#!/usr/bin/env python3
"""KASAM's offline reference verifier. Matches js/analyze.js (population std)."""
import argparse
import json
import math
from pathlib import Path

import numpy as np

CODE_FPS = 15
LEAD_IN_S = 1


def mulberry32(a):
    a &= 0xFFFFFFFF
    imul = lambda x, y: (x * y) & 0xFFFFFFFF
    while True:
        a = (a + 0x6D2B79F5) & 0xFFFFFFFF
        t = imul(a ^ (a >> 15), 1 | a)
        t = ((t + imul(t ^ (t >> 7), 61 | t)) & 0xFFFFFFFF) ^ t
        yield ((t ^ (t >> 14)) & 0xFFFFFFFF) / 4294967296


def code_bits(seed, n):
    random = mulberry32(seed)
    return np.array([1 if next(random) >= 0.5 else -1 for _ in range(n)], dtype=float)


def remove_cut(times, bright, a, b):
    if not (math.isfinite(a) and math.isfinite(b) and 0 <= a < b <= times[-1]):
        raise ValueError('Cut must fit inside the video and end after it starts.')
    keep = (times < a) | (times >= b)
    return np.where(times[keep] >= b, times[keep] - (b - a), times[keep]), bright[keep]


def resample(times, bright):
    grid = np.arange(math.floor(times[-1] * CODE_FPS + 1e-7) + 1) / CODE_FPS
    return np.interp(grid, times, bright)


def detrend(values):
    prefix = np.concatenate(([0.0], np.cumsum(values)))
    residual = np.array([v - (prefix[min(len(values), i + 8)] - prefix[max(0, i - 7)]) /
                         (min(len(values), i + 8) - max(0, i - 7)) for i, v in enumerate(values)])
    return residual / (np.std(residual) + 1e-9)


def edit_boundary(s, code, lag, start, before, after):
    low = max(0, lag + start + min(before, after))
    high = min(len(s), lag + start + max(before, after) + 60)

    def score(p, offset):
        k = p - lag - offset
        return float(s[p] * code[k]) if 0 <= k < len(code) else 0.0

    total = sum(score(p, after) for p in range(low, high))
    best, boundary = total, low
    for p in range(low, high):
        total += score(p, before) - score(p, after)
        if total > best + 1e-9:
            best, boundary = total, p + 1
    return boundary / CODE_FPS


def analyze(times, bright, seed, seconds=20):
    if seconds not in (10, 20, 30):
        raise ValueError('Choose a code duration of 10, 20 or 30 seconds.')
    times, bright = np.asarray(times, dtype=float), np.asarray(bright, dtype=float)
    if (len(times) != len(bright) or len(times) < 2 or not np.isfinite(times).all() or
            not np.isfinite(bright).all() or (times < 0).any() or (np.diff(times) <= 0).any()):
        raise ValueError('Samples need finite brightness and increasing timestamps.')
    s = detrend(resample(times, bright))
    code = code_bits(seed, seconds * CODE_FPS)
    n = len(code)
    if len(s) < n // 2 + 6:
        raise ValueError('Video is too short. Choose a shorter code duration or a longer video.')
    corr = np.array([np.dot(s[lag:lag + min(n, len(s) - lag)], code[:min(n, len(s) - lag)]) /
                     min(n, len(s) - lag) for lag in range(len(s) - n // 2 + 1)])
    lag = int(np.argmax(corr))
    rest = corr[np.abs(np.arange(len(corr)) - lag) > 2]
    z = float((corr[lag] - np.mean(rest)) / (np.std(rest) + 1e-9))
    rows, edits, prev = [], [], None
    if z >= 3.5:
        for start in range(0, n - 60 + 1, CODE_FPS):
            def r_at(pos):
                return float(np.dot(s[pos:pos + 60], code[start:start + 60]) / 60) if 0 <= pos and pos + 60 <= len(s) else -1.0
            low, high = max(0, lag + start - 45), min(len(s) - 60, lag + start + 45)
            pos, r = low, -1.0
            for candidate in range(low, high + 1):
                score = r_at(candidate)
                if score > r:
                    pos, r = candidate, score
            offset = pos - (lag + start)
            if prev is None:
                prev = offset
            row = {'codeTime': start / CODE_FPS, 'r': r, 'sealed': r > 0.2}
            r0 = r_at(lag + start + prev)
            if abs(offset - prev) >= 3 and r > 0.3 and r > r0 + 0.15:
                edit = {'atVideoTime': pos / CODE_FPS, 'shiftSeconds': (offset - prev) / CODE_FPS,
                        'boundaryTime': edit_boundary(s, code, lag, start, prev, offset)}
                row['edit'] = edit
                edits.append(edit)
                prev = offset
            rows.append(row)
    verdict = 'NO-GO' if z < 3.5 else 'TAMPERED' if edits else 'GO' if z > 5 else 'WEAK'
    return {'verdict': verdict, 'z': z, 'lagSeconds': lag / CODE_FPS, 'rows': rows, 'edits': edits,
            'corr': corr.tolist(), 'peakIndex': lag}


def frame_luma(frame):
    # Match browser canvas dimensions and centre ROI. OpenCV stores BGR, not RGB.
    import cv2
    h, w = frame.shape[:2]
    small = cv2.resize(frame, (160, max(2, round(160 * h / w))), interpolation=cv2.INTER_LINEAR)
    h, w = small.shape[:2]
    region = small[h // 4:h // 4 + h // 2, w // 4:w // 4 + w // 2].astype(float)
    return float(np.mean(0.299 * region[:, :, 2] + 0.587 * region[:, :, 1] + 0.114 * region[:, :, 0]))


def read_video(path):
    import cv2
    capture = cv2.VideoCapture(str(path))
    if not capture.isOpened():
        raise ValueError('Could not open the video. Check its path and codec.')
    times, bright = [], []
    fps = capture.get(cv2.CAP_PROP_FPS)
    if not math.isfinite(fps) or fps <= 0:
        capture.release()
        raise ValueError('The decoder could not determine a usable frame rate.')
    timestamps, frame_index = [], 0
    try:
        while True:
            ok, frame = capture.read()
            if not ok:
                break
            timestamps.append(capture.get(cv2.CAP_PROP_POS_MSEC) / 1000)
            times.append(frame_index / fps)
            bright.append(frame_luma(frame))
            frame_index += 1
    finally:
        capture.release()
    if len(bright) < 2:
        raise ValueError('No usable frames found.')
    pts = np.asarray(timestamps)
    # Some decoders report only zero timestamps; use the frame-rate clock then.
    if np.isfinite(pts).all() and (pts >= 0).all() and (np.diff(pts) > 0).all():
        times = timestamps
    return np.asarray(times), np.asarray(bright)


def synthetic_frames(seed=0x12345678, seconds=20):
    bits = code_bits(seed, seconds * CODE_FPS)
    noise = 99
    for frame_index in range((seconds + LEAD_IN_S) * 30):
        t = frame_index / 30
        k = frame_index // 2 - CODE_FPS
        noise = (noise * 1664525 + 1013904223) & 0xFFFFFFFF
        # 5/120 = about 4% modulation. Noise and exposure drift are in the pixels.
        level = math.floor(120 + (0 if k < 0 else bits[k]) * 5 + 2 * math.sin(t * 0.4) + (noise / 4294967296 - 0.5) * 2 + 0.5)
        frame = np.full((240, 320, 3), 70, dtype=np.uint8)
        frame[60:180, 80:240] = level
        yield t, frame


def selftest():
    expected = [-1, 1, 1, -1, 1, 1, -1, -1]
    actual = code_bits(0x12345678, 8).astype(int).tolist()
    print('mulberry32:', actual)
    assert actual == expected, 'Seed parity failed'
    times, bright = [], []
    for t, frame in synthetic_frames():
        times.append(t)
        bright.append(frame_luma(frame))
    times, bright = np.asarray(times), np.asarray(bright)
    original = analyze(times, bright, 0x12345678)
    cut = analyze(*remove_cut(times, bright, 8, 9), 0x12345678)
    wrong = analyze(times, bright, 0x3FA9C21B)
    assert original['verdict'] == 'GO' and original['z'] > 5, original
    assert cut['verdict'] == 'TAMPERED', cut
    assert any(abs(e['boundaryTime'] - 8) <= 1.5 and abs(e['shiftSeconds'] + 1) < 0.1 for e in cut['edits']), cut
    assert wrong['verdict'] == 'NO-GO', wrong
    print(f"Synthetic 4% centre-region modulation: GO, z={original['z']:.3f}")
    print(f"Cut 8:9: TAMPERED, z={cut['z']:.3f}, edits={cut['edits']}")
    print(f"Wrong seal: NO-GO, z={wrong['z']:.3f}")
    print('All self-tests passed. These are synthetic tests, not phone or WhatsApp measurements.')
    return {'original': original, 'cut': cut, 'wrongSeal': wrong}


def parse_seal(value):
    if len(value) != 8 or any(c not in '0123456789abcdefABCDEF' for c in value):
        raise argparse.ArgumentTypeError('Seal must be 8 hexadecimal characters.')
    return int(value, 16)


def parse_cut(value):
    try:
        a, b = map(float, value.split(':'))
        if not math.isfinite(a) or not math.isfinite(b) or a < 0 or b <= a:
            raise ValueError()
        return a, b
    except ValueError as error:
        raise argparse.ArgumentTypeError('Cut must look like 8:9 (start:end).') from error


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('video', nargs='?', type=Path)
    parser.add_argument('--seal', type=parse_seal)
    parser.add_argument('--amp', type=float, choices=(0.02, 0.05, 0.10, 0.15), default=0.10, help='Report metadata; not used in the score')
    parser.add_argument('--seconds', type=int, choices=(10, 20, 30), default=20)
    parser.add_argument('--cut', type=parse_cut)
    parser.add_argument('--selftest', action='store_true')
    parser.add_argument('--json', type=Path, help='Also save the full report as JSON')
    args = parser.parse_args()
    try:
        if args.selftest:
            result = selftest()
        else:
            if args.video is None or args.seal is None:
                parser.error('VIDEO and --seal are required unless --selftest is used.')
            times, bright = read_video(args.video)
            frames = len(times)
            effective_fps = (frames - 1) / (times[-1] - times[0])
            if args.cut:
                times, bright = remove_cut(times, bright, *args.cut)
            result = analyze(times, bright, args.seal, args.seconds)
            result.update(seal=f'{args.seal:08X}', amp=args.amp, seconds=args.seconds, framesAnalysed=frames,
                          samplesAfterCut=len(times), effectiveFps=effective_fps, simulatedCut=args.cut, prototype=True)
            print(f"KASAM | seal {args.seal:08X} | {frames} frames | {effective_fps:.2f} fps")
            print(f"Match z={result['z']:.3f} | lag={result['lagSeconds']:.3f} s")
            for row in result['rows']:
                print(f"Code {row['codeTime']:5.1f} s | r={row['r']: .3f} | {'sealed' if row['sealed'] else 'faint/missing'}")
            for edit in result['edits']:
                action = 'removed' if edit['shiftSeconds'] < 0 else 'inserted'
                print(f"Edit near {edit['boundaryTime']:.2f} s: {abs(edit['shiftSeconds']):.2f} s {action}")
            print(result['verdict'])
        if args.json:
            args.json.write_text(json.dumps(result, indent=2), encoding='utf-8')
    except (ValueError, OSError, ImportError) as error:
        parser.exit(2, f'KASAM: {error}\n')


if __name__ == '__main__':
    main()
