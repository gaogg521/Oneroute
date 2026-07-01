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
import { cn } from '@/lib/utils'
import { CopyButton } from '@/components/copy-button'

interface DocCodeBlockProps {
  /** Raw code/text to display and copy. */
  code: string
  /** Optional label shown in the header bar (e.g. "cURL", "settings.json"). */
  language?: string
  className?: string
}

/**
 * A copyable code block for documentation pages: monospace body with a
 * top-right copy button and an optional language label.
 */
export function DocCodeBlock({ code, language, className }: DocCodeBlockProps) {
  return (
    <div
      className={cn(
        'border-border/60 bg-muted/40 group relative my-4 overflow-hidden rounded-xl border',
        className
      )}
    >
      {language ? (
        <div className='border-border/60 text-muted-foreground flex items-center justify-between border-b px-4 py-1.5 text-xs font-medium'>
          <span>{language}</span>
        </div>
      ) : null}
      <div className='absolute top-1.5 right-1.5 z-10'>
        <CopyButton
          value={code}
          size='icon'
          variant='ghost'
          iconClassName='size-3.5'
          className='h-7 w-7 opacity-0 transition-opacity group-hover:opacity-100 focus-visible:opacity-100'
        />
      </div>
      <pre className='overflow-x-auto px-4 py-3 text-[13px] leading-relaxed'>
        <code className='font-mono whitespace-pre'>{code}</code>
      </pre>
    </div>
  )
}
