import * as Dialog from '@radix-ui/react-dialog'
import type { ReactNode } from 'react'
import { X } from 'lucide-react'
import { cn } from '../../lib/utils'

type ModalSize = 'sm' | 'md' | 'lg'

interface ModalProps {
  open: boolean
  onClose: () => void
  title: string
  size?: ModalSize
  children: ReactNode
}

const MAX_WIDTH: Record<ModalSize, string> = {
  sm: 'max-w-sm',
  md: 'max-w-lg',
  lg: 'max-w-2xl',
}

export function Modal({ open, onClose, title, size = 'md', children }: ModalProps) {
  return (
    <Dialog.Root open={open} onOpenChange={v => { if (!v) onClose() }}>
      <Dialog.Portal>
        <Dialog.Overlay
          className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50"
          style={{ animation: open ? 'fade-in 0.15s ease' : 'fade-out 0.15s ease' }}
        />
        <Dialog.Content
          className={cn(
            'fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-50',
            'w-[calc(100vw-2rem)] bg-white rounded-2xl shadow-2xl',
            'flex flex-col max-h-[90vh] overflow-hidden',
            'border-t-[3px] border-t-indigo-500',
            MAX_WIDTH[size],
          )}
          style={{ animation: open ? 'zoom-in 0.2s ease' : 'zoom-out 0.15s ease' }}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 shrink-0">
            <Dialog.Title className="font-display text-lg font-bold text-slate-900">
              {title}
            </Dialog.Title>
            <Dialog.Close asChild>
              <button
                className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer"
                onClick={onClose}
              >
                <X size={16} />
              </button>
            </Dialog.Close>
          </div>

          {/* Body */}
          <div className="px-6 py-5 overflow-y-auto flex-1">
            {children}
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
