# Doorstep+

**Your Ring doorbell, understood by everyone in the house.**

Doorstep+ is an AI layer on top of the [Ring Partner API](https://developer.amazon.com/docs/ring/api-documentation.html). It describes what is happening at the front door (never *who*), tells each resident in the way that works for them — flashes and vibration for deaf residents, voice for blind residents, large high-contrast text for low vision — remembers everything so you can just ask, and keeps track of deliveries.

Built for the Amazon Developer Hackathon 2026: **Ring track** (accessibility, IoT home automation, access control) with the **AWS Builder** and **Open Source** mini challenges.

| | |
|---|---|
| 🧏 **Alerts for everyone** | Each kind of event has its own flash and vibration rhythm (doorbell, delivery, visitor, vehicle). Deaf and hard of hearing: full-screen colour flashes, vibration, optional smart-light webhook. Blind: every alert read aloud, `R` repeats. Low vision: larger, high-contrast text. |
| 🎥 **Understands movement** | The live view sends short frame bursts, so it can tell a car *driving through* from a parked car, and a person *walking past* from someone *at the door*. Passers-by are logged without alerting. It only calls the AI when the picture actually changes. |
| 🕒 **Expected visitors** | "Plumber, 3–4 PM", "Parcel, today", or "I'm heading home": arrivals in that window are announced as "possibly your plumber" — matched by time and what the camera sees, never by face. Say it in Ask too: "a plumber is coming at 3 PM". |
| 🧠 **Ask your door** | "Did a package arrive, and is it still there?" A Strands agent on Amazon Bedrock searches the event history and answers with exact times, thumbnails and a downloadable incident report. |
| 📦 **Deliveries** | Every package seen at the door, with photos and times. Expected parcels are linked; a later pickup raises an alert. A clearly labelled simulated parcel box opens for verified couriers with a one-time code. |
| 🛡 **Safe by design** | No face recognition, no licence plates, no identity guesses. A deterministic safety layer edits every AI description before anyone sees or hears it — a person can never be captioned as an animal, and very dark frames say "too dark to see" instead of guessing. |

## Live demo

**[Try the read-only demo](https://vgso5tpy4uw5u2a5igztqzc7me0knnxq.lambda-url.us-east-1.on.aws/)** — real events recorded from the Ring Developer Playground, with Ask, filters, Deliveries and "Play a sample alert" (try each alert profile). Live view and anything that changes data are turned off, because they need a personal Ring token. The [demo video](#) shows the live Ring flow.

It runs serverless on **AWS Lambda** (arm64, container image via the AWS Lambda Web Adapter) behind a Lambda Function URL: it sleeps when nobody visits and costs almost nothing. The function has its own read-only IAM role (read DynamoDB and S3 snapshots, call one Bedrock model), a concurrency cap of 3, and Ask is rate-limited. Update it with `./scripts/deploy-demo.sh`.

## Why

From Ring app reviews (App Store, Trustpilot, Ring Community):

- Alerts are noisy and only useful if you're looking at a phone screen, which leaves out deaf, blind and low-vision residents.
- AI captions have mislabelled people, including describing a person as an animal.
- Searching past video is painful, and AI search is a paid Premium feature.
- Packages go missing and deliveries still need someone at the door.

## How it works

```
Ring Partner API ─► Event history (polled) ─────────┐
                └─► Webhooks: motion, doorbell (HMAC)┤
Live view (WHEP) ─► 3-frame burst, only if changed ──┤
                                                     ▼
              Snapshot download (303 → pre-signed URL, 416/425 retry)
                                                     ▼
              Amazon Bedrock vision (Nova 2 Lite / Claude) → structured JSON:
              what, where, package, vehicle, movement — never who
                                                     ▼
              Safety layer (identity, animal-for-person, plates, darkness)
                                                     ▼
              Expected visitors · deliveries · doorbell vs passing-by
                                                     ▼
              Amazon DynamoDB (records) + Amazon S3 (snapshots)
          ┌──────────────────────────┼───────────────────────────┐
          ▼                          ▼                           ▼
  Alerts over SSE: flash,     Ask agent (Strands + Bedrock,   Deliveries, simulated
  vibration, voice, chime,    6 tools over the history)       parcel box, pickup alerts
  smart-light webhook
```

### Ring APIs used (all called in code)

| Ring API | Where |
|---|---|
| `GET /v1/devices?include=status,configurations` | [lib/ring/client.ts](lib/ring/client.ts) `listDevices` |
| `GET /v1/history/devices/{id}/events` | `getHistory`, polled by [lib/ring/poller.ts](lib/ring/poller.ts) |
| `POST /v1/devices/{id}/media/image/download` (303 → pre-signed GET) | `downloadSnapshot`, retried in [lib/pipeline.ts](lib/pipeline.ts) |
| `POST /v1/devices/{id}/media/video/download` | `downloadClip`, served by [app/api/ring/clip](app/api/ring/clip/route.ts) named with the event's own time |
| `POST/DELETE /v1/devices/{id}/media/streaming/whep/sessions` | `startWhepSession` / `stopWhepSession`; browser side in [app/hooks/useLiveStream.ts](app/hooks/useLiveStream.ts) |
| Webhooks `motion_detected` (incl. `package_delivery`), `button_press`, `X-Signature` HMAC | [app/api/webhook](app/api/webhook/route.ts), [lib/ring/webhook.ts](lib/ring/webhook.ts) |
| OAuth refresh with token rotation | [lib/ring/auth.ts](lib/ring/auth.ts) |

### AWS services used

| Service | Use |
|---|---|
| **Amazon Bedrock** — Amazon Nova 2 Lite by default (Converse API); Claude through Anthropic's Bedrock Mantle client | Describes each frame or frame burst as structured JSON — [lib/perception/describe.ts](lib/perception/describe.ts) |
| **Strands Agents SDK** (TypeScript) on Amazon Bedrock | Ask agent with 6 tools: `search_events`, `get_event`, `list_deliveries`, `build_incident_report`, `expect_arrival`, `list_expected` — [lib/agent/ask.ts](lib/agent/ask.ts) |
| **Amazon DynamoDB** | Events, deliveries, expected visitors, parcel box (single table, `pk`/`sk`) — [lib/store/aws.ts](lib/store/aws.ts) |
| **Amazon S3** | Private, encrypted snapshot storage — [lib/store/aws.ts](lib/store/aws.ts) |

## Results

Measured with `npm run eval:report` on real Ring Playground frames (3 runs each), plus harder variants generated from them (dim, very dark, blur, low resolution). Full tables in [docs/results.md](docs/results.md).

| Measure | Result |
|---|---|
| Real Ring frames described correctly | **12/12**, same answer every run |
| Harder variants: honest (correct, or clearly says it's unsure) | **98%** |
| People described as animals | **0** |
| Time per frame (median / 95th percentile) | 2.9 s / 6.8 s |
| Ask: questions answered correctly | **5/5** |
| Safety layer: planted bad captions caught | **10/10** (clean captions untouched: 3/3) |
| Still scenes sent as bursts reported as moving | **0/3** (`npm run eval:motion`) |

**Known weakness:** on a dimmed package frame the model once said "no activity" with high confidence (1 of 3 runs). Very dark frames are caught by a measured-brightness check; dim-but-not-dark frames still rely on the model.

## Run it

Requirements: Node.js 22+, a free Ring developer account, AWS credentials with Amazon Bedrock access.

```bash
npm install
cp .env.example .env.local   # set AWS_REGION; sign in with `aws login`
npm run check:bedrock        # confirms both models answer (image + agent)
npm run dev                  # http://localhost:3000
```

1. Open the [Ring Developer Playground](https://developer.amazon.com/ring/console/playground) and choose **Generate Token**.
2. In the app, open **Settings**, paste the token and choose **Connect**. Playground tokens last about 30 minutes; the blue bar tells you when to reconnect.
3. Pick an alert profile in the top bar (try **Deaf or hard of hearing**).
4. In the Playground, start the **Package**, **Vehicle** or **Motion** simulation. On **Home**, choose **Start live view**, then **Describe now** or turn on **Keep watching**.
5. Add an expected visitor or parcel on Home, ask questions in **Ask**, and see packages in **Deliveries**.

### Storage

Without `DDB_TABLE` / `S3_BUCKET` data lives in `.data/`. To use AWS (pay-per-request table, private encrypted bucket):

```bash
./scripts/setup-aws.sh us-east-1   # prints the two lines to add to .env.local
```

### Smart lights (optional)

Set `LIGHT_WEBHOOK_URL` to any webhook (Home Assistant, IFTTT, …). Each alert POSTs `{ kind, color, rhythm_ms, caption, at }` so a real lamp can flash the same pattern as the screen.

### Test mode

`FIXTURE_MODE=true npm run dev` replaces Ring and Bedrock with canned events for UI work. Every such event is labelled "Test data" and the app shows a "Test mode" banner. The demo video uses real Ring Playground data.

### Checks

```bash
npm test               # 59 unit tests: safety, matching, alerts, webhooks, deliveries, feed rules
npm run typecheck
npm run eval           # model check on saved Ring frames
npm run eval:motion    # still scenes must not be reported as moving
npm run eval:report    # full results report -> docs/results.md (calls Bedrock, a few cents)
```

## Limitations

- The Ring Partner API is read-only (no locks, intercom or alarm), so the parcel box is **simulated** and labelled as such.
- The Playground has one simulated doorbell and no motion webhooks, so the app polls event history; on real devices webhooks feed the same pipeline. Ring returns no stored media for the Playground's Package simulation (see [docs/friction-log.md](docs/friction-log.md)), so packages are seen through the live view.
- Descriptions are AI-generated and can be wrong; low-confidence and very dark scenes get general wording instead of guesses.
- Devices with end-to-end encryption are not visible to partner APIs.
- Single-household demo app without user accounts; not meant to be exposed to the internet as is.

## Open source contribution

Found and fixed two auth bugs in Amazon's official sample, [AmazonAppDev/ring-api-helloworld](https://github.com/AmazonAppDev/ring-api-helloworld): [pull request #29](https://github.com/AmazonAppDev/ring-api-helloworld/pull/29) by [@dapphari007](https://github.com/dapphari007).

- **What:** removed a route that returned the live Ring access token to any caller, and made refresh-token mode keep Ring's rotated refresh token.
- **Why it matters:** every developer starting from the sample inherits both problems. The token leak is a security issue; the refresh bug breaks long-running integrations about 4 hours in, because Ring invalidates the old refresh token on each refresh.

## Built on

Started from [AmazonAppDev/ring-api-helloworld](https://github.com/AmazonAppDev/ring-api-helloworld) (MIT) for its Ring auth module and WHEP streaming starting point. Everything else was built during the hackathon window.

## License

MIT — see [LICENSE](LICENSE).
