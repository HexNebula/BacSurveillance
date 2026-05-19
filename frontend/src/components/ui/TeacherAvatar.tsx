import { cn } from '../../lib/utils'
import type { GenderEnum } from '../../types'

export function TeacherAvatar({
  gender,
  size = 'md',
}: {
  gender: GenderEnum
  size?: 'sm' | 'md' | 'lg'
}) {
  const isFemale = gender === 'F'
  const sizes = {
    sm: 'h-9 w-9',
    md: 'h-10 w-10',
    lg: 'h-12 w-12',
  }

  return (
    <div
      className={cn(
        'relative flex shrink-0 items-center justify-center overflow-hidden rounded-lg border shadow-sm',
        sizes[size],
        isFemale
          ? 'border-rose-100 bg-rose-50'
          : 'border-indigo-100 bg-indigo-50',
      )}
      aria-hidden="true"
    >
      <svg
        viewBox="0 0 64 64"
        className={cn('h-full w-full', isFemale ? 'text-rose-500' : 'text-indigo-600')}
        fill="none"
      >
        <circle cx="32" cy="22" r="10" fill="currentColor" opacity="0.95" />
        {isFemale ? (
          <>
            <path d="M18 35c2.8-8 8.1-12 14-12s11.2 4 14 12" fill="currentColor" opacity="0.18" />
            <path d="M19 26c1.4-9.2 6.2-15 13-15s11.6 5.8 13 15c-2.8-2.2-6.8-3.7-13-3.7S21.8 23.8 19 26Z" fill="currentColor" opacity="0.35" />
            <path d="M14 55c2.5-12.8 9.4-19 18-19s15.5 6.2 18 19" fill="currentColor" opacity="0.9" />
            <path d="M23 55c1.5-5.9 4.6-8.7 9-8.7s7.5 2.8 9 8.7" fill="white" opacity="0.18" />
          </>
        ) : (
          <>
            <path d="M20 18c2.1-5.5 6.2-8.3 12-8.3s9.9 2.8 12 8.3c-3.2-1.9-7.2-2.9-12-2.9s-8.8 1-12 2.9Z" fill="currentColor" opacity="0.35" />
            <path d="M13 55c2.7-12.4 9.7-19 19-19s16.3 6.6 19 19" fill="currentColor" opacity="0.9" />
            <path d="M21 55c2.2-6 5.8-9 11-9s8.8 3 11 9" fill="white" opacity="0.16" />
          </>
        )}
      </svg>
    </div>
  )
}
