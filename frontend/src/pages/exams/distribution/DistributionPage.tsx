import { useState } from 'react'
import { Play, AlertTriangle, CheckCircle2, Pencil, LayoutList, Users, CheckCheck, Lock } from 'lucide-react'
import type { RoomAssignment, TeacherScheduleRow, TeacherSlotCell } from '../../../types'
import { useActiveExam } from '../../../context/ActiveExamContext'
import {
  useRunAssignment, useRoomAssignments, useUpdateRoomAssignment,
  useExamTeachers, useTeacherSchedule,
} from '../../../hooks/useAssignment'
import { useExam, useUpdateExam } from '../../../hooks/useExam'
import { useToast } from '../../../hooks/useToast'
import { PageHeader } from '../../../components/ui/PageHeader'
import { Button } from '../../../components/ui/Button'
import { Modal } from '../../../components/ui/Modal'
import { ConfirmDialog } from '../../../components/ui/ConfirmDialog'
import { Select } from '../../../components/ui/Select'
import { Badge } from '../../../components/ui/Badge'
import { Spinner } from '../../../components/ui/Spinner'
import { cn } from '../../../lib/utils'

// ── Shared helpers ──────────────────────────────────────────────────────────

const SHIFT_LABEL: Record<string, string> = { MORNING: 'Matin', AFTERNOON: 'AM' }

function slotLabel(day: number, shift: string, order: number) {
  return `J${day} ${SHIFT_LABEL[shift] ?? shift} S${order}`
}

// ── Override modal ───────────────────────────────────────────────────────────

function OverrideModal({ open, onClose, assignment, examId }: {
  open: boolean; onClose: () => void; assignment: RoomAssignment; examId: number
}) {
  const { data: teachers = [] } = useExamTeachers(examId)
  const updateRA = useUpdateRoomAssignment(examId)
  const toast    = useToast()

  const [sup1, setSup1] = useState(assignment.supervisor_1_id?.toString() ?? '')
  const [sup2, setSup2] = useState(assignment.supervisor_2_id?.toString() ?? '')

  const handleSave = () => {
    updateRA.mutate(
      { id: assignment.id, data: { supervisor_1_id: sup1 ? Number(sup1) : undefined, supervisor_2_id: sup2 ? Number(sup2) : undefined } },
      { onSuccess: () => { onClose(); toast.success('Affectation modifiée') }, onError: () => toast.error('Erreur') },
    )
  }

  const opts = teachers.map(t => ({ value: t.id, label: `${t.name_fr} — ${t.cin}` }))

  return (
    <Modal open={open} onClose={onClose} title="Modifier l'affectation" size="sm">
      <div className="flex flex-col gap-4">
        <Select label="Surveillant 1" value={sup1} placeholder="— aucun —" options={opts} onChange={e => setSup1(e.target.value)} />
        <Select label="Surveillant 2" value={sup2} placeholder="— aucun —" options={opts} onChange={e => setSup2(e.target.value)} />
        <div className="flex justify-end gap-2 mt-1">
          <Button variant="secondary" onClick={onClose}>Annuler</Button>
          <Button variant="primary" onClick={handleSave} loading={updateRA.isPending}>Enregistrer</Button>
        </div>
      </div>
    </Modal>
  )
}

// ── Par salle view ───────────────────────────────────────────────────────────

function SlotGroupHeader({ day, shift, slotOrder, filiereName }: {
  day: number; shift: string; slotOrder: number; filiereName: string
}) {
  return (
    <tr className="bg-indigo-50 border-b border-indigo-100">
      <td colSpan={5} className="px-4 py-2">
        <div className="flex items-center gap-3">
          <span className="font-semibold text-indigo-800 text-xs uppercase tracking-wide">
            {slotLabel(day, shift, slotOrder)}
          </span>
          <span className="text-xs bg-indigo-100 text-indigo-600 px-2 py-0.5 rounded-full font-medium">
            {filiereName}
          </span>
        </div>
      </td>
    </tr>
  )
}

function RoomView({ examId }: { examId: number }) {
  const { data: assignments = [], isLoading } = useRoomAssignments(examId)
  const { data: teachers = [] }               = useExamTeachers(examId)
  const [override, setOverride] = useState<RoomAssignment | null>(null)

  const teacherMap = Object.fromEntries(teachers.map(t => [t.id, t.name_fr]))

  if (isLoading) return <div className="flex justify-center py-10"><Spinner size={20} className="text-indigo-500" /></div>
  if (assignments.length === 0) return <p className="text-center text-slate-400 py-10 text-sm">Aucune affectation. Lancez d'abord la distribution.</p>

  const rows: Array<{ type: 'header'; ra: RoomAssignment } | { type: 'row'; ra: RoomAssignment }> = []
  let lastSlotId: number | null = null
  for (const ra of assignments) {
    if (ra.exam_slot_id !== lastSlotId) { rows.push({ type: 'header', ra }); lastSlotId = ra.exam_slot_id }
    rows.push({ type: 'row', ra })
  }

  return (
    <>
      <div className="rounded-xl border border-slate-200 overflow-hidden shadow-sm bg-white">
        <table className="w-full border-collapse">
          <thead>
            <tr className="bg-slate-50 border-b border-slate-200">
              {['Salle', 'Surveillant 1', 'Surveillant 2', 'Statut', ''].map(h => (
                <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((entry, i) =>
              entry.type === 'header' ? (
                <SlotGroupHeader key={`h-${entry.ra.exam_slot_id}`} day={entry.ra.day} shift={entry.ra.shift} slotOrder={entry.ra.slot_order} filiereName={entry.ra.filiere_name} />
              ) : (
                <tr key={`${entry.ra.id}-${i}`} className="border-b border-slate-100 hover:bg-slate-50 transition-colors">
                  <td className="px-4 py-3 text-sm text-slate-700 font-medium">{entry.ra.room_name}</td>
                  <td className="px-4 py-3 text-sm text-slate-700">{entry.ra.supervisor_1_id ? teacherMap[entry.ra.supervisor_1_id] ?? `#${entry.ra.supervisor_1_id}` : '—'}</td>
                  <td className="px-4 py-3 text-sm text-slate-700">{entry.ra.supervisor_2_id ? teacherMap[entry.ra.supervisor_2_id] ?? `#${entry.ra.supervisor_2_id}` : '—'}</td>
                  <td className="px-4 py-3">
                    <Badge variant={entry.ra.status === 'OVERRIDDEN' ? 'warning' : 'default'}>
                      {entry.ra.status === 'OVERRIDDEN' ? 'Modifié' : 'Auto'}
                    </Badge>
                  </td>
                  <td className="px-4 py-3">
                    <Button variant="ghost" size="sm" icon={<Pencil size={13} />} onClick={() => setOverride(entry.ra)} />
                  </td>
                </tr>
              )
            )}
          </tbody>
        </table>
      </div>
      {override && <OverrideModal open={!!override} onClose={() => setOverride(null)} assignment={override} examId={examId} />}
    </>
  )
}

// ── Par surveillant view ─────────────────────────────────────────────────────

function RolePill({ cell }: { cell: TeacherSlotCell }) {
  if (!cell.role) return <span className="text-slate-300 text-xs">—</span>

  if (cell.role === 'SUPERVISOR') return (
    <div className="flex flex-col items-center gap-0.5">
      <span className="bg-indigo-100 text-indigo-700 text-[10px] font-semibold px-1.5 py-0.5 rounded-full leading-none">Surv</span>
      {cell.room_name && <span className="text-[10px] text-slate-500 font-medium">{cell.room_name}</span>}
    </div>
  )
  if (cell.role === 'RESERVE') return (
    <span className="bg-amber-100 text-amber-700 text-[10px] font-semibold px-1.5 py-0.5 rounded-full leading-none">Rés</span>
  )
  if (cell.role === 'MADAOUM') return (
    <span className="bg-emerald-100 text-emerald-700 text-[10px] font-semibold px-1.5 py-0.5 rounded-full leading-none">Perm</span>
  )
  return null
}

// Avatar colour cycles through a palette keyed by ordinal/index
const AVATAR_COLORS = [
  'bg-indigo-500', 'bg-violet-500', 'bg-sky-500', 'bg-emerald-500',
  'bg-rose-500',   'bg-amber-500',  'bg-teal-500', 'bg-pink-500',
]

function initials(name: string): string {
  const parts = name.trim().split(/\s+/)
  if (parts.length === 1) return parts[0][0].toUpperCase()
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
}

function TeacherCard({ row, index }: { row: TeacherScheduleRow; index: number }) {
  const active      = row.cells.filter(c => c.role !== null)
  const avatarColor = AVATAR_COLORS[index % AVATAR_COLORS.length]
  const total       = row.total_supervisor + row.total_reserve + row.total_madaoum

  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden flex flex-col">
      {/* Card header */}
      <div className="flex items-center gap-4 px-5 py-4 border-b border-slate-100">
        {/* Avatar */}
        <div className={cn('w-10 h-10 rounded-full flex items-center justify-center shrink-0 text-white font-bold text-sm', avatarColor)}>
          {initials(row.name_fr)}
        </div>
        {/* Name + meta */}
        <div className="flex-1 min-w-0">
          <div className="font-semibold text-slate-800 text-sm leading-tight truncate">{row.name_fr}</div>
          <div className="text-xs text-slate-400 mt-0.5 font-mono">{row.cin}</div>
        </div>
        {/* Ordinal */}
        {row.ordinal != null && (
          <span className="text-xs font-bold text-slate-300 shrink-0">#{row.ordinal}</span>
        )}
      </div>

      {/* Summary counts */}
      <div className="grid grid-cols-3 divide-x divide-slate-100 border-b border-slate-100">
        <div className="flex flex-col items-center py-3 gap-0.5">
          <span className="text-lg font-bold text-indigo-600 leading-none">{row.total_supervisor}</span>
          <span className="text-[10px] text-slate-400 uppercase tracking-wide">Surv.</span>
        </div>
        <div className="flex flex-col items-center py-3 gap-0.5">
          <span className="text-lg font-bold text-amber-500 leading-none">{row.total_reserve}</span>
          <span className="text-[10px] text-slate-400 uppercase tracking-wide">Rés.</span>
        </div>
        <div className="flex flex-col items-center py-3 gap-0.5">
          <span className="text-lg font-bold text-emerald-500 leading-none">{row.total_madaoum}</span>
          <span className="text-[10px] text-slate-400 uppercase tracking-wide">Perm.</span>
        </div>
      </div>

      {/* Slot assignments */}
      <div className="px-4 py-3 flex-1">
        {active.length === 0 ? (
          <p className="text-xs text-slate-300 text-center py-2">Non affecté</p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {active.map(cell => (
              <div
                key={cell.slot_id}
                className={cn(
                  'flex flex-col items-center gap-1 rounded-xl px-3 py-2 border text-center',
                  cell.role === 'SUPERVISOR' ? 'bg-indigo-50 border-indigo-200' :
                  cell.role === 'RESERVE'    ? 'bg-amber-50 border-amber-200'   :
                                               'bg-emerald-50 border-emerald-200',
                )}
              >
                <span className="text-[11px] font-bold text-slate-600 leading-none">
                  {slotLabel(cell.day, cell.shift, cell.slot_order)}
                </span>
                <RolePill cell={cell} />
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Footer total */}
      {total > 0 && (
        <div className="px-5 py-2.5 border-t border-slate-100 bg-slate-50">
          <span className="text-xs text-slate-500">
            <strong className="text-slate-700">{total}</strong> séance{total > 1 ? 's' : ''} au total
          </span>
        </div>
      )}
    </div>
  )
}

function TeacherView({ examId }: { examId: number }) {
  const { data, isLoading } = useTeacherSchedule(examId)

  if (isLoading) return <div className="flex justify-center py-10"><Spinner size={20} className="text-indigo-500" /></div>
  if (!data || data.teachers.length === 0) return (
    <p className="text-center text-slate-400 py-10 text-sm">Aucune affectation. Lancez d'abord la distribution.</p>
  )

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
      {data.teachers.map((row, i) => (
        <TeacherCard key={row.teacher_id} row={row} index={i} />
      ))}
    </div>
  )
}

// ── Main page ────────────────────────────────────────────────────────────────

type ViewTab = 'rooms' | 'teachers'

export default function DistributionPage() {
  const { examId }    = useActiveExam()
  const runAssignment = useRunAssignment()
  const updateExam    = useUpdateExam()
  const { data: exam } = useExam(examId)
  const toast         = useToast()

  const [confirmOpen, setConfirmOpen]       = useState(false)
  const [confirmStatus, setConfirmStatus]   = useState<'ACTIVE' | 'VALIDATED' | null>(null)
  const [activeTab, setActiveTab]           = useState<ViewTab>('rooms')
  const [lastResult, setLastResult]   = useState<{
    warnings: Array<{ type: string; code: string; message: string; context: Record<string, unknown> }>
    total_activities: number
    fair_target_floor: number
    fair_target_ceil: number
  } | null>(null)

  const handleStatusChange = (status: 'ACTIVE' | 'VALIDATED') => {
    updateExam.mutate({ id: examId, data: { status } }, {
      onSuccess: () => {
        setConfirmStatus(null)
        toast.success(status === 'ACTIVE' ? 'Distribution validée — examen en cours' : 'Examen clôturé')
      },
      onError: () => toast.error('Erreur'),
    })
  }

  const handleRun = () => {
    runAssignment.mutate(examId, {
      onSuccess: result => {
        setLastResult(result)
        setConfirmOpen(false)
        if (result.warnings.length === 0) {
          toast.success('Distribution réussie sans avertissements')
        } else {
          toast.toast(`Distribution terminée — ${result.warnings.length} avertissement(s)`, 'info')
        }
      },
      onError: () => { setConfirmOpen(false); toast.error('Erreur lors de la distribution') },
    })
  }

  return (
    <div className="p-8">
      <PageHeader title="Distribution" subtitle="Lancez l'algorithme d'affectation automatique" />

      {/* Run card */}
      <div className="bg-gradient-to-r from-indigo-600 to-violet-600 rounded-2xl p-8 mb-6 flex items-start justify-between gap-6 flex-wrap">
        <div className="text-white">
          <h3 className="font-display font-bold text-xl mb-2">Algorithme de distribution</h3>
          <p className="text-indigo-100 text-sm max-w-xl leading-relaxed">
            Affecte automatiquement les surveillants aux salles en respectant les critères d'équité et d'exemption.
            Les affectations automatiques existantes seront remplacées.
          </p>
          {lastResult && (
            <p className="text-indigo-200 text-xs mt-3">
              Dernière exécution : <strong className="text-white">{lastResult.total_activities}</strong> activités ·
              cible <strong className="text-white">{lastResult.fair_target_floor}–{lastResult.fair_target_ceil}</strong>
            </p>
          )}
        </div>
        <Button
          variant="secondary"
          size="lg"
          icon={runAssignment.isPending ? undefined : <Play size={16} />}
          onClick={() => setConfirmOpen(true)}
          loading={runAssignment.isPending}
          className="shrink-0 bg-white text-indigo-600 hover:bg-indigo-50 border-0 shadow-lg"
        >
          Lancer la distribution
        </Button>
      </div>

      {/* Warnings / success */}
      {lastResult && (
        lastResult.warnings.length > 0 ? (
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex gap-3 mb-6">
            <AlertTriangle size={16} className="text-amber-500 shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold text-amber-800 text-sm mb-2">{lastResult.warnings.length} avertissement(s)</p>
              <div className="flex flex-col gap-1">
                {lastResult.warnings.map((w, i) => (
                  <p key={i} className="text-xs text-amber-700"><strong>[{w.code}]</strong> {w.message}</p>
                ))}
              </div>
            </div>
          </div>
        ) : (
          <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 flex items-center gap-3 mb-6">
            <CheckCircle2 size={16} className="text-emerald-500 shrink-0" />
            <p className="text-sm font-medium text-emerald-700">Distribution complète — aucun avertissement</p>
          </div>
        )
      )}

      {/* Status action banner */}
      {exam?.status === 'DRAFT' && (
        <div className="flex items-center justify-between bg-white border border-slate-200 rounded-xl px-5 py-4 mb-4 shadow-sm">
          <div>
            <p className="font-semibold text-slate-800 text-sm">Distribution prête à valider</p>
            <p className="text-xs text-slate-400 mt-0.5">Vérifiez les affectations ci-dessous, puis validez pour passer l'examen en statut <strong>En cours</strong>.</p>
          </div>
          <Button
            variant="primary"
            icon={<CheckCheck size={14} />}
            onClick={() => setConfirmStatus('ACTIVE')}
            loading={updateExam.isPending}
          >
            Valider la distribution
          </Button>
        </div>
      )}
      {exam?.status === 'ACTIVE' && (
        <div className="flex items-center justify-between bg-emerald-50 border border-emerald-200 rounded-xl px-5 py-4 mb-4">
          <div>
            <p className="font-semibold text-emerald-800 text-sm">Examen en cours</p>
            <p className="text-xs text-emerald-600 mt-0.5">Une fois l'examen terminé, clôturez-le pour archiver les affectations.</p>
          </div>
          <Button
            variant="secondary"
            icon={<Lock size={14} />}
            onClick={() => setConfirmStatus('VALIDATED')}
            loading={updateExam.isPending}
          >
            Clôturer l'examen
          </Button>
        </div>
      )}
      {exam?.status === 'VALIDATED' && (
        <div className="flex items-center gap-3 bg-slate-50 border border-slate-200 rounded-xl px-5 py-4 mb-4">
          <Lock size={15} className="text-slate-400 shrink-0" />
          <p className="text-sm text-slate-500">Examen clôturé — les affectations sont archivées.</p>
        </div>
      )}

      {/* Tab toggle */}
      <div className="flex items-center gap-1 mb-4 bg-slate-100 rounded-lg p-1 w-fit">
        <button
          onClick={() => setActiveTab('rooms')}
          className={cn(
            'flex items-center gap-2 px-3 py-1.5 rounded-md text-sm font-medium transition-all',
            activeTab === 'rooms'
              ? 'bg-white text-slate-800 shadow-sm'
              : 'text-slate-500 hover:text-slate-700',
          )}
        >
          <LayoutList size={14} /> Par salle
        </button>
        <button
          onClick={() => setActiveTab('teachers')}
          className={cn(
            'flex items-center gap-2 px-3 py-1.5 rounded-md text-sm font-medium transition-all',
            activeTab === 'teachers'
              ? 'bg-white text-slate-800 shadow-sm'
              : 'text-slate-500 hover:text-slate-700',
          )}
        >
          <Users size={14} /> Par surveillant
        </button>
      </div>

      {activeTab === 'rooms' ? <RoomView examId={examId} /> : <TeacherView examId={examId} />}

      <ConfirmDialog
        open={confirmOpen}
        onClose={() => setConfirmOpen(false)}
        onConfirm={handleRun}
        loading={runAssignment.isPending}
        title="Lancer la distribution"
        description="Cette action remplacera toutes les affectations automatiques existantes. Continuer ?"
        confirmLabel="Lancer"
        variant="primary"
      />

      <ConfirmDialog
        open={confirmStatus === 'ACTIVE'}
        onClose={() => setConfirmStatus(null)}
        onConfirm={() => handleStatusChange('ACTIVE')}
        loading={updateExam.isPending}
        title="Valider la distribution"
        description="L'examen passera en statut En cours. Vous pourrez toujours modifier des affectations individuelles."
        confirmLabel="Valider"
        variant="primary"
      />

      <ConfirmDialog
        open={confirmStatus === 'VALIDATED'}
        onClose={() => setConfirmStatus(null)}
        onConfirm={() => handleStatusChange('VALIDATED')}
        loading={updateExam.isPending}
        title="Clôturer l'examen"
        description="L'examen sera archivé. Cette action est irréversible."
        confirmLabel="Clôturer"
      />
    </div>
  )
}
