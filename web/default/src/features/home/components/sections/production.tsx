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
import { ShieldCheck, LayoutDashboard, Network, Receipt } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { AnimateInView } from '@/components/animate-in-view'
import { TONES } from '../../lib/tones'

export function Production() {
  const { t } = useTranslation()

  return (
    <section className='relative z-10 px-6 py-14 md:py-20'>
      <div className='mx-auto max-w-6xl'>
        <AnimateInView className='mb-10 max-w-2xl'>
          <p className='text-muted-foreground mb-2.5 text-xs font-medium tracking-widest uppercase'>
            {t('Production')}
          </p>
          <h2 className='text-2xl leading-tight font-bold tracking-tight md:text-3xl'>
            {t('Built for production')}
          </h2>
          <p className='text-muted-foreground/80 mt-3.5 text-base leading-relaxed'>
            {t(
              'Reliable infrastructure, transparent pricing and real-time control — so you can ship with confidence.'
            )}
          </p>
        </AnimateInView>

        <div className='grid gap-4 md:grid-cols-2'>
          {/* Never fails — uptime + failover */}
          <AnimateInView
            animation='fade-up'
            className={`group border-border/50 flex flex-col rounded-xl border p-6 transition-all duration-300 md:p-7 ${TONES.emerald.cardBg} ${TONES.emerald.hoverBorder}`}
          >
            <div className='flex items-center gap-3'>
              <div
                className={`flex size-10 items-center justify-center rounded-lg ${TONES.emerald.iconBox}`}
              >
                <ShieldCheck className='size-5' strokeWidth={1.75} />
              </div>
              <h3 className='text-base font-semibold'>
                {t('Requests that never fail')}
              </h3>
            </div>
            <p className='text-muted-foreground mt-3 text-sm leading-relaxed'>
              {t('99.9% uptime with automatic failover.')}
            </p>
            <div className='border-border/40 bg-background/60 text-muted-foreground mt-4 space-y-1 rounded-lg border p-4 font-mono text-xs'>
              <div>
                <span className='text-muted-foreground/50'>&gt; </span>uptime:{' '}
                <span className='text-emerald-500'>99.9%</span>
              </div>
              <div>
                <span className='text-muted-foreground/50'>&gt; </span>failover:{' '}
                <span className='text-emerald-500'>auto</span>
              </div>
              <div>
                <span className='text-muted-foreground/50'>&gt; </span>latency:{' '}
                <span className='text-blue-500'>&lt;50ms</span>
              </div>
            </div>
          </AnimateInView>

          {/* One console */}
          <AnimateInView
            delay={100}
            animation='fade-up'
            className={`group border-border/50 flex flex-col rounded-xl border p-6 transition-all duration-300 md:p-7 ${TONES.blue.cardBg} ${TONES.blue.hoverBorder}`}
          >
            <div className='flex items-center gap-3'>
              <div
                className={`flex size-10 items-center justify-center rounded-lg ${TONES.blue.iconBox}`}
              >
                <LayoutDashboard className='size-5' strokeWidth={1.75} />
              </div>
              <h3 className='text-base font-semibold'>
                {t('One console, full control')}
              </h3>
            </div>
            <p className='text-muted-foreground mt-3 text-sm leading-relaxed'>
              {t('Track usage and see costs in real time.')}
            </p>
            <div className='mt-4 grid grid-cols-3 gap-2'>
              {[
                { label: t('Console'), value: '1' },
                { label: t('Calls'), value: '45K' },
                { label: t('Saved'), value: '$89' },
              ].map((kpi) => (
                <div
                  key={kpi.label}
                  className='border-border/40 bg-background/60 flex flex-col items-center rounded-lg border px-2 py-3 text-center'
                >
                  <span className='text-lg font-bold tabular-nums'>
                    {kpi.value}
                  </span>
                  <span className='text-muted-foreground/60 mt-0.5 text-[10px]'>
                    {kpi.label}
                  </span>
                </div>
              ))}
            </div>
          </AnimateInView>

          {/* Smart routing */}
          <AnimateInView
            delay={150}
            animation='fade-up'
            className={`group border-border/50 flex flex-col rounded-xl border p-6 transition-all duration-300 md:p-7 ${TONES.violet.cardBg} ${TONES.violet.hoverBorder}`}
          >
            <div className='flex items-center gap-3'>
              <div
                className={`flex size-10 items-center justify-center rounded-lg ${TONES.violet.iconBox}`}
              >
                <Network className='size-5' strokeWidth={1.75} />
              </div>
              <h3 className='text-base font-semibold'>
                {t('Smart model routing')}
              </h3>
            </div>
            <p className='text-muted-foreground mt-3 text-sm leading-relaxed'>
              {t(
                'One request, the best provider chosen automatically — routed in real time to the fastest, cheapest or most stable endpoint.'
              )}
            </p>
            <div className='border-border/40 bg-background/60 text-muted-foreground mt-4 space-y-1 rounded-lg border p-4 font-mono text-xs leading-relaxed'>
              <div>{t('request')} → {t('router')}</div>
              <div className='text-muted-foreground/70'>├─ {t('latency check')}</div>
              <div className='text-muted-foreground/70'>├─ {t('cost optimization')}</div>
              <div className='text-muted-foreground/70'>└─ {t('auto failover')}</div>
              <div>{t('response')} ← {t('best provider')}</div>
            </div>
          </AnimateInView>

          {/* Transparent pricing */}
          <AnimateInView
            delay={200}
            animation='fade-up'
            className={`group border-border/50 flex flex-col rounded-xl border p-6 transition-all duration-300 md:p-7 ${TONES.amber.cardBg} ${TONES.amber.hoverBorder}`}
          >
            <div className='flex items-center gap-3'>
              <div
                className={`flex size-10 items-center justify-center rounded-lg ${TONES.amber.iconBox}`}
              >
                <Receipt className='size-5' strokeWidth={1.75} />
              </div>
              <h3 className='text-base font-semibold'>
                {t('Transparent model pricing')}
              </h3>
            </div>
            <p className='text-muted-foreground mt-3 text-sm leading-relaxed'>
              {t(
                'Pay-as-you-go across every model. See the cost of each model before you call it.'
              )}
            </p>
            <div className='mt-4 space-y-2.5'>
              {[
                t('Pay only for what you use'),
                t('No monthly minimum'),
                t('See per-model pricing'),
              ].map((line) => (
                <div key={line} className='flex items-center gap-2.5'>
                  <span className='flex size-4 shrink-0 items-center justify-center rounded-full bg-amber-500/15'>
                    <svg
                      className='size-2.5 text-amber-600 dark:text-amber-400'
                      fill='none'
                      viewBox='0 0 24 24'
                      stroke='currentColor'
                      strokeWidth={3}
                    >
                      <path
                        strokeLinecap='round'
                        strokeLinejoin='round'
                        d='m4.5 12.75 6 6 9-13.5'
                      />
                    </svg>
                  </span>
                  <span className='text-muted-foreground text-sm'>{line}</span>
                </div>
              ))}
            </div>
          </AnimateInView>
        </div>
      </div>
    </section>
  )
}
