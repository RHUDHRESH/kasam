<p align="center"><img src="./docs/assets/readme-cover.svg" alt="KASAM — The video that swears it's real. A little light. A lasting oath." width="1200"></p>

# KASAM

**The video that swears it's real.**

KASAM explores a simple idea: use the screen beside your phone's camera to put a light code into a recording. Later, look for that code and timing changes that can reveal a cut or insertion. Capture and verification run on your device.

**[Open the app](https://rhudhresh.github.io/kasam/)** · **[Break the demo](https://rhudhresh.github.io/kasam/verify.html?demo=1)** · **[Read the evidence](./docs/VERIFICATION.md)**

[![Verify KASAM](https://github.com/RHUDHRESH/kasam/actions/workflows/verify.yml/badge.svg)](https://github.com/RHUDHRESH/kasam/actions/workflows/verify.yml)

> A working web prototype for the iQOO Hackathon 2026, Open Innovation track. Synthetic signals, encoded test videos and desktop offline use have been checked. Physical phone capture and WhatsApp forwarding still require measurements.

[Try it](#try-it-in-2-minutes) · [Results](#results) · [Run locally](#run-locally) · [Laptop verifier](#laptop-verifier) · [Limits](#honest-limits)

## Why

**One second can change a story.** Remove a sentence from an interview, forward the clip, and the person in it can appear to mean something else.

A recording could carry more than the words: a witness in its light. The screen illuminates the face; the face reflects a fresh pattern; the camera records it in the pixels. A cut can change the pattern's timing.

“Kasam” means “I swear.” The video takes an oath. When the verifier detects a timing break, the app says **Kasam toot gayi** — the oath broke.

## How it works

1. **Write the code.** A fresh eight-character seal code selects a brightness pattern that changes 15 times per second.
2. **Record the reflection.** The phone's front camera records while the screen displays the pattern.
3. **Find the match.** The verifier measures brightness in the video and compares it with the expected pattern.
4. **Follow the timing.** Matching windows with a sudden alignment shift can reveal a cut or insertion.

![Screen → reflection → video → offline verification](./docs/assets/how-it-works.svg)

| Feature | What you can do |
| --- | --- |
| [Seal](https://rhudhresh.github.io/kasam/seal.html) | Record with the front camera and microphone; save the video and its seal code |
| [Verify](https://rhudhresh.github.io/kasam/verify.html) | Analyse a local file; inspect the timeline, correlation chart and English/Hindi certificate |
| [Light-only](https://rhudhresh.github.io/kasam/light.html) | Display the code on one screen while a separate device records |
| Simulate an edit | Remove a time interval from the analysis without changing the video file |
| Offline mode | Use the cached app after the first successful online load |
| Report export | Copy the certificate or export the measurements as JSON |

<details>
<summary>How the verifier scores a clip</summary>

The verifier averages luma in the centre 50% × 50% of decoded frames, resamples at 15 Hz, removes a centred one-second moving average, and normalises by the signal's standard deviation. It correlates the signal with a ±1 sequence regenerated from the 32-bit seed using mulberry32.

The z-score describes how much the strongest correlation stands out from other candidate lags. It is **not a probability of authenticity**. Four-second windows, stepped every second, search within ±3 seconds for changes in alignment.

| Verdict | Meaning |
| --- | --- |
| **NO-GO** | z < 3.5: no matching seal found for this code |
| **WEAK** | 3.5 ≤ z ≤ 5, without a qualifying timing jump: faint match |
| **GO** | z > 5, without a qualifying timing jump: strong match |
| **TAMPERED** | z ≥ 3.5 with a qualifying timing jump: code present, timing broken |

The app labels GO as “Sealed and untouched.” That means no timing break was detected in the checked windows; it does not guarantee the absence of every edit. Cut locations are estimates. Reports retain the window's `atVideoTime` and a refined `boundaryTime` used by the display. [Implementation and sampling notes](./docs/VERIFICATION.md#two-sampling-fixes).

</details>

## Try it in 2 minutes

**Start with the demo — no camera required.**

1. [Open the synthetic demo](https://rhudhresh.github.io/kasam/verify.html?demo=1). It starts with seal `12345678` and returns **GO**.
2. Enable **Simulate an edit**, leave the interval at **8–9 seconds**, and press **Analyse video**. Expect **TAMPERED**, with **1.0 s removed near 0:08**.
3. Disable the simulation, change the code to `3FA9C21B`, and press **Analyse video**. Expect **NO-GO**.

These are deterministic sample tests, clearly labelled in the app. They exercise the maths without representing a camera recording.

**Then try your own recording.**

1. Open [Seal a video](https://rhudhresh.github.io/kasam/seal.html) in Chrome on Android. Set the phone's screen brightness to maximum and choose **10% / 20 seconds**. Indoors, start at 25–35 cm with your face centred.
2. Allow camera and microphone access. Keep the page visible through the one-second lead-in and the light sequence.
3. Download the video and save its code. Select **Verify now**, choose the downloaded file, and press **Analyse video**.
4. Inspect the score and timeline. Export the JSON to keep the measurements. Repeat with **Simulate an edit** to compare the original with a cut.

**Keep the code separate when sharing.** Downloaded filenames include the seal code; rename the file before public sharing if you want to keep the code private. The Share button uses a generic filename. Recent codes are saved in this browser's local storage.

**If your recorder saves WebM:** support varies by browser. KASAM tries MP4/H.264, MP4, WebM/VP9, then WebM. For a native-camera MP4, use [Light-only mode](https://rhudhresh.github.io/kasam/light.html) on a laptop, tablet or second phone beside the recording device. Start the camera first, then the light. Switching away from the light page interrupts its sequence.

**To test a forwarded copy:** send the video to yourself through WhatsApp, download the received file, and verify it with the same code and duration. This is a test procedure, not a claim of validated WhatsApp performance.

## Results

Measured on **4 October 2026**. These results have different scopes; each is identified below.

| Test | Verdict | z-score | Detected change |
| --- | --- | ---: | --- |
| Synthetic original, seed `12345678` | **GO** | 13.620 | No timing break detected |
| Same samples, remove 8–9 s | **TAMPERED** | 8.143 | 1.0 s removed near 8.0 s |
| Same samples, wrong seed `3FA9C21B` | **NO-GO** | 2.473 | No matching seal |
| H.264 MP4 from a controlled canvas recording, checked in the deployed browser | **GO** | 10.22 | No timing break detected |
| The same MP4, decoded by the Python verifier | **GO** | 10.300 | No timing break detected |

The synthetic reference has about 4% brightness modulation in its centre region, with deterministic noise and slow drift. The MP4 check exercises the production recorder and the local-file verification path using a controlled test stream. **Neither is a physical-camera illumination test.** Browser frame scheduling can change sample counts and scores slightly between runs.

Desktop checks also confirmed cached offline operation, a completed light-only sequence, certificate copying, decoded-frame sampling and the seeking fallback. GitHub Actions runs the signal self-test, JavaScript/Python parity, syntax and asset checks on every push to `main` and every pull request.

**Not yet measured:** reflected light on a physical Android phone, WhatsApp recompression, Android installation, gallery/download saving and native file sharing. [Full verification record](./docs/VERIFICATION.md) · [Reference measurements](./docs/verification-results.json) · [Automated checks](https://github.com/RHUDHRESH/kasam/actions/workflows/verify.yml).

<details>
<summary>View the app screenshots</summary>

Screenshots captured from the working app. The cut result shown here uses the synthetic demo.

<p><img src="./docs/assets/app-home.jpg" alt="KASAM desktop homepage" width="1000"></p>
<p><img src="./docs/assets/app-mobile.jpg" alt="KASAM mobile homepage" width="300"></p>
<p><img src="./docs/assets/app-cut.jpg" alt="Synthetic demo showing an oath broken by a one-second cut near eight seconds" width="700"></p>

</details>

## Run locally

The app is plain HTML, CSS and JavaScript. It needs no package installation, bundler or application backend. With Git and Python installed:

```bash
git clone https://github.com/RHUDHRESH/kasam.git
cd kasam
python -m http.server 8080 --bind 127.0.0.1
```

Open [localhost:8080](http://127.0.0.1:8080/) in Chrome. Camera access requires HTTPS or localhost. The live site uses GitHub Pages from **main / root** with `.nojekyll`.

After the footer says **Offline ready**, the app pages and assets are cached. Offline operation still requires the browser's camera permissions and media support. Clearing site data removes the cache and recent seal codes. Videos are processed locally; the app sends no video uploads or analytics and loads no third-party runtime assets.

## Laptop verifier

The Python tool uses the same centre-region analysis as the browser. **Python 3.13** is tested in CI; video decoding requires a codec supported by OpenCV.

From the repository root, create a virtual environment:

```bash
python -m venv .venv
```

Activate it with `source .venv/bin/activate` on macOS/Linux, or `.\.venv\Scripts\Activate.ps1` in Windows PowerShell. Then:

```bash
python -m pip install -r tools/requirements.txt
python tools/kasam_check.py --selftest
python tools/kasam_check.py recording.mp4 --seal 3FA9C21B --seconds 20 --json report.json
python tools/kasam_check.py recording.mp4 --seal 3FA9C21B --seconds 20 --cut 8:9
```

Use the actual seal code and duration from your recording. `--cut 8:9` simulates a removal during analysis; it never overwrites the video. `--amp` stores the screen setting as report metadata and does not change the normalised matching score. The CLI prints window matches, estimated edits and the final verdict.

With **Node.js 24**, run the development parity and asset checks:

```bash
node tools/check.mjs
```

Set `KASAM_PYTHON` to your virtual environment's Python executable if the command named `python` points elsewhere. Node is a development dependency only.

## Honest limits

- **A match is evidence of a light pattern.** It does not prove identity, liveness, factual truth or audio authenticity. Replay and audio-only edits can pass.
- **The pattern can be forged.** A 32-bit seed and mulberry32 are reproducible, not cryptographically secure. Someone who learns or estimates the code can synthesise it.
- **Framing and lighting matter.** The verifier uses the centre of the frame, not a face tracker. Sunlight, motion, distance, exposure control and compression can weaken the signal.
- **Windowed matching has blind spots.** Short edits, changes near clip ends and large timing shifts can be missed. A partial clip can match; GO does not establish completeness.
- **False edit flags are possible.** Heavy noise produced TAMPERED on an uncut synthetic signal in a recorded stress test. Thresholds need physical-device calibration.
- **Flicker may be uncomfortable.** Stop if it bothers you. This prototype is not validated for KYC, legal or medical decisions.

The 10% screen setting alternates normalised grey levels of 0.8 and 1.0 around a 0.9 lead-in. It does not imply a 10% change in reflected face brightness.

## Roadmap

The next stage is a native Android implementation on the iQOO 15:

- **CameraX capture:** tighter control over timestamps and exposure.
- **Face-region tracking:** measure the face instead of a fixed centre rectangle.
- **Secured challenges:** investigate keystore-backed HMAC keys, capture binding and replay protection.
- **Spatial verification:** explore per-region matching for pasted content.
- **On-device explanations:** explain measured evidence in English and Hindi without inventing results.
- **Office Kit verification desk:** transfer recordings and reports to a laptop for inspection.

These are planned capabilities. The current app demonstrates light-code matching and temporal cut/insertion checks.

## Prior art and credits

Coded illumination has substantial prior art. KASAM applies the idea to a screen-based capture experiment and offline timing verification.

- [Cornell: noise-coded illumination, SIGGRAPH 2025](https://news.cornell.edu/stories/2025/07/hiding-secret-codes-light-protects-against-fake-videos) — the project's primary inspiration for embedding evidence in light.
- [Columbia: VeriLight, CCS 2025](https://mobilex.cs.columbia.edu/verilight/) — physical optical signatures for speech-video integrity.
- [iProov: Flashmark](https://www.iproov.com/biometric-encyclopedia/flashmark) — controlled screen illumination for dynamic liveness checks.
- [Face Flashing, 2018](https://arxiv.org/abs/1801.01949) — liveness detection through light reflections.

The illustrations are original SVGs; the screenshots are captures of the app. Certificates use fixed English/Hindi templates.

**License:** [MIT](./LICENSE).
