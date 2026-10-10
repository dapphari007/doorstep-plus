import { subscribe } from '@/lib/bus'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

/** Server-Sent Events: every event, delivery and lock change as it happens. */
export async function GET(req: Request) {
  const encoder = new TextEncoder()
  let cleanup = () => {}
  const stream = new ReadableStream({
    start(controller) {
      const send = (data: string) => {
        try {
          controller.enqueue(encoder.encode(data))
        } catch {
          cleanup()
        }
      }
      send(': connected\n\n')
      const unsubscribe = subscribe((msg) => send(`data: ${JSON.stringify(msg)}\n\n`))
      const keepAlive = setInterval(() => send(': ping\n\n'), 20000)
      cleanup = () => {
        clearInterval(keepAlive)
        unsubscribe()
      }
      req.signal.addEventListener('abort', cleanup)
    },
    cancel() {
      cleanup()
    },
  })
  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
    },
  })
}
