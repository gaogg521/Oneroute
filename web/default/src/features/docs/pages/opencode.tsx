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
  DocOl,
  DocP,
  DocPageHeader,
  DocUl,
} from '../components/doc-section'
import { useDocsEndpoints } from '../lib/use-docs-endpoints'

export function OpenCode() {
  const { t } = useTranslation()
  const { systemName } = useSystemConfig()
  const { apiBaseUrl } = useDocsEndpoints()

  const configJson = `{
  "$schema": "https://opencode.ai/config.json",
  "provider": {
    "newapi-anthropic": {
      "npm": "@ai-sdk/anthropic",
      "name": "${systemName} Claude",
      "options": {
        "baseURL": "${apiBaseUrl}/v1",
        "apiKey": "YOUR_API_KEY"
      },
      "models": {
        "claude-opus-4-8": { "name": "Claude Opus 4.8" },
        "claude-sonnet-4-6": { "name": "Claude Sonnet 4.6" }
      }
    },
    "newapi-google": {
      "npm": "@ai-sdk/google",
      "name": "${systemName} Gemini",
      "options": {
        "baseURL": "${apiBaseUrl}/v1beta",
        "apiKey": "YOUR_API_KEY"
      },
      "models": {
        "gemini-2.5-pro": { "name": "Gemini 2.5 Pro" }
      }
    },
    "newapi-openai": {
      "npm": "@ai-sdk/openai",
      "name": "${systemName} GPT",
      "options": {
        "baseURL": "${apiBaseUrl}/v1",
        "apiKey": "YOUR_API_KEY"
      },
      "models": {
        "gpt-5.2": { "name": "GPT-5.2" }
      }
    }
  }
}`

  return (
    <>
      <DocPageHeader
        eyebrow={t('Integration Guide')}
        title={t('OpenCode')}
        lead={t('Connect OpenCode to {{name}}.', { name: systemName })}
      />

      <DocH2>{t('Overview')}</DocH2>
      <DocP>
        {t(
          'OpenCode is an open-source terminal AI coding assistant with a modern TUI. It supports multiple LLM providers, and through {{name}} you can reach Claude, GPT, and Gemini with one key.',
          { name: systemName }
        )}
      </DocP>

      <DocH2>{t('Prerequisites')}</DocH2>
      <DocUl>
        <li>{t('A modern terminal emulator (WezTerm, Alacritty, Ghostty, Kitty, Windows Terminal, etc.).')}</li>
        <li>
          <Trans
            i18nKey='An API key — create one on the <0>API Keys</0> page.'
            components={[
              <Link to='/keys' className='text-primary font-medium hover:underline' />,
            ]}
          />
        </li>
      </DocUl>

      <DocH2>{t('Step 1: Install OpenCode')}</DocH2>
      <DocCodeBlock
        language='bash'
        code={'# macOS / Linux\ncurl -fsSL https://opencode.ai/install | bash\n\n# Windows (via npm)\nnpm i -g opencode-ai@latest'}
      />
      <DocCodeBlock language='bash' code='opencode --version' />

      <DocH2>{t('Step 2: Configure the API')}</DocH2>
      <DocP>
        {t(
          'Register a custom provider, then add it to the config file.'
        )}
      </DocP>
      <DocOl>
        <li>
          {t('Run')} <DocCode>opencode auth login</DocCode>,{' '}
          {t('choose “other”, enter a Provider ID (e.g. newapi-anthropic), and any placeholder key.')}
        </li>
        <li>
          <Trans
            i18nKey='Create or edit <0>~/.config/opencode/opencode.json</0> (Windows: <1>%userprofile%\\.config\\opencode</1>):'
            components={[<DocCode />, <DocCode />]}
          />
        </li>
      </DocOl>
      <DocCodeBlock language='opencode.json' code={configJson} />
      <DocCallout tone='warning'>
        {t('Replace YOUR_API_KEY with your actual key. JSON is sensitive to symbols.')}
      </DocCallout>

      <DocH2>{t('Step 3: Start Using OpenCode')}</DocH2>
      <DocCodeBlock language='bash' code={'cd your-working-directory\nopencode'} />
      <DocP>
        <Trans
          i18nKey='In the chat interface, type <0>/models</0> — you should see the configured providers; pick one and start.'
          components={[<DocCode />]}
        />
      </DocP>

      <DocH2>{t('FAQ')}</DocH2>
      <DocH3>{t('How do I switch models?')}</DocH3>
      <DocP>
        <Trans
          i18nKey='Type <0>/models</0> in the OpenCode interface and select a model.'
          components={[<DocCode />]}
        />
      </DocP>
      <DocH3>{t('Why don’t my config changes take effect?')}</DocH3>
      <DocUl>
        <li>{t('Restart OpenCode.')}</li>
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
