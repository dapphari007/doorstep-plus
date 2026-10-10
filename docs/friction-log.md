# Friction log

Entries recorded while building. Severity: 🔴 blocker · 🟠 major · 🟡 minor.
Entries marked *(to verify)* were found in docs or code and still need confirming against the live Playground.

---

## 1. Playground live-view events don't say which simulation ran — 🟠

- **Task:** React differently to the Playground's Package, Vehicle and Motion simulations.
- **Steps:** Read the Event History docs and the Devpost forum answer from Ring staff.
- **Expected:** The event (or a `sub_type`) says "package" / "vehicle" / "motion".
- **Actual:** All three are logged as `on_demand`, with no subtype.
- **Workaround:** Download a snapshot for every event and classify it ourselves with a vision model.
- **Suggestion:** Emit the simulated scenario as `sub_type` (matching the motion vocabulary: `package_delivery`, `vehicle`, `human`), or fire simulated `motion_detected` webhooks.

## 2. No motion webhooks in the Playground — 🟠

- **Task:** Build an event-driven app (the recommended architecture) without a physical device.
- **Expected:** Simulations trigger webhooks to a registered URL.
- **Actual:** No motion webhooks; we had to build a polling loop just for development.
- **Workaround:** Poll `GET /v1/history/devices/{id}/events` every 4 s and dedupe by event id ([lib/ring/poller.ts](../lib/ring/poller.ts)).
- **Suggestion:** Let Playground users register a webhook URL (or a built-in tunnel) and deliver signed simulated events.

## 3. 30-minute Playground tokens interrupt development — 🟡

- **Task:** Keep a dev server running against the Playground.
- **Actual:** The token expires mid-session; every request then fails with 401 and the server must be restarted with a new env var.
- **Workaround:** A Settings page that accepts a fresh token at runtime, held in memory.
- **Suggestion:** Offer a Playground refresh token, or longer-lived sandbox tokens scoped to the simulated device.

## 4. Sample app's refresh flow reuses an invalidated refresh token — 🟠

- **Task:** Reuse `lib/auth.ts` from `ring-api-helloworld`.
- **Expected:** Auth keeps working beyond the first token refresh.
- **Actual:** The docs say each refresh returns a new refresh token and invalidates the old one, but the sample always sends the original `RING_REFRESH_TOKEN` from the environment. It will fail on the second refresh (about 4 hours in).
- **Workaround:** Keep the rotated refresh token in memory ([lib/ring/auth.ts](../lib/ring/auth.ts)).
- **Suggestion:** Fix the sample and show persisting the rotated token. Candidate for an upstream PR.

## 5. Sample app exposes the access token to the browser — 🟠

- **Task:** Review the sample before forking.
- **Actual:** `GET /api/ring/token` returns the Ring access token to any caller.
- **Workaround:** Removed the route. All Ring calls stay server-side.
- **Suggestion:** Remove it from the sample; it teaches an unsafe pattern.

## 6. Sample comment says there is no polling API — 🟡

- **Actual:** `app/api/ring/events/route.ts` in the sample says "Ring doesn't have a polling API for events". The Event History endpoint exists and is documented as a polling alternative.
- **Suggestion:** Update the comment and point to Event History.

## 7. Snapshot download needs a manual redirect to avoid leaking the token — 🟡

- **Task:** Download images and clips.
- **Actual:** The endpoint answers `303` with a pre-signed URL. A default `fetch` follows the redirect automatically, and whether the `Authorization` header is forwarded to the pre-signed host depends on the HTTP client.
- **Workaround:** `redirect: 'manual'`, then GET the `Location` without credentials.
- **Suggestion:** Say explicitly in the docs not to forward the bearer token to the pre-signed host.

## 8. Mandatory watermark vs. computer vision — 🟡 *(to verify)*

- **Actual:** Every snapshot carries a fixed-size watermark. It covers more of the frame at lower resolutions, and the docs mention models may need retraining.
- **Workaround:** Request full resolution, and tell the vision model to ignore the overlay.
- **Suggestion:** Return a watermark bounding box in the response headers so apps can mask it.

## 9. Playground simulations create events but no downloadable media — 🔴

- **Task:** Describe a Playground "Package" simulation from its snapshot, which is how a real device event would be handled.
- **Steps:**
  1. Started the Package live-stream simulation in the Playground.
  2. Event History showed a new `on_demand` event.
  3. Called `POST /media/image/download` with `latest_in_range` over the event's start/end, retrying for ~2 minutes as the docs suggest.
- **Expected:** A snapshot from the simulated clip, as with a real recording.
- **Actual:** Every attempt returned `416 MEDIA_NOT_FOUND`. The event exists, but no image or clip can be fetched, so no snapshot or clip feature can be tested in the sandbox.
- **Workaround:** Capture frames from the live WHEP stream in the browser and describe those ("Describe what's happening" / auto-describe).
- **Suggestion:** Have the Playground store the simulated clip as a recording, so image/video download returns real media for simulated events.

## 9b. Undocumented `422 GRECO_NO_VALID_KEY` on a Playground event — 🟠

- **Actual:** For one Playground `on_demand` event, image download answered `422 GRECO_NO_VALID_KEY: No valid Greco key available for decryption`. This code is not in the documented error table (which lists 422 only as `CORRUPT_RECORDING`), and the device reports no end-to-end encryption.
- **Workaround:** Treat it as "no media" and fall back to live-view frames.
- **Suggestion:** Document this code, say whether it is retryable, and explain what a developer can do about it.

## 10. Media download treated as an error by naive clients — 🟡

- **Actual:** `POST /media/image/download` returns `303`. With `redirect: 'manual'` (needed so the token isn't forwarded, see entry 7), a status check of the form `res.ok` treats it as a failure. We shipped that bug once.
- **Suggestion:** Show a full request/redirect/download code sample in the docs, in JavaScript as well as Python.

<!-- Add entries from live Playground testing below: task, steps, expected vs actual, severity, workaround, suggestion. -->
