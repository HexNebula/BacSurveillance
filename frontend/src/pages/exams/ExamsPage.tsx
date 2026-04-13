import { useState } from 'react'
import { Plus, CalendarCheck } from 'lucide-react'
import { useExams } from '../../hooks/useExam'
import { PageHeader } from '../../components/ui/PageHeader'
import { Button } from '../../components/ui/Button'
import { EmptyState } from '../../components/ui/EmptyState'
import { Spinner } from '../../components/ui/Spinner'
import { ExamCard } from './ExamCard'
import { CreateExamModal } from './CreateExamModal'

export default function ExamsPage() {
  const { data: exams = [], isLoading } = useExams()
  const [createOpen, setCreateOpen]     = useState(false)

  return (
    <div className="p-8">
      <PageHeader
        title="Examens"
        subtitle={`${exams.length} session${exams.length !== 1 ? 's' : ''} configurée${exams.length !== 1 ? 's' : ''}`}
        action={
          <Button variant="primary" icon={<Plus size={15} />} onClick={() => setCreateOpen(true)}>
            Créer un examen
          </Button>
        }
      />

      {isLoading ? (
        <div className="flex justify-center py-16">
          <Spinner size={28} className="text-indigo-500" />
        </div>
      ) : exams.length === 0 ? (
        <EmptyState
          icon={<CalendarCheck size={32} />}
          message="Aucun examen créé. Commencez par créer votre première session."
          action={
            <Button variant="primary" size="sm" icon={<Plus size={14} />} onClick={() => setCreateOpen(true)}>
              Créer un examen
            </Button>
          }
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
          {exams.map(exam => (
            <ExamCard key={exam.id} exam={exam} />
          ))}
        </div>
      )}

      <CreateExamModal open={createOpen} onClose={() => setCreateOpen(false)} />
    </div>
  )
}
