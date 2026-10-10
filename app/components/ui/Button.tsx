import { forwardRef, type ButtonHTMLAttributes } from 'react'
import { Icon, type IconName } from './Icon'
import { Spinner } from './Spinner'

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger'
type Size = 'md' | 'sm'

interface Props extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant
  size?: Size
  icon?: IconName
  loading?: boolean
  block?: boolean
}

const VARIANTS: Record<Variant, string> = {
  primary: 'bg-primary text-primary-on hover:bg-primary-hover',
  secondary: 'bg-surface text-ink border border-line hover:bg-subtle',
  ghost: 'text-ink hover:bg-subtle',
  danger: 'bg-surface text-danger border border-line hover:bg-subtle',
}

const SIZES: Record<Size, string> = {
  md: 'h-11 px-5 text-[15px]',
  sm: 'h-9 px-3.5 text-sm',
}

export const Button = forwardRef<HTMLButtonElement, Props>(function Button(
  {
    variant = 'primary',
    size = 'md',
    icon,
    loading = false,
    block = false,
    disabled,
    className = '',
    children,
    type = 'button',
    ...rest
  },
  ref,
) {
  return (
    <button
      ref={ref}
      type={type}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      className={`inline-flex shrink-0 items-center justify-center gap-2 rounded-full font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${VARIANTS[variant]} ${SIZES[size]} ${block ? 'w-full' : ''} ${className}`}
      {...rest}
    >
      {loading ? <Spinner /> : icon && <Icon name={icon} className="h-[18px] w-[18px]" />}
      {children}
    </button>
  )
})
