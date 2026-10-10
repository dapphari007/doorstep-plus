'use client'

import { useState, useRef, useCallback, useEffect, RefObject } from 'react'

// Ring ends sessions without closing the track, so watch the video clock.
const STALL_MS = 3000

interface UseWebRTCStreamOptions {
  videoRef: RefObject<HTMLVideoElement>
  deviceId?: string
}

interface UseWebRTCStreamReturn {
  streamActive: boolean
  streamError: string | null
  /** True when Ring ended the session (the video stopped advancing). */
  streamEnded: boolean
  startStream: () => Promise<void>
  stopStream: () => Promise<void>
}

// WebRTC (WHEP) connection to the Ring live stream.
export function useWebRTCStream({ videoRef, deviceId }: UseWebRTCStreamOptions): UseWebRTCStreamReturn {
  const [streamActive, setStreamActive] = useState(false)
  const [streamError, setStreamError] = useState<string | null>(null)
  const [streamEnded, setStreamEnded] = useState(false)
  const pcRef = useRef<RTCPeerConnection | null>(null)
  const sessionUrlRef = useRef<string | null>(null)

  const startStream = useCallback(async () => {
    setStreamError(null)
    setStreamEnded(false)
    try {
      const pc = new RTCPeerConnection({
        iceServers: [
          { urls: 'stun:stun.l.google.com:19302' },
          { urls: 'stun:stun1.l.google.com:19302' },
        ],
      })
      pcRef.current = pc

      pc.addTransceiver('audio', { direction: 'sendrecv' })
      pc.addTransceiver('video', { direction: 'recvonly' })

      pc.ontrack = (e) => {
        if (videoRef.current && e.streams[0]) {
          videoRef.current.srcObject = e.streams[0]
          setStreamActive(true)
        }
      }

      const offer = await pc.createOffer({ offerToReceiveVideo: true, offerToReceiveAudio: true })
      await pc.setLocalDescription(offer)

      // Wait for ICE gathering
      await new Promise<void>((resolve) => {
        if (pc.iceGatheringState === 'complete') return resolve()
        const timeout = setTimeout(() => resolve(), 3000)
        pc.onicegatheringstatechange = () => {
          if (pc.iceGatheringState === 'complete') {
            clearTimeout(timeout)
            resolve()
          }
        }
      })

      const res = await fetch('/api/ring/stream', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sdpOffer: pc.localDescription!.sdp, deviceId }),
      })

      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error || 'Stream start failed')
      }

      const { sdpAnswer, sessionUrl } = await res.json()
      sessionUrlRef.current = sessionUrl
      await pc.setRemoteDescription({ type: 'answer', sdp: sdpAnswer })
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Stream failed'
      console.error('Stream error:', err)
      setStreamError(message)
      setStreamActive(false)
    }
  }, [videoRef, deviceId])

  const stopStream = useCallback(async () => {
    pcRef.current?.close()
    pcRef.current = null
    if (sessionUrlRef.current) {
      await fetch('/api/ring/stream', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionUrl: sessionUrlRef.current }),
      }).catch(() => {})
      sessionUrlRef.current = null
    }
    if (videoRef.current) videoRef.current.srcObject = null
    setStreamActive(false)
    setStreamError(null)
  }, [videoRef])

  useEffect(() => {
    if (!streamActive) return
    let lastTime = -1
    let lastChange = Date.now()
    const id = setInterval(() => {
      const video = videoRef.current
      if (!video) return
      if (video.currentTime !== lastTime) {
        lastTime = video.currentTime
        lastChange = Date.now()
      } else if (Date.now() - lastChange > STALL_MS) {
        clearInterval(id)
        setStreamEnded(true)
        void stopStream().then(() => setStreamEnded(true))
      }
    }, 1000)
    return () => clearInterval(id)
  }, [streamActive, videoRef, stopStream])

  return { streamActive, streamError, streamEnded, startStream, stopStream }
}
