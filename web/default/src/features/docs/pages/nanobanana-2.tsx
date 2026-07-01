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
  DocCode,
  DocH2,
  DocP,
  DocPageHeader,
  DocUl,
} from '../components/doc-section'
import { ParamTable, type ParamRow } from '../components/param-table'
import { useDocsEndpoints } from '../lib/use-docs-endpoints'

export function Nanobanana2() {
  const { t } = useTranslation()
  const { systemName } = useSystemConfig()
  const { apiBaseUrl } = useDocsEndpoints()

  const curl = `curl --request POST \\
  --url ${apiBaseUrl}/v1/images/generations \\
  --header 'Authorization: Bearer YOUR_API_KEY' \\
  --header 'Content-Type: application/json' \\
  --data '{
  "model": "gemini-3.1-flash-image-preview",
  "prompt": "A cat playing on the grass"
}'`

  const responseJson = `{
  "created": 1757165031,
  "id": "task-unified-1757165031-uyujaw3d",
  "model": "gemini-3.1-flash-image-preview",
  "object": "image.generation.task",
  "progress": 0,
  "status": "pending",
  "task_info": {
    "can_cancel": true,
    "estimated_time": 45
  },
  "type": "image",
  "usage": {
    "billing_rule": "per_call",
    "credits_reserved": 8.7,
    "user_group": "default"
  }
}`

  const requestRows: ParamRow[] = [
    {
      name: 'model',
      type: 'enum<string>',
      required: true,
      description: (
        <>
          {t(
            'Image generation model name. Default: gemini-3.1-flash-image-preview.'
          )}
        </>
      ),
    },
    {
      name: 'prompt',
      type: 'string',
      required: true,
      description: t(
        'Describes the image to generate, or how to edit the input image. Limited to 2000 tokens.'
      ),
    },
    {
      name: 'size',
      type: 'enum<string>',
      description: t(
        'Aspect ratio of the generated image. Default auto. Options include 1:1, 2:3, 3:2, 3:4, 4:3, 9:16, 16:9, 21:9, etc.'
      ),
    },
    {
      name: 'quality',
      type: 'enum<string>',
      description: t(
        'Image quality. Default 2K. Options: 0.5K, 1K, 2K, 4K. Different quality levels have different pricing.'
      ),
    },
    {
      name: 'image_urls',
      type: 'string<uri>[]',
      description: (
        <>
          {t(
            'Reference image URLs for image-to-image and editing. Up to 14 images per request, each under 20MB; .jpeg/.jpg/.png/.webp; URLs must be directly accessible; up to 4 real-person images.'
          )}
        </>
      ),
    },
    {
      name: 'model_params',
      type: 'object',
      description: t('Model extension parameters.'),
    },
    {
      name: 'callback_url',
      type: 'string<uri>',
      description: (
        <>
          {t(
            'HTTPS callback URL triggered when the task is completed, failed, or cancelled (after billing confirmation).'
          )}
          <DocUl className='mt-2'>
            <li>{t('HTTPS only; internal IP addresses are forbidden.')}</li>
            <li>{t('URL length must not exceed 2048 characters.')}</li>
            <li>
              {t(
                'Timeout 10s; up to 3 retries (after 1s/2s/4s); 2xx is treated as success.'
              )}
            </li>
          </DocUl>
        </>
      ),
    },
  ]

  const responseRows: ParamRow[] = [
    {
      name: 'created',
      type: 'integer',
      description: t('Task creation timestamp.'),
    },
    { name: 'id', type: 'string', description: t('Task ID.') },
    {
      name: 'model',
      type: 'string',
      description: t('Actual model name used.'),
    },
    {
      name: 'object',
      type: 'enum<string>',
      description: <DocCode>image.generation.task</DocCode>,
    },
    {
      name: 'progress',
      type: 'integer',
      description: t('Task progress percentage (0-100).'),
    },
    {
      name: 'status',
      type: 'enum<string>',
      description: t('Task status: pending, processing, completed, failed.'),
    },
    {
      name: 'task_info',
      type: 'object',
      description: t('Asynchronous task information (can_cancel, estimated_time).'),
    },
    {
      name: 'type',
      type: 'enum<string>',
      description: t('Task output type: text, image, audio, video.'),
    },
    {
      name: 'usage',
      type: 'object',
      description: t('Usage and billing information.'),
    },
  ]

  return (
    <>
      <DocPageHeader
        eyebrow={t('API Manual')}
        title={t('Nanobanana 2 Image Generation')}
        lead={
          <span className='bg-muted text-foreground/80 mt-1 inline-block rounded-md px-2 py-1 font-mono text-sm'>
            POST /v1/images/generations
          </span>
        }
      />

      <DocUl>
        <li>
          {t(
            'Nano Banana 2 (gemini-3.1-flash-image-preview) supports text-to-image, image-to-image, and image editing modes.'
          )}
        </li>
        <li>
          {t('Asynchronous mode: use the returned task ID to query the result.')}
        </li>
        <li>
          {t(
            'Generated image links are valid for 24 hours — please save them promptly.'
          )}
        </li>
      </DocUl>

      <DocCallout>
        <Trans
          i18nKey='This API reference is provided as an example. The models actually available and their pricing depend on the channels configured on {{name}} — see the <0>Model Square</0> for the current list.'
          values={{ name: systemName }}
          components={[
            <Link
              to='/pricing'
              className='text-primary font-medium hover:underline'
            />,
          ]}
        />
      </DocCallout>

      <DocH2>{t('Authorization')}</DocH2>
      <DocP>
        <Trans
          i18nKey='All APIs require Bearer Token authentication. Get your key from the <0>API Key management page</0> and add it to the request header:'
          components={[
            <Link
              to='/keys'
              className='text-primary font-medium hover:underline'
            />,
          ]}
        />
      </DocP>
      <DocCodeBlock code='Authorization: Bearer YOUR_API_KEY' />

      <DocH2>{t('Request Example')}</DocH2>
      <DocCodeBlock language='cURL' code={curl} />

      <DocH2>{t('Request Body')}</DocH2>
      <ParamTable rows={requestRows} />

      <DocH2>{t('Response')}</DocH2>
      <DocP>{t('200 — image generation task created successfully:')}</DocP>
      <DocCodeBlock language='json' code={responseJson} />
      <ParamTable rows={responseRows} />
    </>
  )
}
