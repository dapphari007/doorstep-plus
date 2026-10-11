// Ask: a Strands agent on Bedrock that answers questions about past events.

import { Agent, BedrockModel, tool } from '@strands-agents/sdk'
import { z } from 'zod'
import { config, hasAwsCredentials } from '../config'
import { getStore } from '../store'
import type { DoorEvent } from '../types'
import { localTimeToEpoch } from '../expectations/match'
import { createExpectation, listExpectations } from '../expectations/service'
import { buildIncidentReport } from './report'

export interface AskTurn {
  role: 'user' | 'assistant'
  text: string
}

export interface AskAnswer {
  answer: string
  /** Events the agent looked at or cited, newest first, for thumbnails. */
  eventIds: string[]
  report?: { title: string; markdown: string }
  mode: 'agent' | 'fixture'
}

function localTime(ms: number) {
  return new Date(ms).toLocaleString('en-US', {
    timeZone: config.timezone,
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  })
}

function compact(e: DoorEvent) {
  return {
    id: e.id,
    time: localTime(e.start),
    epoch_ms: e.start,
    ring_type: e.ringType,
    category: e.perception?.category ?? 'undescribed',
    caption: e.summary ?? e.perception?.caption ?? e.error ?? 'Not described yet',
    camera: e.cameraName,
    view: e.perception?.view,
    package: e.perception?.package.action,
    delivery_id: e.deliveryId,
  }
}

function matchesText(e: DoorEvent, text: string) {
  const hay = [e.perception?.caption, e.perception?.details, e.perception?.carrierGuess, e.perception?.vehicle.kind]
    .filter(Boolean)
    .join(' ')
    .toLowerCase()
  return text
    .toLowerCase()
    .split(/\s+/)
    .filter((w) => w.length > 2)
    .some((w) => hay.includes(w))
}

function systemPrompt() {
  return `You are Doorstep+'s memory. You answer a resident's questions about what happened at their front door, using only the tool results (events described from their Ring doorbell).

The resident may be blind, deaf or have low vision, and answers may be read aloud:
- Lead with the direct answer in one sentence, then the key times. Keep it under 90 words unless asked for detail.
- Say times in the resident's local time zone (${config.timezone}), e.g. "2:14 PM today".
- Describe what happened, never who someone is. Do not speculate about identities.
- Always call search_events before concluding that nothing happened. The delivery log only lists drop-offs where a courier was seen; a package can also appear in events without a delivery record, so for package questions check both.
- "Is it still there?" means: was there a later event with package_filter = picked_up? If not, say it was last seen at the door at that time.
- For time ranges, prefer within_hours (e.g. 24 for "today", 2 for "this afternoon" if it is mid-afternoon) instead of computing timestamps yourself.
- Before answering that something did NOT happen, search again without category or keyword filters over the last 24 hours and read the results.
- If nothing matches, say so plainly and mention the time range you searched.
- If the resident says someone or a parcel is coming ("a plumber is coming at 3 PM", "my parcel arrives today"), call expect_arrival and confirm the window back to them.
- For "did my plumber / parcel come?", call list_expected first.
- When the resident asks for a report, incident summary, or something to send to a carrier, landlord or insurer, you MUST call build_incident_report so they get a downloadable file. Never write the report out in the chat instead; after the tool succeeds, reply in one or two sentences.

Current local time: ${localTime(Date.now())} (epoch ms ${Date.now()}).`
}

export async function askDoor(question: string, history: AskTurn[] = []): Promise<AskAnswer> {
  const store = getStore()
  const touched = new Set<string>()
  let report: AskAnswer['report']

  if (config.fixtures || !hasAwsCredentials()) {
    return fixtureAnswer(question, await store.listEvents({ limit: 200 }))
  }

  const searchEvents = tool({
    name: 'search_events',
    description:
      'Search described doorbell events. Filter by time range (epoch ms), category and/or keywords. Returns newest first.',
    inputSchema: z.object({
      within_hours: z
        .number()
        .min(0.1)
        .max(720)
        .optional()
        .describe('Only events from the last N hours. Prefer this over since_ms.'),
      since_ms: z.number().optional().describe('Only events at or after this epoch ms'),
      until_ms: z.number().optional().describe('Only events at or before this epoch ms'),
      categories: z.array(z.enum(['delivery', 'visitor', 'vehicle', 'animal', 'no_activity', 'other'])).optional(),
      keywords: z.string().optional().describe('Words to look for in captions, e.g. "box van"'),
      package_filter: z
        .enum(['package_seen', 'picked_up'])
        .optional()
        .describe(
          'package_seen: any event where a package was visible (dropped off or sitting at the door). picked_up: someone took a package away.',
        ),
      limit: z.number().min(1).max(50).optional(),
    }),
    callback: async (input) => {
      const since = input.within_hours ? Date.now() - input.within_hours * 3600_000 : input.since_ms
      let events = (await store.listEvents({ since, until: input.until_ms, limit: 500 })).filter(isAnswerable)
      if (input.categories?.length)
        events = events.filter((e) => e.perception && input.categories!.includes(e.perception.category))
      if (input.package_filter === 'package_seen') events = events.filter((e) => e.perception?.package.present)
      if (input.package_filter === 'picked_up')
        events = events.filter((e) => e.perception?.package.action === 'picked_up')
      if (input.keywords) events = events.filter((e) => matchesText(e, input.keywords!))
      const out = events.slice(0, input.limit ?? 20)
      out.forEach((e) => touched.add(e.id))
      return { count: events.length, events: out.map(compact) }
    },
  })

  const getEvent = tool({
    name: 'get_event',
    description: 'Get the full description of one event, including details and safety notes.',
    inputSchema: z.object({ id: z.string() }),
    callback: async ({ id }) => {
      const e = await store.getEvent(id)
      if (!e) return { error: `No event ${id}` }
      touched.add(e.id)
      return {
        ...compact(e),
        details: e.perception?.details,
        actors: e.perception?.actors,
        vehicle: e.perception?.vehicle,
      }
    },
  })

  const listDeliveries = tool({
    name: 'list_deliveries',
    description:
      'The proof-of-delivery log: verified drop-offs, ones needing review, and packages later picked up ("taken").',
    inputSchema: z.object({ limit: z.number().min(1).max(50).optional() }),
    callback: async ({ limit }) => {
      const deliveries = await store.listDeliveries(limit ?? 20)
      deliveries.forEach((d) => {
        touched.add(d.eventId)
        if (d.takenEventId) touched.add(d.takenEventId)
      })
      return deliveries.map((d) => ({
        id: d.id,
        time: localTime(d.at),
        status: d.status,
        carrier_guess: d.carrierGuess,
        summary: d.summary,
        taken_at: d.takenAt ? localTime(d.takenAt) : undefined,
        drop_off_event_id: d.eventId,
        pickup_event_id: d.takenEventId,
      }))
    },
  })

  const expectTool = tool({
    name: 'expect_arrival',
    description:
      'Record that the resident is expecting a visitor (e.g. "plumber") or a parcel, so a matching arrival is announced as "possibly your plumber". Use local clock times; the code converts them.',
    inputSchema: z.object({
      kind: z.enum(['visitor', 'parcel']),
      label: z.string().min(1).max(40).describe('Short name, e.g. "Plumber", "Amazon parcel"'),
      day: z.enum(['today', 'tomorrow']).optional(),
      start_time: z.string().optional().describe('Local 24h time like "15:00". Omit for "any time that day".'),
      end_time: z.string().optional().describe('Local 24h time like "16:00". Defaults to one hour after start_time.'),
    }),
    callback: async ({ kind, label, day, start_time, end_time }) => {
      try {
        const offset = day === 'tomorrow' ? 1 : 0
        const tz = config.timezone
        const from = start_time
          ? localTimeToEpoch(start_time, offset, tz)
          : Math.max(Date.now(), localTimeToEpoch('00:00', offset, tz))
        const until = end_time
          ? localTimeToEpoch(end_time, offset, tz)
          : start_time
            ? from + 3600_000
            : localTimeToEpoch('23:59', offset, tz)
        const x = await createExpectation({ kind, label, from, until })
        return { saved: true, label: x.label, from: localTime(x.from), until: localTime(x.until) }
      } catch (err) {
        return { saved: false, error: err instanceof Error ? err.message : String(err) }
      }
    },
  })

  const listExpectedTool = tool({
    name: 'list_expected',
    description: 'Visitors and parcels the resident said they are expecting, with whether each has arrived.',
    inputSchema: z.object({}),
    callback: async () =>
      (await listExpectations(20)).map((x) => ({
        label: x.label,
        kind: x.kind,
        window: `${localTime(x.from)} to ${localTime(x.until)}`,
        status: x.effectiveStatus,
        arrived_at: x.matchedAt ? localTime(x.matchedAt) : undefined,
        event_id: x.matchedEventId,
      })),
  })

  const reportTool = tool({
    name: 'build_incident_report',
    description:
      'Create a timestamped incident report (e.g. for a missing package claim) from specific event ids. The resident can download it.',
    inputSchema: z.object({
      title: z.string().max(100),
      event_ids: z.array(z.string()).min(1).max(20),
      summary: z.string().max(600).describe('Plain-language summary of what happened'),
    }),
    callback: async ({ title, event_ids, summary }) => {
      const events = (await Promise.all(event_ids.map((id) => store.getEvent(id)))).filter(Boolean) as DoorEvent[]
      events.forEach((e) => touched.add(e.id))
      report = { title, markdown: buildIncidentReport(title, summary, events, config.timezone) }
      return { created: true, events_included: events.length }
    },
  })

  const agent = new Agent({
    model: new BedrockModel({ region: config.aws.region, modelId: config.aws.agentModel, maxTokens: 4000 }),
    systemPrompt: systemPrompt(),
    // The read-only demo can't add expected visitors.
    tools: [searchEvents, getEvent, listDeliveries, reportTool, listExpectedTool, ...(config.demo ? [] : [expectTool])],
    printer: false,
  })

  const transcript = history
    .slice(-6)
    .map((t) => `${t.role === 'user' ? 'Resident' : 'You'}: ${t.text}`)
    .join('\n')
  const prompt = transcript ? `Earlier in this conversation:\n${transcript}\n\nResident: ${question}` : question

  const result = await agent.invoke(prompt)
  const ordered = (await Promise.all(Array.from(touched).map((id) => store.getEvent(id))))
    .filter(Boolean)
    .sort((a, b) => b!.start - a!.start)
    .map((e) => e!.id)

  return { answer: result.toString().trim(), eventIds: ordered.slice(0, 12), report, mode: 'agent' }
}

/** Keyword answer used in FIXTURE_MODE or when AWS credentials are missing. */
/** Repeats, failed frames and empty live frames only add noise to answers. */
function isAnswerable(e: DoorEvent): boolean {
  if (e.repeatOf || e.status !== 'described') return false
  return !(e.source === 'live_frame' && e.perception?.category === 'no_activity')
}

function fixtureAnswer(question: string, events: DoorEvent[]): AskAnswer {
  const q = question.toLowerCase()
  let hits = events.filter((e) => e.status === 'described')
  if (/package|deliver|parcel|box/.test(q)) hits = hits.filter((e) => e.perception?.package.present)
  else if (/car|vehicle|van|truck/.test(q)) hits = hits.filter((e) => e.perception?.vehicle.present)
  const answer = hits.length
    ? `(Fixture mode, no AI) Found ${hits.length} matching event${hits.length > 1 ? 's' : ''}. Most recent: "${hits[0].perception?.caption}" at ${localTime(hits[0].start)}.`
    : '(Fixture mode, no AI) No matching events yet.'
  return { answer, eventIds: hits.slice(0, 12).map((e) => e.id), mode: 'fixture' }
}
