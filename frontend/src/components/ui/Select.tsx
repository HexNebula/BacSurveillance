import type { SelectHTMLAttributes } from 'react'
import { cn } from '../../lib/utils'

interface SelectOption {
  value: string | number
  label: string
}

interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label?: string
  options: SelectOption[]
  error?: string
  placeholder?: string
}

export function Select({ label, options, error, placeholder, id, className, ...rest }: SelectProps) {
  const selectId = id ?? label?.toLowerCase().replace(/\s+/g, '-')

  return (
    <div className="flex flex-col gap-1.5">
      {label && (
        <label htmlFor={selectId} className="text-sm font-medium text-slate-700">
          {label}
        </label>
      )}
      <select
        id={selectId}
        className={cn(
          'h-9 w-full rounded-lg border bg-white px-3 text-sm text-slate-900',
          'shadow-sm transition-all duration-150 cursor-pointer',
          'focus:outline-none focus:ring-2 focus:ring-offset-0',
          error
            ? 'border-rose-400 focus:border-rose-400 focus:ring-rose-400/20'
            : 'border-slate-200 focus:border-indigo-500 focus:ring-indigo-500/20',
          className,
        )}
        {...rest}
      >
        {placeholder && <option value="">{placeholder}</option>}
        {options.map(o => (
          <option key={o.value} value={o.value}>{o.label}</option>
        ))}
      </select>
      {error && <span className="text-xs text-rose-500">{error}</span>}
    </div>
  )
}
