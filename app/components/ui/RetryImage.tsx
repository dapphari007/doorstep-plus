'use client'

import { useEffect, useState, type ImgHTMLAttributes } from 'react'

const RETRIES = 2

/** An image that quietly retries a couple of times (e.g. a throttled server) before giving up. */
export function RetryImage({
  src,
  onGiveUp,
  ...rest
}: ImgHTMLAttributes<HTMLImageElement> & { src: string; onGiveUp?: () => void }) {
  const [attempt, setAttempt] = useState(0)
  const [hidden, setHidden] = useState(false)

  useEffect(() => {
    setAttempt(0)
    setHidden(false)
  }, [src])

  if (hidden) return null
  const url = attempt ? `${src}${src.includes('?') ? '&' : '?'}retry=${attempt}` : src
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      {...rest}
      src={url}
      onError={() => {
        if (attempt < RETRIES) setTimeout(() => setAttempt((a) => a + 1), 800 * (attempt + 1))
        else if (onGiveUp) onGiveUp()
        else setHidden(true)
      }}
    />
  )
}
