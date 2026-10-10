'use client'

import { useCallback, useEffect, useRef, useState, type RefObject } from 'react'
import { errorMessage, postJson } from '../utils/format'

export type StreamStatus = 'idle' | 'connecting' | 'live' | 'ended' | 'error'

// Ring ends sessions after 30-60 s without closing the track, so watch the video clock.
const STALL_MS = 3500
const CONNECT_TIMEOUT_MS = 20_000
const ICE_WAIT_MS = 3000

export function useLiveStream(videoRef: RefObject<HTMLVideoElement>) {
  const [status, setStatus] = useState<StreamStatus>('idle')
  const [error, setError] = useState<string>()
  const pcRef = useRef<RTCPeerConnection | null>(null)
  const sessionUrlRef = useRef<string | null>(null)
  const statusRef = useRef<StreamStatus>('idle')
  const attemptRef = useRef(0)

  const update = useCallback((next: StreamStatus) => {
    statusRef.current = next
    setStatus(next)
  }, [])

  const teardown = useCallback(
    (keepalive = false) => {
      pcRef.current?.close()
      pcRef.current = null
      const sessionUrl = sessionUrlRef.current
      sessionUrlRef.current = null
      if (videoRef.current) videoRef.current.srcObject = null
      if (sessionUrl) {
        fetch('/api/ring/stream', {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ sessionUrl }),
          keepalive,
        }).catch(() => {})
      }
    },
    [videoRef],
  )

  const stop = useCallback(() => {
    attemptRef.current++
    teardown()
    setError(undefined)
    update('idle')
  }, [teardown, update])

  const start = useCallback(async () => {
    if (statusRef.current === 'connecting' || statusRef.current === 'live') return
    const attempt = ++attemptRef.current
    const stale = () => attempt !== attemptRef.current
    setError(undefined)
    update('connecting')

    const timeout = setTimeout(() => {
      if (stale() || statusRef.current !== 'connecting') return
      attemptRef.current++
      teardown()
      setError('The doorbell did not answer. Try again in a moment.')
      update('error')
    }, CONNECT_TIMEOUT_MS)

    try {
      const pc = new RTCPeerConnection({ iceServers: [{ urls: 'stun:stun.l.google.com:19302' }] })
      pcRef.current = pc
      pc.addTransceiver('audio', { direction: 'sendrecv' })
      pc.addTransceiver('video', { direction: 'recvonly' })
      pc.ontrack = (e) => {
        if (stale() || !videoRef.current || !e.streams[0]) return
        videoRef.current.srcObject = e.streams[0]
        update('live')
      }
      pc.onconnectionstatechange = () => {
        if (stale()) return
        if (pc.connectionState === 'failed') {
          teardown()
          setError('The live view connection failed.')
          update('error')
        }
      }

      await pc.setLocalDescription(await pc.createOffer())
      // Ring answers 500 if the offer is sent before ICE gathering finishes.
      await new Promise<void>((resolve) => {
        if (pc.iceGatheringState === 'complete') return resolve()
        const done = setTimeout(resolve, ICE_WAIT_MS)
        pc.onicegatheringstatechange = () => {
          if (pc.iceGatheringState === 'complete') {
            clearTimeout(done)
            resolve()
          }
        }
      })
      if (stale()) return

      const { sdpAnswer, sessionUrl } = await postJson<{ sdpAnswer: string; sessionUrl: string | null }>(
        '/api/ring/stream',
        { sdpOffer: pc.localDescription?.sdp },
      )
      sessionUrlRef.current = sessionUrl
      if (stale()) return teardown()
      await pc.setRemoteDescription({ type: 'answer', sdp: sdpAnswer })
    } catch (err) {
      if (stale()) return
      teardown()
      setError(errorMessage(err, 'Could not start the live view.'))
      update('error')
    } finally {
      clearTimeout(timeout)
    }
  }, [teardown, update, videoRef])

  useEffect(() => {
    if (status !== 'live') return
    let lastTime = -1
    let lastChange = Date.now()
    const id = setInterval(() => {
      const video = videoRef.current
      if (!video) return
      if (video.currentTime !== lastTime) {
        lastTime = video.currentTime
        lastChange = Date.now()
      } else if (Date.now() - lastChange > STALL_MS) {
        attemptRef.current++
        teardown()
        update('ended')
      }
    }, 1000)
    return () => clearInterval(id)
  }, [status, teardown, update, videoRef])

  // Close the Ring session if the page is left mid-stream.
  useEffect(() => {
    const onHide = () => teardown(true)
    window.addEventListener('pagehide', onHide)
    return () => {
      window.removeEventListener('pagehide', onHide)
      attemptRef.current++
      teardown(true)
    }
  }, [teardown])

  return { status, error, start, stop }
}
