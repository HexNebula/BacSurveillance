import { useContext } from 'react'
import { ToastContext } from '../components/ui/ToastContext'

export function useToast() {
  return useContext(ToastContext)
}
