import type { SelectHTMLAttributes } from 'react'
import { Icon } from './Icon'

/** Native select (best on mobile and for screen readers) with its own chevron and spacing. */
export function Select({ className = '', children, ...rest }: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <span className={`relative inline-flex ${className}`}>
      <select
        className="h-10 w-full appearance-none rounded-full border border-line bg-surface pl-4 pr-10 text-sm font-medium text-ink hover:border-muted"
        {...rest}
      >
        {children}
      </select>
      <span
        aria-hidden="true"
        className="pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2 rotate-90 text-muted"
      >
        <Icon name="chevron" className="h-4 w-4" />
      </span>
    </span>
  )
}
