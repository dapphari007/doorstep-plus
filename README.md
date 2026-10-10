# Doorstep+

**Your Ring doorbell, understood — by everyone in the house.**

Doorstep+ is an AI layer on top of the [Ring Partner API](https://developer.amazon.com/docs/ring/api-documentation.html). It describes what is happening at the front door (never *who*), alerts each resident in the way that works for them, remembers everything so you can just ask, and handles package deliveries on its own.

Built for the Amazon Developer Hackathon 2026 — **Ring track** (accessibility, access control, IoT home automation) and the **AWS Builder** mini challenge.

| | |
|---|---|
| 🧏 **Accessible alerts** | Deaf / hard-of-hearing: full-screen colour flashes, vibration and smart-light patterns, each event type with its own rhythm. Blind: every event spoken aloud, `R` repeats. Low vision: extra-large, high-contrast captions. |
| 🧠 **Recall** | Ask "Did a package arrive, and is it still there?" A Strands agent on Amazon Bedrock searches the described event history and answers with exact times, thumbnails and a downloadable incident report. |
| 📦 **Deliveries** | When a courier drops off a package, the footage is checked, a (simulated) parcel box opens for two minutes with a one-time code, and a proof-of-delivery record is kept. If the package is later picked up, you are alerted. |
| 🛡 **Safe by design** | No face recognition, no licence plates, no identity guesses. A deterministic safety pass edits every AI description before anyone sees or hears it (e.g. a person can never be captioned as an animal) and shows what it changed. |

## Why

Ring owners' most common complaints, from App Store, Trustpilot and Ring Community reviews:

- Alerts are noisy, late, and only useful if you are looking at a phone screen — which excludes deaf, blind and low-vision residents.
- AI captions have mislabelled people (including describing a person as an animal).
- Searching past video is painful, and AI search is a Premium-only feature.
- Package theft and missed deliveries still need someone at the door.

## How it works

```
Ring Partner API ──► Event History poll (Playground)  ─┐
                 └─► Webhooks (real devices, HMAC)   ─┤
Browser live view (WHEP) ─► "Describe now" frame ─────┤
                                                       ▼
                       Snapshot download (latest_in_range / at_timestamp, 303 → pre-signed URL)
                                                       ▼
                       Bedrock vision model (Nova / Claude) → structured JSON (what, not who)
                                                       ▼
                       Safety pass (identity, animal-for-person, plates, low confidence)
                                                       ▼
                       Store: DynamoDB + S3  (or local files)
              ┌────────────────────┼─────────────────────┐
              ▼                    ▼                     ▼
     Accessible alerts      Recall agent (Strands     Delivery flow → simulated
     SSE → flash/vibrate/   + Bedrock, tools over      parcel lock, proof of
     speech/smart light     events & deliveries)       delivery, "taken" alerts
```

### Ring APIs used (all called in code)

| Ring API | Where |
|---|---|
| `GET /v1/devices?include=status,configurations` (incl. `e2e_encryption`) | [lib/ring/client.ts](lib/ring/client.ts) `listDevices` |
| `GET /v1/history/devices/{id}/events?event_types=on_demand,motion,ding` | [lib/ring/client.ts](lib/ring/client.ts) `getHistory`, polled by [lib/ring/poller.ts](lib/ring/poller.ts) |
| `POST /v1/devices/{id}/media/image/download` (303 → pre-signed GET) | `downloadSnapshot`, with 416/425 retry in [lib/pipeline.ts](lib/pipeline.ts) |
| `POST /v1/devices/{id}/media/video/download` | `downloadClip`, served by [app/api/ring/clip](app/api/ring/clip/route.ts) with the *event's* time in the filename |
| `POST/DELETE /v1/devices/{id}/media/streaming/whep/sessions` | `startWhepSession` / `stopWhepSession`, browser side in [app/hooks/useWebRTCStream.ts](app/hooks/useWebRTCStream.ts) |
| Webhooks `motion_detected` (incl. `package_delivery` sub_type), `button_press`, `X-Signature` HMAC | [app/api/webhook](app/api/webhook/route.ts), [lib/ring/webhook.ts](lib/ring/webhook.ts) |
| OAuth refresh with token rotation | [lib/ring/auth.ts](lib/ring/auth.ts) |

### AWS services used

| Service | Use |
|---|---|
| **Amazon Bedrock** — Amazon Nova 2 Lite by default (Converse API); Claude via Anthropic's Bedrock Mantle client | Per-event frame description → structured JSON — [lib/perception/describe.ts](lib/perception/describe.ts) |
| **Strands Agents SDK** (TypeScript) + **Amazon Bedrock** | Recall agent with 4 tools: `search_events`, `get_event`, `list_deliveries`, `build_incident_report` — [lib/agent/recall.ts](lib/agent/recall.ts) |
| **Amazon DynamoDB** | Event, delivery and lock records (single table, `pk`/`sk`) — [lib/store/aws.ts](lib/store/aws.ts) |
| **Amazon S3** | Snapshot storage — [lib/store/aws.ts](lib/store/aws.ts) |

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

**Known weakness:** on a dimmed package frame, the model once said "no activity" with high confidence (1 of 3 runs). Very dark frames are caught by a measured-brightness check and reported as "too dark to see clearly"; dim-but-not-dark frames still rely on the model.

## Run it

Requirements: Node.js 22+, a free Ring account, AWS credentials with Bedrock model access.

```bash
npm install
cp .env.example .env.local   # set AWS_REGION; sign in with `aws login`
npm run check:bedrock        # confirms both models answer (image + agent)
npm run dev
```

1. Open the [Ring Developer Playground](https://developer.amazon.com/ring/console/playground) and click **Generate Token**.
2. In the app, go to **Settings**, paste the token, and press **Connect**. (Playground tokens last ~30 minutes; paste a new one when the status turns amber.)
3. Pick an alert profile in the top bar (try **Deaf / hard of hearing**).
4. In the Playground, start a **Package**, **Vehicle** or **Motion** live-view simulation. Within a few seconds the event is described and the alert fires. Or press **Start live view** → **Describe what's happening** in the app.
5. Open **Recall** and ask what happened; open **Deliveries** to see the parcel box and proof of delivery.

### Storage

Without `DDB_TABLE` / `S3_BUCKET`, data lives in `.data/`. To use AWS (pay-per-request table, private encrypted bucket):

```bash
./scripts/setup-aws.sh us-east-1   # prints the two lines to add to .env.local
```

### Smart lights (optional)

Set `LIGHT_WEBHOOK_URL` to any webhook (Home Assistant, IFTTT, …). Each alert POSTs `{ kind, color, rhythm_ms, caption, at }` so a real lamp can flash the same pattern as the screen.

### Fixture mode (development only)

`FIXTURE_MODE=true npm run dev` replaces Ring and Bedrock with canned data and shows **Simulate** buttons. Every fixture event is labelled "FIXTURE (not Ring)" in the UI. The demo video uses real Playground data, not fixtures.

### Tests

```bash
npm test              # unit tests: safety pass, webhooks, deliveries, feed rules
npm run eval          # quick model check on the saved Ring frames
npm run eval:report   # full results report -> docs/results.md (calls Bedrock, a few cents)
npm run typecheck
```

## Honest limitations

- The Ring Partner API is read-only: there is no lock, intercom or alarm control. The parcel box is a **simulated** lock, labelled as such everywhere.
- The Playground has one simulated doorbell and no motion webhooks, so the app polls Event History. On real devices, webhooks feed the same pipeline.
- Descriptions are AI-generated and can be wrong; low-confidence scenes get general wording instead of guesses.
- Devices with end-to-end encryption are not visible to partner APIs.
- This is a single-user demo app with no login; don't expose it to the internet as-is.

## Open source contribution

While building this we found and fixed two auth bugs in Amazon's official sample, [AmazonAppDev/ring-api-helloworld](https://github.com/AmazonAppDev/ring-api-helloworld): [pull request #29](https://github.com/AmazonAppDev/ring-api-helloworld/pull/29) (by [@dapphari007](https://github.com/dapphari007)).

- **What:** removed a route that returned the live Ring access token to any caller, and made refresh-token mode keep the rotated refresh token.
- **Why it matters:** every developer who starts from the sample inherits both problems. The token leak is a security issue, and the refresh bug breaks long-running integrations about 4 hours after start, because Ring invalidates the old refresh token on each refresh.

## Built on

Forked from [AmazonAppDev/ring-api-helloworld](https://github.com/AmazonAppDev/ring-api-helloworld) (MIT) — its WHEP streaming hook and auth module. Everything else was built during the hackathon window.

## License

MIT — see [LICENSE](LICENSE).
