import { useState } from 'react'
import type { LevelEnum } from '../../types'
import { useCreateExam } from '../../hooks/useExam'
import { useToast } from '../../hooks/useToast'
import { Modal } from '../../components/ui/Modal'
import { Input } from '../../components/ui/Input'
import { Select } from '../../components/ui/Select'
import { Button } from '../../components/ui/Button'

interface Props {
  open: boolean
  onClose: () => void
  onCreated?: (examId: number) => void
}

const LEVEL_OPTIONS = [
  { value: 'BAC1',            label: '1ère Bac' },
  { value: 'BAC2_NORMALE',    label: '2ème Bac — Session normale' },
  { value: 'BAC2_RATTRAPAGE', label: '2ème Bac — Rattrapage' },
]

const INITIAL = {
  year: '',
  name_fr: '',
  level: 'BAC1' as LevelEnum,
  start_date: '',
  end_date: '',
  supervisor_arrival_delay: 30,
  student_arrival_delay: 15,
  supervisors_per_room: 2,
  max_reserves: 4,
}

export function CreateExamModal({ open, onClose, onCreated }: Props) {
  const createExam = useCreateExam()
  const toast      = useToast()
  const [form, setForm] = useState(INITIAL)

  const set = <K extends keyof typeof INITIAL>(key: K, value: typeof INITIAL[K]) =>
    setForm(prev => ({ ...prev, [key]: value }))

  const handleSubmit = () => {
    createExam.mutate({ ...form, name_ar: '' }, {
      onSuccess: exam => {
        toast.success('Examen créé')
        setForm(INITIAL)
        onCreated?.(exam.id)
        onClose()
      },
      onError: () => toast.error('Erreur lors de la création'),
    })
  }

  const valid = form.year.trim() && form.name_fr.trim() && form.start_date && form.end_date &&
    form.start_date <= form.end_date

  return (
    <Modal open={open} onClose={onClose} title="Créer un examen" size="md">
      <div className="flex flex-col gap-5">
        <div className="grid grid-cols-2 gap-4">
          <Input
            label="Année scolaire"
            value={form.year}
            onChange={e => set('year', e.target.value)}
            placeholder="2024-2025"
            autoFocus
          />
          <Select
            label="Session"
            value={form.level}
            options={LEVEL_OPTIONS}
            onChange={e => set('level', e.target.value as LevelEnum)}
          />
        </div>
        <Input
          label="Nom de la session"
          value={form.name_fr}
          onChange={e => set('name_fr', e.target.value)}
          placeholder="Ex : Baccalauréat session juin 2025"
        />

        <hr className="border-slate-100" />
        <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider -mb-2">Période</p>

        <div className="grid grid-cols-2 gap-4">
          <Input
            label="Date de début"
            type="date"
            value={form.start_date}
            onChange={e => set('start_date', e.target.value)}
          />
          <Input
            label="Date de fin"
            type="date"
            value={form.end_date}
            onChange={e => set('end_date', e.target.value)}
          />
        </div>

        <hr className="border-slate-100" />
        <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider -mb-2">Paramètres</p>

        <div className="grid grid-cols-2 gap-4">
          <Input
            label="Présence surveillants avant (min)"
            type="number"
            value={form.supervisor_arrival_delay}
            onChange={e => set('supervisor_arrival_delay', Number(e.target.value))}
            min={0}
          />
          <Input
            label="Présence candidats avant (min)"
            type="number"
            value={form.student_arrival_delay}
            onChange={e => set('student_arrival_delay', Number(e.target.value))}
            min={0}
          />
          <Input
            label="Surveillants par salle"
            type="number"
            value={form.supervisors_per_room}
            onChange={e => set('supervisors_per_room', Number(e.target.value))}
            min={1}
            max={4}
          />
          <Input
            label="Réservistes max"
            type="number"
            value={form.max_reserves}
            onChange={e => set('max_reserves', Number(e.target.value))}
            min={0}
          />
        </div>

        <div className="flex justify-end gap-2 pt-1">
          <Button variant="secondary" onClick={onClose}>Annuler</Button>
          <Button
            variant="primary"
            onClick={handleSubmit}
            loading={createExam.isPending}
            disabled={!valid}
          >
            Créer l'examen
          </Button>
        </div>
      </div>
    </Modal>
  )
}
