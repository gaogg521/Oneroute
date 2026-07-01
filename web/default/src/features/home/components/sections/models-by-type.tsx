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
import {
  ArrowRight,
  Video,
  Image as ImageIcon,
  MessageSquare,
  Music,
  type LucideIcon,
} from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { useSystemConfig } from '@/hooks/use-system-config'
import { AnimateInView } from '@/components/animate-in-view'
import { TONES, type ToneKey } from '../../lib/tones'

interface ModelCategory {
  num: string
  tag: string
  title: string
  desc: string
  models: string[]
  linkText: string
  icon: LucideIcon
  tone: ToneKey
}

export function ModelsByType() {
  const { t } = useTranslation()
  const { systemName } = useSystemConfig()

  const categories: ModelCategory[] = [
    {
      num: '/ 01',
      tag: 'VIDEO',
      title: t('AI Video Generation API'),
      desc: t(
        'Generate 720p–1080p video through one {{name}} API. Reach cinematic shots, native-audio clips and text-to-video models. Pick by resolution, duration and cost per second.',
        { name: systemName }
      ),
      models: ['Sora', 'Veo', 'Kling', 'Runway', 'Hailuo'],
      linkText: t('Explore Video API'),
      icon: Video,
      tone: 'rose',
    },
    {
      num: '/ 02',
      tag: 'IMAGE',
      title: t('AI Image Generation API'),
      desc: t(
        'Generate and edit images through one {{name}} API. Reach generation, semantic photo editing and story-driven visuals. Pick by style, resolution and cost per image.',
        { name: systemName }
      ),
      models: ['GPT Image', 'Midjourney', 'Flux', 'Stable Diffusion'],
      linkText: t('Explore Image API'),
      icon: ImageIcon,
      tone: 'violet',
    },
    {
      num: '/ 03',
      tag: 'LLM',
      title: t('LLM & Chat API'),
      desc: t(
        'Reach GPT, Claude, Gemini, DeepSeek, Kimi and more through one {{name}} API key. Build chat, reasoning, coding assistants and automated workflows. Switch models by changing one parameter.',
        { name: systemName }
      ),
      models: ['GPT', 'Claude', 'Gemini', 'DeepSeek', 'Qwen', 'Kimi'],
      linkText: t('Explore LLM API'),
      icon: MessageSquare,
      tone: 'blue',
    },
    {
      num: '/ 04',
      tag: 'AUDIO',
      title: t('AI Music Generation API'),
      desc: t(
        'Generate full tracks through the {{name}} API. One key, stable routing, pay-as-you-go. Built for apps, games and content workflows that need programmatic music.',
        { name: systemName }
      ),
      models: ['Suno', 'TTS', 'Speech'],
      linkText: t('Explore Music API'),
      icon: Music,
      tone: 'amber',
    },
  ]

  return (
    <section className='relative z-10 px-6 py-14 md:py-20'>
      <div className='mx-auto max-w-6xl'>
        <AnimateInView className='mb-10 max-w-2xl'>
          <p className='text-muted-foreground mb-2.5 text-xs font-medium tracking-widest uppercase'>
            {t('Models')}
          </p>
          <h2 className='text-2xl leading-tight font-bold tracking-tight md:text-3xl'>
            {t('Explore models by type')}
          </h2>
          <p className='text-muted-foreground/80 mt-3.5 text-base leading-relaxed'>
            {t(
              'Video, image, language and audio — each model category has its own pricing, capabilities and recommended use cases. Choose the right one, switch whenever you need.'
            )}
          </p>
        </AnimateInView>

        <div className='grid gap-4 md:grid-cols-2'>
          {categories.map((cat, i) => {
            const Icon = cat.icon
            const tone = TONES[cat.tone]
            return (
              <AnimateInView
                key={cat.tag}
                delay={i * 100}
                animation='fade-up'
                className={`group border-border/50 flex flex-col rounded-xl border p-6 transition-all duration-300 md:p-7 ${tone.cardBg} ${tone.hoverBorder}`}
              >
                <div className='flex items-center justify-between'>
                  <div className='flex items-center gap-3'>
                    <div
                      className={`flex size-11 items-center justify-center rounded-lg ${tone.iconBox}`}
                    >
                      <Icon className='size-5' strokeWidth={1.75} />
                    </div>
                    <div className='flex flex-col'>
                      <span className='text-muted-foreground/40 font-mono text-[10px] font-semibold tracking-wider'>
                        {cat.num}
                      </span>
                      <span className={`text-[11px] font-bold tracking-[0.18em] ${tone.text}`}>
                        {cat.tag}
                      </span>
                    </div>
                  </div>
                </div>

                <h3 className='mt-5 text-lg font-semibold'>{cat.title}</h3>
                <p className='text-muted-foreground mt-2.5 flex-1 text-sm leading-relaxed'>
                  {cat.desc}
                </p>

                <div className='mt-4 flex flex-wrap gap-2'>
                  {cat.models.map((m) => (
                    <span
                      key={m}
                      className={`rounded-full border px-3 py-1 text-xs ${tone.chip}`}
                    >
                      {m}
                    </span>
                  ))}
                </div>

                <Link
                  to='/pricing'
                  className={`mt-5 inline-flex items-center gap-1.5 text-sm font-medium transition-colors ${tone.text}`}
                >
                  {cat.linkText}
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
