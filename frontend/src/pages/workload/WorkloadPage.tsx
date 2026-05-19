import { useMemo, useState } from 'react'
import { ArrowDownUp, Search } from 'lucide-react'
import { Modal } from '../../components/ui/Modal'
import { useAllTeachers, useWorkload } from '../../hooks/useAssignment'
import { EmptyState } from '../../components/ui/EmptyState'
import { PageHeader } from '../../components/ui/PageHeader'
import { Spinner } from '../../components/ui/Spinner'
import { TeacherAvatar } from '../../components/ui/TeacherAvatar'
import { cn } from '../../lib/utils'
import type { Teacher, WorkloadLedger } from '../../types'

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

function StatCard({ label, value, sub, color }: { label: string; value: string | number; sub?: string; color: string }) {
  return (
    <div className="bg-white rounded-lg border border-slate-200 shadow-sm px-5 py-4">
      <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">{label}</p>
      <p className={cn('text-2xl font-bold leading-none', color)}>{value}</p>
      {sub && <p className="text-xs text-slate-400 mt-1">{sub}</p>}
    </div>
  )
}

type Balance = 'low' | 'balanced' | 'high'

function balanceFor(total: number, average: number): Balance {
  if (total === 0 || total < Math.max(1, average - 1)) return 'low'
  if (total > average + 1) return 'high'
  return 'balanced'
}

function BalanceBadge({ balance }: { balance: Balance }) {
  const config = {
    low: 'bg-amber-50 text-amber-700 border-amber-200',
    balanced: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    high: 'bg-rose-50 text-rose-700 border-rose-200',
  }
  const label = {
    low: 'Sous-chargé',
    balanced: 'Équilibré',
    high: 'Sur-chargé',
  }

  return (
    <span className={cn('inline-flex h-6 items-center rounded-full border px-2 text-[11px] font-semibold', config[balance])}>
      {label[balance]}
    </span>
  )
}

function LoadBar({ total, average, maxTotal }: { total: number; average: number; maxTotal: number }) {
  const pct = maxTotal > 0 ? Math.min(100, Math.round((total / maxTotal) * 100)) : 0
  const avgPct = maxTotal > 0 ? Math.min(100, Math.round((average / maxTotal) * 100)) : 0
  return (
    <div className="relative h-2 rounded-full bg-slate-100 overflow-hidden">
      <div className="h-full rounded-full bg-slate-900 transition-all" style={{ width: `${pct}%` }} />
      <div className="absolute top-0 h-full w-px bg-emerald-500" style={{ left: `${avgPct}%` }} />
    </div>
  )
}

function workloadStats(ledger: WorkloadLedger | undefined) {
  const total = ledger?.total_count ?? 0
  const reserve = ledger?.reserve_count ?? 0
  const madaoum = ledger?.madaoume_count ?? 0
  return {
    total,
    reserve,
    madaoum,
    supervision: Math.max(0, total - reserve - madaoum),
    bac1: ledger?.bac1_count ?? 0,
    bac2: ledger?.bac2_count ?? 0,
    morning: ledger?.morning_count ?? 0,
    afternoon: ledger?.afternoon_count ?? 0,
  }
}

function TeacherWorkloadCard({
  teacher,
  ledger,
  maxTotal,
  average,
  onOpen,
}: {
  teacher: Teacher
  ledger: WorkloadLedger | undefined
  maxTotal: number
  average: number
  onOpen: () => void
}) {
  const { total, reserve, madaoum, supervision } = workloadStats(ledger)
  const balance = balanceFor(total, average)

  return (
    <button
      type="button"
      onClick={onOpen}
      className="group w-full rounded-lg border border-slate-200 bg-white p-4 text-left shadow-sm transition-all hover:-translate-y-0.5 hover:border-indigo-300 hover:shadow-md focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <TeacherAvatar gender={teacher.gender} />
          <div className="min-w-0">
            <h3 className="truncate text-sm font-bold leading-tight text-slate-900">{teacher.name_fr}</h3>
            <p className="mt-0.5 truncate text-xs text-slate-500">
              <span className="font-mono">{teacher.cin}</span>
              <span className="px-1.5 text-slate-300">·</span>
              {teacher.subject_name ?? 'Matière non renseignée'}
            </p>
          </div>
        </div>
        <div className="text-right">
          <div className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">Total</div>
          <div className="text-3xl font-bold leading-none text-slate-900 tabular-nums">{total}</div>
        </div>
      </div>

      <div className="mt-3 space-y-2">
        <div className="flex items-center justify-between gap-3">
          <span className="text-xs font-medium text-slate-500">Charge annuelle</span>
          <BalanceBadge balance={balance} />
        </div>
        <LoadBar total={total} average={average} maxTotal={maxTotal} />
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-600">
        <span>Surv. <strong className="text-slate-900 tabular-nums">{supervision}</strong></span>
        <span className="text-slate-300">·</span>
        <span>Rés. <strong className="text-amber-700 tabular-nums">{reserve}</strong></span>
        <span className="text-slate-300">·</span>
        <span>Perm. <strong className="text-emerald-700 tabular-nums">{madaoum}</strong></span>
      </div>
    </button>
  )
}

function DetailRow({ label, value, accent }: { label: string; value: number; accent?: string }) {
  return (
    <div className="flex items-center justify-between rounded-md border border-slate-100 bg-slate-50 px-3 py-2">
      <span className="text-sm text-slate-500">{label}</span>
      <span className={cn('text-sm font-bold tabular-nums text-slate-900', accent)}>{value}</span>
    </div>
  )
}

function TeacherWorkloadModal({
  teacher,
  ledger,
  average,
  maxTotal,
  onClose,
}: {
  teacher: Teacher | null
  ledger: WorkloadLedger | undefined
  average: number
  maxTotal: number
  onClose: () => void
}) {
  if (!teacher) return null

  const stats = workloadStats(ledger)
  const balance = balanceFor(stats.total, average)

  return (
    <Modal open={!!teacher} onClose={onClose} title="Détail professeur" size="md">
      <div className="space-y-5">
        <div className="flex items-start justify-between gap-4">
          <div className="flex min-w-0 items-center gap-3">
            <TeacherAvatar gender={teacher.gender} size="lg" />
            <div className="min-w-0">
              <h2 className="truncate text-lg font-bold text-slate-900">{teacher.name_fr}</h2>
              <p className="mt-0.5 text-sm text-slate-500">
                <span className="font-mono">{teacher.cin}</span>
                <span className="px-1.5 text-slate-300">·</span>
                {teacher.subject_name ?? 'Matière non renseignée'}
              </p>
              {teacher.school && <p className="mt-0.5 text-xs text-slate-400">{teacher.school}</p>}
            </div>
          </div>
          <div className="text-right">
            <div className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">Total</div>
            <div className="text-4xl font-bold leading-none text-slate-900 tabular-nums">{stats.total}</div>
          </div>
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-slate-600">Charge annuelle</span>
            <BalanceBadge balance={balance} />
          </div>
          <LoadBar total={stats.total} average={average} maxTotal={maxTotal} />
        </div>

        <div className="grid gap-2 sm:grid-cols-3">
          <DetailRow label="Surveillance" value={stats.supervision} accent="text-indigo-700" />
          <DetailRow label="Réserve" value={stats.reserve} accent="text-amber-700" />
          <DetailRow label="Permanence" value={stats.madaoum} accent="text-emerald-700" />
        </div>

        <div className="grid gap-2 sm:grid-cols-2">
          <DetailRow label="1BAC" value={stats.bac1} />
          <DetailRow label="2BAC" value={stats.bac2} />
          <DetailRow label="Matin" value={stats.morning} />
          <DetailRow label="Après-midi" value={stats.afternoon} />
        </div>
      </div>
    </Modal>
  )
}

type SortKey = 'total' | 'name' | 'bac1' | 'bac2' | 'matin' | 'apres-midi'

const SORT_OPTIONS: { value: SortKey; label: string }[] = [
  { value: 'total', label: 'Total' },
  { value: 'name', label: 'Nom' },
  { value: 'bac1', label: '1BAC' },
  { value: 'bac2', label: '2BAC' },
  { value: 'matin', label: 'Matin' },
  { value: 'apres-midi', label: 'Après-midi' },
]

export default function WorkloadPage() {
  const [year, setYear] = useState(currentYear)
  const [search, setSearch] = useState('')
  const [sort, setSort] = useState<SortKey>('total')
  const [asc, setAsc] = useState(false)
  const [selectedTeacher, setSelectedTeacher] = useState<Teacher | null>(null)

  const { data: teachers = [], isLoading: tLoading } = useAllTeachers()
  const { data: workload = [], isLoading: wLoading } = useWorkload(year)

  const isLoading = tLoading || wLoading

  const ledgerByCin = useMemo(
    () => Object.fromEntries(workload.map(l => [l.cin, l])),
    [workload],
  )

  const maxTotal = useMemo(
    () => Math.max(1, ...workload.map(l => l.total_count)),
    [workload],
  )

  const assigned = teachers.filter(t => ledgerByCin[t.cin]?.total_count > 0).length
  const totalActivities = workload.reduce((s, l) => s + l.total_count, 0)
  const average = assigned > 0 ? totalActivities / assigned : 0
  const avgLabel = assigned > 0 ? average.toFixed(1) : '—'

  const filtered = useMemo(() => {
    const q = search.toLowerCase()
    const rows = teachers.filter(t =>
      !q
      || t.name_fr.toLowerCase().includes(q)
      || t.cin.toLowerCase().includes(q)
      || (t.subject_name ?? '').toLowerCase().includes(q)
    )

    return [...rows].sort((a, b) => {
      const la = ledgerByCin[a.cin]
      const lb = ledgerByCin[b.cin]
      let diff = 0
      if (sort === 'name') diff = a.name_fr.localeCompare(b.name_fr)
      if (sort === 'total') diff = (la?.total_count ?? 0) - (lb?.total_count ?? 0)
      if (sort === 'bac1') diff = (la?.bac1_count ?? 0) - (lb?.bac1_count ?? 0)
      if (sort === 'bac2') diff = (la?.bac2_count ?? 0) - (lb?.bac2_count ?? 0)
      if (sort === 'matin') diff = (la?.morning_count ?? 0) - (lb?.morning_count ?? 0)
      if (sort === 'apres-midi') diff = (la?.afternoon_count ?? 0) - (lb?.afternoon_count ?? 0)
      return asc ? diff : -diff
    })
  }, [asc, ledgerByCin, search, sort, teachers])

  return (
    <div className="p-8">
      <PageHeader
        title="Charge de travail"
        subtitle="Répartition des activités de surveillance par professeur sur l'année scolaire"
      />

      <div className="mb-6 flex flex-wrap items-center gap-3">
        <select
          value={year}
          onChange={e => setYear(e.target.value)}
          className="h-9 rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-700 transition-all focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
        >
          {yearOptions().map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>

        <div className="relative min-w-[280px] flex-1 max-w-md">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Rechercher un professeur, CIN, matière..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="h-9 w-full rounded-lg border border-slate-200 bg-white pl-8 pr-3 text-sm text-slate-700 transition-all focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
          />
        </div>

        <div className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-2 py-1">
          <ArrowDownUp size={14} className="text-slate-400" />
          <select
            value={sort}
            onChange={e => setSort(e.target.value as SortKey)}
            className="h-7 bg-transparent text-sm text-slate-700 focus:outline-none"
          >
            {SORT_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
          <button
            type="button"
            onClick={() => setAsc(v => !v)}
            className="h-7 rounded-md px-2 text-xs font-semibold text-slate-500 hover:bg-slate-100 hover:text-slate-800"
          >
            {asc ? 'Asc' : 'Desc'}
          </button>
        </div>
      </div>

      <div className="mb-6 grid grid-cols-2 gap-3 md:grid-cols-4">
        <StatCard label="Professeurs inscrits" value={teachers.length} color="text-slate-800" />
        <StatCard label="Ont participé" value={assigned} sub={`sur ${teachers.length}`} color="text-indigo-600" />
        <StatCard label="Total activités" value={totalActivities} color="text-violet-600" />
        <StatCard label="Moyenne / prof" value={avgLabel} sub="activités (participants)" color="text-emerald-600" />
      </div>

      {isLoading ? (
        <div className="flex justify-center py-16"><Spinner size={24} className="text-indigo-500" /></div>
      ) : teachers.length === 0 ? (
        <EmptyState message="Aucun professeur enregistré." />
      ) : filtered.length === 0 ? (
        <EmptyState message={`Aucun résultat pour « ${search} »`} />
      ) : (
        <>
          <div className="grid gap-4 md:grid-cols-2 2xl:grid-cols-3">
            {filtered.map(teacher => (
              <TeacherWorkloadCard
                key={teacher.id}
                teacher={teacher}
                ledger={ledgerByCin[teacher.cin]}
                maxTotal={maxTotal}
                average={average}
                onOpen={() => setSelectedTeacher(teacher)}
              />
            ))}
          </div>
          <div className="mt-4 text-xs text-slate-400">
            {filtered.length} professeur{filtered.length !== 1 ? 's' : ''}
            {search ? ` correspondant à « ${search} »` : ''}
          </div>
        </>
      )}

      <TeacherWorkloadModal
        teacher={selectedTeacher}
        ledger={selectedTeacher ? ledgerByCin[selectedTeacher.cin] : undefined}
        average={average}
        maxTotal={maxTotal}
        onClose={() => setSelectedTeacher(null)}
      />
    </div>
  )
}
