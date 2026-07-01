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

export function CodexCli() {
  const { t } = useTranslation()
  const { systemName } = useSystemConfig()
  const { apiBaseUrl } = useDocsEndpoints()

  const configToml = `model = "gpt-5.2"
model_reasoning_effort = "medium"
model_provider = "newapi"

[model_providers.newapi]
name = "${systemName} API"
base_url = "${apiBaseUrl}/v1"
env_key = "OPENAI_API_KEY"
wire_api = "responses"`

  return (
    <>
      <DocPageHeader
        eyebrow={t('Integration Guide')}
        title={t('Codex CLI')}
        lead={t('Connect Codex CLI to {{name}}.', { name: systemName })}
      />

      <DocH2>{t('Overview')}</DocH2>
      <DocP>
        {t(
          'Codex CLI is OpenAI’s official command-line tool for code tasks in the terminal. By pointing it at the {{name}} API, you reach {{name}}’s models through one OpenAI-compatible base URL and key.',
          { name: systemName }
        )}
      </DocP>

      <DocH2>{t('Prerequisites')}</DocH2>
      <DocUl>
        <li>{t('Node.js v20 or higher (run node -v and npm -v to check).')}</li>
        <li>
          <Trans
            i18nKey='An API key — create one on the <0>API Keys</0> page.'
            components={[
              <Link to='/keys' className='text-primary font-medium hover:underline' />,
            ]}
          />
        </li>
      </DocUl>

      <DocH2>{t('Step 1: Install Codex CLI')}</DocH2>
      <DocCodeBlock language='bash' code='npm install -g @openai/codex' />
      <DocCodeBlock language='bash' code='codex --version' />

      <DocH2>{t('Step 2: Configure the API')}</DocH2>
      <DocP>
        <Trans
          i18nKey='Edit <0>~/.codex/config.toml</0> (on Windows <1>%userprofile%\\.codex\\config.toml</1>) and add:'
          components={[<DocCode />, <DocCode />]}
        />
      </DocP>
      <DocCodeBlock language='config.toml' code={configToml} />
      <DocP>{t('Then set your API key as an environment variable:')}</DocP>
      <DocCodeBlock
        language='bash'
        code={'# macOS / Linux\nexport OPENAI_API_KEY="YOUR_API_KEY"\n\n# Windows PowerShell\n[Environment]::SetEnvironmentVariable("OPENAI_API_KEY", "YOUR_API_KEY", "User")'}
      />
      <DocCallout tone='warning'>
        {t('wire_api must be set to "responses" ("chat" is deprecated).')}
      </DocCallout>

      <DocH2>{t('Step 3: Start Using Codex CLI')}</DocH2>
      <DocCodeBlock language='bash' code={'cd your-working-directory\ncodex'} />
      <DocP>{t('Verify the configuration:')}</DocP>
      <DocCodeBlock language='bash' code='codex "Who are you"' />

      <DocH2>{t('FAQ')}</DocH2>
      <DocH3>{t('How do I switch models?')}</DocH3>
      <DocP>
        <Trans
          i18nKey='Change the <0>model</0> field in config.toml and restart Codex CLI.'
          components={[<DocCode />]}
        />
      </DocP>
      <DocH3>{t('What causes 401/403 errors?')}</DocH3>
      <DocUl>
        <li>{t('401: the API key is not set or invalid.')}</li>
        <li>{t('403: insufficient API key permissions or an expired key.')}</li>
        <li>{t('Check that env_key matches your environment variable name.')}</li>
      </DocUl>
      <DocH3>{t('Why don’t my config changes take effect?')}</DocH3>
      <DocUl>
        <li>{t('Restart your terminal.')}</li>
        <li>{t('Check the config file syntax.')}</li>
        <li>{t('Verify the config file path is correct.')}</li>
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
