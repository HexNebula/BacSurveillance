import { useState } from 'react'
import * as Switch from '@radix-ui/react-switch'
import { Copy } from 'lucide-react'
import type { ExamSlot } from '../../../types'
import { useActiveExam } from '../../../context/ActiveExamContext'
import {
  useExam,
  useExamFilieres,
  useExamSlots,
  useCreateExamSlot,
  useUpdateExamSlot,
  useDeleteExamSlot,
  useCopySlots,
} from '../../../hooks/useExam'
import { useFilieres, useSubjects } from '../../../hooks/useCenter'
import { useToast } from '../../../hooks/useToast'
import { PageHeader } from '../../../components/ui/PageHeader'
import { Button } from '../../../components/ui/Button'
import { Modal } from '../../../components/ui/Modal'
import { Select } from '../../../components/ui/Select'
import { Spinner } from '../../../components/ui/Spinner'
import { SlotTimePicker } from '../../../components/ui/SlotTimePicker'
import { cn } from '../../../lib/utils'

type ShiftKey = 'MORNING' | 'AFTERNOON'
const SHIFT_LABELS: Record<ShiftKey, string> = { MORNING: 'Matin', AFTERNOON: 'Après-midi' }
const SHIFTS: ShiftKey[] = ['MORNING', 'AFTERNOON']
const SLOT_ORDERS = [1, 2] as const

function getDays(startDate: string, endDate: string): number[] {
  const start = new Date(startDate)
  const end   = new Date(endDate)
  const days: number[] = []
  let d = 1
  const cur = new Date(start)
  while (cur <= end) { days.push(d++); cur.setDate(cur.getDate() + 1) }
  return days
}

function dayDate(day: number, startDate: string): Date {
  const d = new Date(startDate)
  d.setDate(d.getDate() + day - 1)
  return d
}

function dayTabLabel(day: number, startDate: string): { short: string; full: string } {
  const d = dayDate(day, startDate)
  return {
    short: `J${day}`,
    full:  d.toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric', month: 'short' }),
  }
}

// map[exam_filiere_id][day][shift][slot_order] = ExamSlot | undefined
type SlotMap = Record<number, Record<number, Record<ShiftKey, Record<number, ExamSlot | undefined>>>>

function buildSlotMap(slots: ExamSlot[]): SlotMap {
  const map: SlotMap = {}
  for (const s of slots) {
    if (!map[s.exam_filiere_id]) map[s.exam_filiere_id] = {}
    if (!map[s.exam_filiere_id][s.day]) map[s.exam_filiere_id][s.day] = { MORNING: {}, AFTERNOON: {} }
    map[s.exam_filiere_id][s.day][s.shift as ShiftKey][s.slot_order] = s
  }
  return map
}

// ── Cell ─────────────────────────────────────────────────────────────────────

interface CellProps {
  slot?: ExamSlot
  examFiliereId: number
  day: number
  shift: ShiftKey
  slotOrder: number
  examId: number
  subjectOptions: { value: string | number; label: string }[]
}

function ScheduleCell({ slot, examFiliereId, day, shift, slotOrder, examId, subjectOptions }: CellProps) {
  const createSlot = useCreateExamSlot()
  const updateSlot = useUpdateExamSlot()
  const deleteSlot = useDeleteExamSlot()
  const toast      = useToast()

  const handleSubjectChange = (subjectId: string) => {
    if (!subjectId) {
      if (slot) deleteSlot.mutate({ id: slot.id, examId }, { onError: () => toast.error('Erreur') })
      return
    }
    if (slot) {
      updateSlot.mutate(
        { id: slot.id, data: { subject_id: Number(subjectId) }, examId },
        { onError: () => toast.error('Erreur') },
      )
    } else {
      createSlot.mutate(
        { exam_id: examId, exam_filiere_id: examFiliereId, subject_id: Number(subjectId), day, shift, slot_order: slotOrder },
        { onError: () => toast.error('Erreur') },
      )
    }
  }

  const handleToggle = (checked: boolean) => {
    if (!slot) return
    updateSlot.mutate({ id: slot.id, data: { is_active: checked }, examId }, { onError: () => toast.error('Erreur') })
  }

  const handleStartTimeChange = (value: string | null) => {
    if (!slot) return
    updateSlot.mutate({ id: slot.id, data: { start_time: value }, examId }, { onError: () => toast.error('Erreur') })
  }

  const handleEndTimeChange = (value: string | null) => {
    if (!slot) return
    updateSlot.mutate({ id: slot.id, data: { end_time: value }, examId }, { onError: () => toast.error('Erreur') })
  }

  const isBusy = createSlot.isPending || updateSlot.isPending || deleteSlot.isPending

  return (
    <td className={cn(
      'p-3 border-b border-r border-slate-200 align-middle',
      slot?.subject_id && !isBusy ? 'bg-indigo-50/60' : 'bg-white',
      slot?.is_active === false ? 'opacity-60' : '',
    )}>
      <div className="flex flex-col gap-2">
        <select
          value={slot?.subject_id?.toString() ?? ''}
          disabled={isBusy}
          onChange={e => handleSubjectChange(e.target.value)}
          className={cn(
            'w-full h-8 text-xs rounded-md border px-2 bg-white text-slate-700 cursor-pointer',
            'focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400',
            'border-slate-200 transition-all',
            isBusy && 'opacity-50 cursor-not-allowed',
          )}
        >
          <option value="">— vide —</option>
          {subjectOptions.map(o => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>

        {slot && (
          <div className="flex flex-wrap items-center gap-2">
            <SlotTimePicker
              startTime={slot.start_time}
              endTime={slot.end_time}
              onChangeStart={handleStartTimeChange}
              onChangeEnd={handleEndTimeChange}
              disabled={isBusy}
            />

            <div className="flex items-center gap-2">
              <Switch.Root
                checked={slot.is_active}
                onCheckedChange={handleToggle}
                className="w-9 h-5 rounded-full bg-slate-200 data-[state=checked]:bg-indigo-500 relative cursor-pointer border-none outline-none transition-colors shrink-0"
              >
                <Switch.Thumb className="block w-4 h-4 bg-white rounded-full shadow-sm translate-x-0.5 data-[state=checked]:translate-x-4 transition-transform" />
              </Switch.Root>
              <span className="text-xs text-slate-400">{slot.is_active ? 'Actif' : 'Inactif'}</span>
            </div>
          </div>
        )}
      </div>
    </td>
  )
}

// ── Copy-from modal ───────────────────────────────────────────────────────────

function CopyFromModal({ open, onClose, targetEf, examFilieres, filiereMap, examId }: {
  open: boolean
  onClose: () => void
  targetEf: { id: number; filiere_id: number }
  examFilieres: { id: number; filiere_id: number }[]
  filiereMap: Record<number, { name_fr: string }>
  examId: number
}) {
  const copySlots = useCopySlots(examId)
  const toast     = useToast()
  const [sourceId, setSourceId] = useState('')

  const options = examFilieres
    .filter(ef => ef.id !== targetEf.id)
    .map(ef => ({ value: ef.id, label: filiereMap[ef.filiere_id]?.name_fr ?? `Filière #${ef.filiere_id}` }))

  const targetName = filiereMap[targetEf.filiere_id]?.name_fr ?? `Filière #${targetEf.filiere_id}`

  const handleClose = () => { setSourceId(''); onClose() }

  const handleCopy = () => {
    copySlots.mutate({ targetEfId: targetEf.id, sourceEfId: Number(sourceId) }, {
      onSuccess: () => {
        toast.success(`Planning copié vers "${targetName}"`)
        handleClose()
      },
      onError: () => toast.error('Erreur lors de la copie'),
    })
  }

  return (
    <Modal open={open} onClose={handleClose} title={`Copier le planning → ${targetName}`} size="sm">
      <div className="flex flex-col gap-4">
        <p className="text-sm text-slate-500">
          Toutes les séances de la filière source seront copiées vers <strong>{targetName}</strong>.
          Les séances existantes de cette filière seront remplacées.
        </p>
        <Select
          label="Copier depuis"
          placeholder="— choisir une filière source —"
          value={sourceId}
          options={options}
          onChange={e => setSourceId(e.target.value)}
        />
        <div className="flex justify-end gap-2 mt-1">
          <Button variant="secondary" onClick={handleClose}>Annuler</Button>
          <Button
            variant="primary"
            onClick={handleCopy}
            loading={copySlots.isPending}
            disabled={!sourceId}
          >
            Copier le planning
          </Button>
        </div>
      </div>
    </Modal>
  )
}

// ── Day grid (one day at a time) ──────────────────────────────────────────────

interface DayGridProps {
  day: number
  examId: number
  examFilieres: { id: number; filiere_id: number }[]
  filiereMap: Record<number, { name_fr: string }>
  slotMap: SlotMap
  subjectOptions: { value: string | number; label: string }[]
}

function DayGrid({ day, examId, examFilieres, filiereMap, slotMap, subjectOptions }: DayGridProps) {
  const [copyTarget, setCopyTarget] = useState<{ id: number; filiere_id: number } | null>(null)

  return (
    <>
      <div className="rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <table className="w-full border-collapse">
          <thead>
            {/* Shifts row */}
            <tr>
              <th className="w-52 bg-slate-800 border-b border-r border-slate-700" />
              {SHIFTS.map(shift => (
                <th
                  key={shift}
                  colSpan={2}
                  className="px-4 py-2.5 bg-slate-800 text-white text-xs font-semibold text-center border-b border-r border-slate-700"
                >
                  {SHIFT_LABELS[shift]}
                </th>
              ))}
            </tr>
            {/* S1/S2 row */}
            <tr>
              <th className="px-4 py-2 bg-slate-700 text-slate-300 text-xs font-semibold text-left border-b border-r border-slate-600 w-52">
                Filière
              </th>
              {SHIFTS.flatMap(shift =>
                SLOT_ORDERS.map(order => (
                  <th
                    key={`${shift}-S${order}`}
                    className="px-4 py-2 bg-slate-700 text-slate-300 text-xs font-semibold text-center border-b border-r border-slate-600"
                  >
                    S{order}
                  </th>
                ))
              )}
            </tr>
          </thead>
          <tbody>
            {examFilieres.map(ef => (
              <tr key={ef.id}>
                <td className="px-3 py-3 bg-slate-50 border-b border-r-2 border-slate-300 w-52">
                  <div className="flex items-center justify-between gap-1">
                    <span className="font-semibold text-sm text-indigo-700 truncate">
                      {filiereMap[ef.filiere_id]?.name_fr ?? `Filière #${ef.filiere_id}`}
                    </span>
                    {examFilieres.length > 1 && (
                      <button
                        title="Copier le planning d'une autre filière"
                        onClick={() => setCopyTarget(ef)}
                        className="shrink-0 p-1 rounded-md text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 transition-colors"
                      >
                        <Copy size={12} />
                      </button>
                    )}
                  </div>
                </td>
                {SHIFTS.flatMap(shift =>
                  SLOT_ORDERS.map(order => (
                    <ScheduleCell
                      key={`${ef.id}-${shift}-S${order}`}
                      slot={slotMap[ef.id]?.[day]?.[shift]?.[order]}
                      examFiliereId={ef.id}
                      day={day}
                      shift={shift}
                      slotOrder={order}
                      examId={examId}
                      subjectOptions={subjectOptions}
                    />
                  ))
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {copyTarget && (
        <CopyFromModal
          open={!!copyTarget}
          onClose={() => setCopyTarget(null)}
          targetEf={copyTarget}
          examFilieres={examFilieres}
          filiereMap={filiereMap}
          examId={examId}
        />
      )}
    </>
  )
}

// ── Page ─────────────────────────────────────────────────────────────────────

export default function SchedulePage() {
  const { examId } = useActiveExam()
  const { data: exam }             = useExam(examId)
  const { data: examFilieres = [], isLoading: efLoading } = useExamFilieres(examId)
  const { data: filieres = [],    isLoading: fLoading  } = useFilieres()
  const { data: slots = [],       isLoading: sLoading  } = useExamSlots(examId)
  const { data: subjects = [] }    = useSubjects()

  const isLoading     = efLoading || fLoading || sLoading
  const subjectOptions = subjects.map(s => ({ value: s.id, label: s.name_fr }))
  const slotMap       = buildSlotMap(slots)
  const days          = exam ? getDays(exam.start_date, exam.end_date) : []
  const filiereMap    = Object.fromEntries(filieres.map(f => [f.id, f]))

  const [activeDay, setActiveDay] = useState<number>(1)
  const currentDay = days.includes(activeDay) ? activeDay : (days[0] ?? 1)

  if (isLoading) {
    return <div className="flex justify-center py-16"><Spinner size={24} className="text-indigo-500" /></div>
  }

  if (examFilieres.length === 0) {
    return (
      <div className="p-8">
        <PageHeader title="Planning" subtitle="Affectez les matières par filière, jour et séance (S1 / S2)" />
        <p className="text-center text-slate-400 py-10 text-sm">
          Ajoutez d'abord des filières dans l'étape précédente.
        </p>
      </div>
    )
  }

  return (
    <div className="p-8">
      <PageHeader title="Planning" subtitle="Affectez les matières par filière, jour et séance (S1 / S2)" />

      {/* Day tabs */}
      <div className="flex gap-1 mb-5 flex-wrap">
        {days.map(day => {
          const label = exam ? dayTabLabel(day, exam.start_date) : { short: `J${day}`, full: '' }
          const isActive = day === currentDay
          return (
            <button
              key={day}
              onClick={() => setActiveDay(day)}
              className={cn(
                'flex flex-col items-center px-4 py-2 rounded-xl border text-left transition-all',
                isActive
                  ? 'bg-indigo-600 border-indigo-600 text-white shadow-sm shadow-indigo-200'
                  : 'bg-white border-slate-200 text-slate-600 hover:border-indigo-300 hover:text-indigo-600',
              )}
            >
              <span className="text-sm font-bold leading-none">{label.short}</span>
              <span className={cn('text-xs mt-0.5 leading-none', isActive ? 'text-indigo-200' : 'text-slate-400')}>
                {label.full}
              </span>
            </button>
          )
        })}
      </div>

      {/* Grid for selected day */}
      <DayGrid
        day={currentDay}
        examId={examId}
        examFilieres={examFilieres}
        filiereMap={filiereMap}
        slotMap={slotMap}
        subjectOptions={subjectOptions}
      />
    </div>
  )
}
