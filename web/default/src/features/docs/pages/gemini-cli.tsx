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

export function GeminiCli() {
  const { t } = useTranslation()
  const { systemName } = useSystemConfig()
  const { apiBaseUrl } = useDocsEndpoints()

  return (
    <>
      <DocPageHeader
        eyebrow={t('Integration Guide')}
        title={t('Gemini CLI')}
        lead={t('Connect Gemini CLI to {{name}}.', { name: systemName })}
      />

      <DocH2>{t('Overview')}</DocH2>
      <DocP>
        {t(
          'Gemini CLI is Google’s official command-line tool for Gemini models. Pointed at {{name}}, it can also reach the broader model set (Gemini, GPT, Claude) through one entry point.',
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

      <DocH2>{t('Step 1: Install Gemini CLI')}</DocH2>
      <DocCodeBlock language='bash' code='npm install -g @google/gemini-cli' />
      <DocCodeBlock language='bash' code='gemini --version' />

      <DocH2>{t('Step 2: Configure the API')}</DocH2>
      <DocCallout tone='warning'>
        {t(
          'Gemini CLI’s configuration is more involved than other tools: it requires editing the installed package files. If you are new to this, try Claude Code CLI or Codex CLI first.'
        )}
      </DocCallout>
      <DocP>
        <Trans
          i18nKey='Find the global package directory with <0>npm root -g</0>, then in <1>@google/gemini-cli/node_modules/@google/genai/dist/node/index.mjs</1> (and the matching <2>index.cjs</2>) change the base URL:'
          components={[<DocCode />, <DocCode />, <DocCode />]}
        />
      </DocP>
      <DocCodeBlock
        language='js'
        code={`// Before\ninitHttpOptions.baseUrl = "https://generativelanguage.googleapis.com/";\n\n// After\ninitHttpOptions.baseUrl = "${apiBaseUrl}/";`}
      />
      <DocP>{t('Then set your API key as an environment variable:')}</DocP>
      <DocCodeBlock
        language='bash'
        code={'# macOS / Linux\nexport GEMINI_API_KEY="YOUR_API_KEY"\n\n# Windows PowerShell\n[Environment]::SetEnvironmentVariable("GEMINI_API_KEY", "YOUR_API_KEY", "User")'}
      />

      <DocH2>{t('Step 3: Start Using Gemini CLI')}</DocH2>
      <DocCodeBlock language='bash' code={'cd your-working-directory\ngemini "Who are you"'} />

      <DocH2>{t('FAQ')}</DocH2>
      <DocH3>{t('How do I switch models?')}</DocH3>
      <DocP>
        <Trans
          i18nKey='Type <0>/model</0> in interactive mode to switch models.'
          components={[<DocCode />]}
        />
      </DocP>
      <DocH3>{t('What causes 401/403 errors?')}</DocH3>
      <DocUl>
        <li>{t('401: GEMINI_API_KEY is not set or invalid.')}</li>
        <li>{t('403: insufficient permissions or an expired key.')}</li>
        <li>
          {t('Verify the base URL was changed to')} <DocCode>{`${apiBaseUrl}/`}</DocCode>.
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
