# Product feedback (draft — finish after live testing)

For each tool: what we used it for, what worked, what needs work, onboarding, would we build with it again.

## Ring Partner API + Developer Playground
- **Used for:** device discovery, event history polling, snapshot and clip downloads, WHEP live view, webhook verification.
- **Worked well:** Clear JSON:API docs with error codes. The 416/425 semantics for "recording not ready" made retry logic easy. The hello-world sample got live video working fast.
- **Needs work:** See [friction-log.md](friction-log.md): Playground events don't say which simulation ran, no simulated webhooks, 30-minute tokens, sample auth bugs.
- **Onboarding:** _TODO after Playground testing: time to first token, first stream._
- **Build again?** _TODO_

## Amazon Bedrock (Nova / Claude, vision)
- **Used for:** describing each doorbell frame as structured JSON (Amazon Nova 2 Lite by default; Claude supported).
- **Worked well:** `aws login` made CLI credentials painless. Nova 2 Lite returned valid structured JSON from an image in ~2.7 s and needed no extra agreement.
- **Needs work:** With the Anthropic model agreement not yet accepted, the Bedrock Mantle endpoint answered `404 "model does not exist"` and Converse said "not available for this account". Only `get-foundation-model-availability` showed the real cause (`agreementAvailability: NOT_AVAILABLE`). An error naming the missing agreement would save time.
- _TODO: latency per real Ring event, watermark impact._

## Strands Agents SDK (TypeScript)
- **Used for:** the Recall agent (4 Zod-typed tools over DynamoDB-backed events).
- **Worked well:** Zod tool definitions; `printer: false` for server use; BedrockModel is a one-liner.
- _TODO_

## Amazon DynamoDB / Amazon S3
- **Used for:** event, delivery and lock records; snapshot storage.
- _TODO_
