'use client'

import { useEffect, useRef, useState } from 'react'
import type { RecallAnswer, RecallTurn } from '@/lib/agent/recall'
import { EventCard } from '../components/EventCard'
import { speak } from '../components/AlertLayer'
import { useApp } from '../components/ProfileProvider'

const SUGGESTIONS = [
  'What happened at my door today?',
  'Did a package arrive, and is it still there?',
  'Was there any car in the driveway this afternoon?',
  'Make an incident report for my missing package',
]

interface Turn extends RecallTurn {
  result?: RecallAnswer
}

function download(name: string, text: string) {
  const url = URL.createObjectURL(new Blob([text], { type: 'text/markdown' }))
  const a = document.createElement('a')
  a.href = url
  a.download = name
  a.click()
  URL.revokeObjectURL(url)
}

export default function RecallPage() {
  const { events, prefs } = useApp()
  const [turns, setTurns] = useState<Turn[]>([])
  const [input, setInput] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string>()
  const endRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [turns, busy])

  const ask = async (question: string) => {
    if (!question.trim() || busy) return
    setError(undefined)
    setBusy(true)
    setInput('')
    const history = turns.map(({ role, text }) => ({ role, text }))
    setTurns((t) => [...t, { role: 'user', text: question }])
    try {
      const res = await fetch('/api/recall', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question, history }),
      })
      const body = await res.json()
      if (!res.ok) throw new Error(body.error || 'Recall failed')
      const result = body as RecallAnswer
      setTurns((t) => [...t, { role: 'assistant', text: result.answer, result }])
      if (prefs.speak) speak(result.answer)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Recall failed')
    } finally {
      setBusy(false)
    }
  }

  const byId = new Map(events.map((e) => [e.id, e]))

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-white">Recall</h1>
        <p className="mt-1 text-slate-300">
          Ask about anything your doorbell has seen since you connected it. Answers come from the event descriptions, with
          exact times.
        </p>
      </div>

      <div className="space-y-4" aria-live="polite">
        {turns.length === 0 && (
          <div className="flex flex-wrap gap-2">
            {SUGGESTIONS.map((s) => (
              <button key={s} className="btn-ghost text-left text-sm" onClick={() => ask(s)}>
                {s}
              </button>
            ))}
          </div>
        )}
        {turns.map((t, i) =>
          t.role === 'user' ? (
            <p key={i} className="ml-auto w-fit max-w-[85%] rounded-2xl bg-ring-blue px-4 py-2.5 text-white">
              {t.text}
            </p>
          ) : (
            <div key={i} className="card space-y-3">
              <p className="whitespace-pre-wrap text-lg text-white">{t.text}</p>
              {t.result?.report && (
                <button
                  className="btn-primary"
                  onClick={() =>
                    download(`${t.result!.report!.title.replace(/[^\w-]+/g, '-').toLowerCase()}.md`, t.result!.report!.markdown)
                  }
                >
                  ⬇ Download report: {t.result.report.title}
                </button>
              )}
              {!!t.result?.eventIds.length && (
                <details open={t.result.eventIds.length <= 4}>
                  <summary className="cursor-pointer text-sm font-semibold text-slate-300">
                    {t.result.eventIds.length} event{t.result.eventIds.length > 1 ? 's' : ''} referenced
                  </summary>
                  <ol className="mt-2 space-y-2">
                    {t.result.eventIds.map((id) => {
                      const e = byId.get(id)
                      return e ? (
                        <li key={id}>
                          <EventCard event={e} compact />
                        </li>
                      ) : null
                    })}
                  </ol>
                </details>
              )}
            </div>
          ),
        )}
        {busy && <p className="text-slate-400">Looking through your door’s history…</p>}
        {error && (
          <p role="alert" className="text-amber-300">
            {error}
          </p>
        )}
        <div ref={endRef} />
      </div>

      <form
        className="sticky bottom-4 flex gap-2 rounded-2xl border border-ink-600 bg-ink-900 p-2 shadow-xl"
        onSubmit={(e) => {
          e.preventDefault()
          void ask(input)
        }}
      >
        <label htmlFor="q" className="sr-only">
          Your question
        </label>
        <input
          id="q"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="e.g. Did anyone come to the door while I was out?"
          className="min-w-0 flex-1 rounded-xl bg-transparent px-3 py-2 text-white placeholder:text-slate-500 focus:outline-none"
          autoComplete="off"
        />
        <button className="btn-primary" disabled={busy || !input.trim()}>
          Ask
        </button>
      </form>
    </div>
  )
}
