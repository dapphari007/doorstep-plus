# Voice-over script (read it yourself)

Same words as the AI narration in the demo video, so your recording drops into the same scenes. About 2 minutes 50 seconds of speaking; the video must stay under 3 minutes.

## How to record
- Quiet room, phone or laptop mic 15–20 cm from your mouth. Record one block at a time; it's easy to redo a single block.
- Energy: confident and upbeat, like showing a friend something you're proud of. Smile while you talk; it comes through.
- Pause briefly between sentences. The video lines captions and actions up with those pauses.
- Say the name as **"Doorstep Plus"**.
- Save each block as its own file named like the block (`01-hook.m4a`, …). They replace the AI clips one for one.

## Script

### 01 · Title (≈9 s)
> Yo! What good is a doorbell you can't hear? Or a camera you can't see? Meet Doorstep Plus. Ring, made for everyone in the house.

*Tip: Pause after "can't hear?" and "can't see?". Let each question land.*

### 02 · What reviews say (≈18 s)
> First, I did my homework. I read Ring reviews on the App Store, Google Play, Trustpilot, Reddit and the Ring Community. Same pain everywhere. Noisy, late alerts. Useless unless you're staring at your phone. Captions that get people wrong. And video search behind a paywall.

*Tip: Rattle off the five sites quickly, then slow down for the four pains.*

### 03 · Who gets left out (≈10 s)
> Annoying for most of us. A locked door for some. Four hundred thirty million people live with disabling hearing loss. Two point two billion have a vision impairment.

*Tip: Say the two numbers slowly. They carry the "Potential Impact" score.*

### 04 · The idea (≈14 s)
> So here's the plan. Ring sees it. Amazon Bedrock describes what's happening, never who. Doorstep Plus tells you your way: a flash, a voice, or a buzz. And it remembers, so you can just ask.

### 05 · Go live on the Playground (≈13 s)
> Enough slides, let's go live. This is the Ring Developer Playground, with package, motion and vehicle simulations, on the real Ring Partner API. Grab a token, connect, and there's our doorbell.

### 06 · Package, the big moment (≈15 s)
> Deaf profile, parcel expected. Live view sends a burst of frames to Bedrock. Boom! Amber flashes, twice. That rhythm means delivery. Possibly your parcel. No face recognition, just timing and what the camera sees.

*Tip: Say "Boom!" exactly as the screen flashes amber. The video is cut so that the flash comes right after the pause before it.*

### 07 · Motion clip: birds (≈8 s)
> Switch to the motion clip. Birds! An animal, not an intruder, so you get a soft green blink, not a panic alarm.

*Tip: Say "Birds!" with a smile; the green blink appears right there.*

### 08 · Vehicle clip: just passing (≈11 s)
> Now a car. It reads movement across frames. Driving past the driveway? That's just passing, so it's one quiet row, with no alert. Fewer false alarms.

### 09 · Deliveries (≈6 s)
> Every package lands in Deliveries with a photo and the exact time, and you're warned if someone takes it.

### 10 · Blind and low vision (≈16 s)
> Switch to blind, and every alert talks. *[app voice: "Delivery. Package on step in snow. Possibly your Amazon parcel. 11:13 AM."]* Low vision gets big, high contrast text. Same doorbell, three different experiences.

*Tip: Stop after "every alert talks." The app's own voice (a second, female voice) reads the alert. Keep that clip, then carry on.*

### 11 · Ask your door (≈12 s)
> Or just ask your door. What happened today? A Strands agent on Bedrock searches the history and answers with exact times. Need proof for the courier? One click incident report.

### 12 · Results (≈13 s)
> And I measured it. On real Ring frames: twelve out of twelve described correctly. Zero people called animals. Every planted bad caption caught. Too dark? It says so, instead of guessing.

*Tip: Punch the numbers.*

### 13 · Under the hood (≈18 s)
> Under the hood: Ring's Partner API for events, snapshots and live video, with signed webhooks for real homes. Bedrock with Nova, a Strands agent, DynamoDB, S3, and a serverless demo on Lambda. Plus a pull request fixing two auth bugs in Amazon's Ring sample.

### 14 · Outro (≈8 s)
> Built to ship in the Ring Appstore, for any Ring doorbell. Doorstep Plus. The front door, for everyone. Peace!

## Swapping in your voice
Put your files in `doorstep-video/audio/` with the same names (any format ffmpeg reads; for block 10, record only your two lines and keep the app voice clip), then run `node build.mjs` in `doorstep-video`. Timing, captions and the "Boom!" cut follow your audio automatically. If the total goes over 2:58, trim a few words.
