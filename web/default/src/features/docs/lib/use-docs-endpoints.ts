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

/**
 * Endpoints surfaced in the documentation, derived from the live deployment
 * origin so the examples always match the domain the user is browsing.
 *
 * - apiBaseUrl: the OpenAI-compatible / image API base, e.g. https://your-site.com
 * - anthropicBaseUrl: the Anthropic-compatible base for Claude Code CLI; new-api
 *   serves the Claude format on the same origin.
 */
export interface DocsEndpoints {
  apiBaseUrl: string
  anthropicBaseUrl: string
}

const FALLBACK_ORIGIN = 'https://your-site.com'

function resolveOrigin(): string {
  if (typeof window !== 'undefined' && window.location?.origin) {
    return window.location.origin.replace(/\/+$/, '')
  }
  return FALLBACK_ORIGIN
}

export function useDocsEndpoints(): DocsEndpoints {
  const origin = resolveOrigin()
  return {
    apiBaseUrl: origin,
    anthropicBaseUrl: origin,
  }
}
