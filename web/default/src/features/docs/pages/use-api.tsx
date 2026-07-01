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
import { Trans, useTranslation } from 'react-i18next'
import { useSystemConfig } from '@/hooks/use-system-config'
import { DocCallout } from '../components/doc-callout'
import { DocCodeBlock } from '../components/doc-code-block'
import {
  DocH2,
  DocH3,
  DocOl,
  DocP,
  DocPageHeader,
} from '../components/doc-section'
import { useDocsEndpoints } from '../lib/use-docs-endpoints'

interface Endpoint {
  name: string
  method: string
  path: string
  desc: string
}

export function UseApi() {
  const { t } = useTranslation()
  const { systemName } = useSystemConfig()
  const { apiBaseUrl } = useDocsEndpoints()

  const python = `from openai import OpenAI

client = OpenAI(
    api_key="YOUR_API_KEY",  # a token issued by ${systemName}
    base_url="${apiBaseUrl}/v1"
)

response = client.chat.completions.create(
    model="gpt-4o",
    messages=[{"role": "user", "content": "Hello!"}]
)
print(response.choices[0].message.content)`

  const claude = `curl ${apiBaseUrl}/v1/messages \\
  -H "x-api-key: YOUR_API_KEY" \\
  -H "anthropic-version: 2023-06-01" \\
  -H "content-type: application/json" \\
  -d '{"model": "claude-sonnet-4-6", "max_tokens": 1024, "messages": [{"role": "user", "content": "Hello"}]}'`

  const gemini = `curl "${apiBaseUrl}/v1beta/models/gemini-2.5-pro:generateContent?key=YOUR_API_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{"contents": [{"parts": [{"text": "Hello"}]}]}'`

  const endpoints: Endpoint[] = [
    {
      name: t('Chat Completions'),
      method: 'POST',
      path: '/v1/chat/completions',
      desc: t('Conversational generation with streaming support.'),
    },
    {
      name: t('Completions'),
      method: 'POST',
      path: '/v1/completions',
      desc: t('Legacy completion endpoint.'),
    },
    {
      name: t('Embeddings'),
      method: 'POST',
      path: '/v1/embeddings',
      desc: t('Text vectorization.'),
    },
    {
      name: t('Image Generation'),
      method: 'POST',
      path: '/v1/images/generations',
      desc: t('Text-to-image.'),
    },
    {
      name: t('Image Editing'),
      method: 'POST',
      path: '/v1/images/edits',
      desc: t('Image editing.'),
    },
    {
      name: t('Speech to Text'),
      method: 'POST',
      path: '/v1/audio/transcriptions',
      desc: t('Whisper and similar models.'),
    },
    {
      name: t('Text to Speech'),
      method: 'POST',
      path: '/v1/audio/speech',
      desc: t('Text-to-speech (TTS).'),
    },
    {
      name: t('Rerank'),
      method: 'POST',
      path: '/v1/rerank',
      desc: t('Document reranking.'),
    },
    {
      name: t('Responses API'),
      method: 'POST',
      path: '/v1/responses',
      desc: t('OpenAI Responses format.'),
    },
    {
      name: t('Realtime'),
      method: 'GET',
      path: '/v1/realtime',
      desc: t('OpenAI Realtime API (WebSocket).'),
    },
    {
      name: t('Models'),
      method: 'GET',
      path: '/v1/models',
      desc: t('List available models.'),
    },
  ]

  return (
    <>
      <DocPageHeader
        eyebrow={t('Getting Started')}
        title={t('Using the API')}
        lead={t(
          'Replace OpenAI’s base_url with the {{name}} API address and use a token issued by {{name}} as the api_key to start calling.',
          { name: systemName }
        )}
      />

      <DocH2>{t('Test in the Playground')}</DocH2>
      <DocP>
        {t(
          'The built-in Playground lets you chat with models without writing any code — the quickest way to confirm a token works.'
        )}
      </DocP>
      <DocOl>
        <li>
          <Trans
            i18nKey='Open the <0>Playground</0> from the sidebar.'
            components={[
              <Link
                to='/playground'
                className='text-primary font-medium hover:underline'
              />,
            ]}
          />
        </li>
        <li>{t('Select the model you want to test on the left.')}</li>
        <li>
          {t('Type a message at the bottom and send it; the reply appears on the right.')}
        </li>
      </DocOl>

      <DocH2>{t('Get your API address and key')}</DocH2>
      <DocP>
        <Trans
          i18nKey='Your API Base URL is shown below. Create and copy a token from the <0>API Keys</0> page to use as the api_key.'
          components={[
            <Link
              to='/keys'
              className='text-primary font-medium hover:underline'
            />,
          ]}
        />
      </DocP>
      <DocCodeBlock language='Base URL' code={apiBaseUrl} />
      <DocCallout>
        {t(
          'If your client expects an OpenAI-style endpoint, use the Base URL with a /v1 suffix.'
        )}
      </DocCallout>

      <DocH2>{t('Code Examples')}</DocH2>
      <DocH3>{t('Python (OpenAI SDK)')}</DocH3>
      <DocCodeBlock language='python' code={python} />
      <DocH3>{t('Claude native format')}</DocH3>
      <DocCodeBlock language='bash' code={claude} />
      <DocH3>{t('Gemini native format')}</DocH3>
      <DocCodeBlock language='bash' code={gemini} />
      <DocCallout tone='tip'>
        <Trans
          i18nKey='For connecting Claude Code CLI, see the <0>Claude Code CLI guide</0>. For image generation details, see <1>Nanobanana 2</1>.'
          components={[
            <Link
              to='/docs/integration/claude-code-cli'
              className='text-primary font-medium hover:underline'
            />,
            <Link
              to='/docs/api/nanobanana-2'
              className='text-primary font-medium hover:underline'
            />,
          ]}
        />
      </DocCallout>

      <DocH2>{t('Supported Endpoints')}</DocH2>
      <div className='border-border/60 my-4 overflow-x-auto rounded-xl border'>
        <table className='w-full border-collapse text-left text-sm'>
          <thead>
            <tr className='border-border/60 bg-muted/40 border-b'>
              <th className='px-4 py-2.5 font-semibold'>{t('Endpoint')}</th>
              <th className='px-4 py-2.5 font-semibold'>{t('Path')}</th>
              <th className='px-4 py-2.5 font-semibold'>{t('Description')}</th>
            </tr>
          </thead>
          <tbody>
            {endpoints.map((e) => (
              <tr
                key={e.path}
                className='border-border/40 border-b align-top last:border-b-0'
              >
                <td className='px-4 py-3 whitespace-nowrap'>{e.name}</td>
                <td className='px-4 py-3 whitespace-nowrap'>
                  <span className='bg-primary/10 text-primary mr-2 rounded px-1.5 py-0.5 font-mono text-[10px] font-semibold'>
                    {e.method}
                  </span>
                  <code className='text-foreground/90 font-mono text-[13px]'>
                    {e.path}
                  </code>
                </td>
                <td className='text-muted-foreground px-4 py-3'>{e.desc}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <DocP className='text-muted-foreground/70 text-xs'>
        {t(
          'Available endpoints and models depend on the channels configured on this site.'
        )}
      </DocP>
    </>
  )
}
