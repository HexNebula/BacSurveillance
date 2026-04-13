import { useState } from 'react'
import { Plus, Pencil, Trash2, Upload, Download } from 'lucide-react'
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
import { Table } from '../../components/ui/Table'
import type { Column } from '../../components/ui/Table'
import { cn } from '../../lib/utils'

const INITIAL_FORM = {
  name_fr: '', gender: 'M' as GenderEnum,
  cin: '', som: '', school: '', subject_id: '',
}

function TeacherAvatar({ name, gender }: { name: string; gender: string }) {
  const initials = name.split(' ').slice(0, 2).map(w => w[0]).join('').toUpperCase()
  return (
    <div className={cn(
      'w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold shrink-0',
      gender === 'F' ? 'bg-rose-100 text-rose-600' : 'bg-indigo-100 text-indigo-700',
    )}>
      {initials}
    </div>
  )
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
    <div className="border-2 border-dashed border-slate-200 rounded-2xl p-6 text-center bg-white mb-6">
      <div className="w-12 h-12 bg-slate-100 rounded-xl flex items-center justify-center mx-auto mb-3 text-slate-400">
        <Upload size={20} />
      </div>
      <h3 className="font-semibold text-slate-700 text-sm mb-1">Importer via Excel</h3>
      <p className="text-xs text-slate-400 mb-4">Format CSV — colonnes : nom_fr, genre (M/F), cin, som, etablissement, ordinal</p>
      <div className="flex items-center justify-center gap-3 flex-wrap">
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
      {file && <p className="text-xs text-slate-500 mt-3">Fichier : <strong>{file.name}</strong></p>}
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

  const columns: Column<Teacher>[] = [
    {
      key: 'ordinal', label: '#', width: '48px',
      render: (_t, i) => (
        <span className="font-mono text-xs font-semibold text-slate-400">{i + 1}</span>
      ),
    },
    {
      key: 'name_fr', label: 'Surveillant',
      render: t => (
        <div className="flex items-center gap-3">
          <TeacherAvatar name={t.name_fr} gender={t.gender} />
          <div className="font-medium text-slate-800 text-sm">{t.name_fr}</div>
        </div>
      ),
    },
    {
      key: 'gender', label: 'Genre', width: '90px',
      render: t => (
        <Badge variant={t.gender === 'F' ? 'danger' : 'primary'}>
          {t.gender === 'M' ? 'Homme' : 'Femme'}
        </Badge>
      ),
    },
    { key: 'cin', label: 'CIN', render: t => <span className="font-mono text-xs text-slate-600">{t.cin}</span> },
    { key: 'school', label: 'Établissement', render: t => t.school ?? '—' },
    {
      key: 'subject', label: 'Matière',
      render: t => t.subject_id ? (subjectMap[t.subject_id] ?? `#${t.subject_id}`) : '—',
    },
    {
      key: 'actions', label: '', width: '80px',
      render: t => (
        <div className="flex gap-1 justify-end">
          <Button variant="ghost" size="sm" icon={<Pencil size={13} />} onClick={() => { setEditing(t); setModalOpen(true) }} />
          <Button variant="ghost" size="sm" icon={<Trash2 size={13} />} className="text-rose-500" onClick={() => setDeleting(t)} />
        </div>
      ),
    },
  ]

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

      <Table
        columns={columns}
        data={filtered}
        loading={isLoading}
        rowKey={t => t.id}
        emptyMessage="Aucun résultat pour ces filtres."
      />

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
