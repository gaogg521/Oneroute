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
import { ArrowRight, ScanLine, Shuffle, Rocket } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { useStatus } from '@/hooks/use-status'
import { useSystemConfig } from '@/hooks/use-system-config'
import { AnimateInView } from '@/components/animate-in-view'
import { TONES, type ToneKey } from '../../lib/tones'

export function WhyUs() {
  const { t } = useTranslation()
  const { systemName } = useSystemConfig()
  const { status } = useStatus()
  const rawDocsLink = (status?.docs_link as string | undefined)?.trim() || ''
  const docsUrl =
    rawDocsLink && !rawDocsLink.includes('docs.newapi.pro')
      ? rawDocsLink
      : '/docs'
  const docsExternal = docsUrl.startsWith('http')

  const items = [
    {
      num: '/01',
      tone: 'blue' as ToneKey,
      icon: ScanLine,
      title: t('Clear model access'),
      desc: t(
        'See supported models, capabilities and docs before you start integrating. No mystery wrappers, no surprise behavior — every model has a documented interface.'
      ),
      linkText: t('Browse supported models'),
      to: '/pricing',
      external: false,
    },
    {
      num: '/02',
      tone: 'violet' as ToneKey,
      icon: Shuffle,
      title: t('Flexible model selection'),
      desc: t(
        'Compare model families as your needs change. Switch between GPT, Claude, Gemini and image or video families without rewriting your stack each time.'
      ),
      linkText: t('Compare model families'),
      to: '/pricing',
      external: false,
    },
    {
      num: '/03',
      tone: 'amber' as ToneKey,
      icon: Rocket,
      title: t('Built for real usage'),
      desc: t(
        'Start from model pages, docs and API access paths — not demos. Every entry point is designed for an integration you can ship to production.'
      ),
      linkText: t('Read the docs'),
      to: docsUrl,
      external: docsExternal,
    },
  ]

  return (
    <section className='border-border/40 relative z-10 border-t px-6 py-14 md:py-20'>
      <div className='mx-auto max-w-6xl'>
        <AnimateInView className='mb-10 max-w-2xl'>
          <p className='text-muted-foreground mb-2.5 text-xs font-medium tracking-widest uppercase'>
            {t('Why')} {systemName}
          </p>
          <h2 className='text-2xl leading-tight font-bold tracking-tight md:text-3xl'>
            {t('Model access should be clear before you integrate.')}
          </h2>
          <p className='text-muted-foreground/80 mt-3.5 text-base leading-relaxed'>
            {t(
              'Not a cheap aggregator, not a model showroom. It is the platform layer that makes adding AI models to a real product a deliberate choice rather than guesswork.'
            )}
          </p>
        </AnimateInView>

        <div className='grid gap-4 md:grid-cols-3'>
          {items.map((item, i) => {
            const tone = TONES[item.tone]
            const Icon = item.icon
            return (
              <AnimateInView
                key={item.num}
                delay={i * 100}
                animation='fade-up'
                className={`group border-border/50 relative flex flex-col overflow-hidden rounded-xl border p-6 transition-all duration-300 md:p-7 ${tone.cardBg} ${tone.hoverBorder}`}
              >
                <span
                  aria-hidden
                  className={`absolute inset-x-0 top-0 h-0.5 opacity-70 ${tone.bar}`}
                />
                <div className='flex items-center justify-between'>
                  <div
                    className={`flex size-10 items-center justify-center rounded-lg ${tone.iconBox}`}
                  >
                    <Icon className='size-5' strokeWidth={1.75} />
                  </div>
                  <span
                    className={`font-mono text-sm font-semibold tabular-nums ${tone.text}`}
                  >
                    {item.num}
                  </span>
                </div>
                <h3 className='mt-5 text-base font-semibold'>{item.title}</h3>
                <p className='text-muted-foreground mt-2.5 flex-1 text-sm leading-relaxed'>
                  {item.desc}
                </p>
                {item.external ? (
                  <a
                    href={item.to}
                    target='_blank'
                    rel='noopener noreferrer'
                    className={`mt-5 inline-flex items-center gap-1.5 text-sm font-medium transition-colors ${tone.text}`}
                  >
                    {item.linkText}
                    <ArrowRight className='size-3.5 transition-transform duration-200 group-hover:translate-x-0.5' />
                  </a>
                ) : (
                  <Link
                    to={item.to}
                    className={`mt-5 inline-flex items-center gap-1.5 text-sm font-medium transition-colors ${tone.text}`}
                  >
                    {item.linkText}
                    <ArrowRight className='size-3.5 transition-transform duration-200 group-hover:translate-x-0.5' />
                  </Link>
                )}
              </AnimateInView>
            )
          })}
        </div>
      </div>
    </section>
  )
}
