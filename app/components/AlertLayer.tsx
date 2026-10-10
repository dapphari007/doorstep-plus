'use client'

// Flash, vibrate, speak or chime for each new event, depending on the profile.

import { useCallback, useEffect, useRef, useState } from 'react'
import { PATTERNS, alertKindFor, spokenText, type AlertPattern } from '@/lib/alerts'
import { useApp } from './ProfileProvider'

interface Shown {
  key: string
  pattern: AlertPattern
  caption: string
  spoken: string
  at: number
}

function playChime() {
  try {
    const ctx = new AudioContext()
    ;[880, 660].forEach((freq, i) => {
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()
      osc.frequency.value = freq
      gain.gain.setValueAtTime(0.0001, ctx.currentTime + i * 0.25)
      gain.gain.exponentialRampToValueAtTime(0.3, ctx.currentTime + i * 0.25 + 0.02)
      gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + i * 0.25 + 0.4)
      osc.connect(gain).connect(ctx.destination)
      osc.start(ctx.currentTime + i * 0.25)
      osc.stop(ctx.currentTime + i * 0.25 + 0.45)
    })
  } catch {
    // audio blocked until the user interacts with the page
  }
}

export function speak(text: string) {
  if (typeof window === 'undefined' || !('speechSynthesis' in window)) return
  window.speechSynthesis.cancel()
  const u = new SpeechSynthesisUtterance(text)
  u.rate = 1
  window.speechSynthesis.speak(u)
}

export function AlertLayer() {
  const { alert, prefs } = useApp()
  const [shown, setShown] = useState<Shown>()
  const [flashOn, setFlashOn] = useState(false)
  const [live, setLive] = useState('')
  const timers = useRef<ReturnType<typeof setTimeout>[]>([])
  const last = useRef<Shown>()

  const runFlash = useCallback((rhythm: number[]) => {
    timers.current.forEach(clearTimeout)
    timers.current = []
    let t = 0
    // Repeat the rhythm twice so it is noticeable from across a room.
    const seq = [...rhythm, 500, ...rhythm]
    seq.forEach((ms, i) => {
      const on = i % 2 === 0
      timers.current.push(setTimeout(() => setFlashOn(on && i !== rhythm.length), t))
      t += ms
    })
    timers.current.push(setTimeout(() => setFlashOn(false), t))
  }, [])

  useEffect(() => {
    if (!alert) return
    let pattern: AlertPattern
    let caption: string
    let spoken: string
    let at: number
    if (alert.event?.perception) {
      const p = alert.event.perception
      pattern = PATTERNS[alertKindFor(p)]
      caption = p.caption
      at = alert.event.start
      spoken = spokenText(p, at)
    } else if (alert.delivery) {
      pattern = PATTERNS.package_taken
      caption = 'A delivered package was picked up from the door'
      at = alert.delivery.takenAt ?? Date.now()
      spoken = `Package alert. ${caption}.`
    } else {
      return
    }
    if (pattern.kind === 'quiet') return

    const item = { key: alert.key, pattern, caption, spoken, at }
    last.current = item
    setShown(item)
    setLive(spoken)
    if (prefs.flash) runFlash(pattern.rhythm)
    if (prefs.vibrate && 'vibrate' in navigator) navigator.vibrate([...pattern.rhythm, 500, ...pattern.rhythm])
    if (prefs.speak) speak(spoken)
    if (prefs.chime) playChime()
  }, [alert, prefs, runFlash])

  // Keyboard: R repeats the last alert, Escape dismisses the card.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement
      if (target.closest('input, textarea, select, [contenteditable]')) return
      if (e.key === 'r' || e.key === 'R') {
        if (last.current) {
          speak(last.current.spoken)
          setLive('')
          setTimeout(() => setLive(last.current!.spoken), 50)
        } else speak('No alerts yet.')
      }
      if (e.key === 'Escape') setShown(undefined)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  useEffect(() => () => timers.current.forEach(clearTimeout), [])

  return (
    <>
      <div aria-live="assertive" aria-atomic="true" className="sr-only">
        {live}
      </div>
      <div
        aria-hidden="true"
        className="flash-layer pointer-events-none fixed inset-0 z-40 transition-opacity duration-75"
        style={{ background: shown?.pattern.color ?? 'transparent', opacity: flashOn ? 0.85 : 0 }}
      />
      {shown && (
        <div
          role="dialog"
          aria-label="Doorbell alert"
          className="fixed inset-x-3 bottom-3 z-50 mx-auto max-w-3xl rounded-3xl border-4 bg-ink-950 p-5 shadow-2xl sm:p-7"
          style={{ borderColor: shown.pattern.color }}
        >
          <div className="flex items-start gap-4">
            <span className="text-5xl leading-none" aria-hidden="true">
              {shown.pattern.icon}
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-bold uppercase tracking-wide" style={{ color: shown.pattern.color }}>
                {shown.pattern.label} ·{' '}
                {new Date(shown.at).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}
              </p>
              <p className="mt-1 text-2xl font-bold leading-snug text-white sm:text-4xl">{shown.caption}</p>
            </div>
            <button className="btn-ghost shrink-0" onClick={() => setShown(undefined)} aria-label="Dismiss alert">
              ✕
            </button>
          </div>
          <p className="mt-3 text-sm text-slate-400">Press R to hear it again · Esc to dismiss</p>
        </div>
      )}
    </>
  )
}
