import { useState } from 'react'
import { Plus, Pencil, Trash2, ChevronDown, ChevronRight, X, Copy } from 'lucide-react'
import type { Filiere, FiliereSubject } from '../../types'
import {
  useFilieres,
  useCreateFiliere,
  useUpdateFiliere,
  useDeleteFiliere,
  useAddFiliereSubject,
  useRemoveFiliereSubject,
  useCopyFiliereSubjects,
  useSubjects,
} from '../../hooks/useCenter'
import { useToast } from '../../hooks/useToast'
import { PageHeader } from '../../components/ui/PageHeader'
import { Button } from '../../components/ui/Button'
import { Input } from '../../components/ui/Input'
import { Select } from '../../components/ui/Select'
import { Modal } from '../../components/ui/Modal'
import { ConfirmDialog } from '../../components/ui/ConfirmDialog'
import { Badge } from '../../components/ui/Badge'
import { EmptyState } from '../../components/ui/EmptyState'
import { Spinner } from '../../components/ui/Spinner'
import { cn } from '../../lib/utils'

function FiliereFormModal({ open, onClose, editing }: {
  open: boolean
  onClose: () => void
  editing?: Filiere | null
}) {
  const createFiliere = useCreateFiliere()
  const updateFiliere = useUpdateFiliere()
  const toast = useToast()

  const [nameFr, setNameFr] = useState(editing?.name_fr ?? '')
  const [candType, setCandType] = useState<'OFFICIEL' | 'LIBRE'>(
    (editing?.candidate_type as 'OFFICIEL' | 'LIBRE') ?? 'OFFICIEL'
  )
  const [initialized, setInitialized] = useState(false)

  if (editing && !initialized) {
    setNameFr(editing.name_fr)
    setCandType((editing.candidate_type as 'OFFICIEL' | 'LIBRE') ?? 'OFFICIEL')
    setInitialized(true)
  }

  const handleClose = () => { setInitialized(false); setNameFr(''); setCandType('OFFICIEL'); onClose() }

  const handleSave = () => {
    const payload = { name_fr: nameFr.trim(), candidate_type: candType }
    if (editing) {
      updateFiliere.mutate({ id: editing.id, data: payload }, {
        onSuccess: () => { handleClose(); toast.success('Filière modifiée') },
        onError: () => toast.error('Erreur'),
      })
    } else {
      createFiliere.mutate(payload, {
        onSuccess: () => { handleClose(); toast.success('Filière créée') },
        onError: () => toast.error('Erreur'),
      })
    }
  }

  return (
    <Modal open={open} onClose={handleClose} title={editing ? 'Modifier la filière' : 'Nouvelle filière'} size="sm">
      <div className="flex flex-col gap-4">
        <Input label="Nom de la filière" value={nameFr} onChange={e => setNameFr(e.target.value)} autoFocus />
        <Select
          label="Type de candidats"
          value={candType}
          options={[{ value: 'OFFICIEL', label: 'Officiel' }, { value: 'LIBRE', label: 'Libre' }]}
          onChange={e => setCandType(e.target.value as 'OFFICIEL' | 'LIBRE')}
        />
        <div className="flex justify-end gap-2 mt-1">
          <Button variant="secondary" onClick={handleClose}>Annuler</Button>
          <Button
            variant="primary"
            onClick={handleSave}
            loading={createFiliere.isPending || updateFiliere.isPending}
            disabled={!nameFr.trim()}
          >
            {editing ? 'Modifier' : 'Créer'}
          </Button>
        </div>
      </div>
    </Modal>
  )
}

function CopySubjectsModal({ open, onClose, filiere, allFilieres }: {
  open: boolean
  onClose: () => void
  filiere: Filiere
  allFilieres: Filiere[]
}) {
  const copySubjects = useCopyFiliereSubjects()
  const toast = useToast()
  const [sourceId, setSourceId] = useState('')

  const options = allFilieres
    .filter(f => f.id !== filiere.id)
    .map(f => ({ value: f.id, label: f.name_fr }))

  const handleClose = () => { setSourceId(''); onClose() }

  const handleCopy = () => {
    copySubjects.mutate({ targetId: filiere.id, sourceId: Number(sourceId) }, {
      onSuccess: ({ added }) => {
        toast.success(added > 0 ? `${added} matière${added > 1 ? 's' : ''} ajoutée${added > 1 ? 's' : ''}` : 'Aucune nouvelle matière à ajouter')
        handleClose()
      },
      onError: () => toast.error('Erreur lors de la copie'),
    })
  }

  return (
    <Modal open={open} onClose={handleClose} title={`Copier les matières vers "${filiere.name_fr}"`} size="sm">
      <div className="flex flex-col gap-4">
        <p className="text-sm text-slate-500">
          Les matières de la filière source seront ajoutées à <strong>{filiere.name_fr}</strong>. Les matières déjà assignées ne seront pas dupliquées.
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
          <Button variant="primary" onClick={handleCopy} loading={copySubjects.isPending} disabled={!sourceId}>
            Copier
          </Button>
        </div>
      </div>
    </Modal>
  )
}

function SubjectManager({ filiere, allFilieres }: { filiere: Filiere; allFilieres: Filiere[] }) {
  const { data: allSubjects = [] } = useSubjects()
  const addSubject = useAddFiliereSubject()
  const removeSubject = useRemoveFiliereSubject()
  const toast = useToast()
  const [copyOpen, setCopyOpen] = useState(false)

  const assignedIds = new Set(filiere.filiere_subjects.map(fs => fs.subject_id))

  const handleAdd = (subjectId: number) => {
    addSubject.mutate({ filiereId: filiere.id, subject_id: subjectId }, {
      onError: () => toast.error('Erreur'),
    })
  }

  const handleRemove = (fs: FiliereSubject) => {
    removeSubject.mutate(fs.id, {
      onError: () => toast.error('Erreur'),
    })
  }

  const unassigned = allSubjects.filter(s => !assignedIds.has(s.id))

  return (
    <div className="mt-3 space-y-3">
      <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Matières assignées</p>

      {filiere.filiere_subjects.length === 0 ? (
        <p className="text-xs text-slate-400">Aucune matière assignée.</p>
      ) : (
        <div className="flex flex-wrap gap-2">
          {filiere.filiere_subjects.map(fs => {
            const subject = allSubjects.find(s => s.id === fs.subject_id)
            return (
              <span
                key={fs.id}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium bg-indigo-100 text-indigo-700 ring-1 ring-indigo-300"
              >
                {subject?.name_fr ?? `Matière #${fs.subject_id}`}
                <button
                  onClick={() => handleRemove(fs)}
                  className="hover:text-indigo-900 transition-colors ml-0.5"
                >
                  <X size={11} />
                </button>
              </span>
            )
          })}
        </div>
      )}

      <div className="flex items-center gap-2">
        {unassigned.length > 0 && (
          <select
            className="h-8 text-xs rounded-md border border-slate-200 bg-white text-slate-700 px-2 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400"
            defaultValue=""
            onChange={e => {
              if (e.target.value) { handleAdd(Number(e.target.value)); e.target.value = '' }
            }}
          >
            <option value="">+ Ajouter une matière…</option>
            {unassigned.map(s => <option key={s.id} value={s.id}>{s.name_fr}</option>)}
          </select>
        )}
        {allFilieres.length > 1 && (
          <button
            title="Copier les matières d'une autre filière"
            onClick={() => setCopyOpen(true)}
            className="flex items-center gap-1.5 h-8 px-2.5 text-xs rounded-md border border-slate-200 bg-white text-slate-500 hover:text-indigo-600 hover:border-indigo-300 transition-colors"
          >
            <Copy size={11} /> Copier depuis…
          </button>
        )}
      </div>

      <CopySubjectsModal
        open={copyOpen}
        onClose={() => setCopyOpen(false)}
        filiere={filiere}
        allFilieres={allFilieres}
      />
    </div>
  )
}

function FiliereCard({ filiere, allFilieres, onEdit, onDelete }: {
  filiere: Filiere
  allFilieres: Filiere[]
  onEdit: () => void
  onDelete: () => void
}) {
  const [expanded, setExpanded] = useState(false)

  return (
    <div className={cn(
      'bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden transition-all',
      expanded && 'border-l-4 border-l-indigo-500',
    )}>
      <div
        className="flex items-center gap-3 px-5 py-4 cursor-pointer hover:bg-slate-50 transition-colors"
        onClick={() => setExpanded(v => !v)}
      >
        {expanded
          ? <ChevronDown size={15} className="text-indigo-400 shrink-0" />
          : <ChevronRight size={15} className="text-slate-400 shrink-0" />
        }
        <div className="flex-1 min-w-0">
          <div className="font-display font-semibold text-slate-900 text-sm">{filiere.name_fr}</div>
          <div className="text-xs text-slate-400 mt-0.5">
            {filiere.filiere_subjects.length} matière{filiere.filiere_subjects.length !== 1 ? 's' : ''}
          </div>
        </div>
        <Badge variant={filiere.candidate_type === 'LIBRE' ? 'warning' : 'primary'}>
          {filiere.candidate_type === 'LIBRE' ? 'Libre' : 'Officiel'}
        </Badge>
        <div className="flex gap-1" onClick={e => e.stopPropagation()}>
          <Button variant="ghost" size="sm" icon={<Pencil size={13} />} onClick={onEdit} />
          <Button variant="ghost" size="sm" icon={<Trash2 size={13} />} className="text-rose-500" onClick={onDelete} />
        </div>
      </div>

      {expanded && (
        <div className="px-5 pb-4 border-t border-slate-100">
          <SubjectManager filiere={filiere} allFilieres={allFilieres} />
        </div>
      )}
    </div>
  )
}

export default function FilieresGlobalPage() {
  const { data: filieres = [], isLoading } = useFilieres()
  const deleteFiliere = useDeleteFiliere()
  const toast = useToast()

  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState<Filiere | null>(null)
  const [deleting, setDeleting] = useState<Filiere | null>(null)

  const handleDelete = () => {
    if (!deleting) return
    deleteFiliere.mutate(deleting.id, {
      onSuccess: () => { setDeleting(null); toast.success('Filière supprimée') },
      onError: (err: unknown) => {
        const msg = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail
        toast.error(msg ?? 'Erreur lors de la suppression')
      },
    })
  }

  return (
    <div className="p-8">
      <PageHeader
        title="Catalogue des filières"
        subtitle="Définissez les filières et leurs matières. Elles seront disponibles dans tous les examens."
        action={
          <Button variant="primary" icon={<Plus size={14} />} onClick={() => { setEditing(null); setModalOpen(true) }}>
            Nouvelle filière
          </Button>
        }
      />

      {isLoading ? (
        <div className="flex justify-center py-16"><Spinner size={24} className="text-indigo-500" /></div>
      ) : filieres.length === 0 ? (
        <EmptyState
          message="Aucune filière créée. Créez les filières de votre établissement."
          action={
            <Button variant="primary" size="sm" icon={<Plus size={13} />} onClick={() => setModalOpen(true)}>
              Nouvelle filière
            </Button>
          }
        />
      ) : (
        <div className="flex flex-col gap-3">
          {filieres.map(f => (
            <FiliereCard
              key={f.id}
              filiere={f}
              allFilieres={filieres}
              onEdit={() => { setEditing(f); setModalOpen(true) }}
              onDelete={() => setDeleting(f)}
            />
          ))}
        </div>
      )}

      <FiliereFormModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        editing={editing}
      />

      <ConfirmDialog
        open={!!deleting}
        onClose={() => setDeleting(null)}
        onConfirm={handleDelete}
        loading={deleteFiliere.isPending}
        title="Supprimer la filière"
        description={`Supprimer "${deleting?.name_fr}" du catalogue ? Elle sera retirée de tous les examens.`}
        confirmLabel="Supprimer"
      />
    </div>
  )
}
