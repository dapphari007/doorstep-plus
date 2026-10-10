'use client'

import Link from 'next/link'
import { useCallback, useEffect, useRef, useState } from 'react'
import type { DoorEvent } from '@/lib/types'
import { useLiveStream } from '../hooks/useLiveStream'
import { errorMessage, postJson } from '../utils/format'
import { Badge } from './ui/Badge'
import { Button } from './ui/Button'
import { Card } from './ui/Card'
import { InlineMessage } from './ui/EmptyState'
import { Icon } from './ui/Icon'
import { Spinner } from './ui/Spinner'
import { Switch } from './ui/Switch'

const DESCRIBE_EVERY_MS = 8000
const RECONNECT_DELAY_MS = 1500
const MAX_RETRIES = 3
const FIXTURE_SCENES = ['package', 'vehicle', 'motion', 'pickup'] as const

function grabFrame(video: HTMLVideoElement | null): string | undefined {
  if (!video || !video.videoWidth || !video.videoHeight) return undefined
  const canvas = document.createElement('canvas')
  canvas.width = video.videoWidth
  canvas.height = video.videoHeight
  canvas.getContext('2d')?.drawImage(video, 0, 0)
  return canvas.toDataURL('image/jpeg', 0.85)
}

export function LiveViewCard({ ringConnected, fixtures }: { ringConnected: boolean; fixtures: boolean }) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const { status, error, start, stop } = useLiveStream(videoRef)
  const [keepWatching, setKeepWatching] = useState(false)
  const [describing, setDescribing] = useState(false)
  const [message, setMessage] = useState<{ tone: 'success' | 'warning'; text: string }>()
  const busy = useRef(false)
  const retries = useRef(0)

  const canStream = ringConnected && !fixtures
  const live = status === 'live'

  const describe = useCallback(async (quiet = false) => {
    if (busy.current) return
    const image = grabFrame(videoRef.current)
    if (!image) {
      if (!quiet) setMessage({ tone: 'warning', text: 'Start the live view first, then describe what you see.' })
      return
    }
    busy.current = true
    setDescribing(true)
    if (!quiet) setMessage(undefined)
    try {
      const { event } = await postJson<{ event: DoorEvent }>('/api/describe', { image })
      if (event.status === 'error') throw new Error(event.error || 'Could not describe this frame')
      if (!quiet) setMessage({ tone: 'success', text: event.perception?.caption ?? 'Described' })
    } catch (err) {
      setMessage({ tone: 'warning', text: errorMessage(err, 'Could not describe this frame') })
    } finally {
      busy.current = false
      setDescribing(false)
    }
  }, [])

  const simulate = async (scene: (typeof FIXTURE_SCENES)[number]) => {
    if (busy.current) return
    busy.current = true
    setDescribing(true)
    setMessage(undefined)
    try {
      await postJson('/api/dev/simulate', { scene })
    } catch (err) {
      setMessage({ tone: 'warning', text: errorMessage(err) })
    } finally {
      busy.current = false
      setDescribing(false)
    }
  }

  // Keep watching: describe on a timer while live.
  useEffect(() => {
    if (!keepWatching || !live) return
    retries.current = 0
    const first = setTimeout(() => void describe(true), 1500)
    const id = setInterval(() => void describe(true), DESCRIBE_EVERY_MS)
    return () => {
      clearTimeout(first)
      clearInterval(id)
    }
  }, [keepWatching, live, describe])

  // Keep watching: reconnect when Ring ends the session, give up after repeated errors.
  useEffect(() => {
    if (!keepWatching) return
    if (status === 'idle' || status === 'ended') {
      const id = setTimeout(() => void start(), status === 'ended' ? RECONNECT_DELAY_MS : 0)
      return () => clearTimeout(id)
    }
    if (status === 'error') {
      if (retries.current >= MAX_RETRIES) {
        setKeepWatching(false)
        setMessage({ tone: 'warning', text: 'Stopped watching after repeated connection errors.' })
        return
      }
      retries.current++
      const id = setTimeout(() => void start(), RECONNECT_DELAY_MS * retries.current)
      return () => clearTimeout(id)
    }
  }, [keepWatching, status, start])

  const toggleKeepWatching = (on: boolean) => {
    setKeepWatching(on)
    setMessage(undefined)
    retries.current = 0
    if (!on) stop()
  }

  const overlay = {
    idle: 'Live view is off',
    connecting: 'Connecting to your doorbell…',
    live: '',
    ended: keepWatching ? 'Session ended. Reconnecting…' : 'Live view ended. Sessions last 30–60 seconds.',
    error: error ?? 'Live view stopped',
  }[status]

  return (
    <Card className="overflow-hidden" aria-labelledby="live-heading">
      <div className="relative aspect-video bg-black">
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted
          className="h-full w-full object-contain"
          aria-label="Live video from your doorbell"
        />
        {!live && (
          <div className="absolute inset-0 grid place-items-center p-6 text-center text-white/80">
            <div className="flex flex-col items-center gap-3">
              {status === 'connecting' ? <Spinner className="h-6 w-6" /> : <Icon name="video" className="h-8 w-8" />}
              <p className="max-w-xs text-sm">{overlay}</p>
            </div>
          </div>
        )}
        {live && (
          <span className="absolute left-3 top-3 inline-flex items-center gap-1.5 rounded-full bg-black/60 px-2.5 py-1 text-xs font-semibold text-white">
            <span aria-hidden="true" className="h-2 w-2 animate-pulse rounded-full bg-red-500" /> Live
          </span>
        )}
      </div>

      <div className="space-y-3 p-5 sm:p-6">
        <div className="flex items-center justify-between gap-3">
          <h2 id="live-heading" className="text-lg font-semibold">
            Live view
          </h2>
          {fixtures && <Badge tone="warning">Test mode</Badge>}
        </div>

        {!ringConnected && !fixtures ? (
          <p className="text-sm text-muted">
            <Link href="/settings" className="font-semibold text-primary underline-offset-2 hover:underline">
              Connect your Ring account
            </Link>{' '}
            to see your door live.
          </p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {live || status === 'connecting' ? (
              <Button variant="secondary" icon="stop" onClick={() => toggleKeepWatching(false)}>
                Stop
              </Button>
            ) : (
              <Button variant="secondary" icon="play" onClick={() => void start()} disabled={!canStream}>
                {status === 'ended' || status === 'error' ? 'Reconnect' : 'Start live view'}
              </Button>
            )}
            <Button
              icon="sparkle"
              onClick={() => void describe()}
              loading={describing && !keepWatching}
              disabled={!live || describing}
            >
              Describe now
            </Button>
          </div>
        )}

        {canStream && (
          <Switch
            checked={keepWatching}
            onChange={toggleKeepWatching}
            label="Keep watching"
            description="Describes the door every few seconds and reconnects automatically. Alerts only when something changes."
          />
        )}

        {message && <InlineMessage tone={message.tone}>{message.text}</InlineMessage>}

        {fixtures && (
          <div className="rounded-xl bg-subtle p-3">
            <p className="text-sm font-medium">Test mode: create a fake event (not from Ring)</p>
            <div className="mt-2 flex flex-wrap gap-2">
              {FIXTURE_SCENES.map((scene) => (
                <Button
                  key={scene}
                  size="sm"
                  variant="secondary"
                  onClick={() => void simulate(scene)}
                  disabled={describing}
                >
                  {scene[0].toUpperCase() + scene.slice(1)}
                </Button>
              ))}
            </div>
          </div>
        )}
      </div>
    </Card>
  )
}
