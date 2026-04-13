import { NavLink, useParams, useLocation } from 'react-router-dom'
import { GitBranch, Calendar, LayoutGrid, Users, SlidersHorizontal, Shuffle } from 'lucide-react'
import { cn } from '../../lib/utils'

const STEPS = [
  { to: 'branches',     label: 'Filières',     icon: GitBranch         },
  { to: 'schedule',     label: 'Planning',     icon: Calendar          },
  { to: 'rooms',        label: 'Salles',       icon: LayoutGrid        },
  { to: 'teachers',     label: 'Surveillants', icon: Users             },
  { to: 'config',       label: 'Config',       icon: SlidersHorizontal },
  { to: 'distribution', label: 'Distribution', icon: Shuffle           },
]

export function ExamStepTabs() {
  const { examId } = useParams()
  const { pathname } = useLocation()

  const currentStep = STEPS.findIndex(s => pathname.includes(s.to))

  return (
    <div className="bg-white border-b border-slate-200 sticky top-[57px] z-10 shadow-sm">
      <div className="flex items-center px-6 overflow-x-auto">
        {STEPS.map(({ to, label, icon: Icon }, i) => {
          const isDone    = i < currentStep
          const isCurrent = i === currentStep

          return (
            <NavLink
              key={to}
              to={`/exams/${examId}/${to}`}
              className={({ isActive }) =>
                cn(
                  'flex items-center gap-2 px-4 py-3.5 text-sm font-medium whitespace-nowrap',
                  'border-b-2 transition-all duration-150 shrink-0 no-underline',
                  isActive
                    ? 'border-indigo-500 text-indigo-600'
                    : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300',
                )
              }
            >
              <span className={cn(
                'w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold shrink-0 transition-all',
                isDone    ? 'bg-emerald-500 text-white' :
                isCurrent ? 'bg-indigo-500 text-white ring-4 ring-indigo-100' :
                            'bg-slate-100 text-slate-400',
              )}>
                {isDone ? '✓' : i + 1}
              </span>
              <Icon size={13} />
              {label}
            </NavLink>
          )
        })}
      </div>
    </div>
  )
}
