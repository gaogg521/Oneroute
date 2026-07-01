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
  DocH3,
  DocP,
  DocPageHeader,
  DocUl,
} from '../components/doc-section'
import { useDocsEndpoints } from '../lib/use-docs-endpoints'

export function CodeBuddy() {
  const { t } = useTranslation()
  const { systemName } = useSystemConfig()
  const { apiBaseUrl } = useDocsEndpoints()

  const modelsJson = `{
  "models": [
    {
      "id": "claude-sonnet-4-6",
      "name": "${systemName} Claude Sonnet 4.6",
      "vendor": "Anthropic",
      "apiKey": "YOUR_API_KEY",
      "url": "${apiBaseUrl}/v1/chat/completions",
      "supportsToolCall": true,
      "supportsImages": true
    },
    {
      "id": "gpt-5.2",
      "name": "${systemName} GPT-5.2",
      "vendor": "OpenAI",
      "apiKey": "YOUR_API_KEY",
      "url": "${apiBaseUrl}/v1/chat/completions",
      "supportsToolCall": true,
      "supportsImages": true
    }
  ]
}`

  return (
    <>
      <DocPageHeader
        eyebrow={t('Integration Guide')}
        title={t('CodeBuddy / WorkBuddy')}
        lead={t('Connect CodeBuddy and WorkBuddy to {{name}}.', { name: systemName })}
      />

      <DocH2>{t('Overview')}</DocH2>
      <DocP>
        {t(
          'CodeBuddy and WorkBuddy are Tencent Cloud AI tools that support custom model integration via a models.json file. They use the same configuration, so this guide applies to both.'
        )}
      </DocP>

      <DocH2>{t('Prerequisites')}</DocH2>
      <DocUl>
        <li>
          <Trans
            i18nKey='An API key — create one on the <0>API Keys</0> page.'
            components={[
              <Link to='/keys' className='text-primary font-medium hover:underline' />,
            ]}
          />
        </li>
      </DocUl>

      <DocH2>{t('Configuration')}</DocH2>
      <DocP>
        <Trans
          i18nKey='Edit <0>~/.codebuddy/models.json</0> (WorkBuddy: <1>~/.workbuddy/models.json</1>) and add:'
          components={[<DocCode />, <DocCode />]}
        />
      </DocP>
      <DocCodeBlock language='models.json' code={modelsJson} />
      <DocCallout tone='warning'>
        {t('Only the OpenAI SDK format is supported. Replace YOUR_API_KEY with your actual key.')}
      </DocCallout>
      <DocP>
        {t(
          'After saving, the tool detects the change and reloads automatically (about a 1-second delay). The configured models then appear in the model dropdown.'
        )}
      </DocP>

      <DocH2>{t('FAQ')}</DocH2>
      <DocH3>{t('Does it support project-level configuration?')}</DocH3>
      <DocP>
        {t(
          'Yes. Besides the user-level file, you can place models.json in a project’s .codebuddy/ (or .workbuddy/) directory; project-level config takes priority.'
        )}
      </DocP>
      <DocH3>{t('Why don’t my config changes take effect?')}</DocH3>
      <DocUl>
        <li>{t('Check the JSON format is valid.')}</li>
        <li>{t('Confirm the API key is correct.')}</li>
        <li>{t('Try restarting the application.')}</li>
      </DocUl>

      <DocCallout tone='tip'>
        <Trans
          i18nKey='Available models depend on the channels configured on {{name}} — see the <0>Model Square</0>.'
          values={{ name: systemName }}
          components={[
            <Link to='/pricing' className='text-primary font-medium hover:underline' />,
          ]}
        />
      </DocCallout>
    </>
  )
}
