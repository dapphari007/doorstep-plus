import Link from 'next/link'

function GradientPlus() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="-ml-px mt-[0.02em] h-[0.6em] w-[0.6em]">
      <defs>
        <linearGradient id="plus-gradient" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#0ea5e9" />
          <stop offset="50%" stopColor="#d946ef" />
          <stop offset="100%" stopColor="#f59e0b" />
        </linearGradient>
      </defs>
      <path d="M9 2h6v7h7v6h-7v7H9v-7H2V9h7z" fill="url(#plus-gradient)" />
    </svg>
  )
}

export function Wordmark({ className = '' }: { className?: string }) {
  return (
    <Link
      href="/"
      aria-label="Doorstep+, home"
      className={`inline-flex items-start whitespace-nowrap text-[22px] font-semibold tracking-tight text-primary sm:text-2xl ${className}`}
    >
      Doorstep
      <GradientPlus />
    </Link>
  )
}
