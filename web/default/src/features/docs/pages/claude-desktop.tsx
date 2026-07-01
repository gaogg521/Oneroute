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
import {
  DocCode,
  DocH2,
  DocH3,
  DocOl,
  DocP,
  DocPageHeader,
  DocUl,
} from '../components/doc-section'
import { useDocsEndpoints } from '../lib/use-docs-endpoints'

export function ClaudeDesktop() {
  const { t } = useTranslation()
  const { systemName } = useSystemConfig()
  const { anthropicBaseUrl } = useDocsEndpoints()

  return (
    <>
      <DocPageHeader
        eyebrow={t('Integration Guide')}
        title={t('Claude Desktop Integration')}
        lead={t('Connect Claude Desktop to {{name}}.', { name: systemName })}
      />

      <DocH2>{t('Overview')}</DocH2>
      <DocP>
        {t(
          'Claude Desktop is Anthropic’s official desktop app. This guide connects it to {{name}} through an Anthropic-compatible gateway so you can use models that support the Anthropic Messages API.',
          { name: systemName }
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
        <li>{t('Claude Desktop installed from Anthropic’s official download page.')}</li>
      </DocUl>

      <DocH2>{t('Step 1: Enable Developer Mode')}</DocH2>
      <DocP>
        {t(
          'Launch Claude Desktop, click Help → Troubleshooting, and enable Developer Mode. A Developer menu then appears for third-party inference configuration.'
        )}
      </DocP>
      <DocCallout>
        {t(
          'On Windows, enable the “Virtual Machine Platform” feature first (Win + R → optionalfeatures), then restart if prompted.'
        )}
      </DocCallout>

      <DocH2>{t('Step 2: Open Third-Party Inference Settings')}</DocH2>
      <DocP>
        {t(
          'In the Developer menu, open the third-party inference panel and fill it in:'
        )}
      </DocP>
      <DocUl>
        <li>
          <Trans
            i18nKey='Gateway base URL: <0>{{url}}</0>'
            values={{ url: anthropicBaseUrl }}
            components={[<DocCode />]}
          />
        </li>
        <li>{t('Gateway API key: your API key, without the Bearer prefix.')}</li>
        <li>
          {t('Gateway auth scheme:')} <DocCode>bearer</DocCode>
        </li>
        <li>
          {t('Model list: add only text/chat model IDs that support the Anthropic Messages API.')}
        </li>
      </DocUl>

      <DocH2>{t('Step 3: Save and Restart')}</DocH2>
      <DocOl>
        <li>{t('Save the configuration, then fully quit Claude Desktop.')}</li>
        <li>{t('Launch it again; it now routes requests through {{name}}.', { name: systemName })}</li>
        <li>{t('Check the model selector to confirm the available models appear.')}</li>
      </DocOl>

      <DocH2>{t('FAQ')}</DocH2>
      <DocH3>{t('The Developer menu does not appear.')}</DocH3>
      <DocP>
        {t('Confirm Developer Mode is enabled and Claude Desktop has been fully restarted.')}
      </DocP>
      <DocH3>{t('I cannot connect after configuring it.')}</DocH3>
      <DocUl>
        <li>{t('Check the base URL is correct.')}</li>
        <li>{t('Check the API key is valid.')}</li>
        <li>{t('Confirm the auth scheme is bearer.')}</li>
        <li>{t('Fully close and reopen Claude Desktop.')}</li>
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
