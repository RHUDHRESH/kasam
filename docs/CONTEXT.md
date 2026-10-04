# KASAM: project context (paste this into ChatGPT FIRST)

> **How to use:** start a new ChatGPT chat and paste this whole file first. Add one line at the end: "Read this context. Reply only with a 10-line summary of what we're building and why, then wait." Check that the summary is right. Then paste the build prompt from `26-chatgpt-build-prompt-kasam.md` (everything below "PROMPT STARTS HERE"). This file is the **what and why**; the build prompt is the **how**. Also save this file in the repo as `docs/CONTEXT.md`.

---

## 0. You are joining our team

You are the engineer on a 3-person student team building **KASAM** for the **iQOO Hackathon 2026**. Everything you need to understand the project is below. When a later instruction is unclear, decide using the goals in section 9 and the principles in section 10, and tell us what you assumed.

## 1. The one-line pitch

**KASAM: the video that swears it's real.**

While you record a selfie video, your phone's screen lights your face with a secret, invisible-ish flicker code. The code becomes part of the video's pixels. Later, anyone holding the seal code can check the video, even after it has been forwarded on WhatsApp. If it's untouched, the code is there from start to end. If someone cut, pasted or faked part of it, the code breaks at that exact spot.

"Kasam" is Hindi for "I swear" or "on my oath" ("Kasam se!" is what everyone in India says when they want you to believe them). The video takes an oath, and an edit makes it break the oath. That's the whole brand: **"Kasam toot gayi"**, the oath broke, is what the app shows when it catches an edit.

## 2. The competition we're building for

- **Event:** iQOO Hackathon 2026, run by iQOO (vivo's performance phone brand) with Reskilll. Billed as "India's first phone-first AI hackathon". Student category.
- **Rounds:**
  1. **Phase 1, now:** an online idea submission. It needs a title, a description, a deck (PDF), and optionally a **video URL** and a **prototype URL** (a live demo or a GitHub repo). **This is what we're building for right now.**
  2. **Grand Finale:** Bengaluru, 9 to 11 October 2026, 48 hours of building on an **iQOO 15** phone.
- **Tracks:** Mobility, Community App, Smart Living, Productivity, Developer Tools, **Open Innovation**. We're entering **Open Innovation**: "any domain, with a local or open-source model at the core".
- **What the judges reward** (from the organisers' published guides):
  - **Phone-first:** the phone must do the real work. A laptop-centric demo scores low, and phone usage is measured.
  - **AI-native and on-device:** local or open models running on the phone score higher than cloud APIs.
  - **Office Kit:** iQOO's phone-to-laptop tool (mirroring, file transfer, clipboard sync). Its use is tracked and scored at the finale.
  - **Problem fit and novelty:** a real problem and a fresh idea.
  - **Craft and pitch:** a working demo, clearly explained.
- **The judges:** a panel of tech and AI industry people, likely including iQOO/vivo, Qualcomm (who make the phone's Snapdragon chip) and startup founders. They've seen hundreds of chatbot and to-do apps. They want a **"how is that even possible?"** moment that iQOO could put in an ad: "Built on iQOO 15".

## 3. The problem

- **Anyone can fake a video now.** Free AI tools swap faces and clone voices in minutes.
- **Real money is being lost to fake video.** Indians lost nearly **₹2,000 crore to "digital arrest" scams in 2024**, where fraudsters pose as police or officials on video calls (The Wire, citing a government-linked report). Banks and fintechs now verify customers by video (video KYC), which deepfakes can attack.
- **Edited clips spread on WhatsApp** every election cycle. A 1-second cut can change what someone appears to say.
- **Ordinary people have no way to prove a video is real.** If your genuine video is called fake, you can't prove otherwise.

## 4. Why today's solutions fail

| Approach | How it works | Why it fails |
| --- | --- | --- |
| Deepfake detectors | An AI looks for signs that a video was AI-generated | They only **guess**, and every new AI model hides those signs better. They're always one step behind |
| Digital signatures / C2PA metadata | A cryptographic signature is stored beside the video file | **WhatsApp re-compresses videos and strips metadata** when forwarding, so the proof disappears exactly where fakes spread |
| Visible watermarks | A logo on the video | Easily cropped or copied onto a fake |
| Forensic experts | People examine the file | Slow and expensive; nobody does this for a forwarded clip |

**KASAM's insight:** don't try to detect fakes; **certify the real.** And put the proof **inside the pixels**, where compression and forwarding can't remove it, because it is part of the picture itself.

## 5. How KASAM works (the physics, in plain words)

1. **The screen is a light source.** The phone's screen is very bright (the iQOO 15 reaches 6,000 nits). During a selfie video, it lights the face.
2. **We hide a code in that light.** The screen's brightness wobbles by a few percent in a secret pseudo-random pattern of +1 and −1 steps, 15 steps per second. Each recording gets a fresh random **seed**, shown to the user as an 8-character **seal code** such as `3FA9C21B`. The seed fully determines the pattern.
3. **The face reflects the code into the camera.** The face gets very slightly brighter and darker in that exact pattern. The camera records it, so the code is now inside every frame.
4. **It survives compression.** Video compression (WhatsApp) throws away fine detail, but a whole face getting brighter or darker over time is coarse, so it survives. We confirmed this in a simulation: a ±10% code survived WhatsApp-quality compression, and 1-second and 2-second cuts were located correctly with no false alarms. The real-phone WhatsApp test is being run by the team.
5. **Verification is correlation.**
   - The verifier measures the face's brightness in every frame, giving a signal over time.
   - It regenerates the expected pattern from the seal code and slides it along the signal to find where they match.
   - A genuine video has one sharp, strong match peak. We measure how much it stands out as a z-score: above 5 is a confident match.
   - Random noise can't produce that peak, and without the seed nobody can know the pattern.
6. **Edits break the timing.**
   - **Cut:** if 1 second is cut out, every later part of the code arrives 1 second early. Matching 4-second windows one by one shows a sudden jump in the offset at the cut, which tells us when and how much.
   - **Paste:** a pasted object (a different face, a logo) wasn't lit by our screen, so that area of the picture doesn't carry the code. A per-region correlation map shows it as a dark hole. This is our stretch "code video" view.
   - **Full deepfake made from scratch:** the code isn't there at all, so the result is NO-GO.
7. **Verdicts:**
   - **GO:** "sealed and untouched".
   - **TAMPERED:** "oath broken at 0:08".
   - **WEAK:** the seal is faint.
   - **NO-GO:** no seal for this seal code.

**Who can verify:** whoever holds the seal code. That's the recorder, or anyone they share it with (a bank, a family member, a journalist). The seal code never travels inside the video, so a forger can't learn it from the video.

## 6. Who it's for (user stories)

- **Priya, applying for a loan online:** the fintech app asks her to record a video for KYC. Recorded with KASAM, the bank can verify it's a live recording of her, not a deepfake injected into the camera feed.
- **Ravi, a delivery or field worker:** proves he was at a site with a sealed selfie video. An old video re-used later fails the check.
- **Meena, filing a complaint or insurance claim:** her evidence video is sealed. If anyone claims it was edited, the verifier shows it wasn't.
- **A journalist** records an interview with KASAM. If an edited clip of it spreads, the original verifies and the edited one breaks.
- **Hackathon judges:** they try to fool KASAM live on stage by cutting, pasting or AI-editing a sealed video. It catches them.

## 7. What already exists (prior art), and what is new

| Who | What they did | Difference from KASAM |
| --- | --- | --- |
| **Cornell, "noise-coded illumination"** (SIGGRAPH 2025) | Room lamps flicker a secret code; edits break it | Needs special programmable lamps in the room; checked on a computer |
| **Columbia, VeriLight** (CCS 2025) | A separate device near a speaker encodes a hash of their face and lip motion into light | A dedicated hardware unit for speeches and events |
| **iProov Flashmark** (commercial) | The phone screen flashes colours to prove a live person during identity checks | A live check only, verified in iProov's cloud; it doesn't seal a video you can forward |
| **Face Flashing** (research, 2018) | Screen flashes prove a real 3D face, not a replayed video on a flat screen | Liveness only |

**What's new in KASAM:** the phone alone, using its own screen, seals an ordinary recording that can be verified **offline, after WhatsApp forwarding**, and **shows where** it was edited. We credit the prior work openly in the README; it shows we did our homework.

## 8. What we're building now vs later

### Now: the Phase 1 prototype (what you'll build)

A **web app** hosted free on **GitHub Pages**. It's plain HTML, CSS and JavaScript, with no server, no frameworks and no build step, and it works offline once loaded. Plus a small **Python laptop tool** with the same maths.
- **Seal page:** the phone screen flickers the code while the front camera records. The user gets the video and its seal code.
- **Light-only page:** the screen flickers the code full screen, and the user records with the phone's normal camera app (or another phone). This is useful because the normal camera app saves MP4, which WhatsApp always accepts.
- **Verify page:** load any video, enter the seal code, and get a verdict with a timeline, a match-strength chart and a plain certificate in English and Hindi. A **"Simulate an edit"** option cuts seconds a to b, so anyone can test cut detection without editing software.
- **README** with the results table, how it works, honest limits and credits.

Why a web app first: it gives us a **live prototype URL** in hours. It runs **on the phone itself**, so the phone's screen really is the light source. It needs no Android build tooling, and it shows the core idea working end to end. That's what Phase 1 shortlisting needs.

### Later: the finale build on the iQOO 15 (not now; mention it in the README roadmap)

- A native Android app (Kotlin, CameraX).
- A face tracker on the Snapdragon NPU, instead of the centre-of-frame box.
- **Llama 3.2 running on-device** to write the certificate in Hindi and English. This is the "open model at the core" the track asks for.
- A **replay check:** a flat screen re-filmed reflects the code evenly, while a real 3D face doesn't.
- **Time-tied keys:** HMAC keys in the phone's secure keystore.
- An **Office Kit "verification desk"** on a laptop.
- **Stretch: "words in light"**, where the code is keyed to the words being spoken, so a voice-cloned edit breaks the seal at the exact word.
- The finale demo, **"Fool KASAM, win ₹1,000"**: a judge draws one of 6 cards (No edit, Cut, Paste, AI edit, Replay, Old video), a teammate performs that attack, and KASAM shows its verdict before the card is revealed.

## 9. What success looks like for this prototype

In priority order:
1. **It works on a real phone:** open the GitHub Pages link on an Android phone in Chrome, seal a 20-second selfie, verify it, and get **GO with z > 5** at 10% amplitude indoors.
2. **It catches a cut:** the same video with "Simulate an edit" (8 to 9 s) gives **TAMPERED** with the marker within ±1.5 s of 8 s.
3. **A wrong seal code gives NO-GO**, which proves the code is secret and specific.
4. **It survives WhatsApp:** a video sent through WhatsApp and downloaded still verifies. The team fills the README table with real results.
5. **Judges get it in 30 seconds:** the UI and README are clear, honest and good-looking, with no jargon on screen.
6. **It's honest:** limits are stated, prior art is credited, and no fake numbers appear anywhere. Placeholder numbers are marked `[fill in]`.

## 10. Principles (use these to make decisions)

- **Simple and working beats ambitious and broken.** Finish every core feature before any stretch feature.
- **Phone first:** design for a phone screen held at arm's length. Big buttons, few words.
- **Offline and private:** no network calls, no analytics, no uploads. The video never leaves the device. This is a selling point, so say it in the UI ("Nothing leaves this phone").
- **Show, don't claim:** prefer visible evidence (the timeline, the correlation peak) over adjectives.
- **Honest science:** never invent statistics. Say what isn't proven yet.
- **Brand voice:** confident, warm, a little desi. Use Hindi touches only where natural ("Kasam se", "Kasam toot gayi"). English first.
- **Brand look:** dark theme. Background `#14121A`, text `#F8F4EF`, gold `#F4C95D` (the "Kasam light"), red `#EF6A5B` (oath broken), green `#5BC48A` (sealed).

## 11. Known risks and how the design handles them

| Risk | Handling |
| --- | --- |
| The phone's auto-exposure flattens the flicker | The code changes 15 times a second, faster than auto-exposure reacts; slow drift is removed with a 1-second moving average |
| Compression weakens the code | Use the average brightness over a large area (the face), which compression preserves; amplitude can be raised to 15% |
| Bright sunlight drowns the screen | Stated as a limit; the main uses (KYC, complaints, interviews) are mostly indoors |
| The browser's recorder saves .webm, which WhatsApp may refuse | Light-only mode plus the native camera app gives MP4 |
| Frame timing in the browser is uneven | Record real frame timestamps (`requestVideoFrameCallback`) and resample to a uniform 15 Hz grid |
| A forger with the seal code could fake the flicker | The seal code is shared only with trusted verifiers; the finale version uses keystore HMAC keys and a replay check |
| Someone films a screen playing a real sealed video | Finale replay check (a flat surface reflects light evenly); stated as roadmap in this prototype |

## 12. Glossary

- **Light code:** the secret sequence of +1/−1 brightness steps the screen shows, 15 per second.
- **Seed / seal code:** the random 32-bit number (shown as 8 hex characters) that generates the light code.
- **Amplitude (amp):** how much the brightness swings, e.g. 0.10 = ±10%.
- **Lead-in:** 1 second of steady brightness before the code starts.
- **Correlation:** a measure of how well two signals match; we slide the code along the video's brightness to find the best match.
- **Lag:** where in the video the code starts.
- **z-score:** how far the best match stands out from all other positions. Above 5 is confident; below 3.5 means not found.
- **Window / timeline:** 4-second pieces of the code matched one by one. A jump in their offset reveals a cut or insertion.
- **GO / TAMPERED / WEAK / NO-GO:** the four verdicts.
- **Office Kit:** iQOO's phone-to-laptop software (mirroring, file transfer, clipboard sync), scored at the finale.
- **iQOO 15:** the phone every finalist builds on. It has a Snapdragon 8 Elite Gen 5 chip with an NPU, a 6,000-nit screen and a 32 MP front camera.

## 13. Sources

- Cornell noise-coded illumination: https://www.news.cornell.edu/stories/2025/07/hiding-secret-codes-light-protects-against-fake-videos
- Columbia VeriLight: https://mobilex.cs.columbia.edu/verilight/
- iProov Flashmark: https://www.iproov.com/biometric-encyclopedia/flashmark
- Face Flashing (2018): https://arxiv.org/abs/1801.01949
- Digital arrest losses 2024: https://m.thewire.in/article/tech/indians-lost-nearly-rs-2000-crore-to-digital-arrest-scams-in-2024-report
- Hackathon format: https://blogs.reskilll.com/iqoo-hackathon-2026-india-phone-first-ai-hackathon-iqoo-reskilll/
