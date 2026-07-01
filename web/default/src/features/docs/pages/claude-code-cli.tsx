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

export function ClaudeCodeCli() {
  const { t } = useTranslation()
  const { systemName } = useSystemConfig()
  const { anthropicBaseUrl } = useDocsEndpoints()

  const settingsJson = `{
  "env": {
    "ANTHROPIC_AUTH_TOKEN": "YOUR_API_KEY",
    "ANTHROPIC_BASE_URL": "${anthropicBaseUrl}",
    "CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC": "1"
  },
  "permissions": {
    "allow": [],
    "deny": []
  }
}`

  return (
    <>
      <DocPageHeader
        eyebrow={t('Integration Guide')}
        title={t('Claude Code CLI')}
        lead={t('Connect Claude Code CLI to {{name}}.', { name: systemName })}
      />

      <DocH2>{t('Overview')}</DocH2>
      <DocP>
        {t(
          'Claude Code CLI is the official command-line tool from Anthropic for interacting with Claude models in the terminal. By integrating Claude Code CLI with the {{name}} API, you can directly access Claude model capabilities through {{name}}.',
          { name: systemName }
        )}
      </DocP>

      <DocH2>{t('Prerequisites')}</DocH2>
      <DocP>{t('Before configuring, make sure you have:')}</DocP>
      <DocH3>{t('Get an API Key')}</DocH3>
      <DocUl>
        <li>{t('Log in to the {{name}} console.', { name: systemName })}</li>
        <li>
          <Trans
            i18nKey='In <0>API Keys</0>, click “Create New Key”, then copy the generated key.'
            components={[
              <Link
                to='/keys'
                className='text-primary font-medium hover:underline'
              />,
            ]}
          />
        </li>
        <li>
          {t('The API Key usually starts with')} <DocCode>sk-</DocCode>
          {t('. Keep it safe.')}
        </li>
      </DocUl>

      <DocH2>{t('Step 1: Install Claude Code CLI')}</DocH2>
      <DocCallout tone='tip'>
        {t(
          'If you don’t know how to open a command line terminal, see the FAQ below.'
        )}
      </DocCallout>

      <DocH3>{t('macOS / Linux: one-command installation')}</DocH3>
      <DocCodeBlock
        language='bash'
        code='curl -fsSL https://claude.ai/install.sh | bash'
      />
      <DocP>
        {t(
          'Expected result: you’ll see download and installation info, ending with a success message. If you get permission denied, add sudo before the command.'
        )}
      </DocP>

      <DocH3>{t('Windows: install via npm')}</DocH3>
      <DocP>
        {t(
          'Install Node.js first (LTS v20 or higher recommended), then verify:'
        )}
      </DocP>
      <DocCodeBlock language='bash' code={'node -v\nnpm -v'} />
      <DocP>{t('Then install Claude Code CLI in PowerShell or CMD:')}</DocP>
      <DocCodeBlock
        language='bash'
        code='npm install -g @anthropic-ai/claude-code'
      />
      <DocUl>
        <li>
          {t(
            'permission denied: run PowerShell or CMD as administrator.'
          )}
        </li>
        <li>
          {t(
            'npm command not found: Node.js is not installed correctly or not added to PATH.'
          )}
        </li>
      </DocUl>

      <DocH3>{t('Verify installation')}</DocH3>
      <DocCodeBlock language='bash' code='claude --version' />
      <DocP>{t('Success indicator: it shows a version number (e.g. 1.x.x).')}</DocP>

      <DocH2>{t('Step 2: Configure the API')}</DocH2>
      <DocP>
        {t('Claude Code CLI is configured via the settings.json file.')}
      </DocP>

      <DocH3>{t('Option A: settings.json (recommended)')}</DocH3>
      <DocP>
        <Trans
          i18nKey='Open the config directory: on Windows press Win + R and enter <0>%userprofile%\\.claude</0>; on macOS / Linux it is <1>~/.claude</1>. Create the folder if it does not exist.'
          components={[<DocCode />, <DocCode />]}
        />
      </DocP>
      <DocP>
        {t(
          'In that folder, create settings.json (remove any .txt extension) and add:'
        )}
      </DocP>
      <DocCodeBlock language='settings.json' code={settingsJson} />
      <DocCallout tone='warning'>
        <DocUl className='mt-0 text-current'>
          <li>{t('Copy the content completely, without missing any symbol.')}</li>
          <li>
            {t(
              'Replace YOUR_API_KEY with your actual API Key (keep the quotes).'
            )}
          </li>
          <li>
            {t('Do not use full-width / Chinese punctuation (e.g. ，).')}
          </li>
        </DocUl>
      </DocCallout>
      <DocP>{t('Configuration options:')}</DocP>
      <DocUl>
        <li>
          <DocCode>ANTHROPIC_AUTH_TOKEN</DocCode>:{' '}
          {t('your {{name}} API Key.', { name: systemName })}
        </li>
        <li>
          <DocCode>ANTHROPIC_BASE_URL</DocCode>: <DocCode>{anthropicBaseUrl}</DocCode>{' '}
          {t('(the {{name}} API endpoint).', { name: systemName })}
        </li>
        <li>
          <DocCode>CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC</DocCode>:{' '}
          {t('reduce non-essential network requests.')}
        </li>
      </DocUl>

      <DocH3>{t('Option B: environment variables')}</DocH3>
      <DocP>{t('Permanent setup on Windows (PowerShell):')}</DocP>
      <DocCodeBlock
        language='powershell'
        code={`[System.Environment]::SetEnvironmentVariable('ANTHROPIC_BASE_URL', '${anthropicBaseUrl}', 'User')\n[System.Environment]::SetEnvironmentVariable('ANTHROPIC_AUTH_TOKEN', 'YOUR_API_KEY', 'User')`}
      />
      <DocP>{t('Permanent setup on macOS / Linux (zsh or bash):')}</DocP>
      <DocCodeBlock
        language='bash'
        code={`echo 'export ANTHROPIC_BASE_URL="${anthropicBaseUrl}"' >> ~/.zshrc\necho 'export ANTHROPIC_AUTH_TOKEN="YOUR_API_KEY"' >> ~/.zshrc\nsource ~/.zshrc`}
      />
      <DocP>
        {t(
          'Temporary setup (current terminal only) — macOS / Linux / PowerShell:'
        )}
      </DocP>
      <DocCodeBlock
        language='bash'
        code={`export ANTHROPIC_BASE_URL="${anthropicBaseUrl}"\nexport ANTHROPIC_AUTH_TOKEN="YOUR_API_KEY"`}
      />
      <DocCallout>
        {t(
          'Restart the terminal for permanent changes to take effect. Temporary settings are lost once the terminal is closed.'
        )}
      </DocCallout>

      <DocH2>{t('Step 3: Start Using Claude Code CLI')}</DocH2>
      <DocP>{t('Enter a safe working directory:')}</DocP>
      <DocCodeBlock language='bash' code='cd your-working-directory' />
      <DocP>{t('Start interactive mode:')}</DocP>
      <DocCodeBlock language='bash' code='claude' />
      <DocP>{t('Verify the configuration:')}</DocP>
      <DocCodeBlock language='bash' code='claude "Who are you"' />
      <DocP>{t('Success indicators:')}</DocP>
      <DocUl>
        <li>{t('You see the AI response text (a few lines).')}</li>
        <li>{t('No errors like 401, 403, or API Key invalid.')}</li>
      </DocUl>

      <DocH2>{t('FAQ')}</DocH2>

      <DocH3>{t('1. What is Claude Code CLI and what is it used for?')}</DocH3>
      <DocP>
        {t(
          'It is the official command-line tool from Anthropic for interacting with Claude models in the terminal. It is mainly used for code assistance, text generation, Q&A, and file analysis — ideal for developers who want quick AI capabilities in a command line.'
        )}
      </DocP>

      <DocH3>
        {t('2. How do I verify installation and configuration on first use?')}
      </DocH3>
      <DocUl>
        <li>
          <DocCode>claude --version</DocCode>:{' '}
          {t('confirm Claude Code CLI is installed.')}
        </li>
        <li>
          <DocCode>claude "Who are you"</DocCode>:{' '}
          {t('confirm the API configuration is correct.')}
        </li>
      </DocUl>

      <DocH3>
        {t(
          '3. What’s the difference between interactive mode and single command mode?'
        )}
      </DocH3>
      <DocUl>
        <li>
          {t(
            'Interactive mode: run claude for a continuous, multi-turn conversation, ideal for complex tasks.'
          )}
        </li>
        <li>
          {t(
            'Single command mode: run claude "question" to get one response and exit, ideal for quick queries.'
          )}
        </li>
      </DocUl>

      <DocH3>
        {t(
          '4. Will Claude Code CLI automatically read or upload my local files and code?'
        )}
      </DocH3>
      <DocP>
        {t(
          'No. It only reads file content when you explicitly reference or authorize it, and asks for confirmation before sensitive operations. Use it in a dedicated project folder.'
        )}
      </DocP>

      <DocH3>
        {t(
          '5. How do I use Claude Code CLI to analyze or process local file content?'
        )}
      </DocH3>
      <DocUl>
        <li>{t('Type the file path for Claude to read.')}</li>
        <li>{t('Drag files into the terminal window.')}</li>
        <li>{t('Copy and paste file content.')}</li>
      </DocUl>

      <DocH3>{t('6. Does Claude Code CLI support Chinese input and output?')}</DocH3>
      <DocP>
        {t(
          'Yes, fully supported. You can ask questions in Chinese and receive Chinese responses.'
        )}
      </DocP>

      <DocH3>{t('7. No output after execution — what could be the cause?')}</DocH3>
      <DocUl>
        <li>{t('Network connection issues preventing API server access.')}</li>
        <li>{t('Invalid API Key or insufficient balance.')}</li>
        <li>{t('Incorrect ANTHROPIC_BASE_URL configuration.')}</li>
        <li>{t('A firewall or proxy is blocking requests.')}</li>
      </DocUl>

      <DocH3>
        {t(
          '8. Why don’t my config file or environment variable changes take effect?'
        )}
      </DocH3>
      <DocUl>
        <li>{t('Restart your terminal or command line window.')}</li>
        <li>{t('Check that settings.json has valid JSON syntax.')}</li>
        <li>
          {t(
            'Verify the config path: Windows C:\\Users\\{username}\\.claude\\settings.json, macOS / Linux ~/.claude/settings.json.'
          )}
        </li>
      </DocUl>

      <DocH3>{t('9. What causes 401/403 errors?')}</DocH3>
      <DocUl>
        <li>{t('401: ANTHROPIC_AUTH_TOKEN not set or invalid API Key.')}</li>
        <li>{t('403: insufficient API Key permissions or an expired key.')}</li>
        <li>
          {t('Verify ANTHROPIC_BASE_URL is set to')}{' '}
          <DocCode>{anthropicBaseUrl}</DocCode>.
        </li>
      </DocUl>

      <DocH3>
        {t(
          '10. What scenarios is Claude Code CLI suited for, and not suited for?'
        )}
      </DocH3>
      <DocP>{t('Suited for:')}</DocP>
      <DocUl>
        <li>{t('Code writing, debugging, and refactoring.')}</li>
        <li>{t('Quick Q&A in command-line environments.')}</li>
        <li>{t('File content analysis and processing.')}</li>
        <li>{t('Automation script integration.')}</li>
      </DocUl>
      <DocP>{t('Not suited for:')}</DocP>
      <DocUl>
        <li>{t('Complex interactions requiring a graphical interface.')}</li>
        <li>{t('Real-time collaborative editing.')}</li>
        <li>{t('Large-scale batch file processing.')}</li>
      </DocUl>

      <DocH3>{t('11. How do I switch models?')}</DocH3>
      <DocP>
        <Trans
          i18nKey='Type <0>/model</0> in interactive mode to switch models.'
          components={[<DocCode />]}
        />
      </DocP>

      <DocH3>{t('12. Which Claude models are supported?')}</DocH3>
      <DocP>
        <Trans
          i18nKey='The available Claude models depend on the channels configured on {{name}}. Common model IDs include <0>claude-opus-4-8</0>, <1>claude-sonnet-4-6</1>, and <2>claude-haiku-4-5</2>. For the current list and pricing, see the <3>Model Square</3>.'
          values={{ name: systemName }}
          components={[
            <DocCode />,
            <DocCode />,
            <DocCode />,
            <Link
              to='/pricing'
              className='text-primary font-medium hover:underline'
            />,
          ]}
        />
      </DocP>

      <DocH3>{t('13. How do I upload images?')}</DocH3>
      <DocUl>
        <li>{t('Reference the image path.')}</li>
        <li>{t('Drag and drop an image into the terminal.')}</li>
        <li>{t('Paste an image directly.')}</li>
      </DocUl>
      <DocP>
        {t(
          'All methods require user action — Claude Code CLI will not automatically read or upload local images.'
        )}
      </DocP>

      <DocH3>{t('14. How do I open a command line terminal?')}</DocH3>
      <DocUl>
        <li>
          {t(
            'Windows: press Win + R, type cmd or powershell, then press Enter.'
          )}
        </li>
        <li>
          {t('macOS: press Command + Space, type Terminal, then press Enter.')}
        </li>
        <li>{t('Linux: press Ctrl + Alt + T, or search for “Terminal”.')}</li>
      </DocUl>

      <DocH2>{t('Notes')}</DocH2>
      <DocUl>
        <li>
          {t(
            'Run Claude Code CLI in a dedicated project folder; avoid sensitive directories (system folders or folders containing credentials). It operates from the current working directory.'
          )}
        </li>
        <li>
          {t(
            'If you previously logged in with an official account, clear the ANTHROPIC_AUTH_TOKEN environment variable or override it in settings.json.'
          )}
        </li>
      </DocUl>
    </>
  )
}
