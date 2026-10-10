import type { ReactNode } from 'react'

type Tone = 'neutral' | 'primary' | 'success' | 'warning' | 'danger'

const TONES: Record<Tone, string> = {
  neutral: 'bg-subtle text-muted',
  primary: 'bg-primary/10 text-primary',
  success: 'bg-success/10 text-success',
  warning: 'bg-warning/10 text-warning',
  danger: 'bg-danger/10 text-danger',
}

export function Badge({ tone = 'neutral', children, title }: { tone?: Tone; children: ReactNode; title?: string }) {
  return (
    <span
      title={title}
      className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold ${TONES[tone]}`}
    >
      {children}
    </span>
  )
}

export function StatusDot({ tone }: { tone: 'success' | 'warning' | 'danger' | 'neutral' }) {
  const color = { success: 'bg-success', warning: 'bg-warning', danger: 'bg-danger', neutral: 'bg-muted' }[tone]
  return <span aria-hidden="true" className={`inline-block h-2 w-2 shrink-0 rounded-full ${color}`} />
}
