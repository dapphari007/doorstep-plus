import Link from 'next/link'

export function Wordmark({ className = '' }: { className?: string }) {
  return (
    <Link
      href="/"
      aria-label="Doorstep Copilot, home"
      className={`whitespace-nowrap text-[22px] font-semibold tracking-tight sm:text-2xl ${className}`}
    >
      <span className="text-ink">Doorstep</span> <span className="font-normal text-primary">Copilot</span>
    </Link>
  )
}
