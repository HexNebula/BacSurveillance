import { useState, useRef, useEffect } from 'react'
import { DayPicker } from 'react-day-picker'
import { format, parse, isValid } from 'date-fns'
import { fr } from 'date-fns/locale'
import { CalendarDays } from 'lucide-react'
import { cn } from '../../lib/utils'

import 'react-day-picker/dist/style.css'

interface DatePickerProps {
  label?: string
  value: string          // ISO "YYYY-MM-DD"
  onChange: (value: string) => void
  min?: string           // ISO "YYYY-MM-DD" — days before this are disabled
  disabled?: boolean
  error?: string
  onDisabledDayClick?: () => void
}

export function DatePicker({ label, value, onChange, min, disabled, error, onDisabledDayClick }: DatePickerProps) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  const selected = value ? parse(value, 'yyyy-MM-dd', new Date()) : undefined
  const minDate  = min  ? parse(min,   'yyyy-MM-dd', new Date()) : undefined

  // Close on outside click
  useEffect(() => {
    if (!open) return
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open])

  const handleSelect = (day: Date | undefined) => {
    if (!day) return
    onChange(format(day, 'yyyy-MM-dd'))
    setOpen(false)
  }

  const handleDayClick = (_day: Date, modifiers: Record<string, boolean>) => {
    if (modifiers.disabled) onDisabledDayClick?.()
  }

  const display = selected && isValid(selected)
    ? format(selected, 'd MMMM yyyy', { locale: fr })
    : ''

  return (
    <div className="flex flex-col gap-1.5" ref={ref}>
      {label && <label className="text-sm font-medium text-slate-700">{label}</label>}

      <button
        type="button"
        disabled={disabled}
        onClick={() => setOpen(v => !v)}
        className={cn(
          'h-9 w-full rounded-lg border bg-white px-3 text-sm text-left flex items-center gap-2',
          'shadow-sm transition-all duration-150',
          'focus:outline-none focus:ring-2 focus:ring-offset-0',
          error
            ? 'border-rose-400 focus:border-rose-400 focus:ring-rose-400/20'
            : open
              ? 'border-indigo-500 ring-2 ring-indigo-500/20'
              : 'border-slate-200 hover:border-slate-300',
          disabled && 'opacity-50 cursor-not-allowed',
        )}
      >
        <CalendarDays size={14} className="text-slate-400 shrink-0" />
        <span className={display ? 'text-slate-900' : 'text-slate-400'}>
          {display || 'Sélectionner une date'}
        </span>
      </button>

      {error && <span className="text-xs text-rose-500">{error}</span>}

      {open && (
        <div className="absolute z-50 mt-1 bg-white rounded-xl border border-slate-200 shadow-xl p-3"
          style={{ marginTop: label ? '4.5rem' : '2.75rem' }}>
          <DayPicker
            mode="single"
            selected={selected}
            onSelect={handleSelect}
            locale={fr}
            disabled={minDate ? { before: minDate } : undefined}
            onDayClick={handleDayClick}
            defaultMonth={selected ?? minDate}
            classNames={{
              root:         'rdp-custom',
              months:       'flex flex-col',
              month:        'space-y-2',
              caption:      'flex items-center justify-between px-1',
              caption_label:'text-sm font-semibold text-slate-800 capitalize',
              nav:          'flex items-center gap-1',
              nav_button:   'h-7 w-7 flex items-center justify-center rounded-md hover:bg-slate-100 transition-colors text-slate-600',
              nav_button_previous: '',
              nav_button_next:     '',
              table:        'w-full border-collapse',
              head_row:     'flex',
              head_cell:    'text-slate-400 text-xs font-medium w-9 text-center',
              row:          'flex mt-1',
              cell:         'w-9 text-center text-sm',
              day:          'h-9 w-9 rounded-lg text-sm font-medium transition-colors hover:bg-indigo-50 hover:text-indigo-700 focus:outline-none',
              day_selected: '!bg-indigo-600 !text-white hover:!bg-indigo-700',
              day_today:    'font-bold text-indigo-600',
              day_disabled: 'text-slate-300 cursor-not-allowed hover:bg-transparent hover:text-slate-300',
              day_outside:  'text-slate-300',
            }}
          />
        </div>
      )}
    </div>
  )
}
