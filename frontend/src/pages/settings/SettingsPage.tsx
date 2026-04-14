import { useState } from 'react'
import { Building2, BookOpen, LayoutGrid, Pencil, Trash2, Plus } from 'lucide-react'
import type { Room, Subject } from '../../types'
import {
  useCenterSettings, useUpdateCenterSettings,
  useRooms, useCreateRoom, useUpdateRoom, useDeleteRoom,
  useSubjects, useCreateSubject, useUpdateSubject, useDeleteSubject,
} from '../../hooks/useCenter'
import { useToast } from '../../hooks/useToast'
import { PageHeader } from '../../components/ui/PageHeader'
import { Button } from '../../components/ui/Button'
import { Input } from '../../components/ui/Input'
import { Modal } from '../../components/ui/Modal'
import { ConfirmDialog } from '../../components/ui/ConfirmDialog'
import { Table } from '../../components/ui/Table'
import type { Column } from '../../components/ui/Table'

function Section({ icon: Icon, title, children }: { icon: React.ElementType; title: string; children: React.ReactNode }) {
  return (
    <section className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden mb-6">
      <div className="bg-slate-50 border-b border-slate-200 px-6 py-4 flex items-center gap-3">
        <Icon size={16} className="text-indigo-500 shrink-0" />
        <h2 className="font-display font-semibold text-slate-800 text-base">{title}</h2>
      </div>
      <div className="px-6 py-5">{children}</div>
    </section>
  )
}

function CenterSection() {
  const { data: settings, isLoading } = useCenterSettings()
  const update = useUpdateCenterSettings()
  const toast  = useToast()

  const [nameFr, setNameFr]           = useState('')
  const [initialized, setInitialized] = useState(false)

  if (settings && !initialized) {
    setNameFr(settings.name_fr)
    setInitialized(true)
  }

  const handleSave = () => {
    update.mutate(
      { name_fr: nameFr, name_ar: '' },
      {
        onSuccess: () => toast.success('Paramètres enregistrés'),
        onError:   () => toast.error("Erreur lors de l'enregistrement"),
      },
    )
  }

  if (isLoading) return <p className="text-sm text-slate-400">Chargement…</p>

  return (
    <div className="flex flex-col gap-4 max-w-lg">
      <Input
        label="Nom du centre"
        value={nameFr}
        onChange={e => setNameFr(e.target.value)}
        placeholder="Ex : Lycée Mohammed V"
      />
      <div>
        <Button
          variant="primary"
          onClick={handleSave}
          loading={update.isPending}
          disabled={!nameFr.trim()}
        >
          Enregistrer
        </Button>
      </div>
    </div>
  )
}

function RoomsSection() {
  const { data: rooms = [], isLoading } = useRooms()
  const createRoom = useCreateRoom()
  const updateRoom = useUpdateRoom()
  const deleteRoom = useDeleteRoom()
  const toast      = useToast()

  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing]     = useState<Room | null>(null)
  const [deleting, setDeleting]   = useState<Room | null>(null)
  const [name, setName]           = useState('')
  const [capacity, setCapacity]   = useState('')

  const openCreate = () => { setEditing(null); setName(''); setCapacity(''); setModalOpen(true) }
  const openEdit   = (r: Room) => { setEditing(r); setName(r.name); setCapacity(r.capacity?.toString() ?? ''); setModalOpen(true) }

  const handleSave = () => {
    const payload = { name: name.trim(), capacity: capacity ? Number(capacity) : undefined }
    const onRoomError = (err: unknown) => {
      const msg = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail
      toast.error(msg ?? 'Erreur')
    }
    if (editing) {
      updateRoom.mutate({ id: editing.id, data: payload }, {
        onSuccess: () => { setModalOpen(false); toast.success('Salle modifiée') },
        onError:   onRoomError,
      })
    } else {
      createRoom.mutate(payload, {
        onSuccess: () => { setModalOpen(false); toast.success('Salle ajoutée') },
        onError:   onRoomError,
      })
    }
  }

  const handleDelete = () => {
    if (!deleting) return
    deleteRoom.mutate(deleting.id, {
      onSuccess: () => { setDeleting(null); toast.success('Salle supprimée') },
      onError:   () => toast.error('Erreur'),
    })
  }

  const columns: Column<Room>[] = [
    { key: 'name', label: 'Nom de la salle' },
    { key: 'capacity', label: 'Capacité', render: r => r.capacity ?? '—' },
    {
      key: 'actions', label: '', width: '90px',
      render: room => (
        <div className="flex gap-1 justify-end">
          <Button variant="ghost" size="sm" icon={<Pencil size={13} />} onClick={() => openEdit(room)} />
          <Button variant="ghost" size="sm" icon={<Trash2 size={13} />} className="text-rose-500 hover:text-rose-600" onClick={() => setDeleting(room)} />
        </div>
      ),
    },
  ]

  return (
    <>
      <div className="flex justify-end mb-3">
        <Button variant="primary" size="sm" icon={<Plus size={14} />} onClick={openCreate}>
          Ajouter une salle
        </Button>
      </div>
      <Table columns={columns} data={rooms} loading={isLoading} rowKey={r => r.id} emptyMessage="Aucune salle configurée" />

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editing ? 'Modifier la salle' : 'Nouvelle salle'} size="sm">
        <div className="flex flex-col gap-4">
          <Input label="Nom de la salle" value={name} onChange={e => setName(e.target.value)} placeholder="Ex : Salle A1" autoFocus />
          <Input label="Capacité (optionnel)" type="number" value={capacity} onChange={e => setCapacity(e.target.value)} placeholder="Ex : 30" min={1} />
          <div className="flex justify-end gap-2 mt-1">
            <Button variant="secondary" onClick={() => setModalOpen(false)}>Annuler</Button>
            <Button variant="primary" onClick={handleSave} loading={createRoom.isPending || updateRoom.isPending} disabled={!name.trim()}>
              {editing ? 'Modifier' : 'Ajouter'}
            </Button>
          </div>
        </div>
      </Modal>

      <ConfirmDialog open={!!deleting} onClose={() => setDeleting(null)} onConfirm={handleDelete} loading={deleteRoom.isPending}
        title="Supprimer la salle" description={`Supprimer "${deleting?.name}" ?`} confirmLabel="Supprimer" />
    </>
  )
}

function SubjectsSection() {
  const { data: subjects = [], isLoading } = useSubjects()
  const createSubject = useCreateSubject()
  const updateSubject = useUpdateSubject()
  const deleteSubject = useDeleteSubject()
  const toast         = useToast()

  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing]     = useState<Subject | null>(null)
  const [deleting, setDeleting]   = useState<Subject | null>(null)
  const [nameFr, setNameFr]       = useState('')

  const openCreate = () => { setEditing(null); setNameFr(''); setModalOpen(true) }
  const openEdit   = (s: Subject) => { setEditing(s); setNameFr(s.name_fr); setModalOpen(true) }

  const handleSave = () => {
    const payload = { name_fr: nameFr.trim(), name_ar: '' }
    const onSubjectError = (err: unknown) => {
      const msg = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail
      toast.error(msg ?? 'Erreur')
    }
    if (editing) {
      updateSubject.mutate({ id: editing.id, data: payload }, {
        onSuccess: () => { setModalOpen(false); toast.success('Matière modifiée') },
        onError:   onSubjectError,
      })
    } else {
      createSubject.mutate(payload, {
        onSuccess: () => { setModalOpen(false); toast.success('Matière ajoutée') },
        onError:   onSubjectError,
      })
    }
  }

  const handleDelete = () => {
    if (!deleting) return
    deleteSubject.mutate(deleting.id, {
      onSuccess: () => { setDeleting(null); toast.success('Matière supprimée') },
      onError: (err: unknown) => {
        const msg = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail
        toast.error(msg ?? 'Erreur lors de la suppression')
      },
    })
  }

  const columns: Column<Subject>[] = [
    { key: 'name_fr', label: 'Matière' },
    {
      key: 'actions', label: '', width: '90px',
      render: s => (
        <div className="flex gap-1 justify-end">
          <Button variant="ghost" size="sm" icon={<Pencil size={13} />} onClick={() => openEdit(s)} />
          <Button variant="ghost" size="sm" icon={<Trash2 size={13} />} className="text-rose-500 hover:text-rose-600" onClick={() => setDeleting(s)} />
        </div>
      ),
    },
  ]

  return (
    <>
      <div className="flex justify-end mb-3">
        <Button variant="primary" size="sm" icon={<Plus size={14} />} onClick={openCreate}>
          Ajouter une matière
        </Button>
      </div>
      <Table columns={columns} data={subjects} loading={isLoading} rowKey={s => s.id} emptyMessage="Aucune matière configurée" />

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editing ? 'Modifier la matière' : 'Nouvelle matière'} size="sm">
        <div className="flex flex-col gap-4">
          <Input label="Nom de la matière" value={nameFr} onChange={e => setNameFr(e.target.value)} placeholder="Ex : Mathématiques" autoFocus />
          <div className="flex justify-end gap-2 mt-1">
            <Button variant="secondary" onClick={() => setModalOpen(false)}>Annuler</Button>
            <Button variant="primary" onClick={handleSave} loading={createSubject.isPending || updateSubject.isPending} disabled={!nameFr.trim()}>
              {editing ? 'Modifier' : 'Ajouter'}
            </Button>
          </div>
        </div>
      </Modal>

      <ConfirmDialog open={!!deleting} onClose={() => setDeleting(null)} onConfirm={handleDelete} loading={deleteSubject.isPending}
        title="Supprimer la matière" description={`Supprimer "${deleting?.name_fr}" ?`} confirmLabel="Supprimer" />
    </>
  )
}

export default function SettingsPage() {
  return (
    <div className="p-8">
      <PageHeader title="Paramètres" subtitle="Configuration du centre d'examen" />
      <Section icon={Building2} title="Centre d'examen"><CenterSection /></Section>
      <Section icon={LayoutGrid} title="Salles"><RoomsSection /></Section>
      <Section icon={BookOpen} title="Matières"><SubjectsSection /></Section>
    </div>
  )
}
