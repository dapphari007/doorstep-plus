# Demo video script (target 2:45, hard limit 3:00)

Judges may only watch the video, so lead with the strongest moment and keep every claim visible on screen. Use real Ring Playground data only (no test mode).

## Before recording
1. `npm run build && npm start` (hides the Next.js dev badge). Clear old demo data first.
2. Generate a fresh Playground token and connect it in Settings.
3. Browser at 1280×800 or larger; turn on sound for the Blind part.
4. Settings → "This device" name: e.g. Asha.

## Script

| Time | On screen | Say |
|---|---|---|
| 0:00–0:15 | Home, profile set to **Deaf or hard of hearing** | "A doorbell that only chimes and buzzes a phone doesn't work if you can't hear it or aren't looking at the screen. Doorstep+ makes a Ring doorbell understandable for everyone in the house." |
| 0:15–0:30 | On Home, **Expecting someone? → Add → A parcel → Any time today** | "I'm expecting a parcel today, so I tell the app." |
| 0:30–1:05 | Split screen: Ring Playground starts the **Package** simulation; Doorstep+ **Start live view** + **Keep watching** | "This is the real Ring Partner API, on Ring's Playground doorbell. The moment a package appears, the whole screen flashes amber twice — that rhythm means delivery — and the card says 'Package on the step, possibly your parcel'." Open **Deliveries** to show the photo and time. |
| 1:05–1:30 | Switch profile to **Blind**; Playground **Motion** simulation | Let the spoken alert play: "Animal. Birds feeding at the feeder." Press **R** to repeat. "Every alert can be read aloud." |
| 1:30–1:50 | Playground **Vehicle** simulation | "A car driving through the lot is understood as passing by, and logged without an alert. Fewer false alerts — the top complaint from Ring owners." Show it in Activity with the **Vehicles** filter. |
| 1:50–2:15 | **Ask**: "Did my parcel arrive, and is it still there?", then "Make an incident report for it" | "Ask is a Strands agent on Amazon Bedrock. It answers from the history with exact times, and makes a report I can send to a carrier." Click **Download report**. |
| 2:15–2:35 | README **Results** table | "It describes what is happening, never who. A safety layer means a person is never called an animal, and dark frames say 'too dark to see' instead of guessing. Measured on real Ring frames: twelve out of twelve correct." |
| 2:35–2:45 | Architecture diagram | "Ring Partner API, Amazon Bedrock, Strands, DynamoDB and S3. Doorstep+: your Ring doorbell, understood by everyone." |

## Tips
- Upload to YouTube as **Public**, in English, under 3 minutes. Don't use copyrighted music.
- If a live step fails while recording, cut and retry that segment rather than narrating over an error.
- Keep the Playground and app side by side so judges see the Ring source and the result together.
- The Vehicle and Package moments depend on the Playground clips; check them once before recording, since the motion wording ("passing by") has not yet been confirmed on the live Vehicle clip.
