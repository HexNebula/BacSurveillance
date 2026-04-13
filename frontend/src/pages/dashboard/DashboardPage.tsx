import { CalendarCheck, LayoutGrid, Clock, ArrowRight } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { useExams } from '../../hooks/useExam'
import { useRooms, useCenterSettings } from '../../hooks/useCenter'
import { PageHeader } from '../../components/ui/PageHeader'
import { Badge } from '../../components/ui/Badge'
import { cn } from '../../lib/utils'

const STATUS_BADGE: Record<string, 'default' | 'success' | 'warning' | 'primary'> = {
  DRAFT:     'warning',
  ASSIGNED:  'primary',
  VALIDATED: 'success',
}
const STATUS_LABELS: Record<string, string> = {
  DRAFT: 'Brouillon', ASSIGNED: 'Distribué', VALIDATED: 'Validé',
}

interface StatCardProps {
  label: string
  value: string | number
  icon: React.ElementType
  sub?: string
  color?: 'indigo' | 'emerald' | 'violet'
}

function StatCard({ label, value, icon: Icon, sub, color = 'indigo' }: StatCardProps) {
  const colorMap = {
    indigo:  { box: 'bg-indigo-50 text-indigo-600', num: 'text-indigo-600' },
    emerald: { box: 'bg-emerald-50 text-emerald-600', num: 'text-emerald-600' },
    violet:  { box: 'bg-violet-50 text-violet-600', num: 'text-violet-600' },
  }
  const c = colorMap[color]
  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 flex items-center gap-5">
      <div className={cn('w-12 h-12 rounded-xl flex items-center justify-center shrink-0', c.box)}>
        <Icon size={22} />
      </div>
      <div>
        <div className={cn('font-display text-3xl font-bold leading-none', c.num)}>{value}</div>
        <div className="text-sm text-slate-500 mt-1">{label}</div>
        {sub && <div className="text-xs text-slate-400 mt-0.5">{sub}</div>}
      </div>
    </div>
  )
}

export default function DashboardPage() {
  const { data: exams = [] }    = useExams()
  const { data: rooms = [] }    = useRooms()
  const { data: settings }      = useCenterSettings()
  const navigate                = useNavigate()

  const activeExams = exams.filter(e => e.status !== 'VALIDATED')
  const draftExams  = exams.filter(e => e.status === 'DRAFT')

  return (
    <div className="p-8">
      <PageHeader
        title={settings?.name_fr ?? 'Tableau de bord'}
        subtitle="Vue d'ensemble du système de surveillance"
      />

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
        <StatCard
          label="Sessions d'examen"
          value={exams.length}
          icon={CalendarCheck}
          sub={`${activeExams.length} en cours`}
          color="indigo"
        />
        <StatCard
          label="Salles configurées"
          value={rooms.length}
          icon={LayoutGrid}
          color="emerald"
        />
        <StatCard
          label="En brouillon"
          value={draftExams.length}
          icon={Clock}
          sub="À distribuer"
          color="violet"
        />
      </div>

      {exams.length > 0 && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-100">
            <h2 className="font-display font-semibold text-slate-800 text-base">Dernières sessions</h2>
          </div>
          <ul className="divide-y divide-slate-100">
            {exams.slice(0, 6).map(exam => (
              <li
                key={exam.id}
                className="flex items-center gap-4 px-6 py-4 hover:bg-slate-50 transition-colors cursor-pointer group"
                onClick={() => navigate(`/exams/${exam.id}/branches`)}
              >
                <div className={cn(
                  'w-2.5 h-2.5 rounded-full shrink-0',
                  exam.status === 'VALIDATED' ? 'bg-emerald-500' :
                  exam.status === 'ACTIVE'    ? 'bg-indigo-500' : 'bg-amber-400',
                )} />
                <div className="flex-1 min-w-0">
                  <div className="font-medium text-sm text-slate-800 truncate">{exam.name_fr}</div>
                  <div className="text-xs text-slate-400 mt-0.5">{exam.year}</div>
                </div>
                <Badge variant={STATUS_BADGE[exam.status] ?? 'default'}>
                  {STATUS_LABELS[exam.status] ?? exam.status}
                </Badge>
                <ArrowRight size={14} className="text-slate-300 group-hover:text-indigo-400 transition-colors" />
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}
