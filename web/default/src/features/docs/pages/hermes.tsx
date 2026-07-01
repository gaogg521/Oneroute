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

export function Hermes() {
  const { t } = useTranslation()
  const { systemName } = useSystemConfig()
  const { apiBaseUrl } = useDocsEndpoints()

  const configYaml = `model:
  provider: custom
  default: claude-sonnet-4-6
  base_url: ${apiBaseUrl}/v1
  api_mode: chat_completions`

  return (
    <>
      <DocPageHeader
        eyebrow={t('Integration Guide')}
        title={t('Hermes Agent')}
        lead={t('Connect Hermes Agent to {{name}}.', { name: systemName })}
      />

      <DocH2>{t('Overview')}</DocH2>
      <DocP>
        {t(
          'Hermes Agent is an open-source, terminal-native autonomous AI agent from Nous Research (MIT licensed). It supports custom OpenAI-compatible endpoints, so you can use {{name}}’s Claude, GPT, and Gemini families from your terminal with one key.',
          { name: systemName }
        )}
      </DocP>
      <DocCallout>
        {t(
          'Hermes Agent is a command-line tool — not the same as the Hermes 3 / Hermes 4 models. Use a model with at least 64K context (e.g. the Claude / Gemini families).'
        )}
      </DocCallout>

      <DocH2>{t('Prerequisites')}</DocH2>
      <DocUl>
        <li>{t('A terminal on macOS, Linux, or Windows (native or WSL2).')}</li>
        <li>
          <Trans
            i18nKey='An API key — create one on the <0>API Keys</0> page.'
            components={[
              <Link to='/keys' className='text-primary font-medium hover:underline' />,
            ]}
          />
        </li>
      </DocUl>

      <DocH2>{t('Step 1: Install Hermes Agent')}</DocH2>
      <DocCodeBlock
        language='bash'
        code={'# macOS / Linux\ncurl -fsSL https://hermes-agent.nousresearch.com/install.sh | bash\n\n# Windows PowerShell\niex (irm https://hermes-agent.nousresearch.com/install.ps1)'}
      />
      <DocP>
        {t(
          'On first run, choose “Full setup”, select “custom endpoint”, and enter the endpoint URL and key (covered below). Then run hermes doctor to verify.'
        )}
      </DocP>

      <DocH2>{t('Step 2: Configure the API')}</DocH2>
      <DocP>
        {t(
          'Because {{name}} provides an OpenAI-compatible endpoint, set Hermes’ provider to custom. The easiest way is the setup wizard:',
          { name: systemName }
        )}
      </DocP>
      <DocCodeBlock language='bash' code='hermes model' />
      <DocP>
        <Trans
          i18nKey='Choose “custom endpoint”, set API base URL to <0>{{url}}</0>, enter your API key, and pick “Chat Completions” as the compatibility mode.'
          values={{ url: `${apiBaseUrl}/v1` }}
          components={[<DocCode />]}
        />
      </DocP>
      <DocP>{t('Or configure it from the command line:')}</DocP>
      <DocCodeBlock
        language='bash'
        code={`hermes config set OPENAI_API_KEY YOUR_API_KEY\nhermes config set OPENAI_BASE_URL ${apiBaseUrl}/v1\nhermes config set model claude-sonnet-4-6`}
      />
      <DocP>
        <Trans
          i18nKey='These write the key to <0>~/.hermes/.env</0> and the rest to <1>~/.hermes/config.yaml</1>, for example:'
          components={[<DocCode />, <DocCode />]}
        />
      </DocP>
      <DocCodeBlock language='config.yaml' code={configYaml} />

      <DocH2>{t('Step 3: Start Using and Verify')}</DocH2>
      <DocCodeBlock language='bash' code={'hermes --tui\n# then ask:\nwho are you'} />

      <DocH2>{t('FAQ')}</DocH2>
      <DocH3>{t('What should I do if I get a context length error at startup?')}</DocH3>
      <DocP>
        {t(
          'Hermes recommends a model with at least 64K context. Switch to a larger-context model (e.g. the Claude family).'
        )}
      </DocP>
      <DocH3>{t('How do I switch models?')}</DocH3>
      <DocUl>
        <li>
          {t('Interactive:')} <DocCode>hermes model</DocCode>
        </li>
        <li>
          {t('Command line:')} <DocCode>hermes config set model &lt;name&gt;</DocCode>
        </li>
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
