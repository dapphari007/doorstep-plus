'use client'


import { useCallback, useEffect, useRef, useState } from 'react'
import { useWebRTCStream } from '../hooks/useWebRTCStream'

const AUTO_EVERY_MS = 8000

export function LivePanel({ fixtures }: { fixtures: boolean }) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const { streamActive, streamError, streamEnded, startStream, stopStream } = useWebRTCStream({ videoRef })
  const [busy, setBusy] = useState(false)
  const [auto, setAuto] = useState(false)
  const [message, setMessage] = useState<string>()
  const [starting, setStarting] = useState(false)

  const describe = useCallback(
    async (hint?: string) => {
      setBusy(true)
      setMessage(undefined)
      try {
        let image: string | undefined
        const video = videoRef.current
        if (video && streamActive && video.videoWidth) {
          const canvas = document.createElement('canvas')
          canvas.width = video.videoWidth
          canvas.height = video.videoHeight
          canvas.getContext('2d')!.drawImage(video, 0, 0)
          image = canvas.toDataURL('image/jpeg', 0.85)
        }
        if (!image && !fixtures) {
          setMessage('Start the live view first.')
          return
        }
        const res = await fetch('/api/describe', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ image, hint }),
        })
        const body = await res.json()
        if (!res.ok) setMessage(body.error || 'Describe failed')
        else if (body.event?.status === 'error') setMessage(body.event.error)
      } catch (err) {
        setMessage(err instanceof Error ? err.message : 'Describe failed')
      } finally {
        setBusy(false)
      }
    },
    [fixtures, streamActive],
  )

  // Auto-describe while the stream is open (Ring caps sessions at 30-60 s).
  useEffect(() => {
    if (!auto || !streamActive) return
    const id = setInterval(() => {
      if (!busy) void describe()
    }, AUTO_EVERY_MS)
    return () => clearInterval(id)
  }, [auto, streamActive, busy, describe])

  // Ring caps sessions at 30-60 s, so reconnect while keep-watching is on.
  useEffect(() => {
    if (!streamEnded || !auto) return
    const id = setTimeout(() => {
      setStarting(true)
      void startStream().finally(() => setStarting(false))
    }, 1500)
    return () => clearTimeout(id)
  }, [streamEnded, auto, startStream])

  const toggleStream = async () => {
    if (streamActive) return stopStream()
    setStarting(true)
    await startStream()
    setStarting(false)
  }

  const simulate = async (scene: string) => {
    setBusy(true)
    await fetch('/api/dev/simulate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ scene }),
    })
    setBusy(false)
  }

  return (
    <section className="card" aria-labelledby="live-heading">
      <div className="flex items-center justify-between gap-3">
        <h2 id="live-heading" className="text-lg font-bold text-white">
          Live view
        </h2>
        {streamActive && <span className="pill bg-red-500/20 text-red-200">● Streaming from Ring</span>}
      </div>
      <div className="relative mt-3 aspect-video overflow-hidden rounded-xl bg-black">
        <video ref={videoRef} autoPlay playsInline muted className="h-full w-full object-contain" aria-label="Ring live video" />
        {!streamActive && (
          <div className="absolute inset-0 grid place-items-center p-6 text-center text-slate-400">
            {starting
              ? 'Connecting to the doorbell…'
              : streamEnded
                ? auto
                  ? 'Ring ended the session (30–60 s limit). Reconnecting…'
                  : 'Ring ended the session (30–60 s limit). Start it again to keep watching.'
                : 'Live view is off. Ring limits each session to 30–60 seconds.'}
          </div>
        )}
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        <button className="btn-ghost" onClick={toggleStream} disabled={starting || fixtures}>
          {streamActive ? 'Stop live view' : 'Start live view'}
        </button>
        <button className="btn-primary" onClick={() => describe()} disabled={busy || (!streamActive && !fixtures)}>
          {busy ? 'Describing…' : 'Describe what’s happening'}
        </button>
        <label className="flex items-center gap-2 px-2 text-sm text-slate-300">
          <input type="checkbox" checked={auto} onChange={(e) => setAuto(e.target.checked)} className="h-4 w-4" />
          Keep watching: describe every {AUTO_EVERY_MS / 1000}s and reconnect
        </label>
      </div>
      {(streamError || message) && (
        <p role="status" className="mt-2 text-sm text-amber-300">
          {streamError || message}
        </p>
      )}
      {fixtures && (
        <div className="mt-4 rounded-xl border border-fuchsia-500/40 bg-fuchsia-500/10 p-3">
          <p className="text-sm font-semibold text-fuchsia-200">Fixture mode: fake events, not Ring data</p>
          <div className="mt-2 flex flex-wrap gap-2">
            {['package', 'vehicle', 'motion', 'pickup'].map((s) => (
              <button key={s} className="btn-ghost text-sm" onClick={() => simulate(s)} disabled={busy}>
                Simulate {s}
              </button>
            ))}
          </div>
        </div>
      )}
    </section>
  )
}
