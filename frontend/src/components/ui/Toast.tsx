import { createContext, useCallback, useState, useRef } from 'react'
import type { ReactNode } from 'react'
import { CheckCircle2, XCircle, Info, X } from 'lucide-react'
import { cn } from '../../lib/utils'

type ToastVariant = 'success' | 'error' | 'info'

interface Toast {
  id: number
  message: string
  variant: ToastVariant
}

interface ToastContextValue {
  toast: (message: string, variant?: ToastVariant) => void
  success: (message: string) => void
  error: (message: string) => void
}

export const ToastContext = createContext<ToastContextValue>({
  toast: () => {},
  success: () => {},
  error: () => {},
})

const VARIANT_CONFIG: Record<ToastVariant, {
  icon: ReactNode
  borderColor: string
  iconColor: string
}> = {
  success: {
    icon: <CheckCircle2 size={16} />,
    borderColor: 'border-l-emerald-500',
    iconColor: 'text-emerald-500',
  },
  error: {
    icon: <XCircle size={16} />,
    borderColor: 'border-l-rose-500',
    iconColor: 'text-rose-500',
  },
  info: {
    icon: <Info size={16} />,
    borderColor: 'border-l-indigo-500',
    iconColor: 'text-indigo-500',
  },
}

function ToastItem({ t, onDismiss }: { t: Toast; onDismiss: (id: number) => void }) {
  const cfg = VARIANT_CONFIG[t.variant]
  return (
    <div
      className={cn(
        'flex items-start gap-3 w-80 rounded-xl bg-white shadow-lg border border-slate-200',
        'p-4 border-l-4 cursor-pointer',
        cfg.borderColor,
      )}
      style={{ animation: 'slide-up-fade 0.25s ease' }}
      onClick={() => onDismiss(t.id)}
    >
      <span className={cn('mt-0.5 shrink-0', cfg.iconColor)}>{cfg.icon}</span>
      <p className="text-sm text-slate-700 font-medium flex-1 leading-snug">{t.message}</p>
      <button
        className="shrink-0 text-slate-400 hover:text-slate-600 transition-colors mt-0.5 cursor-pointer"
        onClick={e => { e.stopPropagation(); onDismiss(t.id) }}
      >
        <X size={14} />
      </button>
    </div>
  )
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([])
  const counter = useRef(0)

  const dismiss = useCallback((id: number) => {
    setToasts(prev => prev.filter(t => t.id !== id))
  }, [])

  const toast = useCallback((message: string, variant: ToastVariant = 'info') => {
    const id = ++counter.current
    setToasts(prev => [...prev, { id, message, variant }])
    setTimeout(() => dismiss(id), 4000)
  }, [dismiss])

  const success = useCallback((message: string) => toast(message, 'success'), [toast])
  const error   = useCallback((message: string) => toast(message, 'error'),   [toast])

  return (
    <ToastContext.Provider value={{ toast, success, error }}>
      {children}
      <div className="fixed top-4 right-4 z-[9999] flex flex-col gap-2 pointer-events-none">
        {toasts.map(t => (
          <div key={t.id} className="pointer-events-auto">
            <ToastItem t={t} onDismiss={dismiss} />
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  )
}
