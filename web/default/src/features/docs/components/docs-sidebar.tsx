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
import { Link, useLocation } from '@tanstack/react-router'
import { cn } from '@/lib/utils'
import { useDocsNav } from '../lib/use-docs-nav'

/** Left navigation rail for the documentation center (Mintlify-style). */
export function DocsSidebar({ onNavigate }: { onNavigate?: () => void }) {
  const groups = useDocsNav()
  const { pathname } = useLocation()

  return (
    <nav className='space-y-6'>
      {groups.map((group) => (
        <div key={group.title}>
          <p className='text-muted-foreground/60 mb-2 px-2 text-[11px] font-bold tracking-[0.12em] uppercase'>
            {group.title}
          </p>
          <ul className='space-y-0.5'>
            {group.items.map((item) => {
              const active = pathname === item.to
              return (
                <li key={item.to}>
                  <Link
                    to={item.to}
                    onClick={onNavigate}
                    className={cn(
                      'flex items-center gap-2 rounded-md px-2 py-1.5 text-sm transition-colors',
                      active
                        ? 'bg-accent text-accent-foreground font-medium'
                        : 'text-muted-foreground hover:bg-accent/50 hover:text-foreground'
                    )}
                  >
                    {item.badge ? (
                      <span className='bg-primary/10 text-primary rounded px-1.5 py-0.5 font-mono text-[10px] font-semibold'>
                        {item.badge}
                      </span>
                    ) : null}
                    <span className='min-w-0 truncate'>{item.label}</span>
                  </Link>
                </li>
              )
            })}
          </ul>
        </div>
      ))}
    </nav>
  )
}
