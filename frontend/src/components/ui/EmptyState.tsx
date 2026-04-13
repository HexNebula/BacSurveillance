import type { ReactNode } from 'react'

interface EmptyStateProps {
  icon?: ReactNode
  message: string
  action?: ReactNode
}

export function EmptyState({ icon, message, action }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center gap-3">
      {icon && (
        <div className="w-16 h-16 rounded-2xl bg-slate-100 flex items-center justify-center text-slate-400 mb-1">
          {icon}
        </div>
      )}
      <p className="text-sm text-slate-400 max-w-xs leading-relaxed">{message}</p>
      {action}
    </div>
  )
}
