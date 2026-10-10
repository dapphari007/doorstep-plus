import type { ReactNode } from 'react'
import { Icon, type IconName } from './Icon'

export function EmptyState({ icon, title, children }: { icon: IconName; title: string; children?: ReactNode }) {
  return (
    <div className="flex flex-col items-center px-6 py-10 text-center">
      <span className="grid h-12 w-12 place-items-center rounded-full bg-subtle text-muted">
        <Icon name={icon} className="h-6 w-6" />
      </span>
      <p className="mt-3 font-semibold">{title}</p>
      {children && <div className="mt-1 max-w-sm text-sm text-muted">{children}</div>}
    </div>
  )
}

export function InlineMessage({
  tone = 'warning',
  children,
}: {
  tone?: 'warning' | 'danger' | 'success'
  children: ReactNode
}) {
  const color = { warning: 'text-warning', danger: 'text-danger', success: 'text-success' }[tone]
  return (
    <p role={tone === 'success' ? 'status' : 'alert'} className={`text-sm ${color}`}>
      {children}
    </p>
  )
}
