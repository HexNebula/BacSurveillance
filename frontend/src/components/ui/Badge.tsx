import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '../../lib/utils'
import type { ReactNode } from 'react'

const badge = cva(
  'inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium whitespace-nowrap',
  {
    variants: {
      variant: {
        default: 'bg-slate-100 text-slate-600',
        success: 'bg-emerald-50 text-emerald-700 ring-1 ring-inset ring-emerald-200',
        warning: 'bg-amber-50 text-amber-700 ring-1 ring-inset ring-amber-200',
        danger:  'bg-rose-50 text-rose-600 ring-1 ring-inset ring-rose-200',
        info:    'bg-blue-50 text-blue-700 ring-1 ring-inset ring-blue-200',
        primary: 'bg-indigo-50 text-indigo-700 ring-1 ring-inset ring-indigo-200',
      },
    },
    defaultVariants: { variant: 'default' },
  },
)

interface BadgeProps extends VariantProps<typeof badge> {
  children: ReactNode
  className?: string
}

export function Badge({ variant, children, className }: BadgeProps) {
  return <span className={cn(badge({ variant }), className)}>{children}</span>
}
