import { useState } from 'react'
import { LayoutGrid } from 'lucide-react'
import type { ExamFiliereRoom, Room } from '../../../types'
import { useActiveExam } from '../../../context/ActiveExamContext'
import { useExamFilieres } from '../../../hooks/useExam'
import { useFiliereRooms, useAddFiliereRoom, useRemoveFiliereRoom } from '../../../hooks/useExam'
import { useFilieres, useRooms } from '../../../hooks/useCenter'
import { useToast } from '../../../hooks/useToast'
import { PageHeader } from '../../../components/ui/PageHeader'
import { Button } from '../../../components/ui/Button'
import { Modal } from '../../../components/ui/Modal'
import { Spinner } from '../../../components/ui/Spinner'
import { EmptyState } from '../../../components/ui/EmptyState'
import { cn } from '../../../lib/utils'

// ── Room picker modal (per filière) ───────────────────────────────────────────

function RoomPickerModal({ examFiliereId, maxRooms, filiereName, open, onClose }: {
  examFiliereId: number
  maxRooms: number
  filiereName: string
  open: boolean
  onClose: () => void
}) {
  const { data: allRooms = [] }            = useRooms()
  const { data: assigned = [], isLoading } = useFiliereRooms(examFiliereId)
  const addRoom    = useAddFiliereRoom(examFiliereId)
  const removeRoom = useRemoveFiliereRoom(examFiliereId)
  const toast      = useToast()

  const assignedIds = new Set(assigned.map((a: ExamFiliereRoom) => a.room_id))

  const toggle = (room: Room) => {
    if (assignedIds.has(room.id)) {
      const efr = assigned.find((a: ExamFiliereRoom) => a.room_id === room.id)
      if (efr) removeRoom.mutate(efr.id, { onError: () => toast.error('Erreur') })
    } else {
      if (assigned.length >= maxRooms) {
        toast.error(`Maximum ${maxRooms} salle(s) pour cette filière`)
        return
      }
      addRoom.mutate({ room_id: room.id }, { onError: () => toast.error('Erreur') })
    }
  }

  return (
    <Modal open={open} onClose={onClose} title={`Salles — ${filiereName}`} size="sm">
      {isLoading ? (
        <div className="flex justify-center py-8"><Spinner size={20} className="text-indigo-500" /></div>
      ) : (
        <>
          <p className="text-sm text-slate-500 mb-4">
            Sélectionnez jusqu'à <strong>{maxRooms}</strong> salle(s) · {assigned.length}/{maxRooms} affectée(s)
          </p>
          <div className="flex flex-col gap-2">
            {allRooms.map(room => {
              const checked = assignedIds.has(room.id)
              return (
                <label
                  key={room.id}
                  className={cn(
                    'flex items-center gap-3 px-4 py-3 rounded-lg border cursor-pointer transition-all',
                    checked
                      ? 'border-indigo-300 bg-indigo-50 text-indigo-800'
                      : 'border-slate-200 bg-white hover:bg-slate-50',
                  )}
                >
                  <input
                    type="checkbox"
                    checked={checked}
                    className="w-4 h-4 accent-indigo-500"
                    onChange={() => toggle(room)}
                  />
                  <span className="flex-1 text-sm font-medium">{room.name}</span>
                  {room.capacity && <span className="text-xs text-slate-400">{room.capacity} places</span>}
                </label>
              )
            })}
            {allRooms.length === 0 && (
              <p className="text-sm text-slate-400 text-center py-4">Aucune salle dans les paramètres</p>
            )}
          </div>
          <div className="flex justify-end mt-4">
            <Button variant="primary" onClick={onClose}>Fermer</Button>
          </div>
        </>
      )}
    </Modal>
  )
}

// ── Filière card ──────────────────────────────────────────────────────────────

function FiliereCard({ examFiliereId, filiereName, maxRooms }: {
  examFiliereId: number
  filiereName: string
  maxRooms: number
}) {
  const { data: assigned = [] } = useFiliereRooms(examFiliereId)
  const { data: allRooms = [] } = useRooms()
  const [pickerOpen, setPickerOpen] = useState(false)

  const assignedRoomNames = (assigned as ExamFiliereRoom[]).map(a => {
    const room = allRooms.find(r => r.id === a.room_id)
    return room?.name ?? `#${a.room_id}`
  })

  const fillPct = maxRooms > 0 ? Math.round((assigned.length / maxRooms) * 100) : 0

  return (
    <>
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5 flex items-center gap-4 border-l-4 border-l-indigo-400">
        <div className="flex-1 min-w-0">
          <div className="font-semibold text-slate-800 text-sm">{filiereName}</div>

          {assignedRoomNames.length > 0 && (
            <div className="flex gap-1.5 mt-2 flex-wrap">
              {assignedRoomNames.map(name => (
                <span key={name} className="bg-indigo-500 text-white text-xs px-2.5 py-0.5 rounded-full font-medium">
                  {name}
                </span>
              ))}
            </div>
          )}

          <div className="mt-2.5 flex items-center gap-2">
            <div className="flex-1 h-1.5 bg-slate-100 rounded-full overflow-hidden">
              <div
                className={cn('h-full rounded-full transition-all', fillPct === 100 ? 'bg-emerald-500' : 'bg-indigo-500')}
                style={{ width: `${fillPct}%` }}
              />
            </div>
            <span className={cn('text-xs font-medium', fillPct === 100 ? 'text-emerald-600' : 'text-slate-400')}>
              {assigned.length}/{maxRooms}
            </span>
          </div>
        </div>

        <Button variant="secondary" size="sm" icon={<LayoutGrid size={13} />} onClick={() => setPickerOpen(true)}>
          Affecter salles
        </Button>
      </div>

      <RoomPickerModal
        examFiliereId={examFiliereId}
        maxRooms={maxRooms}
        filiereName={filiereName}
        open={pickerOpen}
        onClose={() => setPickerOpen(false)}
      />
    </>
  )
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function RoomAssignmentsPage() {
  const { examId }                          = useActiveExam()
  const { data: examFilieres = [], isLoading: efLoading } = useExamFilieres(examId)
  const { data: filieres = [],    isLoading: fLoading  } = useFilieres()

  const isLoading  = efLoading || fLoading
  const filiereMap = Object.fromEntries(filieres.map(f => [f.id, f]))

  return (
    <div className="p-8">
      <PageHeader
        title="Affectation des salles"
        subtitle="Assignez les salles physiques à chaque filière — elles s'appliquent à tous les créneaux"
      />

      {isLoading ? (
        <div className="flex justify-center py-16"><Spinner size={24} className="text-indigo-500" /></div>
      ) : examFilieres.length === 0 ? (
        <EmptyState message="Ajoutez d'abord des filières dans l'étape précédente." />
      ) : (
        <div className="flex flex-col gap-3">
          {examFilieres.map(ef => (
            <FiliereCard
              key={ef.id}
              examFiliereId={ef.id}
              filiereName={filiereMap[ef.filiere_id]?.name_fr ?? `Filière #${ef.filiere_id}`}
              maxRooms={ef.room_count}
            />
          ))}
        </div>
      )}
    </div>
  )
}
