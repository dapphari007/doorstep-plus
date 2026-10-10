# Demo video script (target 2:50)

Judges may not run the app, so the video is the product. Lead with the strongest moment.

| Time | Screen | Voice-over |
|---|---|---|
| 0:00–0:15 | Black screen, then the Doorstep page with the Deaf profile selected | "A doorbell that only beeps and buzzes a phone is useless if you can't hear it or can't see the screen. Ring owners also tell us alerts are noisy, AI captions have mislabelled people, and search is paywalled." |
| 0:15–0:55 | Split view: Ring Developer Playground on the left, Doorstep+ on the right. Start the **Package** simulation. | "This is a real Ring Partner API device in Ring's Playground. When the courier arrives, Doorstep+ pulls the snapshot, a vision model on Amazon Bedrock describes what's happening, never who, and the whole room flashes amber twice: that rhythm means 'delivery'." Show the big caption card. |
| 0:55–1:20 | Switch profile to **Blind**. Start the **Motion** simulation. | Let the spoken alert play. Press **R** to repeat it. "Every event is spoken, and the same patterns can drive a real smart light." |
| 1:20–1:40 | Settings → hover the 🛡 safety notes on an event | "A deterministic safety layer edits every description before anyone hears it. No faces, no licence plates, and a person can never be described as an animal." |
| 1:40–2:10 | **Recall**: "Did a package arrive today, and is it still there?" Then "Make an incident report for it." | "Recall is a Strands agent on Bedrock with tools over the event history. It answers with exact times and builds a carrier-ready report." Click Download. |
| 2:10–2:35 | **Deliveries** page | "A verified courier opens the parcel box for two minutes with a one-time code. This lock is simulated, because Ring's API is read-only, but the proof-of-delivery chain is real Ring footage." |
| 2:35–2:50 | Architecture diagram from the README | "Ring Partner API, Bedrock, Strands, DynamoDB and S3. Built for everyone at the door." |

Recording tips: 1080p, hide the Next.js dev badge (`npm run build && npm start`), clear `.data/` first, generate a fresh Playground token right before recording.
