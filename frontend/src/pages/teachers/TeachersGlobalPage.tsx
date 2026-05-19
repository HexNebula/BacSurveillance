import { useState } from 'react'
import { Download, Pencil, Plus, Trash2, Upload } from 'lucide-react'
import type { Teacher, GenderEnum } from '../../types'
import {
  useAllTeachers,
  useCreateTeacher,
  useBulkCreateTeachers,
  useUpdateTeacher,
  useDeleteTeacher,
} from '../../hooks/useAssignment'
import { useSubjects } from '../../hooks/useCenter'
import { useToast } from '../../hooks/useToast'
import { PageHeader } from '../../components/ui/PageHeader'
import { Button } from '../../components/ui/Button'
import { Input } from '../../components/ui/Input'
import { Select } from '../../components/ui/Select'
import { Modal } from '../../components/ui/Modal'
import { ConfirmDialog } from '../../components/ui/ConfirmDialog'
import { Badge } from '../../components/ui/Badge'
import { TeacherAvatar } from '../../components/ui/TeacherAvatar'

const INITIAL_FORM = {
  name_fr: '', gender: 'M' as GenderEnum,
  cin: '', som: '', school: '', subject_id: '',
}

function TeacherFormModal({ open, onClose, editing }: {
  open: boolean
  onClose: () => void
  editing?: Teacher | null
}) {
  const createTeacher = useCreateTeacher()
  const updateTeacher = useUpdateTeacher()
  const { data: subjects = [] } = useSubjects()
  const toast = useToast()

  const [form, setForm] = useState({ ...INITIAL_FORM })
  const [initialized, setInitialized] = useState(false)

  if (editing && !initialized) {
    setForm({
      name_fr: editing.name_fr,
      gender: editing.gender,
      cin: editing.cin,
      som: editing.som ?? '',
      school: editing.school ?? '',
      subject_id: editing.subject_id?.toString() ?? '',
    })
    setInitialized(true)
  }

  const set = <K extends keyof typeof INITIAL_FORM>(k: K, v: string) =>
    setForm(prev => ({ ...prev, [k]: v }))

  const handleClose = () => { setInitialized(false); setForm({ ...INITIAL_FORM }); onClose() }

  const handleSave = () => {
    const payload = {
      name_fr: form.name_fr.trim(),
      name_ar: '',
      gender: form.gender,
      cin: form.cin.trim(),
      som: form.som.trim() || null,
      school: form.school.trim() || null,
      subject_id: form.subject_id ? Number(form.subject_id) : null,
      ordinal: null,
    }
    if (editing) {
      updateTeacher.mutate({ id: editing.id, data: payload }, {
        onSuccess: () => { handleClose(); toast.success('Surveillant modifié') },
        onError: () => toast.error('Erreur (CIN déjà utilisé ?)'),
      })
    } else {
      createTeacher.mutate(payload, {
        onSuccess: () => { handleClose(); toast.success('Surveillant créé') },
        onError: () => toast.error('Erreur (CIN déjà existant ?)'),
      })
    }
  }

  return (
    <Modal
      open={open}
      onClose={handleClose}
      title={editing ? 'Modifier le surveillant' : 'Nouveau surveillant'}
      size="md"
    >
      <div className="flex flex-col gap-4">
        <Input label="Nom (français)" value={form.name_fr} onChange={e => set('name_fr', e.target.value)} autoFocus />
        <div className="grid grid-cols-3 gap-3">
          <Select
            label="Genre"
            value={form.gender}
            options={[{ value: 'M', label: 'Homme' }, { value: 'F', label: 'Femme' }]}
            onChange={e => set('gender', e.target.value)}
          />
          <Input label="CIN" value={form.cin} onChange={e => set('cin', e.target.value)} placeholder="AB123456" />
          <Input label="SOM" value={form.som} onChange={e => set('som', e.target.value)} placeholder="Code SOM" />
        </div>
        <div className="grid grid-cols-3 gap-3">
          <div className="col-span-2">
            <Input label="Établissement" value={form.school} onChange={e => set('school', e.target.value)} />
          </div>
          <Select
            label="Matière"
            value={form.subject_id}
            placeholder="— aucune —"
            options={subjects.map(s => ({ value: s.id, label: s.name_fr }))}
            onChange={e => set('subject_id', e.target.value)}
          />
        </div>
        <div className="flex justify-end gap-2 mt-1">
          <Button variant="secondary" onClick={handleClose}>Annuler</Button>
          <Button
            variant="primary"
            onClick={handleSave}
            loading={createTeacher.isPending || updateTeacher.isPending}
            disabled={!form.name_fr.trim() || !form.cin.trim()}
          >
            {editing ? 'Modifier' : 'Créer'}
          </Button>
        </div>
      </div>
    </Modal>
  )
}

function ExcelImportPanel() {
  const bulkCreate = useBulkCreateTeachers()
  const toast = useToast()
  const [file, setFile] = useState<File | null>(null)

  const handleImport = async () => {
    if (!file) return
    try {
      // Parse CSV: nom_fr,genre,cin,som,etablissement,ordinal
      const text = await file.text()
      const lines = text.split('\n').map(l => l.trim()).filter(Boolean)
      if (lines.length < 2) { toast.error('Fichier vide ou sans données'); return }
      const headers = lines[0].split(',').map(h => h.trim().toLowerCase())
      const idx = (key: string) => headers.indexOf(key)
      const teachers = lines.slice(1).map(line => {
        const cols = line.split(',').map(c => c.trim().replace(/^"|"$/g, ''))
        const get = (key: string) => cols[idx(key)] ?? ''
        const genderRaw = get('genre').toUpperCase()
        return {
          name_fr: get('nom_fr') || get('nom'),
          name_ar: '',
          gender: (['M', 'F'].includes(genderRaw) ? genderRaw : 'M') as GenderEnum,
          cin: get('cin'),
          som: get('som') || null,
          school: get('etablissement') || null,
          subject_id: null as number | null,
          ordinal: get('ordinal') ? Number(get('ordinal')) : null,
        }
      }).filter(t => t.name_fr && t.cin)
      if (teachers.length === 0) { toast.error('Aucune ligne valide trouvée'); return }
      bulkCreate.mutate(teachers, {
        onSuccess: res => { toast.success(`${res.length} surveillant(s) importé(s)`); setFile(null) },
        onError: () => toast.error('Erreur lors de l\'import (CIN en double ?)'),
      })
    } catch {
      toast.error('Erreur lors de la lecture du fichier')
    }
  }

  return (
    <div className="mb-5 flex flex-wrap items-center gap-4 rounded-lg border border-slate-200 bg-white px-4 py-3 shadow-sm">
      <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-slate-100 text-slate-400">
        <Upload size={20} />
      </div>
      <div className="min-w-0 flex-1">
        <h3 className="text-sm font-semibold text-slate-800">Importer via Excel</h3>
        <p className="text-xs text-slate-400">CSV : nom_fr, genre, cin, som, etablissement, ordinal</p>
        {file && <p className="mt-1 text-xs text-slate-500">Fichier : <strong>{file.name}</strong></p>}
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <a
          href="/teacher-template.xlsx"
          download
          className="inline-flex items-center gap-1.5 text-xs text-indigo-600 hover:text-indigo-700 font-medium"
        >
          <Download size={13} /> Télécharger le modèle
        </a>
        <input type="file" accept=".csv" id="excel-upload-global" className="hidden" onChange={e => setFile(e.target.files?.[0] ?? null)} />
        <label htmlFor="excel-upload-global" className="inline-flex items-center h-8 px-3 text-xs font-medium text-slate-700 bg-white border border-slate-200 rounded-lg cursor-pointer hover:bg-slate-50 transition-colors">
          Choisir un fichier
        </label>
        {file && (
          <Button variant="primary" size="sm" loading={bulkCreate.isPending} onClick={handleImport}>
            Importer
          </Button>
        )}
      </div>
    </div>
  )
}

function TeacherListItem({
  teacher,
  subjectName,
  onEdit,
  onDelete,
}: {
  teacher: Teacher
  subjectName: string
  onEdit: () => void
  onDelete: () => void
}) {
  return (
    <div className="grid grid-cols-[minmax(240px,1.5fr)_minmax(160px,1fr)_minmax(180px,1fr)_96px_72px] items-center gap-4 border-b border-slate-100 px-4 py-3 last:border-b-0 hover:bg-slate-50/70">
      <div className="flex min-w-0 items-center gap-3">
        <TeacherAvatar gender={teacher.gender} size="sm" />
        <div className="min-w-0">
          <div className="truncate text-sm font-semibold text-slate-900">{teacher.name_fr}</div>
          <div className="font-mono text-xs text-slate-400">{teacher.cin}</div>
        </div>
      </div>

      <div className="min-w-0">
        <div className="truncate text-sm text-slate-700">{subjectName}</div>
        <div className="text-xs text-slate-400">Matière</div>
      </div>

      <div className="min-w-0">
        <div className="truncate text-sm text-slate-700">{teacher.school ?? '—'}</div>
        <div className="text-xs text-slate-400">Établissement</div>
      </div>

      <Badge variant={teacher.gender === 'F' ? 'danger' : 'primary'}>
        {teacher.gender === 'M' ? 'Homme' : 'Femme'}
      </Badge>

      <div className="flex justify-end gap-1">
        <Button variant="ghost" size="sm" icon={<Pencil size={13} />} onClick={onEdit} />
        <Button variant="ghost" size="sm" icon={<Trash2 size={13} />} className="text-rose-500" onClick={onDelete} />
      </div>
    </div>
  )
}

export default function TeachersGlobalPage() {
  const { data: teachers = [], isLoading } = useAllTeachers()
  const deleteTeacher = useDeleteTeacher()
  const { data: subjects = [] } = useSubjects()
  const toast = useToast()

  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState<Teacher | null>(null)
  const [deleting, setDeleting] = useState<Teacher | null>(null)
  const [search, setSearch] = useState('')
  const [filterSubject, setFilterSubject] = useState('')
  const [filterSchool, setFilterSchool] = useState('')

  const subjectMap = Object.fromEntries(subjects.map(s => [s.id, s.name_fr]))

  // Unique schools for filter dropdown
  const schools = Array.from(new Set(teachers.map(t => t.school).filter(Boolean))).sort() as string[]

  const filtered = teachers.filter(t => {
    if (search && !t.name_fr.toLowerCase().includes(search.toLowerCase()) &&
        !t.cin.toLowerCase().includes(search.toLowerCase()) &&
        !t.school?.toLowerCase().includes(search.toLowerCase())) return false
    if (filterSubject && String(t.subject_id ?? '') !== filterSubject) return false
    if (filterSchool && t.school !== filterSchool) return false
    return true
  })

  const handleDelete = () => {
    if (!deleting) return
    deleteTeacher.mutate(deleting.id, {
      onSuccess: () => { setDeleting(null); toast.success('Surveillant supprimé') },
      onError: (err: unknown) => {
        const msg = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail
        toast.error(msg ?? 'Erreur lors de la suppression')
      },
    })
  }

  return (
    <div className="p-8">
      <PageHeader
        title="Catalogue des surveillants"
        subtitle={`${teachers.length} surveillant${teachers.length !== 1 ? 's' : ''} dans le catalogue global`}
        action={
          <Button variant="primary" icon={<Plus size={14} />} onClick={() => { setEditing(null); setModalOpen(true) }}>
            Ajouter manuellement
          </Button>
        }
      />

      <ExcelImportPanel />

      <div className="flex items-center gap-3 mb-3 flex-wrap">
        <span className="font-semibold text-sm text-slate-700 mr-auto">
          Liste des surveillants
          {filtered.length !== teachers.length && (
            <span className="ml-2 text-xs font-normal text-slate-400">{filtered.length} résultat{filtered.length !== 1 ? 's' : ''}</span>
          )}
        </span>
        <Select
          value={filterSubject}
          placeholder="Toutes les matières"
          options={subjects.map(s => ({ value: String(s.id), label: s.name_fr }))}
          onChange={e => setFilterSubject(e.target.value)}
          className="w-48"
        />
        <Select
          value={filterSchool}
          placeholder="Tous les établissements"
          options={schools.map(s => ({ value: s, label: s }))}
          onChange={e => setFilterSchool(e.target.value)}
          className="w-52"
        />
        <Input
          placeholder="Nom, CIN…"
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="w-48"
        />
        {(filterSubject || filterSchool || search) && (
          <button
            onClick={() => { setFilterSubject(''); setFilterSchool(''); setSearch('') }}
            className="text-xs text-slate-400 hover:text-slate-600 whitespace-nowrap"
          >
            Réinitialiser
          </button>
        )}
      </div>

      <div className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
        <div className="grid grid-cols-[minmax(240px,1.5fr)_minmax(160px,1fr)_minmax(180px,1fr)_96px_72px] gap-4 border-b border-slate-200 bg-slate-50 px-4 py-3 text-xs font-semibold uppercase tracking-wider text-slate-500">
          <div>Surveillant</div>
          <div>Matière</div>
          <div>Établissement</div>
          <div>Genre</div>
          <div />
        </div>

        {isLoading ? (
          <div className="divide-y divide-slate-100">
            {Array.from({ length: 6 }).map((_, index) => (
              <div key={index} className="grid grid-cols-[minmax(240px,1.5fr)_minmax(160px,1fr)_minmax(180px,1fr)_96px_72px] items-center gap-4 px-4 py-3">
                <div className="flex items-center gap-3">
                  <div className="h-9 w-9 animate-pulse rounded-lg bg-slate-100" />
                  <div className="space-y-2">
                    <div className="h-3 w-32 animate-pulse rounded bg-slate-100" />
                    <div className="h-2.5 w-20 animate-pulse rounded bg-slate-100" />
                  </div>
                </div>
                <div className="h-3 w-28 animate-pulse rounded bg-slate-100" />
                <div className="h-3 w-32 animate-pulse rounded bg-slate-100" />
                <div className="h-5 w-16 animate-pulse rounded-full bg-slate-100" />
                <div className="h-7 w-14 animate-pulse rounded bg-slate-100" />
              </div>
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="px-4 py-12 text-center text-sm text-slate-400">
            Aucun résultat pour ces filtres.
          </div>
        ) : (
          filtered.map(t => (
            <TeacherListItem
              key={t.id}
              teacher={t}
              subjectName={t.subject_id ? (subjectMap[t.subject_id] ?? `#${t.subject_id}`) : '—'}
              onEdit={() => { setEditing(t); setModalOpen(true) }}
              onDelete={() => setDeleting(t)}
            />
          ))
        )}
      </div>

      <TeacherFormModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        editing={editing}
      />

      <ConfirmDialog
        open={!!deleting}
        onClose={() => setDeleting(null)}
        onConfirm={handleDelete}
        loading={deleteTeacher.isPending}
        title="Supprimer le surveillant"
        description={`Supprimer "${deleting?.name_fr}" (CIN: ${deleting?.cin}) du catalogue ? Il sera retiré de tous les examens.`}
        confirmLabel="Supprimer"
      />
    </div>
  )
}
