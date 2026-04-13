import { Outlet, NavLink } from 'react-router-dom'
import {
  LayoutDashboard,
  Settings,
  Calendar,
  FileText,
  GraduationCap,
  Users,
  BookOpen,
} from 'lucide-react'
import { cn } from '../lib/utils'

const nav = [
  { to: '/dashboard',  label: 'Tableau de bord', icon: LayoutDashboard },
  { to: '/exams',      label: 'Examens',          icon: Calendar },
  { to: '/teachers',   label: 'Surveillants',     icon: Users },
  { to: '/filieres',   label: 'Filières',         icon: BookOpen },
  { to: '/documents',  label: 'Documents',        icon: FileText },
  { to: '/settings',   label: 'Paramètres',       icon: Settings },
]

export default function Layout() {
  return (
    <div className="flex min-h-svh w-full">
      <Sidebar />
      <main className="flex-1 overflow-y-auto bg-slate-50 min-h-svh">
        <Outlet />
      </main>
    </div>
  )
}

function Sidebar() {
  return (
    <aside className="w-60 bg-slate-900 flex flex-col shrink-0 sticky top-0 h-svh overflow-y-auto">
      {/* Brand */}
      <div className="px-5 py-6 border-b border-slate-800">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-indigo-500/20 flex items-center justify-center shrink-0">
            <GraduationCap size={18} className="text-indigo-400" />
          </div>
          <div>
            <div className="text-sm font-semibold text-white leading-tight font-display">
              Surveillance
            </div>
            <div className="text-xs text-slate-400 leading-tight">
              des Examens
            </div>
          </div>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 py-4">
        <ul className="flex flex-col gap-0.5 list-none m-0 p-0">
          {nav.map(({ to, label, icon: Icon }) => (
            <li key={to}>
              <NavLink
                to={to}
                className={({ isActive }) =>
                  cn(
                    'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-150 no-underline',
                    isActive
                      ? 'text-white bg-indigo-500/15 border-l-2 border-indigo-400'
                      : 'text-slate-400 hover:text-white hover:bg-slate-800 border-l-2 border-transparent',
                  )
                }
              >
                {({ isActive }) => (
                  <>
                    <Icon
                      size={16}
                      className={cn('shrink-0', isActive ? 'text-indigo-400' : '')}
                    />
                    {label}
                  </>
                )}
              </NavLink>
            </li>
          ))}
        </ul>
      </nav>

      {/* Footer */}
      <div className="px-5 py-4 border-t border-slate-800 text-xs text-slate-600">
        v1.0.0
      </div>
    </aside>
  )
}
