import { useState } from 'react'
import { Plus, Trash2 } from 'lucide-react'
import type { TeacherExemption, ExemptionTypeEnum } from '../../../types'
import { useActiveExam } from '../../../context/ActiveExamContext'
import { useExam, useUpdateExam, useExamSlots, useExamFilieres } from '../../../hooks/useExam'
import { useFilieres } from '../../../hooks/useCenter'
import { useExamTeachers, useExemptions, useCreateExemption, useDeleteExemption } from '../../../hooks/useAssignment'
import { useToast } from '../../../hooks/useToast'
import { PageHeader } from '../../../components/ui/PageHeader'
import { Button } from '../../../components/ui/Button'
import { Input } from '../../../components/ui/Input'   // kept for max_reserves field
import { Select } from '../../../components/ui/Select'
import { Modal } from '../../../components/ui/Modal'
import { ConfirmDialog } from '../../../components/ui/ConfirmDialog'
import { Table } from '../../../components/ui/Table'
import type { Column } from '../../../components/ui/Table'
import { Badge } from '../../../components/ui/Badge'

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
      <div className="bg-slate-50 border-b border-slate-200 px-6 py-4">
        <h2 className="font-display font-semibold text-slate-800 text-base">{title}</h2>
      </div>
      <div className="px-6 py-5">{children}</div>
    </div>
  )
}

const TYPE_OPTIONS = [
  { value: 'SLOT',  label: 'Séance spécifique'  },
  { value: 'SHIFT', label: 'Demi-journée entière' },
  { value: 'DAY',   label: 'Journée entière'      },
]

const SHIFT_OPTIONS = [
  { value: 'MORNING',   label: 'Matinée'     },
  { value: 'AFTERNOON', label: 'Après-midi'  },
]

function slotLabel(slot: { day: number; shift: string; slot_order: number; filiere_name?: string }): string {
  const shift = slot.shift === 'MORNING' ? 'Matinée' : 'Après-midi'
  return `Jour ${slot.day} — Séance ${slot.slot_order} ${shift}${slot.filiere_name ? ` (${slot.filiere_name})` : ''}`
}

function ExemptionModal({ open, onClose, examId }: { open: boolean; onClose: () => void; examId: number }) {
  const { data: exam }            = useExam(examId)
  const { data: teachers = [] }   = useExamTeachers(examId)
  const { data: slots = [] }      = useExamSlots(examId)
  const { data: examFilieres = [] } = useExamFilieres(examId)
  const { data: filieres = [] }   = useFilieres()
  const createEx = useCreateExemption()
  const toast    = useToast()

  const [teacherId, setTeacherId] = useState('')
  const [type, setType]           = useState<ExemptionTypeEnum>('DAY')
  const [refValue, setRefValue]   = useState('')

  // Reset ref value when type changes
  const handleTypeChange = (t: string) => {
    setType(t as ExemptionTypeEnum)
    setRefValue('')
  }

  // Build filière name lookup
  const filiereMap = Object.fromEntries(filieres.map(f => [f.id, f.name_fr]))
  const efMap      = Object.fromEntries(examFilieres.map(ef => [ef.id, filiereMap[ef.filiere_id] ?? '']))

  // Active slots sorted
  const activeSlots = [...slots.filter(s => s.is_active)].sort((a, b) =>
    a.day !== b.day ? a.day - b.day : a.shift.localeCompare(b.shift) || a.slot_order - b.slot_order
  )

  // Days derived from exam dates
  const days: number[] = []
  if (exam) {
    const start = new Date(exam.start_date)
    const end   = new Date(exam.end_date)
    let d = 1
    const cur = new Date(start)
    while (cur <= end) { days.push(d++); cur.setDate(cur.getDate() + 1) }
  }

  const handleSave = () => {
    createEx.mutate(
      { teacher_id: Number(teacherId), exam_id: examId, exemption_type: type, ref_value: refValue },
      {
        onSuccess: () => { onClose(); setTeacherId(''); setType('DAY'); setRefValue(''); toast.success('Exemption ajoutée') },
        onError:   () => toast.error('Erreur'),
      },
    )
  }

  const refValid = refValue !== ''

  return (
    <Modal open={open} onClose={onClose} title="Nouvelle exemption" size="sm">
      <div className="flex flex-col gap-4">
        <Select
          label="Surveillant"
          placeholder="— sélectionnez —"
          value={teacherId}
          options={teachers.map(t => ({ value: t.id, label: t.name_fr }))}
          onChange={e => setTeacherId(e.target.value)}
        />
        <Select
          label="Type d'exemption"
          value={type}
          options={TYPE_OPTIONS}
          onChange={e => handleTypeChange(e.target.value)}
        />

        {type === 'DAY' && (
          <Select
            label="Journée"
            placeholder="— choisir un jour —"
            value={refValue}
            options={days.map(d => ({ value: String(d), label: `Jour ${d}` }))}
            onChange={e => setRefValue(e.target.value)}
          />
        )}

        {type === 'SHIFT' && (
          <Select
            label="Demi-journée"
            placeholder="— choisir —"
            value={refValue}
            options={SHIFT_OPTIONS}
            onChange={e => setRefValue(e.target.value)}
          />
        )}

        {type === 'SLOT' && (
          <Select
            label="Séance"
            placeholder="— choisir une séance —"
            value={refValue}
            options={activeSlots.map(s => ({
              value: String(s.id),
              label: slotLabel({ ...s, filiere_name: efMap[s.exam_filiere_id] }),
            }))}
            onChange={e => setRefValue(e.target.value)}
          />
        )}

        <div className="flex justify-end gap-2 mt-1">
          <Button variant="secondary" onClick={onClose}>Annuler</Button>
          <Button variant="primary" onClick={handleSave} loading={createEx.isPending} disabled={!teacherId || !refValid}>
            Ajouter
          </Button>
        </div>
      </div>
    </Modal>
  )
}

const TYPE_BADGE: Record<string, 'default' | 'warning' | 'danger'> = {
  SLOT: 'default', SHIFT: 'warning', DAY: 'danger',
}
const TYPE_LABELS: Record<string, string> = { SLOT: 'Séance', SHIFT: 'Demi-journée', DAY: 'Journée' }

export default function ConfigPage() {
  const { examId }  = useActiveExam()
  const { data: exam } = useExam(examId)
  const { data: exemptions = [], isLoading: exLoading } = useExemptions(examId)
  const { data: teachers = [] } = useExamTeachers(examId)
  const { data: slots = [] }    = useExamSlots(examId)
  const { data: examFilieres = [] } = useExamFilieres(examId)
  const { data: filieres = [] } = useFilieres()
  const deleteEx   = useDeleteExemption(examId)
  const updateExam = useUpdateExam()
  const toast      = useToast()

  const [exModalOpen, setExModalOpen] = useState(false)
  const [deleting, setDeleting]       = useState<TeacherExemption | null>(null)
  const [maxReserves, setMaxReserves] = useState<number | null>(null)

  if (exam && maxReserves === null) setMaxReserves(exam.max_reserves)

  const teacherMap  = Object.fromEntries(teachers.map(t => [t.id, t.name_fr]))
  const filiereMap  = Object.fromEntries(filieres.map(f => [f.id, f.name_fr]))
  const efMap       = Object.fromEntries(examFilieres.map(ef => [ef.id, filiereMap[ef.filiere_id] ?? '']))
  const slotMap     = Object.fromEntries(slots.map(s => [s.id, s]))

  function refValueLabel(ex: TeacherExemption): string {
    if (ex.exemption_type === 'SHIFT') {
      return ex.ref_value === 'MORNING' ? 'Matinée' : 'Après-midi'
    }
    if (ex.exemption_type === 'DAY') {
      return `Jour ${ex.ref_value}`
    }
    // SLOT
    const s = slotMap[Number(ex.ref_value)]
    if (!s) return `Séance #${ex.ref_value}`
    return slotLabel({ ...s, filiere_name: efMap[s.exam_filiere_id] })
  }

  const columns: Column<TeacherExemption>[] = [
    { key: 'teacher', label: 'Surveillant', render: ex => teacherMap[ex.teacher_id] ?? `#${ex.teacher_id}` },
    {
      key: 'exemption_type', label: 'Type',
      render: ex => <Badge variant={TYPE_BADGE[ex.exemption_type] ?? 'default'}>{TYPE_LABELS[ex.exemption_type] ?? ex.exemption_type}</Badge>,
    },
    { key: 'ref_value', label: 'Valeur', render: ex => <span className="text-sm text-slate-700">{refValueLabel(ex)}</span> },
    {
      key: 'actions', label: '', width: '60px',
      render: ex => (
        <Button variant="ghost" size="sm" icon={<Trash2 size={13} />} className="text-rose-500" onClick={() => setDeleting(ex)} />
      ),
    },
  ]

  const handleSaveReserves = () => {
    if (maxReserves === null) return
    updateExam.mutate(
      { id: examId, data: { max_reserves: maxReserves } },
      { onSuccess: () => toast.success('Mis à jour'), onError: () => toast.error('Erreur') },
    )
  }

  return (
    <div className="p-8">
      <PageHeader title="Configuration" subtitle="Exemptions et paramètres avant distribution" />

      <div className="grid lg:grid-cols-5 gap-6">
        {/* Exemptions — 3/5 */}
        <div className="lg:col-span-3">
          <Card title="Exemptions">
            <div className="flex justify-end mb-3">
              <Button variant="primary" size="sm" icon={<Plus size={13} />} onClick={() => setExModalOpen(true)}>
                Ajouter une exemption
              </Button>
            </div>
            <Table columns={columns} data={exemptions} loading={exLoading} rowKey={ex => ex.id} emptyMessage="Aucune exemption" />
          </Card>
        </div>

        {/* Réservistes — 2/5 */}
        <div className="lg:col-span-2">
          <Card title="Réservistes">
            <p className="text-sm text-slate-500 mb-4">Nombre maximum de surveillants réservistes convoqués par séance.</p>
            <Input
              label="Réservistes max"
              type="number"
              value={maxReserves ?? ''}
              onChange={e => setMaxReserves(Number(e.target.value))}
              min={0}
              max={20}
            />
            <div className="mt-3">
              <Button variant="primary" onClick={handleSaveReserves} loading={updateExam.isPending}>
                Enregistrer
              </Button>
            </div>
          </Card>
        </div>
      </div>

      <ExemptionModal open={exModalOpen} onClose={() => setExModalOpen(false)} examId={examId} />

      <ConfirmDialog
        open={!!deleting}
        onClose={() => setDeleting(null)}
        onConfirm={() => {
          if (!deleting) return
          deleteEx.mutate(deleting.id, {
            onSuccess: () => { setDeleting(null); toast.success('Exemption supprimée') },
            onError:   () => toast.error('Erreur'),
          })
        }}
        loading={deleteEx.isPending}
        title="Supprimer l'exemption"
        description="Confirmer la suppression de cette exemption ?"
        confirmLabel="Supprimer"
      />
    </div>
  )
}
