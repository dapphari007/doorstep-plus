# Product feedback

For each tool: what we used it for, what worked, what needs work, onboarding, and whether we'd build with it again. Detailed reproduction steps are in [friction-log.md](friction-log.md).

## Ring Partner API and Ring Developer Playground
- **Used for:** device discovery, event-history polling, snapshot and clip downloads, WHEP live video, webhook verification, OAuth refresh.
- **Worked well:**
  - The Playground gives a working token in one click, with no app registration. We had live video in our own app within minutes.
  - The docs are clear and complete: JSON:API shapes, error codes, and the 416/425 "recording not ready" semantics made retry logic easy.
  - The live stream follows whichever simulation was last opened in the Playground, which made scripted demos easy.
- **Needs work:**
  - Simulated events are all logged as `on_demand`, with no sub-type saying Package, Vehicle or Motion.
  - No motion webhooks in the Playground, so event-driven apps need a polling workaround during development.
  - Package-simulation media can't be downloaded: `416 MEDIA_NOT_FOUND` at first, then an undocumented `422 GRECO_NO_VALID_KEY`. Motion and Vehicle media download fine.
  - Live sessions end after 30–60 seconds without closing the WebRTC track, so apps must detect a frozen video clock themselves.
  - Playground tokens expire after about 30 minutes, interrupting development.
  - The hello-world sample exposed the access token on a public route and did not keep rotated refresh tokens (fixed in our PR #29).
- **Onboarding:** fast for the Playground; the real-device path (Private App, US device, subscription, webhook hosting) is a much bigger step, and the API is US-only.
- **Would we build with it again?** Yes. The API surface is small and well designed; the sandbox gaps above are the main blockers for richer demos.

## Amazon Bedrock (Amazon Nova 2 Lite; Claude supported)
- **Used for:** describing each Ring frame or 3-frame burst as structured JSON; the model behind the Ask agent.
- **Worked well:**
  - `aws login` made CLI and SDK credentials painless, with no long-lived keys on disk.
  - Nova 2 Lite returned valid structured JSON from images in about 3 seconds median, cheaply enough to run every few seconds, and needed no extra model agreement.
  - The Converse API let us swap models without changing app code.
- **Needs work:**
  - Before the Anthropic model agreement was accepted, the Bedrock Mantle endpoint answered `404 "model does not exist"` and Converse said "not available for this account". Only `get-foundation-model-availability` showed the real cause (`agreementAvailability: NOT_AVAILABLE`). An error naming the missing agreement would save time.
  - On dim frames the model can be confidently wrong; we added our own brightness check.
- **Would we build with it again?** Yes.

## Strands Agents SDK (TypeScript)
- **Used for:** the Ask agent, with six Zod-typed tools over the event history.
- **Worked well:** Zod tool definitions with typed callbacks; `BedrockModel` is a one-line setup; `printer: false` keeps server logs clean; it works with any Bedrock Converse model.
- **Needs work:** with more tools, the model sometimes answered in chat instead of calling the right tool (for example writing a report instead of calling the report tool), so tool-use instructions had to be very explicit. A built-in way to require a tool for a turn would help.
- **Would we build with it again?** Yes.

## Amazon DynamoDB and Amazon S3
- **Used for:** events, deliveries, expected visitors and parcel-box state in one pay-per-request table; private, encrypted snapshot storage.
- **Worked well:** on-demand billing meant no capacity planning and cents of cost; new S3 buckets are private and encrypted by default.
- **Needs work:** nothing blocking at this scale.
- **Would we build with it again?** Yes.
