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
  Boxes,
  Gauge,
  Image as ImageIcon,
  KeyRound,
  MessageSquareText,
  Plug,
  Route as RouteIcon,
  ShieldCheck,
  Video,
  Wallet,
} from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { useSystemConfig } from '@/hooks/use-system-config'
import { DocH2, DocPageHeader } from '../components/doc-section'

interface Item {
  icon: typeof Boxes
  title: string
  desc: string
}

function FeatureGrid({ items, cols = 3 }: { items: Item[]; cols?: 2 | 3 }) {
  return (
    <div
      className={`mt-4 grid gap-4 sm:grid-cols-2 ${
        cols === 3 ? 'lg:grid-cols-3' : ''
      }`}
    >
      {items.map(({ icon: Icon, title, desc }) => (
        <div
          key={title}
          className='border-border/60 bg-card/40 hover:border-border rounded-xl border p-4 transition-colors'
        >
          <Icon className='text-primary size-5' />
          <h3 className='mt-3 text-sm font-semibold'>{title}</h3>
          <p className='text-muted-foreground mt-1.5 text-sm leading-relaxed'>
            {desc}
          </p>
        </div>
      ))}
    </div>
  )
}

export function Introduction() {
  const { t } = useTranslation()
  const { systemName } = useSystemConfig()

  const advantages: Item[] = [
    {
      icon: Boxes,
      title: t('Unified Access'),
      desc: t(
        'Connect to mainstream image, video, text, and audio models through one API, reducing multi-provider integration costs.'
      ),
    },
    {
      icon: Plug,
      title: t('OpenAI Compatible'),
      desc: t(
        'Compatible with OpenAI-style interfaces and mainstream SDKs, making migration from existing applications easier.'
      ),
    },
    {
      icon: RouteIcon,
      title: t('Reliable Routing'),
      desc: t(
        'Supports multi-channel routing and failover to improve model invocation stability.'
      ),
    },
    {
      icon: Wallet,
      title: t('Transparent Billing'),
      desc: t(
        'Track usage in real time, manage quotas flexibly, and trace every charge clearly.'
      ),
    },
  ]

  const capabilities: Item[] = [
    {
      icon: ImageIcon,
      title: t('Image Generation'),
      desc: t(
        'Use GPT Image, Nanobanana, Seedream, and other models for text-to-image, image-to-image, editing, and optimization.'
      ),
    },
    {
      icon: Video,
      title: t('Video Creation'),
      desc: t(
        'Use Seedance and other video models for text-to-video, image-to-video, and multi-reference video generation.'
      ),
    },
    {
      icon: MessageSquareText,
      title: t('Text Generation'),
      desc: t(
        'Use Claude and other language models for chat, content generation, coding assistance, and long-context text tasks.'
      ),
    },
  ]

  const coreFeatures: Item[] = [
    {
      icon: RouteIcon,
      title: t('Intelligent Routing'),
      desc: t(
        'Route requests based on model availability, response behavior, and cost policies to reduce dependency on a single channel.'
      ),
    },
    {
      icon: Gauge,
      title: t('Task Management'),
      desc: t(
        'Create asynchronous tasks, query status, and retrieve results for long-running image and video workloads.'
      ),
    },
    {
      icon: ShieldCheck,
      title: t('Secure Access'),
      desc: t(
        'Manage API Key access across different businesses, environments, and teams.'
      ),
    },
    {
      icon: Wallet,
      title: t('Usage Tracking'),
      desc: t(
        'Track usage and spending records for cost allocation and quota management.'
      ),
    },
  ]

  const useCases: Item[] = [
    {
      icon: Boxes,
      title: t('Enterprise App Development'),
      desc: t(
        'Integrate AI capabilities quickly while reducing model integration and maintenance work.'
      ),
    },
    {
      icon: ImageIcon,
      title: t('Content Production Workflows'),
      desc: t(
        'Combine image, video, and text models to build automated workflows for marketing, education, and creative production.'
      ),
    },
    {
      icon: KeyRound,
      title: t('AI Coding Tools'),
      desc: t(
        'Configure one model gateway for Claude Code CLI, Codex CLI, Gemini CLI, and similar developer tools.'
      ),
    },
  ]

  const steps = [
    {
      title: t('Get an API Key'),
      desc: t('Create and save your key in the console.'),
      to: '/keys',
      cta: t('Go to API Keys'),
    },
    {
      title: t('Make Your First Request'),
      desc: t(
        'Read the integration guide and connect Claude Code CLI to {{name}}.',
        { name: systemName }
      ),
      to: '/docs/integration/claude-code-cli',
      cta: t('Claude Code CLI'),
    },
    {
      title: t('Explore Model Docs'),
      desc: t('Browse available models and call the image generation API.'),
      to: '/docs/api/nanobanana-2',
      cta: t('Nanobanana 2 Image Generation'),
    },
  ]

  return (
    <>
      <DocPageHeader
        eyebrow={t('Getting Started')}
        title={systemName}
        lead={t(
          '{{name}} is an enterprise AI gateway platform for developers who need a unified model access layer, task management, and usage tracking.',
          { name: systemName }
        )}
      />

      <DocH2>{t('Platform Advantages')}</DocH2>
      <FeatureGrid items={advantages} cols={2} />

      <DocH2>{t('Capabilities')}</DocH2>
      <FeatureGrid items={capabilities} cols={3} />

      <DocH2>{t('Core Features')}</DocH2>
      <FeatureGrid items={coreFeatures} cols={2} />

      <DocH2>{t('Use Cases')}</DocH2>
      <FeatureGrid items={useCases} cols={3} />

      <DocH2>{t('Get Started')}</DocH2>
      <ol className='mt-4 space-y-3'>
        {steps.map((step, i) => (
          <li
            key={step.title}
            className='border-border/60 bg-card/40 flex flex-col gap-3 rounded-xl border p-4 sm:flex-row sm:items-center sm:justify-between'
          >
            <div className='flex gap-3'>
              <span className='bg-primary/10 text-primary flex size-7 shrink-0 items-center justify-center rounded-full text-sm font-bold'>
                {i + 1}
              </span>
              <div>
                <h3 className='text-sm font-semibold'>{step.title}</h3>
                <p className='text-muted-foreground mt-0.5 text-sm leading-relaxed'>
                  {step.desc}
                </p>
              </div>
            </div>
            <Link
              to={step.to}
              className='text-primary inline-flex shrink-0 items-center gap-1 text-sm font-medium hover:underline sm:ml-4'
            >
              {step.cta}
              <ArrowRight className='size-3.5' />
            </Link>
          </li>
        ))}
      </ol>
    </>
  )
}
