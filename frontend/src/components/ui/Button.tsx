import type { ReactNode, ButtonHTMLAttributes } from 'react'
import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '../../lib/utils'
import { Spinner } from './Spinner'

const button = cva(
  [
    'inline-flex items-center justify-center gap-2 rounded-lg font-medium transition-all duration-150',
    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2',
    'disabled:pointer-events-none disabled:opacity-50 shrink-0 whitespace-nowrap cursor-pointer',
    'active:scale-[0.97]',
  ],
  {
    variants: {
      variant: {
        primary:
          'bg-indigo-500 text-white shadow-sm shadow-indigo-200 hover:bg-indigo-600',
        secondary:
          'bg-white border border-slate-200 text-slate-700 shadow-sm hover:bg-slate-50',
        danger:
          'bg-rose-50 border border-rose-200 text-rose-600 hover:bg-rose-100',
        ghost:
          'text-slate-600 hover:bg-slate-100 hover:text-slate-900',
      },
      size: {
        sm: 'h-8 px-3 text-xs',
        md: 'h-9 px-4 text-sm',
        lg: 'h-11 px-6 text-base',
      },
    },
    defaultVariants: { variant: 'secondary', size: 'md' },
  },
)

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement>, VariantProps<typeof button> {
  loading?: boolean
  icon?: ReactNode
  children?: ReactNode
}

export function Button({
  variant,
  size,
  loading = false,
  icon,
  children,
  disabled,
  className,
  ...rest
}: ButtonProps) {
  return (
    <button
      disabled={disabled || loading}
      className={cn(button({ variant, size }), className)}
      {...rest}
    >
      {loading ? <Spinner size={14} /> : icon}
      {children}
    </button>
  )
}
