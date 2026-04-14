import { useState, useMemo } from 'react'
import { Search } from 'lucide-react'
import { useWorkload } from '../../hooks/useAssignment'
import { useAllTeachers } from '../../hooks/useAssignment'
import { PageHeader } from '../../components/ui/PageHeader'
import { Spinner } from '../../components/ui/Spinner'
import { EmptyState } from '../../components/ui/EmptyState'
import { cn } from '../../lib/utils'
import type { WorkloadLedger } from '../../types'
import type { Teacher } from '../../types'

// ── Helpers ───────────────────────────────────────────────────────────────────

function currentYear(): string {
  const now = new Date()
  const y = now.getFullYear()
  return now.getMonth() >= 8 ? `${y}-${y + 1}` : `${y - 1}-${y}`
}

function yearOptions(): { value: string; label: string }[] {
  const base = new Date().getFullYear()
  return Array.from({ length: 4 }, (_, i) => {
    const y = base - i
    const val = `${y}-${y + 1}`
    return { value: val, label: val }
  })
}

function MiniBar({ value, max, className }: { value: number; max: number; className: string }) {
  const pct = max > 0 ? Math.min(100, Math.round((value / max) * 100)) : 0
  return (
    <div className="flex items-center gap-2 w-full">
      <div className="flex-1 h-1.5 bg-slate-100 rounded-full overflow-hidden">
        <div className={cn('h-full rounded-full transition-all', className)} style={{ width: `${pct}%` }} />
      </div>
      <span className="text-xs font-semibold text-slate-600 w-5 text-right tabular-nums">{value}</span>
    </div>
  )
}

function StatCard({ label, value, sub, color }: { label: string; value: string | number; sub?: string; color: string }) {
  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm px-5 py-4">
      <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">{label}</p>
      <p className={cn('text-2xl font-bold leading-none', color)}>{value}</p>
      {sub && <p className="text-xs text-slate-400 mt-1">{sub}</p>}
    </div>
  )
}

// ── Row ───────────────────────────────────────────────────────────────────────

function TeacherRow({ teacher, ledger, maxTotal }: {
  teacher: Teacher
  ledger: WorkloadLedger | undefined
  maxTotal: number
}) {
  const total = ledger?.total_count ?? 0
  const bac1  = ledger?.bac1_count ?? 0
  const bac2  = ledger?.bac2_count ?? 0
  const matin = ledger?.morning_count ?? 0
  const apm   = ledger?.afternoon_count ?? 0

  const isFemale = teacher.gender === 'F'
  const initials = (() => {
    const parts = teacher.name_fr.trim().split(/\s+/)
    return parts.length === 1 ? parts[0][0] : (parts[0][0] + parts[parts.length - 1][0])
  })().toUpperCase()

  return (
    <tr className="border-b border-slate-100 hover:bg-slate-50/80 transition-colors group">
      {/* Teacher identity */}
      <td className="px-5 py-3">
        <div className="flex items-center gap-3">
          <div className={cn(
            'w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold text-white shrink-0',
            isFemale ? 'bg-gradient-to-br from-rose-400 to-pink-500' : 'bg-gradient-to-br from-indigo-500 to-violet-600',
          )}>
            {initials}
          </div>
          <div className="min-w-0">
            <div className="text-sm font-semibold text-slate-800 truncate">{teacher.name_fr}</div>
            <div className="text-xs text-slate-400 font-mono">{teacher.cin}</div>
          </div>
        </div>
      </td>

      {/* Subject */}
      <td className="px-4 py-3 text-xs text-slate-500 max-w-[140px] truncate">
        {teacher.subject_name ?? '—'}
      </td>

      {/* Total with bar */}
      <td className="px-4 py-3 w-40">
        {total > 0 ? (
          <MiniBar value={total} max={maxTotal} className={total >= maxTotal * 0.8 ? 'bg-emerald-500' : total >= maxTotal * 0.5 ? 'bg-indigo-500' : 'bg-slate-400'} />
        ) : (
          <span className="text-xs text-slate-300">—</span>
        )}
      </td>

      {/* BAC1 */}
      <td className="px-4 py-3 w-32">
        {total > 0 ? <MiniBar value={bac1} max={total} className="bg-indigo-400" /> : <span className="text-xs text-slate-300">—</span>}
      </td>

      {/* BAC2 */}
      <td className="px-4 py-3 w-32">
        {total > 0 ? <MiniBar value={bac2} max={total} className="bg-violet-400" /> : <span className="text-xs text-slate-300">—</span>}
      </td>

      {/* Matin */}
      <td className="px-4 py-3 text-center">
        <span className={cn('text-xs font-semibold tabular-nums', matin > 0 ? 'text-amber-600' : 'text-slate-300')}>
          {matin > 0 ? matin : '—'}
        </span>
      </td>

      {/* Après-midi */}
      <td className="px-4 py-3 text-center">
        <span className={cn('text-xs font-semibold tabular-nums', apm > 0 ? 'text-blue-600' : 'text-slate-300')}>
          {apm > 0 ? apm : '—'}
        </span>
      </td>
    </tr>
  )
}

// ── Page ──────────────────────────────────────────────────────────────────────

type SortKey = 'name' | 'total' | 'bac1' | 'bac2' | 'matin' | 'apm'

export default function WorkloadPage() {
  const [year, setYear]     = useState(currentYear)
  const [search, setSearch] = useState('')
  const [sort, setSort]     = useState<SortKey>('total')
  const [asc, setAsc]       = useState(false)

  const { data: teachers = [], isLoading: tLoading } = useAllTeachers()
  const { data: workload = [], isLoading: wLoading }  = useWorkload(year)

  const isLoading = tLoading || wLoading

  const ledgerByCin = useMemo(
    () => Object.fromEntries(workload.map(l => [l.cin, l])),
    [workload],
  )

  const maxTotal = useMemo(
    () => Math.max(1, ...workload.map(l => l.total_count)),
    [workload],
  )

  // Stats
  const assigned   = teachers.filter(t => ledgerByCin[t.cin]?.total_count > 0).length
  const totalSessions = workload.reduce((s, l) => s + l.total_count, 0)
  const avg = assigned > 0 ? (totalSessions / assigned).toFixed(1) : '—'

  const toggleSort = (key: SortKey) => {
    if (sort === key) setAsc(v => !v)
    else { setSort(key); setAsc(false) }
  }

  const filtered = useMemo(() => {
    const q = search.toLowerCase()
    let rows = teachers.filter(t =>
      !q || t.name_fr.toLowerCase().includes(q) || t.cin.toLowerCase().includes(q) || (t.subject_name ?? '').toLowerCase().includes(q)
    )
    rows = [...rows].sort((a, b) => {
      const la = ledgerByCin[a.cin]
      const lb = ledgerByCin[b.cin]
      let diff = 0
      if (sort === 'name')  diff = a.name_fr.localeCompare(b.name_fr)
      if (sort === 'total') diff = (la?.total_count ?? 0) - (lb?.total_count ?? 0)
      if (sort === 'bac1')  diff = (la?.bac1_count ?? 0) - (lb?.bac1_count ?? 0)
      if (sort === 'bac2')  diff = (la?.bac2_count ?? 0) - (lb?.bac2_count ?? 0)
      if (sort === 'matin') diff = (la?.morning_count ?? 0) - (lb?.morning_count ?? 0)
      if (sort === 'apm')   diff = (la?.afternoon_count ?? 0) - (lb?.afternoon_count ?? 0)
      return asc ? diff : -diff
    })
    return rows
  }, [teachers, ledgerByCin, search, sort, asc])

  function SortTh({ label, col, className = '' }: { label: string; col: SortKey; className?: string }) {
    const active = sort === col
    return (
      <th
        onClick={() => toggleSort(col)}
        className={cn(
          'px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider cursor-pointer select-none transition-colors',
          active ? 'text-indigo-600 bg-indigo-50/60' : 'text-slate-500 hover:text-slate-700',
          className,
        )}
      >
        <div className="flex items-center gap-1">
          {label}
          <span className={cn('text-[10px]', active ? 'text-indigo-400' : 'text-slate-300')}>
            {active ? (asc ? '↑' : '↓') : '↕'}
          </span>
        </div>
      </th>
    )
  }

  return (
    <div className="p-8">
      <PageHeader
        title="Charge de travail"
        subtitle="Répartition des séances de surveillance par professeur sur l'année scolaire"
      />

      {/* Year + search bar */}
      <div className="flex items-center gap-3 mb-6 flex-wrap">
        <select
          value={year}
          onChange={e => setYear(e.target.value)}
          className="h-9 px-3 text-sm rounded-lg border border-slate-200 bg-white text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400 transition-all"
        >
          {yearOptions().map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>

        <div className="relative flex-1 max-w-xs">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Rechercher un professeur, CIN, matière…"
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full h-9 pl-8 pr-3 text-sm rounded-lg border border-slate-200 bg-white text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400 transition-all"
          />
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        <StatCard label="Professeurs inscrits" value={teachers.length} color="text-slate-800" />
        <StatCard label="Ont participé" value={assigned} sub={`sur ${teachers.length}`} color="text-indigo-600" />
        <StatCard label="Total séances" value={totalSessions} color="text-violet-600" />
        <StatCard label="Moyenne / prof" value={avg} sub="séances (participants)" color="text-emerald-600" />
      </div>

      {isLoading ? (
        <div className="flex justify-center py-16"><Spinner size={24} className="text-indigo-500" /></div>
      ) : teachers.length === 0 ? (
        <EmptyState message="Aucun professeur enregistré." />
      ) : (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
          <table className="w-full border-collapse">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50">
                <SortTh label="Professeur" col="name" className="w-56" />
                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Matière</th>
                <SortTh label="Total" col="total" className="w-40" />
                <SortTh label="1BAC" col="bac1" className="w-32" />
                <SortTh label="2BAC" col="bac2" className="w-32" />
                <SortTh label="Matin" col="matin" className="w-20 text-center" />
                <SortTh label="AM" col="apm" className="w-20 text-center" />
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-5 py-10 text-center text-sm text-slate-400">
                    Aucun résultat pour « {search} »
                  </td>
                </tr>
              ) : (
                filtered.map(t => (
                  <TeacherRow
                    key={t.id}
                    teacher={t}
                    ledger={ledgerByCin[t.cin]}
                    maxTotal={maxTotal}
                  />
                ))
              )}
            </tbody>
          </table>
          <div className="px-5 py-2.5 border-t border-slate-100 bg-slate-50/60 text-xs text-slate-400">
            {filtered.length} professeur{filtered.length !== 1 ? 's' : ''}
            {search ? ` correspondant à « ${search} »` : ''}
          </div>
        </div>
      )}
    </div>
  )
}
