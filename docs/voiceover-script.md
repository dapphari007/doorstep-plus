# Voice-over script (read it yourself)

Same words as the AI narration in the generated video, so your recording lines up with the same scenes. Target: about 2 minutes 20 seconds of speaking.

## How to record
- Quiet room, phone or laptop mic 15–20 cm from your mouth. Record one block at a time; it's easy to redo a single block.
- Energy: confident and upbeat, like you're showing a friend something you're proud of. Smile while you talk; it comes through.
- Speed: about 2.5 words per second. If a block runs long, drop a few words rather than rushing.
- Say the name as **"Doorstep Plus"**.
- Save each block as its own file named like the block (`01-hook.m4a`, …). They can replace the AI clips one for one.

## Script

### 01 · Title (≈14 s)
> Yo! Quick question. What good is a doorbell if you can't hear it? For millions of deaf and blind people, a chime and a phone buzz just don't cut it. So I built **Doorstep Plus**. Your Ring doorbell, understood by *everyone* in the house.

*Tip: pause after "can't hear it?" Let the question land.*

### 02 · The problem (≈16 s)
> I dug through hundreds of Ring reviews, and the same pain kept showing up. Alerts are noisy. They only help if you're staring at your phone. An AI caption once called a person an animal. And searching old video is locked behind Premium. **Challenge accepted.**

*Tip: list the four problems quickly; slow down on "Challenge accepted."*

### 03 · Setup (≈10 s)
> Here's the app, running on the **real Ring Partner API** with Ring's Developer Playground doorbell. I switch alerts to deaf or hard of hearing, and tell it I'm expecting a parcel today.

### 04 · Live view, the big moment (≈21 s)
> Now the live view. Doorstep Plus grabs a short burst of frames, sends them to Amazon Bedrock, and gets back what's happening. **Never who.** Boom! The whole screen flashes amber, twice. That rhythm means delivery. And check it out: *possibly your parcel*. No face recognition. Just time, and what the camera sees.

*Tip: say "Boom!" right as the screen flashes.*

### 05 · Deliveries (≈7 s)
> Deliveries keeps every package with a photo and the exact time. If someone grabs it later, you get a picked-up alert.

### 06 · Blind and low vision (≈11 s)
> Switch to blind, and every alert talks. Press R and it repeats. Low vision gets big, high contrast text. Same doorbell, three totally different experiences.

### 07 · Movement (≈10 s)
> It reads movement too. A car just driving past gets logged quietly, with no alert. Fewer false alarms, which is literally the number one Ring complaint.

### 08 · Ask your door (≈15 s)
> And you can just ask your door. *Did a package arrive, and is it still there?* A Strands agent on Bedrock digs through the history and answers with exact times. Need proof for the courier? Make an incident report. One click, downloaded.

### 09 · Results (≈14 s)
> And I didn't just vibe check it. I measured it on real Ring frames. **Twelve out of twelve** correct. **Zero** people called animals. **Every** planted bad caption caught. And when it's too dark to see, it says so, instead of guessing.

*Tip: punch the numbers.*

### 10 · Under the hood (≈15 s)
> Under the hood: the Ring Partner API, Amazon Bedrock with Nova, Strands Agents, DynamoDB and S3, plus a live serverless demo on Lambda. I even fixed two auth bugs in Amazon's own Ring sample, and opened a pull request.

### 11 · Outro (≈6 s)
> **Doorstep Plus.** Because the front door should work for *everyone*. Thanks for watching!

## Swapping in your voice
Put your files in `doorstep-video/audio/` with the same names (any format ffmpeg reads) and re-run the build step; the video timing follows the audio lengths automatically.
