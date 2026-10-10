# Doorstep+ — UI brief

Use this to design a new UI. The backend (`lib/`, `app/api/`) stays as is; the UI only talks to the HTTP endpoints below.

## Product in one line
An accessible AI layer for a Ring doorbell: it tells you what's happening at your door (never who), in the way that works for you (flashes, vibration, voice), remembers everything you can ask about, and tracks deliveries.

## Design direction
- **Plain and calm.** One clear main thing per screen. No dashboards full of cards.
- **Accessibility first.** Large readable type, high contrast, everything works by keyboard, screen-reader labels on all controls, nothing conveyed by colour alone, respect reduced motion.
- **Works at 375px** (phone) up to desktop.
- Light and dark themes.

## Screens

### 1. Home (Front door)
Main job: show what's happening at the door right now.

| Element | Data / behaviour |
|---|---|
| **Now card** (the hero) | Latest described event: icon + kind label (Delivery / Someone at the door / Vehicle / Animal / Package picked up), time, **caption** (big), details (small), snapshot image. Empty state: "Nothing yet." |
| Live view | Video element (WebRTC, use the existing hook `app/hooks/useWebRTCStream.ts`). Buttons: **Start / Stop live view**, **Describe now**. Toggle: **Keep watching**. States: off, connecting, streaming, ended by Ring ("sessions last 30–60 s"), error message. |
| Recent activity | List of events (newest first): thumbnail, kind, time, caption. Pending state: "Describing…". Hide repeats (`repeatOf`) and live-view sessions without media (see filter below). |
| Status line | Small: "Watching Ring · checked 1:02 PM" or a warning like "Ring token expired — reconnect in Settings". |

Filter for the list: hide events where `repeatOf` is set, or where `ringType === 'on_demand'` and `status` is `no_media` or `error`.

### 2. Recall (Ask)
Main job: chat with your door's history.
- Question box + **Ask** button. Suggested questions as chips when empty:
  "What happened at my door today?", "Did a package arrive, and is it still there?", "Was there a car in the driveway this afternoon?", "Make an incident report for my missing package".
- Each answer: text, optional **Download report** button (Markdown), list of referenced events (thumbnail + caption + time).
- Loading state: "Looking through your door's history…". Speak the answer aloud if the profile has voice on.

### 3. Deliveries
- **Parcel box** panel (label it **Simulated**): Locked / Open, re-lock countdown, active one-time code + expiry, code input + **Unlock**, **Lock now**, **Reset simulator**, short log (time + text).
- **Delivery list**: status badge (**Verified drop-off** / **Needs a look** / **Picked up**), time, carrier guess, summary, drop-off thumbnail, pickup thumbnail if taken.

### 4. Settings
- **Connect Ring**: password-type input for a Playground token + **Connect**. Link to `https://developer.amazon.com/ring/console/playground`. Never display the token.
- **Alert profile** (radio cards): Standard, Deaf / hard of hearing, Blind, Low vision, each with a one-line description.
- **Alert toggles**: Screen flash, Vibration, Speak aloud, Chime.
- **System check**: Ring connected, Event polling, Amazon Bedrock (models), Storage (DynamoDB + S3 / local), Smart-light webhook. Each with ok / warning + one line of detail.
- **Privacy promise** (3 bullets): no face recognition or plates; a safety check edits every AI description; only events after you connect.

### Global
- Top bar: app name, nav (Home, Recall, Deliveries, Settings), live connection dot, **profile switcher**.
- **Alert overlay** (fires for each new event): full-screen colour flash in the event's rhythm (if flash on), large caption card at the bottom with kind, time, caption, dismiss. Keyboard: **R** repeats the last alert aloud, **Esc** dismisses. Must also announce via an `aria-live="assertive"` region.
- Skip-to-content link.

## Alert vocabulary (keep these)
From `lib/alerts.ts` — `PATTERNS[kind]` gives `label`, `color`, `icon`, `rhythm` (ms on/off). Use `alertKindFor(perception)` and `spokenText(perception, time)`.

| kind | label | colour | rhythm |
|---|---|---|---|
| delivery | Delivery | amber | long, long |
| visitor | Someone at the door | blue | 3 short |
| vehicle | Vehicle | purple | 1 long |
| animal | Animal | green | 3 quick |
| urgent | Urgent | red | rapid |
| package_taken | Package picked up | red | 3 medium |

## Data shapes (from `lib/types.ts`)
```ts
DoorEvent {
  id, deviceId, ringType: 'on_demand'|'motion'|'ding'|string, subType?,
  start: number /* epoch ms */, source: 'history'|'webhook'|'live_frame'|'fixture',
  status: 'pending'|'described'|'no_media'|'error', error?, hasSnapshot: boolean,
  perception?: {
    category: 'delivery'|'visitor'|'vehicle'|'animal'|'no_activity'|'other',
    caption: string, details: string,
    actors: { role, action }[], package: { present, action }, vehicle: { present, kind? },
    carrierGuess?, urgency: 'low'|'normal'|'high', confidence: number, safetyNotes: string[]
  },
  deliveryId?, repeatOf?
}
DeliveryRecord { id, eventId, at, status: 'verified'|'needs_review'|'taken', carrierGuess?, summary, code?, codeExpiresAt?, takenEventId?, takenAt? }
LockState { simulated: true, locked, unlockedUntil?, activeCode?: { code, expiresAt, deliveryId }, log: { at, action, detail }[] }
```
Show a "FIXTURE (not Ring)" badge on events with `source === 'fixture'`.

## API
| Method | Path | Body → Response |
|---|---|---|
| GET | `/api/status` | → `{ fixtures, ring:{connected,mode}, aws:{credentials,region,perceptionModel,agentModel,store}, poller:{lastSuccessAt,lastError,deviceId}, lightWebhook, timezone }` |
| GET | `/api/events?limit=200` | → `{ events: DoorEvent[] }` (newest first) |
| GET | `/api/events/stream` | **SSE**: `data: {kind:'event',event}` · `{kind:'delivery',delivery}` · `{kind:'lock',lock}` |
| GET | `/api/events/{id}/snapshot` | → image (only when `hasSnapshot`) |
| POST | `/api/describe` | `{ image: "data:image/jpeg;base64,…" }` (a frame from the live video) → `{ event }` |
| POST | `/api/poll` | → `{ queued }` ("Check Ring now") |
| POST | `/api/recall` | `{ question, history: {role,text}[] }` → `{ answer, eventIds, report?: {title, markdown}, mode }` |
| GET | `/api/deliveries` | → `{ deliveries, lock }` |
| POST | `/api/lock` | `{ action: 'lock'|'unlock'|'reset', code? }` → `{ lock }` or `{ error }` |
| POST | `/api/ring/token` | `{ token }` → `{ ok }` |
| POST/DELETE | `/api/ring/stream` | WHEP signalling (handled by the hook) |
| POST | `/api/dev/simulate` | `{ scene: 'package'|'vehicle'|'motion'|'pickup' }` (fixture mode only) |

Alert rule: alert once for an SSE `event` message with `status === 'described'`, no `repeatOf`, and `createdAt` after page load; alert for a `delivery` message whose status becomes `taken`.

## Keep from the current UI
`app/hooks/useWebRTCStream.ts` (live video + stall detection), the SSE/alert logic in `app/components/ProfileProvider.tsx` and `AlertLayer.tsx` (restyle freely), and the profile names/defaults.
