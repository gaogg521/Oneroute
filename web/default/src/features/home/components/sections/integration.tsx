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
import { useTranslation } from 'react-i18next'
import { AnimateInView } from '@/components/animate-in-view'
import { TONES, type ToneKey } from '../../lib/tones'

export function Integration() {
  const { t } = useTranslation()

  const steps: { num: string; title: string; desc: string; tone: ToneKey }[] = [
    {
      num: '01',
      tone: 'blue',
      title: t('Sign up'),
      desc: t('Register in 30 seconds with free credits and no credit card.'),
    },
    {
      num: '02',
      tone: 'violet',
      title: t('Create an API key'),
      desc: t(
        'Generate a universal API key in one click, with flexible management and access control.'
      ),
    },
    {
      num: '03',
      tone: 'emerald',
      title: t('Choose your integration'),
      desc: t(
        'OpenAI, Anthropic, Google and more formats supported. The unified gateway adapts automatically — no need to refactor existing code.'
      ),
    },
    {
      num: '04',
      tone: 'amber',
      title: t('Start calling'),
      desc: t(
        'Update the Base URL and API key, then enjoy smart routing and cost optimization right away.'
      ),
    },
  ]

  return (
    <section className='relative z-10 px-6 py-14 md:py-20'>
      <div className='mx-auto max-w-6xl'>
        <AnimateInView className='mb-10 max-w-2xl'>
          <p className='text-muted-foreground mb-2.5 text-xs font-medium tracking-widest uppercase'>
            {t('Integration')}
          </p>
          <h2 className='text-2xl leading-tight font-bold tracking-tight md:text-3xl'>
            {t('Integrate in 4 steps')}
          </h2>
          <p className='text-muted-foreground/80 mt-3.5 text-base leading-relaxed'>
            {t(
              'A unified interface compatible with OpenAI, Anthropic, Google and other mainstream SDKs — migrate seamlessly with zero friction.'
            )}
          </p>
        </AnimateInView>

        <div className='grid gap-4 md:grid-cols-4'>
          {steps.map((step, i) => {
            const tone = TONES[step.tone]
            return (
              <AnimateInView
                key={step.num}
                delay={i * 100}
                animation='fade-up'
                className={`group border-border/50 relative flex flex-col rounded-xl border p-5 transition-all duration-300 ${tone.cardBg} ${tone.hoverBorder}`}
              >
                <span
                  className={`flex size-10 items-center justify-center rounded-lg font-mono text-sm font-bold tabular-nums ${tone.iconBox}`}
                >
                  {step.num}
                </span>
                <h3 className='mt-4 text-base font-semibold'>{step.title}</h3>
                <p className='text-muted-foreground mt-2 text-sm leading-relaxed'>
                  {step.desc}
                </p>
              </AnimateInView>
            )
          })}
        </div>
      </div>
    </section>
  )
}
