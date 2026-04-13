import { useState } from 'react'
import { Plus, Pencil, Trash2 } from 'lucide-react'
import type { ExamFiliere, Filiere } from '../../../types'
import { useActiveExam } from '../../../context/ActiveExamContext'
import { useExamFilieres, useEnrollFiliere, useUpdateExamFiliere, useRemoveExamFiliere } from '../../../hooks/useExam'
import { useFilieres } from '../../../hooks/useCenter'
import { useToast } from '../../../hooks/useToast'
import { PageHeader } from '../../../components/ui/PageHeader'
import { Button } from '../../../components/ui/Button'
import { Input } from '../../../components/ui/Input'
import { Select } from '../../../components/ui/Select'
import { Modal } from '../../../components/ui/Modal'
import { ConfirmDialog } from '../../../components/ui/ConfirmDialog'
import { Badge } from '../../../components/ui/Badge'
import { EmptyState } from '../../../components/ui/EmptyState'
import { Spinner } from '../../../components/ui/Spinner'

function EnrollModal({ open, onClose, examId, filieres, enrolled }: {
  open: boolean
  onClose: () => void
  examId: number
  filieres: Filiere[]
  enrolled: ExamFiliere[]
}) {
  const enrollFiliere = useEnrollFiliere()
  const toast = useToast()

  const enrolledIds = new Set(enrolled.map(ef => ef.filiere_id))
  const available = filieres.filter(f => !enrolledIds.has(f.id))

  const [filiereId, setFiliereId] = useState('')
  const [roomCount, setRoomCount] = useState('1')

  const handleClose = () => {
    setFiliereId('')
    setRoomCount('1')
    onClose()
  }

  const handleSave = () => {
    enrollFiliere.mutate(
      { exam_id: examId, filiere_id: Number(filiereId), room_count: Number(roomCount) },
      {
        onSuccess: () => { handleClose(); toast.success('Filière ajoutée à l\'examen') },
        onError: () => toast.error('Erreur lors de l\'ajout'),
      },
    )
  }

  return (
    <Modal open={open} onClose={handleClose} title="Ajouter une filière" size="sm">
      <div className="flex flex-col gap-4">
        {available.length === 0 ? (
          <p className="text-sm text-slate-500">
            Toutes les filières disponibles sont déjà inscrites.
            Créez d'abord des filières dans le catalogue global (menu Filières).
          </p>
        ) : (
          <>
            <Select
              label="Filière"
              placeholder="— sélectionner —"
              value={filiereId}
              options={available.map(f => ({
                value: f.id,
                label: `${f.name_fr} (${f.candidate_type === 'LIBRE' ? 'Libre' : 'Officiel'})`,
              }))}
              onChange={e => setFiliereId(e.target.value)}
            />
            <Input
              label="Nombre de salles"
              type="number"
              value={roomCount}
              onChange={e => setRoomCount(e.target.value)}
              min={1}
            />
          </>
        )}
        <div className="flex justify-end gap-2 mt-1">
          <Button variant="secondary" onClick={handleClose}>Annuler</Button>
          {available.length > 0 && (
            <Button
              variant="primary"
              onClick={handleSave}
              loading={enrollFiliere.isPending}
              disabled={!filiereId || !roomCount}
            >
              Ajouter
            </Button>
          )}
        </div>
      </div>
    </Modal>
  )
}

function EditRoomModal({ open, onClose, examFiliere, filiereMap }: {
  open: boolean
  onClose: () => void
  examFiliere: ExamFiliere
  filiereMap: Record<number, Filiere>
}) {
  const updateEF = useUpdateExamFiliere()
  const toast = useToast()
  const [roomCount, setRoomCount] = useState(examFiliere.room_count.toString())

  const filiere = filiereMap[examFiliere.filiere_id]

  const handleSave = () => {
    updateEF.mutate(
      { id: examFiliere.id, data: { room_count: Number(roomCount) }, examId: examFiliere.exam_id },
      {
        onSuccess: () => { onClose(); toast.success('Nombre de salles modifié') },
        onError: () => toast.error('Erreur'),
      },
    )
  }

  return (
    <Modal open={open} onClose={onClose} title={`Modifier — ${filiere?.name_fr ?? ''}`} size="sm">
      <div className="flex flex-col gap-4">
        <Input
          label="Nombre de salles"
          type="number"
          value={roomCount}
          onChange={e => setRoomCount(e.target.value)}
          min={1}
        />
        <div className="flex justify-end gap-2 mt-1">
          <Button variant="secondary" onClick={onClose}>Annuler</Button>
          <Button variant="primary" onClick={handleSave} loading={updateEF.isPending}>
            Modifier
          </Button>
        </div>
      </div>
    </Modal>
  )
}

export default function BranchesPage() {
  const { examId } = useActiveExam()
  const { data: examFilieres = [], isLoading: efLoading } = useExamFilieres(examId)
  const { data: filieres = [], isLoading: fLoading } = useFilieres()
  const removeEF = useRemoveExamFiliere()
  const toast = useToast()

  const [enrollOpen, setEnrollOpen] = useState(false)
  const [editing, setEditing] = useState<ExamFiliere | null>(null)
  const [deleting, setDeleting] = useState<ExamFiliere | null>(null)

  const filiereMap = Object.fromEntries(filieres.map(f => [f.id, f]))
  const isLoading = efLoading || fLoading

  const handleDelete = () => {
    if (!deleting) return
    removeEF.mutate({ id: deleting.id, examId }, {
      onSuccess: () => { setDeleting(null); toast.success('Filière retirée de l\'examen') },
      onError: () => toast.error('Erreur lors de la suppression'),
    })
  }

  return (
    <div className="p-8">
      <PageHeader
        title="Filières de l'examen"
        subtitle="Inscrivez les filières qui passent cet examen et définissez le nombre de salles"
        action={
          <Button variant="primary" icon={<Plus size={14} />} onClick={() => setEnrollOpen(true)}>
            Ajouter une filière
          </Button>
        }
      />

      {isLoading ? (
        <div className="flex justify-center py-16"><Spinner size={24} className="text-indigo-500" /></div>
      ) : examFilieres.length === 0 ? (
        <EmptyState
          message="Aucune filière inscrite. Ajoutez les filières qui passent cet examen."
          action={
            <Button variant="primary" size="sm" icon={<Plus size={13} />} onClick={() => setEnrollOpen(true)}>
              Ajouter une filière
            </Button>
          }
        />
      ) : (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
          <table className="w-full border-collapse">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200">
                <th className="px-5 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Filière</th>
                <th className="px-5 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Type</th>
                <th className="px-5 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Salles</th>
                <th className="px-5 py-3 w-20" />
              </tr>
            </thead>
            <tbody>
              {examFilieres.map(ef => {
                const f = filiereMap[ef.filiere_id]
                return (
                  <tr key={ef.id} className="border-b border-slate-100 last:border-0 hover:bg-slate-50 transition-colors">
                    <td className="px-5 py-3 font-semibold text-sm text-slate-800">
                      {f?.name_fr ?? `Filière #${ef.filiere_id}`}
                    </td>
                    <td className="px-5 py-3">
                      <Badge variant={f?.candidate_type === 'LIBRE' ? 'warning' : 'primary'}>
                        {f?.candidate_type === 'LIBRE' ? 'Libre' : 'Officiel'}
                      </Badge>
                    </td>
                    <td className="px-5 py-3">
                      <Badge variant="default">{ef.room_count} salle{ef.room_count > 1 ? 's' : ''}</Badge>
                    </td>
                    <td className="px-5 py-3">
                      <div className="flex gap-1 justify-end">
                        <Button variant="ghost" size="sm" icon={<Pencil size={13} />} onClick={() => setEditing(ef)} />
                        <Button
                          variant="ghost"
                          size="sm"
                          icon={<Trash2 size={13} />}
                          className="text-rose-500"
                          onClick={() => setDeleting(ef)}
                        />
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      <EnrollModal
        open={enrollOpen}
        onClose={() => setEnrollOpen(false)}
        examId={examId}
        filieres={filieres}
        enrolled={examFilieres}
      />

      {editing && (
        <EditRoomModal
          open={!!editing}
          onClose={() => setEditing(null)}
          examFiliere={editing}
          filiereMap={filiereMap}
        />
      )}

      <ConfirmDialog
        open={!!deleting}
        onClose={() => setDeleting(null)}
        onConfirm={handleDelete}
        loading={removeEF.isPending}
        title="Retirer la filière"
        description={`Retirer "${filiereMap[deleting?.filiere_id ?? 0]?.name_fr ?? ''}" de cet examen ? Les créneaux associés seront supprimés.`}
        confirmLabel="Retirer"
      />
    </div>
  )
}
