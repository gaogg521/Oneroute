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
import type { DocNavGroup } from '../types'

/**
 * Sidebar navigation structure for the documentation center.
 * Mirrors the source layout: Getting Started / Integration Guide / API Manual.
 */
export function useDocsNav(): DocNavGroup[] {
  const { t } = useTranslation()

  return [
    {
      title: t('Getting Started'),
      items: [
        { label: t('Introduction'), to: '/docs' },
        { label: t('Using the API'), to: '/docs/quick-start' },
      ],
    },
    {
      title: t('Integration Guide'),
      items: [
        { label: t('Claude Code CLI'), to: '/docs/integration/claude-code-cli' },
        {
          label: t('Claude Desktop Integration'),
          to: '/docs/integration/claude-desktop',
        },
        {
          label: t('CodeBuddy / WorkBuddy'),
          to: '/docs/integration/codebuddy',
        },
        { label: t('Codex CLI'), to: '/docs/integration/codex-cli' },
        { label: t('Gemini CLI'), to: '/docs/integration/gemini-cli' },
        { label: t('OpenCode'), to: '/docs/integration/opencode' },
        { label: t('Hermes Agent'), to: '/docs/integration/hermes' },
      ],
    },
    {
      title: t('API Manual'),
      items: [
        {
          label: t('Nanobanana 2 Image Generation'),
          to: '/docs/api/nanobanana-2',
          badge: 'POST',
        },
      ],
    },
  ]
}
