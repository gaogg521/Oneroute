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
import { cn } from '@/lib/utils'

/** Slugify a heading's text content for use as an anchor id. */
function slugify(value: ReactNode): string | undefined {
  if (typeof value !== 'string') return undefined
  return value
    .toLowerCase()
    .trim()
    .replace(/[^\w一-鿿]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

/** Page header: eyebrow + title + lead paragraph. */
export function DocPageHeader({
  eyebrow,
  title,
  lead,
}: {
  eyebrow?: string
  title: string
  lead?: ReactNode
}) {
  return (
    <header className='mb-8'>
      {eyebrow ? (
        <p className='text-muted-foreground mb-2 text-xs font-semibold tracking-widest uppercase'>
          {eyebrow}
        </p>
      ) : null}
      <h1 className='text-3xl font-bold tracking-tight'>{title}</h1>
      {lead ? (
        <p className='text-muted-foreground mt-3 text-base leading-relaxed'>
          {lead}
        </p>
      ) : null}
    </header>
  )
}

export function DocH2({
  children,
  className,
}: {
  children: ReactNode
  className?: string
}) {
  return (
    <h2
      id={slugify(children)}
      className={cn(
        'border-border/50 mt-10 scroll-mt-24 border-t pt-8 text-xl font-semibold tracking-tight first:mt-0 first:border-t-0 first:pt-0',
        className
      )}
    >
      {children}
    </h2>
  )
}

export function DocH3({
  children,
  className,
}: {
  children: ReactNode
  className?: string
}) {
  return (
    <h3
      id={slugify(children)}
      className={cn('mt-6 scroll-mt-24 text-base font-semibold', className)}
    >
      {children}
    </h3>
  )
}

export function DocP({
  children,
  className,
}: {
  children: ReactNode
  className?: string
}) {
  return (
    <p
      className={cn(
        'text-muted-foreground mt-3 text-sm leading-relaxed',
        className
      )}
    >
      {children}
    </p>
  )
}

export function DocUl({
  children,
  className,
}: {
  children: ReactNode
  className?: string
}) {
  return (
    <ul
      className={cn(
        'text-muted-foreground mt-3 ml-5 list-disc space-y-1.5 text-sm leading-relaxed marker:text-muted-foreground/50',
        className
      )}
    >
      {children}
    </ul>
  )
}

export function DocOl({
  children,
  className,
}: {
  children: ReactNode
  className?: string
}) {
  return (
    <ol
      className={cn(
        'text-muted-foreground mt-3 ml-5 list-decimal space-y-1.5 text-sm leading-relaxed marker:text-muted-foreground/50',
        className
      )}
    >
      {children}
    </ol>
  )
}

/** Inline monospace code token. Children are optional so it can be used as a
 * <Trans> component placeholder (children are injected at interpolation time). */
export function DocCode({ children }: { children?: ReactNode }) {
  return (
    <code className='bg-muted text-foreground/90 rounded px-1.5 py-0.5 font-mono text-[0.85em]'>
      {children}
    </code>
  )
}
