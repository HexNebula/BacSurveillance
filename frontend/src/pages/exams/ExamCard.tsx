import { useNavigate } from 'react-router-dom'
import { Calendar, Trash2, ArrowRight } from 'lucide-react'
import { useState } from 'react'
import type { Exam } from '../../types'
import { useDeleteExam } from '../../hooks/useExam'
import { useToast } from '../../hooks/useToast'
import { Badge } from '../../components/ui/Badge'
import { Button } from '../../components/ui/Button'
import { ConfirmDialog } from '../../components/ui/ConfirmDialog'
import { cn } from '../../lib/utils'

const LEVEL_LABELS: Record<string, string> = {
  BAC1:            '1ère Bac',
  BAC2_NORMALE:    '2ème Bac · Normale',
  BAC2_RATTRAPAGE: '2ème Bac · Rattrapage',
}

const LEVEL_GRADIENT: Record<string, string> = {
  BAC1:            'from-indigo-500 to-indigo-700',
  BAC2_NORMALE:    'from-violet-500 to-violet-700',
  BAC2_RATTRAPAGE: 'from-sky-500 to-sky-700',
}

const STATUS_BADGE: Record<string, 'warning' | 'primary' | 'success'> = {
  DRAFT:     'warning',
  ASSIGNED:  'primary',
  VALIDATED: 'success',
}
const STATUS_LABELS: Record<string, string> = {
  DRAFT: 'Brouillon', ASSIGNED: 'Distribué', VALIDATED: 'Validé',
}

function formatDate(d: string) {
  return new Date(d).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' })
}

export function ExamCard({ exam }: { exam: Exam }) {
  const navigate   = useNavigate()
  const deleteExam = useDeleteExam()
  const toast      = useToast()
  const [confirm, setConfirm] = useState(false)

  const gradient = LEVEL_GRADIENT[exam.level] ?? 'from-slate-500 to-slate-700'

  const handleDelete = () => {
    deleteExam.mutate(exam.id, {
      onSuccess: () => { setConfirm(false); toast.success('Examen supprimé') },
      onError:   () => toast.error('Erreur lors de la suppression'),
    })
  }

  return (
    <>
      <div className="rounded-2xl overflow-hidden border border-slate-200 shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all duration-200 bg-white">
        {/* Gradient top strip */}
        <div className={cn('h-20 bg-gradient-to-br flex items-end px-5 pb-3 relative', gradient)}>
          <span className="text-white text-xs font-semibold tracking-wide opacity-90">
            {LEVEL_LABELS[exam.level] ?? exam.level}
          </span>
          <button
            className="absolute top-3 right-3 w-7 h-7 rounded-lg bg-white/20 hover:bg-white/30 flex items-center justify-center text-white transition-colors cursor-pointer"
            onClick={() => setConfirm(true)}
          >
            <Trash2 size={13} />
          </button>
        </div>

        {/* Body */}
        <div className="px-5 py-4">
          <h3 className="font-display font-bold text-slate-900 text-base leading-tight mb-3">
            {exam.name_fr}
          </h3>

          <div className="flex items-center gap-1.5 text-sm text-slate-400 mb-4">
            <Calendar size={13} />
            <span>{formatDate(exam.start_date)} → {formatDate(exam.end_date)}</span>
          </div>

          <div className="flex items-center justify-between">
            <Badge variant={STATUS_BADGE[exam.status] ?? 'default'}>
              {STATUS_LABELS[exam.status] ?? exam.status}
            </Badge>
            <Button
              variant="primary"
              size="sm"
              onClick={() => navigate(`/exams/${exam.id}/branches`)}
            >
              Ouvrir <ArrowRight size={13} />
            </Button>
          </div>
        </div>
      </div>

      <ConfirmDialog
        open={confirm}
        onClose={() => setConfirm(false)}
        onConfirm={handleDelete}
        loading={deleteExam.isPending}
        title="Supprimer l'examen"
        description={`Cette action supprimera définitivement "${exam.name_fr}" et toutes ses données.`}
        confirmLabel="Supprimer"
      />
    </>
  )
}
