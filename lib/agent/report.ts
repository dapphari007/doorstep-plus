import type { DoorEvent } from '../types'

// Incident report with local, UTC and Ring event ids so timestamps are never ambiguous.
export function buildIncidentReport(title: string, summary: string, events: DoorEvent[], timeZone: string): string {
  const sorted = [...events].sort((a, b) => a.start - b.start)
  const fmt = (ms: number) => new Date(ms).toLocaleString('en-US', { timeZone, dateStyle: 'full', timeStyle: 'long' })
  const lines = [
    `# ${title}`,
    '',
    `Generated ${fmt(Date.now())} by Doorstep Copilot from Ring doorbell events.`,
    '',
    '## Summary',
    '',
    summary,
    '',
    '## Timeline',
    '',
    '| Local time | UTC | What happened | Ring event id |',
    '|---|---|---|---|',
    ...sorted.map(
      (e) =>
        `| ${fmt(e.start)} | ${new Date(e.start).toISOString()} | ${(e.perception?.caption ?? 'Not described').replace(/\|/g, '/')} | \`${e.id}\` |`,
    ),
    '',
    '## Details',
    '',
    ...sorted.flatMap((e) => [
      `### ${fmt(e.start)}`,
      '',
      e.perception?.details ?? e.error ?? 'No description available.',
      '',
      `Snapshot: /api/events/${encodeURIComponent(e.id)}/snapshot`,
      '',
    ]),
    '---',
    'Descriptions are AI-generated from Ring snapshots and say what happened, not who was involved. Ring media carries a Ring watermark. Original footage can be requested from Ring by event time.',
  ]
  return lines.join('\n')
}
