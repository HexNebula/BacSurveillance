import { useState } from 'react'
import { Search, UserPlus, Trash2 } from 'lucide-react'
import type { Teacher } from '../../../types'
import { useActiveExam } from '../../../context/ActiveExamContext'
import {
  useAllTeachers,
  useExamTeachers,
  useEnrollTeacher,
  useRemoveExamTeacher,
} from '../../../hooks/useAssignment'
import { useSubjects } from '../../../hooks/useCenter'
import { useToast } from '../../../hooks/useToast'
import { PageHeader } from '../../../components/ui/PageHeader'
import { Button } from '../../../components/ui/Button'
import { Input } from '../../../components/ui/Input'
import { Modal } from '../../../components/ui/Modal'
import { ConfirmDialog } from '../../../components/ui/ConfirmDialog'
import { Badge } from '../../../components/ui/Badge'
import { Table } from '../../../components/ui/Table'
import type { Column } from '../../../components/ui/Table'
import { EmptyState } from '../../../components/ui/EmptyState'
import { cn } from '../../../lib/utils'

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

function EnrollModal({ open, onClose, examId, enrolledIds }: {
  open: boolean
  onClose: () => void
  examId: number
  enrolledIds: Set<number>
}) {
  const { data: allTeachers = [] } = useAllTeachers()
  const enrollTeacher = useEnrollTeacher(examId)
  const toast = useToast()
  const [search, setSearch] = useState('')

  const available = allTeachers.filter(t =>
    !enrolledIds.has(t.id) &&
    (!search ||
      t.name_fr.toLowerCase().includes(search.toLowerCase()) ||
      t.cin.toLowerCase().includes(search.toLowerCase()) ||
      t.school?.toLowerCase().includes(search.toLowerCase()))
  )

  const handleEnroll = (teacher: Teacher) => {
    enrollTeacher.mutate(teacher.id, {
      onSuccess: () => toast.success(`${teacher.name_fr} ajouté à l'examen`),
      onError: () => toast.error('Erreur lors de l\'ajout'),
    })
  }

  return (
    <Modal open={open} onClose={onClose} title="Ajouter un surveillant" size="lg">
      <div className="flex flex-col gap-4">
        <Input
          placeholder="Rechercher par nom, CIN, établissement…"
          value={search}
          onChange={e => setSearch(e.target.value)}
          autoFocus
        />

        {available.length === 0 ? (
          <p className="text-sm text-slate-400 text-center py-6">
            {allTeachers.length === 0
              ? 'Aucun surveillant dans le catalogue. Créez d\'abord des surveillants dans le menu global.'
              : 'Tous les surveillants sont déjà inscrits à cet examen.'}
          </p>
        ) : (
          <div className="max-h-80 overflow-y-auto rounded-lg border border-slate-200 divide-y divide-slate-100">
            {available.map(t => (
              <div key={t.id} className="flex items-center gap-3 px-4 py-3 hover:bg-slate-50 transition-colors">
                <TeacherAvatar name={t.name_fr} gender={t.gender} />
                <div className="flex-1 min-w-0">
                  <div className="font-medium text-sm text-slate-800 truncate">{t.name_fr}</div>
                  <div className="text-xs text-slate-400">{t.cin}{t.school ? ` · ${t.school}` : ''}</div>
                </div>
                <Button
                  variant="primary"
                  size="sm"
                  icon={<UserPlus size={13} />}
                  loading={enrollTeacher.isPending}
                  onClick={() => handleEnroll(t)}
                >
                  Ajouter
                </Button>
              </div>
            ))}
          </div>
        )}

        <div className="flex justify-end mt-1">
          <Button variant="secondary" onClick={onClose}>Fermer</Button>
        </div>
      </div>
    </Modal>
  )
}

export default function TeachersPage() {
  const { examId } = useActiveExam()
  const { data: enrolled = [], isLoading } = useExamTeachers(examId)
  const removeTeacher = useRemoveExamTeacher(examId)
  const { data: subjects = [] } = useSubjects()
  const toast = useToast()

  const [enrollOpen, setEnrollOpen] = useState(false)
  const [deleting, setDeleting] = useState<Teacher | null>(null)
  const [search, setSearch] = useState('')

  const enrolledIds = new Set(enrolled.map(t => t.id))
  const subjectMap = Object.fromEntries(subjects.map(s => [s.id, s.name_fr]))

  const filtered = enrolled.filter(t =>
    !search ||
    t.name_fr.toLowerCase().includes(search.toLowerCase()) ||
    t.cin.toLowerCase().includes(search.toLowerCase()) ||
    t.school?.toLowerCase().includes(search.toLowerCase())
  )

  const handleRemove = () => {
    if (!deleting) return
    removeTeacher.mutate(deleting.id, {
      onSuccess: () => { setDeleting(null); toast.success('Surveillant retiré de l\'examen') },
      onError: () => toast.error('Erreur'),
    })
  }

  const columns: Column<Teacher>[] = [
    {
      key: 'name_fr', label: 'Surveillant',
      render: t => (
        <div className="flex items-center gap-3">
          <TeacherAvatar name={t.name_fr} gender={t.gender} />
          <div>
            <div className="font-medium text-slate-800 text-sm">{t.name_fr}</div>
            {t.ordinal && <div className="text-xs text-slate-400">#{t.ordinal}</div>}
          </div>
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
      key: 'actions', label: '', width: '60px',
      render: t => (
        <Button
          variant="ghost"
          size="sm"
          icon={<Trash2 size={13} />}
          className="text-rose-500"
          onClick={() => setDeleting(t)}
        />
      ),
    },
  ]

  return (
    <div className="p-8">
      <PageHeader
        title="Surveillants"
        subtitle={`${enrolled.length} surveillant${enrolled.length !== 1 ? 's' : ''} inscrits à cet examen`}
        action={
          <Button variant="primary" icon={<UserPlus size={14} />} onClick={() => setEnrollOpen(true)}>
            Ajouter un surveillant
          </Button>
        }
      />

      {enrolled.length === 0 && !isLoading ? (
        <EmptyState
          message="Aucun surveillant inscrit. Ajoutez des surveillants depuis le catalogue global."
          action={
            <Button variant="primary" size="sm" icon={<UserPlus size={13} />} onClick={() => setEnrollOpen(true)}>
              Ajouter un surveillant
            </Button>
          }
        />
      ) : (
        <>
          <div className="flex items-center justify-between mb-3">
            <span className="font-semibold text-sm text-slate-700">Liste des surveillants inscrits</span>
            <div className="relative">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="Rechercher…"
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="h-9 pl-8 pr-3 text-sm rounded-lg border border-slate-200 bg-white text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400 w-64"
              />
            </div>
          </div>

          <Table
            columns={columns}
            data={filtered}
            loading={isLoading}
            rowKey={t => t.id}
            emptyMessage={search ? 'Aucun résultat' : 'Aucun surveillant inscrit.'}
          />
        </>
      )}

      <EnrollModal
        open={enrollOpen}
        onClose={() => setEnrollOpen(false)}
        examId={examId}
        enrolledIds={enrolledIds}
      />

      <ConfirmDialog
        open={!!deleting}
        onClose={() => setDeleting(null)}
        onConfirm={handleRemove}
        loading={removeTeacher.isPending}
        title="Retirer le surveillant"
        description={`Retirer "${deleting?.name_fr}" de cet examen ?`}
        confirmLabel="Retirer"
      />
    </div>
  )
}
