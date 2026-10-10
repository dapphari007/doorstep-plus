'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { PATTERNS, alertKindFor, spokenText, type AlertPattern } from '@/lib/alerts'
import { useApp } from '../providers/AppProvider'
import { clockTime } from '../utils/format'
import { iconFor } from '../utils/kinds'
import { chime, speak, vibrate } from '../utils/sound'
import { Icon, type IconName } from './ui/Icon'

interface Shown {
  key: string
  pattern: AlertPattern
  icon: IconName
  caption: string
  spoken: string
  at: number
}

function describeAlert(alert: NonNullable<ReturnType<typeof useApp>['alert']>): Shown | undefined {
  if (alert.event?.perception) {
    const pattern = PATTERNS[alertKindFor(alert.event.perception)]
    if (pattern.kind === 'quiet') return undefined
    return {
      key: alert.key,
      pattern,
      icon: iconFor(pattern.kind),
      caption: alert.event.perception.caption,
      spoken: spokenText(alert.event.perception, alert.event.start),
      at: alert.event.start,
    }
  }
  if (alert.delivery) {
    const caption = 'A package was picked up from your door'
    return {
      key: alert.key,
      pattern: PATTERNS.package_taken,
      icon: 'box',
      caption,
      spoken: `Package alert. ${caption}.`,
      at: alert.delivery.takenAt ?? Date.now(),
    }
  }
  return undefined
}

/** On/off rhythm played twice, with a pause between. */
function flashSequence(rhythm: number[]): { on: boolean; ms: number }[] {
  const once = rhythm.map((ms, i) => ({ on: i % 2 === 0, ms }))
  return [...once, { on: false, ms: 500 }, ...once, { on: false, ms: 0 }]
}

export function AlertOverlay() {
  const { alert, dismissAlert, prefs } = useApp()
  const [shown, setShown] = useState<Shown>()
  const [flashOn, setFlashOn] = useState(false)
  const [announcement, setAnnouncement] = useState('')
  const timers = useRef<ReturnType<typeof setTimeout>[]>([])
  const last = useRef<Shown>()

  const clearTimers = () => {
    timers.current.forEach(clearTimeout)
    timers.current = []
  }

  const flash = useCallback((rhythm: number[]) => {
    clearTimers()
    let t = 0
    for (const step of flashSequence(rhythm)) {
      timers.current.push(setTimeout(() => setFlashOn(step.on), t))
      t += step.ms
    }
  }, [])

  const announce = (text: string) => {
    // Clear first so screen readers re-read identical text.
    setAnnouncement('')
    timers.current.push(setTimeout(() => setAnnouncement(text), 60))
  }

  useEffect(() => {
    if (!alert) return
    const item = describeAlert(alert)
    if (!item) return
    last.current = item
    setShown(item)
    announce(item.spoken)
    if (prefs.flash) flash(item.pattern.rhythm)
    if (prefs.vibrate) vibrate([...item.pattern.rhythm, 500, ...item.pattern.rhythm])
    if (prefs.speak) speak(item.spoken)
    if (prefs.chime) chime()
    // prefs is left out on purpose: changing settings must not replay the last alert.
  }, [alert, flash])

  const close = useCallback(() => {
    clearTimers()
    setFlashOn(false)
    setShown(undefined)
    dismissAlert()
  }, [dismissAlert])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return
      const target = e.target as HTMLElement | null
      if (target?.closest('input, textarea, select, [contenteditable="true"]')) return
      if (e.key === 'r' || e.key === 'R') {
        const text = last.current?.spoken ?? 'No alerts yet.'
        speak(text)
        announce(text)
      } else if (e.key === 'Escape') {
        close()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [close])

  useEffect(() => clearTimers, [])

  return (
    <>
      <div aria-live="assertive" aria-atomic="true" className="sr-only">
        {announcement}
      </div>
      <div
        aria-hidden="true"
        className="pointer-events-none fixed inset-0 z-40 transition-opacity duration-75"
        style={{ background: shown?.pattern.color ?? 'transparent', opacity: flashOn ? 0.85 : 0 }}
      />
      {shown && (
        <div
          role="alertdialog"
          aria-labelledby="alert-caption"
          className="fixed inset-x-3 bottom-[calc(5rem+env(safe-area-inset-bottom))] z-50 mx-auto max-w-lg rounded-2xl border border-line bg-surface p-4 shadow-xl md:bottom-6"
        >
          <div className="flex items-start gap-3">
            <span
              aria-hidden="true"
              className="grid h-11 w-11 shrink-0 place-items-center rounded-full text-white"
              style={{ background: shown.pattern.color }}
            >
              <Icon name={shown.icon} className="h-5 w-5" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-muted">
                {shown.pattern.label} · {clockTime(shown.at)}
              </p>
              <p id="alert-caption" className="mt-0.5 text-lg font-semibold leading-snug">
                {shown.caption}
              </p>
              <div className="mt-3 flex gap-2">
                <button
                  type="button"
                  onClick={() => speak(shown.spoken)}
                  className="inline-flex h-9 items-center gap-1.5 rounded-full border border-line px-3 text-sm font-medium hover:bg-subtle"
                >
                  <Icon name="volume" className="h-4 w-4" /> Read aloud
                </button>
              </div>
            </div>
            <button
              type="button"
              onClick={close}
              aria-label="Dismiss alert"
              className="grid h-9 w-9 shrink-0 place-items-center rounded-full text-muted hover:bg-subtle"
            >
              <Icon name="close" />
            </button>
          </div>
        </div>
      )}
    </>
  )
}
