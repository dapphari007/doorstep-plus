# Devpost submission (copy into the form)

## Project name
Doorstep+

## Tagline
Your Ring doorbell, understood by everyone in the house.

## Track and mini challenges
- **Track:** Ring
- **Mini challenges:** AWS Builder, Open Source

## What it does
Doorstep+ adds an AI layer to a Ring doorbell so that everyone in a home knows what's happening at the front door — including people who can't hear a chime or see a phone screen.

- **Alerts that work for each person.** Deaf and hard-of-hearing residents get full-screen colour flashes and vibration, with a different rhythm for a doorbell press, a delivery, a visitor or a car (and an optional smart-light webhook). Blind residents hear every alert read aloud and can press R to repeat it. Low-vision residents get larger, high-contrast text.
- **Describes what is happening, never who.** Each event is described from Ring footage by a vision model on Amazon Bedrock. A deterministic safety layer edits every description before anyone sees or hears it: no identity guesses, no race or appearance descriptors, no licence plates, a person can never be called an animal, and very dark frames say "too dark to see" instead of guessing.
- **Understands movement.** The live view sends short frame bursts, so the app tells a car driving through from a parked one, and someone walking past from someone at the door. Passers-by are logged without an alert, which cuts the false alerts Ring owners complain about.
- **Expected visitors.** "Plumber, 3–4 PM", "Parcel today", or a family member tapping "I'm heading home": arrivals in that window are announced as "possibly your plumber". Matching uses time and what the camera sees, never faces.
- **Ask your door.** "Did a package arrive, and is it still there?" An agent answers from the event history with exact times and thumbnails, and can produce a downloadable incident report for a carrier or insurer.
- **Deliveries.** Every package seen at the door with photos and times, linked to expected parcels, with an alert if it is later picked up. A clearly labelled simulated parcel box shows how a verified courier could get a one-time code (Ring's API has no lock control).

## How we built it
- **Ring Partner API:** device discovery, event-history polling, snapshot and clip downloads (303 → pre-signed URL with 416/425 retries), WHEP live video, HMAC-verified webhooks for motion and doorbell presses, OAuth refresh with token rotation. Tested end to end against the Ring Developer Playground.
- **Amazon Bedrock:** Amazon Nova 2 Lite (Converse API) describes each frame or 3-frame burst as structured JSON (category, actors and roles, package, vehicle, movement, confidence). Claude on Bedrock is supported through Anthropic's Bedrock Mantle client.
- **Strands Agents SDK (TypeScript):** the Ask agent, with six tools over the history: search events, get event, list deliveries, build incident report, expect arrival, list expected.
- **Amazon DynamoDB and Amazon S3:** events, deliveries, expected visitors and parcel-box state in one pay-per-request table; snapshots in a private, encrypted bucket. `scripts/setup-aws.sh` creates both.
- **App:** Next.js and TypeScript, Server-Sent Events for live alerts, a mobile-first accessible UI (keyboard, screen reader announcements, reduced motion).
- **Quality:** 59 unit tests, and an evaluation report (`npm run eval:report`) on real Ring Playground frames: 12/12 correct, 0 people described as animals, 10/10 planted bad captions caught, 5/5 Ask questions right, median 2.9 s per frame.

## Challenges we ran into
- The Playground sends no motion webhooks, so we poll event history and treat new event ids as triggers.
- Ring returned `416 MEDIA_NOT_FOUND` and an undocumented `422 GRECO_NO_VALID_KEY` for Package-simulation media, while Motion and Vehicle media downloaded fine. We added live-view frame capture so packages are still seen.
- Ring ends live sessions after 30–60 seconds without closing the video track. We detect the frozen video clock and reconnect automatically.
- Asking a model about movement made it miss an obvious package. Our evaluation caught it; the fix was to describe the latest frame in full and use earlier frames only for movement.
- Models are confidently wrong on dark frames. A measured-brightness check now caps confidence and says "too dark to see".

## Accomplishments we're proud of
- An accessibility-first doorbell experience that no Ring Appstore app offers today.
- A safety layer with measured results, not just a promise.
- Honest evaluation that found and fixed real bugs (a missed package, wrong time windows in Ask, a courier matched as "your plumber").
- An open-source fix to Amazon's own Ring sample (see below).

## What we learned
- Small, deterministic code around a model (safety rules, brightness checks, time maths in code instead of in the prompt) makes AI features far more reliable.
- Measuring early changes decisions: several "improvements" made things worse until the evaluation showed it.

## What's next
- Push notifications so alerts reach phones and watches with the app closed.
- Account linking as a Ring Private App, then the Ring Appstore.
- More languages for spoken alerts and answers.
- An MCP server so voice assistants can ask "what's at my door?".

## Built during the hackathon
The project started from Amazon's MIT-licensed sample `AmazonAppDev/ring-api-helloworld` (its Ring auth module and WHEP streaming starting point). Everything else — the perception pipeline, safety layer, alerts, movement, expected visitors, Ask agent, deliveries, AWS storage, UI, tests and evaluation — was built during the submission window.

---

## AWS Builder mini challenge
**Services and how they are used:** Amazon Bedrock (Nova 2 Lite vision through the Converse API; Claude supported) for frame and burst descriptions; Strands Agents SDK on Bedrock for the Ask agent with six tools; Amazon DynamoDB for events, deliveries, expected visitors and parcel-box state; Amazon S3 for private, encrypted snapshots. Integrations are documented in the README ("AWS services used") with links to the code, and `scripts/setup-aws.sh` provisions the storage.

## Open Source mini challenge
- **Contribution URL:** https://github.com/AmazonAppDev/ring-api-helloworld/pull/29
- **Your repo URL:** https://github.com/dapphari007/doorstep-plus
- **GitHub username:** dapphari007
- **What, how, why:** Removed `GET /api/ring/token`, which returned the live Ring access token to any caller and was not used by the app; and fixed refresh-token mode so it keeps the rotated refresh token Ring returns on each refresh instead of re-sending the original one. Every developer who starts from Amazon's sample inherits both problems: the first is a token leak, the second breaks long-running integrations about four hours after start. The PR type-checks, builds, and merges cleanly with the other open PRs.

## Links
- Demo video (YouTube, public, under 3 minutes): `<add>`
- GitHub repo: https://github.com/dapphari007/doorstep-plus
- Read-only live demo (recorded Ring Playground events, serverless on AWS Lambda): https://vgso5tpy4uw5u2a5igztqzc7me0knnxq.lambda-url.us-east-1.on.aws/
