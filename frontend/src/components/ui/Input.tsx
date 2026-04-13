import type { InputHTMLAttributes } from 'react'
import { cn } from '../../lib/utils'

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string
  error?: string
  hint?: string
}

export function Input({ label, error, hint, id, className, ...rest }: InputProps) {
  const inputId = id ?? label?.toLowerCase().replace(/\s+/g, '-')

  return (
    <div className="flex flex-col gap-1.5">
      {label && (
        <label htmlFor={inputId} className="text-sm font-medium text-slate-700">
          {label}
        </label>
      )}
      <input
        id={inputId}
        className={cn(
          'h-9 w-full rounded-lg border bg-white px-3 text-sm text-slate-900',
          'shadow-sm placeholder:text-slate-400 transition-all duration-150',
          'focus:outline-none focus:ring-2 focus:ring-offset-0',
          error
            ? 'border-rose-400 focus:border-rose-400 focus:ring-rose-400/20'
            : 'border-slate-200 focus:border-indigo-500 focus:ring-indigo-500/20',
          className,
        )}
        {...rest}
      />
      {error && <span className="text-xs text-rose-500">{error}</span>}
      {hint && !error && <span className="text-xs text-slate-400">{hint}</span>}
    </div>
  )
}
