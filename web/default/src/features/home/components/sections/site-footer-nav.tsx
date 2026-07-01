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
import { Link } from '@tanstack/react-router'
import { useTranslation } from 'react-i18next'
import { useStatus } from '@/hooks/use-status'
import { useSystemConfig } from '@/hooks/use-system-config'

interface NavColumn {
  title: string
  items: { label: string; to: string; external?: boolean }[]
}

export function SiteFooterNav() {
  const { t } = useTranslation()
  const { systemName, logo } = useSystemConfig()
  const { status } = useStatus()
  // Use the built-in docs center (/docs) by default; only go external when an
  // admin set a custom docs_link that is NOT the legacy upstream default.
  const rawDocsLink = (status?.docs_link as string | undefined)?.trim() || ''
  const externalDocsUrl =
    rawDocsLink && !rawDocsLink.includes('docs.newapi.pro') ? rawDocsLink : ''
  const docsUrl = externalDocsUrl || '/docs'
  const docsExternal = Boolean(externalDocsUrl)
  const displayLogo = logo || '/logo.png'

  const llm = ['GPT', 'Claude', 'Gemini', 'DeepSeek', 'Qwen', 'Kimi']
  const image = ['GPT Image', 'Midjourney', 'Flux', 'Stable Diffusion']
  const video = ['Sora', 'Veo', 'Kling', 'Runway', 'Hailuo']

  const columns: NavColumn[] = [
    {
      title: t('LLM API'),
      items: llm.map((m) => ({ label: m, to: '/pricing' })),
    },
    {
      title: t('Image API'),
      items: image.map((m) => ({ label: m, to: '/pricing' })),
    },
    {
      title: t('Video API'),
      items: video.map((m) => ({ label: m, to: '/pricing' })),
    },
    {
      title: t('Product'),
      items: [
        { label: t('Models'), to: '/pricing' },
        { label: t('Pricing'), to: '/pricing' },
        { label: t('Docs'), to: docsUrl, external: docsExternal },
      ],
    },
  ]

  return (
    <section className='border-border/40 relative z-10 border-t px-6 py-16 md:py-20'>
      <div className='mx-auto max-w-6xl'>
        <div className='flex flex-col gap-10 md:flex-row md:justify-between md:gap-16'>
          {/* Brand */}
          <div className='max-w-xs shrink-0'>
            <Link to='/' className='flex items-center gap-2.5'>
              <img
                src={displayLogo}
                alt={systemName}
                className='size-7 rounded-lg object-contain'
              />
              <span className='text-base font-semibold tracking-tight'>
                {systemName}
              </span>
            </Link>
            <p className='text-muted-foreground/70 mt-4 text-sm leading-relaxed'>
              {t('One API for the world top AI image, video and chat models.')}
            </p>
          </div>

          {/* Link columns */}
          <div className='grid flex-1 grid-cols-2 gap-8 sm:grid-cols-4 md:max-w-3xl'>
            {columns.map((col) => (
              <div key={col.title}>
                <p className='text-muted-foreground/50 mb-3 text-[11px] font-bold tracking-[0.15em] uppercase'>
                  {col.title}
                </p>
                <ul className='space-y-2.5'>
                  {col.items.map((item) => (
                    <li key={item.label}>
                      {item.external ? (
                        <a
                          href={item.to}
                          target='_blank'
                          rel='noopener noreferrer'
                          className='text-muted-foreground hover:text-foreground text-sm transition-colors'
                        >
                          {item.label}
                        </a>
                      ) : (
                        <Link
                          to={item.to}
                          className='text-muted-foreground hover:text-foreground text-sm transition-colors'
                        >
                          {item.label}
                        </Link>
                      )}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  )
}
