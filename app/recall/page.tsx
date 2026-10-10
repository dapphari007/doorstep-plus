'use client'

import { useEffect, useRef, useState, type KeyboardEvent } from 'react'
import type { RecallAnswer, RecallTurn } from '@/lib/agent/recall'
import { EventRow } from '../components/EventRow'
import { Button } from '../components/ui/Button'
import { Card, Container, PageHeader } from '../components/ui/Card'
import { InlineMessage } from '../components/ui/EmptyState'
import { Icon } from '../components/ui/Icon'
import { Spinner } from '../components/ui/Spinner'
import { useNow } from '../hooks/useNow'
import { useApp } from '../providers/AppProvider'
import { errorMessage, postJson } from '../utils/format'
import { speak } from '../utils/sound'

const MAX_QUESTION = 500
const SUGGESTIONS = [
  'What happened at my door today?',
  'Did a package arrive, and is it still there?',
  'Was there a car in the driveway this afternoon?',
  'Make an incident report for my missing package',
]

interface Turn extends RecallTurn {
  id: number
  result?: RecallAnswer
}

function downloadMarkdown(title: string, markdown: string) {
  const name = `${
    title
      .replace(/[^\w-]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .toLowerCase() || 'report'
  }.md`
  const url = URL.createObjectURL(new Blob([markdown], { type: 'text/markdown' }))
  const a = document.createElement('a')
  a.href = url
  a.download = name
  a.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

export default function RecallPage() {
  const { events, prefs } = useApp()
  const now = useNow(60_000)
  const [turns, setTurns] = useState<Turn[]>([])
  const [input, setInput] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<{ text: string; question: string }>()
  const endRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const mounted = useRef(true)
  const nextId = useRef(0)

  useEffect(() => {
    mounted.current = true
    return () => {
      mounted.current = false
    }
  }, [])

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' })
  }, [turns.length, busy])

  const ask = async (raw: string) => {
    const question = raw.trim().slice(0, MAX_QUESTION)
    if (!question || busy) return
    setError(undefined)
    setBusy(true)
    setInput('')
    const history = turns.map(({ role, text }) => ({ role, text }))
    setTurns((t) => [...t, { id: nextId.current++, role: 'user', text: question }])
    try {
      const result = await postJson<RecallAnswer>('/api/recall', { question, history })
      if (!mounted.current) return
      setTurns((t) => [...t, { id: nextId.current++, role: 'assistant', text: result.answer || 'No answer.', result }])
      if (prefs.speak && result.answer) speak(result.answer)
    } catch (err) {
      if (!mounted.current) return
      setTurns((t) => t.slice(0, -1))
      setError({ text: errorMessage(err, 'Could not get an answer'), question })
    } finally {
      if (mounted.current) {
        setBusy(false)
        inputRef.current?.focus()
      }
    }
  }

  const onKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
      e.preventDefault()
      void ask(input)
    }
  }

  const byId = new Map(events.map((e) => [e.id, e]))

  return (
    <Container>
      <div className="max-w-3xl">
        <PageHeader
          title="Ask your door"
          subtitle="Questions about anything your doorbell has seen since you connected it."
        />

        <div className="space-y-4" aria-live="polite">
          {turns.length === 0 && !busy && (
            <Card className="p-5">
              <p className="text-sm font-medium text-muted">Try asking</p>
              <div className="mt-3 flex flex-wrap gap-2">
                {SUGGESTIONS.map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => void ask(s)}
                    className="rounded-full border border-line px-3.5 py-2 text-left text-sm hover:bg-subtle"
                  >
                    {s}
                  </button>
                ))}
              </div>
            </Card>
          )}

          {turns.map((t) =>
            t.role === 'user' ? (
              <p
                key={t.id}
                className="ml-auto w-fit max-w-[85%] whitespace-pre-wrap break-words rounded-2xl rounded-br-md bg-primary px-4 py-2.5 text-primary-on"
              >
                {t.text}
              </p>
            ) : (
              <Card key={t.id} className="space-y-3 p-5">
                <p className="whitespace-pre-wrap break-words leading-relaxed">{t.text}</p>
                <div className="flex flex-wrap gap-2">
                  <Button size="sm" variant="secondary" icon="volume" onClick={() => speak(t.text)}>
                    Read aloud
                  </Button>
                  {t.result?.report && (
                    <Button
                      size="sm"
                      icon="download"
                      onClick={() => downloadMarkdown(t.result!.report!.title, t.result!.report!.markdown)}
                    >
                      Download report
                    </Button>
                  )}
                </div>
                {!!t.result?.eventIds.length && (
                  <ul className="divide-y divide-line border-t border-line">
                    {t.result.eventIds.map((id) => {
                      const event = byId.get(id)
                      return event ? (
                        <li key={id}>
                          <EventRow event={event} now={now} />
                        </li>
                      ) : null
                    })}
                  </ul>
                )}
              </Card>
            ),
          )}

          {busy && (
            <p className="flex items-center gap-2 text-muted">
              <Spinner /> Looking through your door's history…
            </p>
          )}
          {error && (
            <div className="flex flex-wrap items-center gap-3">
              <InlineMessage tone="danger">{error.text}</InlineMessage>
              <Button size="sm" variant="secondary" icon="refresh" onClick={() => void ask(error.question)}>
                Try again
              </Button>
            </div>
          )}
          <div ref={endRef} />
        </div>

        <form
          className="sticky bottom-[calc(5rem+env(safe-area-inset-bottom))] mt-6 flex items-end gap-2 rounded-3xl border border-line bg-surface p-2 shadow-lg md:bottom-6"
          onSubmit={(e) => {
            e.preventDefault()
            void ask(input)
          }}
        >
          <label htmlFor="question" className="sr-only">
            Your question
          </label>
          <textarea
            id="question"
            ref={inputRef}
            rows={1}
            value={input}
            maxLength={MAX_QUESTION}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={onKeyDown}
            placeholder="Ask about your door…"
            className="max-h-32 min-h-[44px] min-w-0 flex-1 resize-none bg-transparent px-3 py-2.5 placeholder:text-muted focus:outline-none"
          />
          <Button
            type="submit"
            aria-label="Send question"
            disabled={!input.trim() || busy}
            className="!h-11 !w-11 !px-0"
          >
            <Icon name="send" />
          </Button>
        </form>
      </div>
    </Container>
  )
}
