import { useCallback, useEffect, useRef, useState } from 'react'
import { Clock, X } from 'lucide-react'
import { cn } from '../../lib/utils'

const HOURS   = Array.from({ length: 11 }, (_, i) => String(i + 8).padStart(2, '0'))  // 08–18
const MINUTES = ['00', '05', '10', '15', '20', '25', '30', '35', '40', '45', '50', '55']

interface SlotTimePickerProps {
  startTime: string | null | undefined
  endTime:   string | null | undefined
  onChangeStart: (value: string | null) => void
  onChangeEnd:   (value: string | null) => void
  disabled?: boolean
}

function TimeSelect({
  label,
  value,
  onChange,
}: {
  label: string
  value: string
  onChange: (v: string) => void
}) {
  const [h, m] = value ? value.split(':') : ['', '']

  const setH = (hh: string) => onChange(`${hh}:${m || '00'}`)
  const setM = (mm: string) => onChange(`${h || '08'}:${mm}`)

  return (
    <div className="flex flex-col gap-1">
      <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">{label}</span>
      <div className="flex gap-1">
        <select
          value={h}
          onChange={e => setH(e.target.value)}
          className="h-8 px-2 text-sm rounded-md border border-slate-200 bg-white text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-400"
        >
          <option value="">--</option>
          {HOURS.map(hh => <option key={hh} value={hh}>{hh}</option>)}
        </select>
        <span className="self-center text-slate-400 text-sm font-bold">:</span>
        <select
          value={m}
          onChange={e => setM(e.target.value)}
          className="h-8 px-2 text-sm rounded-md border border-slate-200 bg-white text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-400"
        >
          <option value="">--</option>
          {MINUTES.map(mm => <option key={mm} value={mm}>{mm}</option>)}
        </select>
      </div>
    </div>
  )
}

export function SlotTimePicker({ startTime, endTime, onChangeStart, onChangeEnd, disabled }: SlotTimePickerProps) {
  const [open, setOpen] = useState(false)
  const [panelPosition, setPanelPosition] = useState({ top: 0, left: 0 })
  const buttonRef = useRef<HTMLButtonElement>(null)

  const hasTime = startTime || endTime
  const label   = hasTime
    ? `${startTime ?? '??:??'} → ${endTime ?? '??:??'}`
    : 'Horaire'

  const clear = (e: React.MouseEvent) => {
    e.stopPropagation()
    onChangeStart(null)
    onChangeEnd(null)
  }

  const updatePanelPosition = useCallback(() => {
    const rect = buttonRef.current?.getBoundingClientRect()
    if (!rect) return

    const panelWidth = 288
    const panelHeight = 104
    const spacing = 6
    const belowTop = rect.bottom + spacing
    const aboveTop = rect.top - panelHeight - spacing
    const hasRoomBelow = belowTop + panelHeight <= window.innerHeight - spacing

    setPanelPosition({
      top: hasRoomBelow ? belowTop : Math.max(spacing, aboveTop),
      left: Math.min(Math.max(spacing, rect.left), window.innerWidth - panelWidth - spacing),
    })
  }, [])

  const toggleOpen = () => {
    updatePanelPosition()
    setOpen(v => !v)
  }

  useEffect(() => {
    if (!open) return
    window.addEventListener('resize', updatePanelPosition)
    window.addEventListener('scroll', updatePanelPosition, true)
    return () => {
      window.removeEventListener('resize', updatePanelPosition)
      window.removeEventListener('scroll', updatePanelPosition, true)
    }
  }, [open, updatePanelPosition])

  return (
    <div className="relative inline-flex">
      <button
        ref={buttonRef}
        type="button"
        disabled={disabled}
        onClick={toggleOpen}
        className={cn(
          'flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium transition-all border',
          hasTime
            ? 'bg-indigo-50 border-indigo-200 text-indigo-700 hover:bg-indigo-100'
            : 'bg-slate-50 border-slate-200 text-slate-400 hover:bg-slate-100',
          disabled && 'opacity-50 cursor-not-allowed',
        )}
      >
        <Clock size={11} />
        {label}
        {hasTime && !disabled && (
          <span
            role="button"
            onClick={clear}
            className="ml-0.5 text-indigo-400 hover:text-indigo-700"
          >
            <X size={10} />
          </span>
        )}
      </button>

      {open && !disabled && (
        <>
          <button
            type="button"
            aria-label="Fermer"
            className="fixed inset-0 z-40 cursor-default bg-transparent"
            onClick={() => setOpen(false)}
          />
          <div
            className="fixed z-50 flex gap-4 rounded-xl border border-slate-200 bg-white p-4 shadow-xl"
            style={{ top: panelPosition.top, left: panelPosition.left }}
          >
            <TimeSelect
              label="Début"
              value={startTime ?? ''}
              onChange={v => onChangeStart(v || null)}
            />
            <div className="self-end pb-1 text-slate-300 text-lg font-light">→</div>
            <TimeSelect
              label="Fin"
              value={endTime ?? ''}
              onChange={v => onChangeEnd(v || null)}
            />
          </div>
        </>
      )}
    </div>
  )
}
