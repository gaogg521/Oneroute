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
import { type ReactNode, useState } from 'react'
import { Menu, X } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { PublicLayout } from '@/components/layout'
import { DocsSidebar } from './docs-sidebar'

/**
 * Documentation shell: public header + sticky left sidebar + content column.
 * The sidebar collapses behind a toggle on mobile.
 */
export function DocsLayout({ children }: { children: ReactNode }) {
  const { t } = useTranslation()
  const [mobileOpen, setMobileOpen] = useState(false)

  return (
    <PublicLayout showMainContainer={false}>
      <div className='mx-auto w-full max-w-7xl px-4 pt-20 pb-16 md:px-6'>
        {/* Mobile sidebar toggle */}
        <button
          type='button'
          onClick={() => setMobileOpen((v) => !v)}
          className='border-border/60 text-muted-foreground hover:text-foreground mb-4 inline-flex items-center gap-2 rounded-md border px-3 py-1.5 text-sm md:hidden'
          aria-expanded={mobileOpen}
        >
          {mobileOpen ? <X className='size-4' /> : <Menu className='size-4' />}
          {t('Documentation')}
        </button>

        <div className='flex gap-8'>
          {/* Sidebar */}
          <aside
            className={`${
              mobileOpen ? 'block' : 'hidden'
            } md:block md:w-60 md:shrink-0`}
          >
            <div className='md:sticky md:top-24 md:max-h-[calc(100vh-7rem)] md:overflow-y-auto md:pr-2'>
              <DocsSidebar onNavigate={() => setMobileOpen(false)} />
            </div>
          </aside>

          {/* Content */}
          <main className='min-w-0 flex-1'>
            <article className='mx-auto max-w-3xl'>{children}</article>
          </main>
        </div>
      </div>
    </PublicLayout>
  )
}
