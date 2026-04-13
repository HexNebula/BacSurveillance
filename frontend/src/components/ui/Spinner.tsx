import { cn } from '../../lib/utils'

interface SpinnerProps {
  size?: number
  className?: string
}

export function Spinner({ size = 20, className }: SpinnerProps) {
  return (
    <div
      className={cn('rounded-full border-2 border-current border-t-transparent animate-spin', className)}
      style={{ width: size, height: size, flexShrink: 0 }}
    />
  )
}
