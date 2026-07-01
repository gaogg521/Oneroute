/*
Copyright (C) 2023-2026 QuantumNous

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU Affero General Public License as
published by the Free Software Foundation, either version 3 of the
License, or (at your option) any later version.

This program is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
GNU Affero General Public License for more details.

You should have received a copy of the GNU Affero General Public License
along with this program. If not, see <https://www.gnu.org/licenses/>.

For commercial licensing, please contact support@quantumnous.com
*/
import type { ReactNode } from 'react'
import { AlertTriangle, Info, Lightbulb } from 'lucide-react'
import { cn } from '@/lib/utils'

type CalloutTone = 'info' | 'warning' | 'tip'

interface DocCalloutProps {
  tone?: CalloutTone
  children: ReactNode
  className?: string
}

const TONE_STYLES: Record<
  CalloutTone,
  { wrapper: string; icon: typeof Info }
> = {
  info: {
    wrapper:
      'border-blue-500/30 bg-blue-500/5 text-blue-700 dark:text-blue-300',
    icon: Info,
  },
  tip: {
    wrapper:
      'border-emerald-500/30 bg-emerald-500/5 text-emerald-700 dark:text-emerald-300',
    icon: Lightbulb,
  },
  warning: {
    wrapper:
      'border-amber-500/40 bg-amber-500/10 text-amber-700 dark:text-amber-300',
    icon: AlertTriangle,
  },
}

/** A highlighted note/warning box used throughout the docs. */
export function DocCallout({
  tone = 'info',
  children,
  className,
}: DocCalloutProps) {
  const { wrapper, icon: Icon } = TONE_STYLES[tone]
  return (
    <div
      className={cn(
        'my-4 flex gap-2.5 rounded-xl border px-4 py-3 text-sm leading-relaxed',
        wrapper,
        className
      )}
    >
      <Icon className='mt-0.5 size-4 shrink-0' />
      <div className='min-w-0 [&_code]:rounded [&_code]:bg-black/10 [&_code]:px-1 [&_code]:py-0.5 [&_code]:font-mono [&_code]:text-[0.85em] dark:[&_code]:bg-white/10'>
        {children}
      </div>
    </div>
  )
}
