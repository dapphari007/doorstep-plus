import type { HTMLAttributes, ReactNode } from 'react'

export function Card({ className = '', ...rest }: HTMLAttributes<HTMLElement>) {
  return <section className={`rounded-2xl border border-line bg-surface ${className}`} {...rest} />
}

export function SectionTitle({ children, action, id }: { children: ReactNode; action?: ReactNode; id?: string }) {
  return (
    <div className="mb-3 flex items-center justify-between gap-3">
      <h2 id={id} className="text-lg font-semibold">
        {children}
      </h2>
      {action}
    </div>
  )
}

export function PageHeader({ title, subtitle, action }: { title: string; subtitle?: ReactNode; action?: ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
      <div className="min-w-0">
        <h1 className="text-3xl font-semibold leading-tight tracking-tight md:text-[44px]">{title}</h1>
        {subtitle && <p className="mt-1 text-muted">{subtitle}</p>}
      </div>
      {action}
    </div>
  )
}

/** Page content area: full width with generous side padding, left aligned. */
export function Container({ className = '', children }: { className?: string; children: ReactNode }) {
  return <div className={`px-4 py-8 sm:px-8 md:py-12 lg:px-16 ${className}`}>{children}</div>
}
