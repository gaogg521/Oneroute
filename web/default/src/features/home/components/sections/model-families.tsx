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
import { ArrowRight } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { AnimateInView } from '@/components/animate-in-view'
import { TONES, type ToneKey } from '../../lib/tones'

export function ModelFamilies() {
  const { t } = useTranslation()

  const families: {
    name: string
    desc: string
    tags: string[]
    tone: ToneKey
  }[] = [
    {
      name: t('GPT API Family'),
      desc: t('Compare GPT models across reasoning, coding, context and cost.'),
      tags: [t('Reasoning'), t('Coding'), t('Chat'), t('Cost')],
      tone: 'emerald',
    },
    {
      name: t('Claude API Family'),
      desc: t(
        'Compare Claude models across coding agents, reasoning and long-context workflows.'
      ),
      tags: [t('Agents'), t('Coding'), t('Long Context'), t('Reasoning')],
      tone: 'amber',
    },
    {
      name: t('Gemini API Family'),
      desc: t(
        'Compare Gemini models across reasoning, multimodal tasks, speed and cost.'
      ),
      tags: [t('Reasoning'), t('Multimodal'), t('Fast'), t('Value')],
      tone: 'blue',
    },
    {
      name: t('Image API Family'),
      desc: t(
        'Compare image models across generation, editing and creative production workflows.'
      ),
      tags: [t('Generation'), t('Editing'), t('Creative'), t('Image API')],
      tone: 'violet',
    },
  ]

  return (
    <section className='border-border/40 relative z-10 border-t px-6 py-14 md:py-20'>
      <div className='mx-auto max-w-6xl'>
        <AnimateInView className='mb-10 max-w-2xl'>
          <p className='text-muted-foreground mb-2.5 text-xs font-medium tracking-widest uppercase'>
            {t('Compare')}
          </p>
          <h2 className='text-2xl leading-tight font-bold tracking-tight md:text-3xl'>
            {t('Compare AI model families before you integrate')}
          </h2>
          <p className='text-muted-foreground/80 mt-3.5 text-base leading-relaxed'>
            {t(
              'When several similar models exist, compare versions within a family by capability, cost and use case — then pick the API that best fits your workflow.'
            )}
          </p>
        </AnimateInView>

        <div className='grid gap-4 sm:grid-cols-2 lg:grid-cols-4'>
          {families.map((f, i) => {
            const tone = TONES[f.tone]
            return (
              <AnimateInView
                key={f.name}
                delay={i * 80}
                animation='scale-in'
                className={`group border-border/50 relative flex flex-col overflow-hidden rounded-xl border p-5 transition-all duration-300 ${tone.cardBg} ${tone.hoverBorder}`}
              >
                <span
                  aria-hidden
                  className={`absolute inset-x-0 top-0 h-0.5 opacity-70 ${tone.bar}`}
                />
                <h3 className={`text-base font-semibold ${tone.text}`}>
                  {f.name}
                </h3>
                <p className='text-muted-foreground mt-2 flex-1 text-sm leading-relaxed'>
                  {f.desc}
                </p>
                <div className='mt-4 flex flex-wrap gap-1.5'>
                  {f.tags.map((tag) => (
                    <span
                      key={tag}
                      className={`rounded-md border px-2 py-0.5 text-[11px] ${tone.chip}`}
                    >
                      {tag}
                    </span>
                  ))}
                </div>
                <Link
                  to='/pricing'
                  className={`mt-5 inline-flex items-center gap-1.5 text-sm font-medium transition-colors ${tone.text}`}
                >
                  {t('Compare models')}
                  <ArrowRight className='size-3.5 transition-transform duration-200 group-hover:translate-x-0.5' />
                </Link>
              </AnimateInView>
            )
          })}
        </div>
      </div>
    </section>
  )
}
