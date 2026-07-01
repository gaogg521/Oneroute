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
import { useSystemConfig } from '@/hooks/use-system-config'
import {
  Accordion,
  AccordionItem,
  AccordionTrigger,
  AccordionContent,
} from '@/components/ui/accordion'
import { AnimateInView } from '@/components/animate-in-view'

export function FAQ() {
  const { t } = useTranslation()
  const { systemName } = useSystemConfig()
  const name = systemName

  const faqs = [
    {
      q: t('How does {{name}} pricing work?', { name }),
      a: t(
        'Pay-as-you-go, with each model price visible before you call it. Billed by token, image or video duration depending on the model type. No monthly minimum, no setup fee, and new users get free credits to test. A real-time dashboard shows usage and cost.'
      ),
    },
    {
      q: t('Are there any hidden fees?'),
      a: t(
        'No. Transparent pay-as-you-go, billed per model by tokens or requests. No platform monthly fee and no setup cost. New users also get free credits to test.'
      ),
    },
    {
      q: t('How long does it take to integrate {{name}} into an existing app?', {
        name,
      }),
      a: t(
        'Usually under 10 minutes. If you already use an OpenAI-compatible API, just swap the Base URL and API key — most existing code needs no changes. SDKs and migration guides are provided.'
      ),
    },
    {
      q: t('Which models and providers does {{name}} support?', { name }),
      a: t(
        'Over 40 models from leading providers including OpenAI, Anthropic and Google, with new models added continuously. All are available through one unified endpoint; switch models by changing a single parameter.'
      ),
    },
    {
      q: t('If a provider goes down, will my app break?'),
      a: t(
        '{{name}} provides automatic failover across providers. If one provider fails, requests are routed instantly to another available one, with real-time health checks targeting high availability.',
        { name }
      ),
    },
    {
      q: t('Does routing through {{name}} add latency?', { name }),
      a: t(
        'The added latency is typically under 50ms, and overall response time is often faster — smart routing picks the fastest provider in real time and routes around congested nodes.'
      ),
    },
    {
      q: t('Is my data safe? Do you store my prompts?'),
      a: t(
        '{{name}} acts only as a secure proxy and does not store your prompts or model responses. Traffic is encrypted in transit, and only the audit logs required for operation are kept.',
        { name }
      ),
    },
    {
      q: t('Do I need a separate API key for each provider, or just one key?'),
      a: t(
        'Just one {{name}} key. All upstream provider connections are handled for you — fewer keys to manage, one bill, and new providers become available without extra configuration.',
        { name }
      ),
    },
    {
      q: t('Why use {{name}} instead of connecting to a provider directly?', {
        name,
      }),
      a: t(
        'One API for many models across many providers, automatic failover, transparent pricing, unified billing and usage analytics, and switching models by changing one parameter instead of rewriting code.'
      ),
    },
    {
      q: t('Can I try {{name}} for free before committing?', { name }),
      a: t(
        'Yes. Sign up for free credits, no credit card required. Test multiple models, evaluate performance and compare cost savings in the dashboard.'
      ),
    },
  ]

  return (
    <section className='border-border/40 relative z-10 border-t px-6 py-14 md:py-20'>
      <div className='mx-auto max-w-3xl'>
        <AnimateInView className='mb-8 text-center md:mb-10'>
          <p className='text-muted-foreground mb-3 text-xs font-medium tracking-widest uppercase'>
            {t('FAQ')}
          </p>
          <h2 className='text-2xl font-bold tracking-tight md:text-3xl'>
            {t('Frequently asked questions')}
          </h2>
        </AnimateInView>

        <AnimateInView animation='fade-up'>
          <Accordion className='border-border/50 overflow-hidden rounded-xl border'>
            {faqs.map((faq, i) => (
              <AccordionItem
                key={i}
                value={String(i)}
                className='border-border/40 not-last:border-b px-5'
              >
                <AccordionTrigger className='text-[15px]'>
                  {faq.q}
                </AccordionTrigger>
                <AccordionContent>
                  <p className='text-muted-foreground leading-relaxed'>
                    {faq.a}
                  </p>
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </AnimateInView>
      </div>
    </section>
  )
}
