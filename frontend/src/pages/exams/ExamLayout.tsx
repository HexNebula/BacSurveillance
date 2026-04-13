import { useParams, Outlet, Navigate, useNavigate } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'
import { useExam } from '../../hooks/useExam'
import { ActiveExamContext } from '../../context/ActiveExamContext'
import { ExamStepTabs } from './ExamStepTabs'
import { Badge } from '../../components/ui/Badge'
import { Button } from '../../components/ui/Button'
import { Spinner } from '../../components/ui/Spinner'

const LEVEL_LABELS: Record<string, string> = {
  BAC1:            '1ère Bac',
  BAC2_NORMALE:    '2ème Bac · Normale',
  BAC2_RATTRAPAGE: '2ème Bac · Rattrapage',
}

export default function ExamLayout() {
  const { examId: examIdStr } = useParams()
  const examId  = Number(examIdStr)
  const navigate = useNavigate()
  const { data: exam, isLoading, isError } = useExam(examId)

  if (!examId || isNaN(examId)) return <Navigate to="/exams" replace />

  if (isLoading) {
    return (
      <div className="flex justify-center py-20">
        <Spinner size={28} className="text-indigo-500" />
      </div>
    )
  }

  if (isError || !exam) return <Navigate to="/exams" replace />

  return (
    <ActiveExamContext.Provider value={{ examId }}>
      {/* Exam header bar */}
      <div className="bg-white border-b border-slate-200 shadow-sm px-6 py-3 flex items-center gap-3 sticky top-0 z-20">
        <Button
          variant="ghost"
          size="sm"
          icon={<ArrowLeft size={15} />}
          onClick={() => navigate('/exams')}
        />
        <div className="flex-1 min-w-0">
          <div className="font-display font-bold text-slate-900 text-base truncate leading-tight">
            {exam.name_fr}
          </div>
          <div className="text-xs text-slate-400">{exam.year}</div>
        </div>
        <Badge variant="primary">{LEVEL_LABELS[exam.level] ?? exam.level}</Badge>
      </div>

      {/* Step tabs */}
      <ExamStepTabs />

      {/* Page content */}
      <Outlet />
    </ActiveExamContext.Provider>
  )
}
