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

// Endpoint-path preview shown under the "Base URL" field so admins can
// confirm the resolved upstream request URL without reading adaptor
// source. Suffixes are copied verbatim from each relay/channel/*/adaptor.go
// GetRequestURL implementation. Channels whose URL can't be derived from
// the base URL alone (Azure, Custom, AWS Bedrock, Vertex AI, Xunfei,
// Replicate, AdvancedCustom) and channels whose path is keyed by model name
// or API version in a way that isn't cleanly enumerable (Baidu v1, Gemini,
// Tencent) are intentionally omitted.

export interface EndpointSuffixEntry {
  label: string
  path: string
}

// Channels whose adaptor mirrors the client's inbound OpenAI-style request
// path onto the base URL unchanged (GetFullRequestURL passthrough), rather
// than a literally hardcoded suffix. Shown with an extra caveat line.
export const OPENAI_COMPATIBLE_SUFFIXES: EndpointSuffixEntry[] = [
  { label: 'Chat Completions', path: '/v1/chat/completions' },
  { label: 'Embeddings', path: '/v1/embeddings' },
  { label: 'Images', path: '/v1/images/generations' },
  { label: 'Image Edits', path: '/v1/images/edits' },
  { label: 'Audio Speech', path: '/v1/audio/speech' },
  { label: 'Responses', path: '/v1/responses' },
  { label: 'Rerank', path: '/v1/rerank' },
]

const OPENAI_COMPATIBLE_TYPE_IDS = [
  1, 6, 7, 9, 10, 12, 13, 19, 20, 31, 40, 42, 47, 48, 53,
]

const OLLAMA_SUFFIXES: EndpointSuffixEntry[] = [
  { label: 'Chat', path: '/api/chat' },
  { label: 'Completions', path: '/api/generate' },
  { label: 'Embeddings', path: '/api/embed' },
]

const PALM_SUFFIXES: EndpointSuffixEntry[] = [
  {
    label: 'Chat Completions',
    path: '/v1beta2/models/chat-bison-001:generateMessage',
  },
]

const CLAUDE_SUFFIXES: EndpointSuffixEntry[] = [
  { label: 'Messages', path: '/v1/messages' },
]

const MOONSHOT_SUFFIXES: EndpointSuffixEntry[] = [
  { label: 'Chat Completions', path: '/v1/chat/completions' },
  { label: 'Completions', path: '/v1/completions' },
  { label: 'Embeddings', path: '/v1/embeddings' },
  { label: 'Rerank', path: '/v1/rerank' },
  { label: 'Messages', path: '/anthropic/v1/messages' },
]

const ZHIPU_4V_SUFFIXES: EndpointSuffixEntry[] = [
  { label: 'Chat Completions', path: '/api/paas/v4/chat/completions' },
  { label: 'Embeddings', path: '/api/paas/v4/embeddings' },
  { label: 'Images', path: '/api/paas/v4/images/generations' },
  { label: 'Messages', path: '/api/anthropic/v1/messages' },
]

const PERPLEXITY_SUFFIXES: EndpointSuffixEntry[] = [
  { label: 'Chat Completions', path: '/chat/completions' },
  { label: 'Responses', path: '/v1/responses' },
]

const COHERE_SUFFIXES: EndpointSuffixEntry[] = [
  { label: 'Chat', path: '/v1/chat' },
  { label: 'Rerank', path: '/v1/rerank' },
]

const MINIMAX_SUFFIXES: EndpointSuffixEntry[] = [
  { label: 'Chat Completions', path: '/v1/text/chatcompletion_v2' },
  { label: 'Images', path: '/v1/image_generation' },
  { label: 'Audio Speech', path: '/v1/t2a_v2' },
  { label: 'Messages', path: '/anthropic/v1/messages' },
]

const DIFY_SUFFIXES: EndpointSuffixEntry[] = [
  { label: 'Workflow', path: '/v1/workflows/run' },
  { label: 'Completion', path: '/v1/completion-messages' },
  { label: 'Chat', path: '/v1/chat-messages' },
]

const JINA_SUFFIXES: EndpointSuffixEntry[] = [
  { label: 'Rerank', path: '/v1/rerank' },
  { label: 'Embeddings', path: '/v1/embeddings' },
]

const CLOUDFLARE_SUFFIXES: EndpointSuffixEntry[] = [
  {
    label: 'Chat Completions',
    path: '/client/v4/accounts/{account_id}/ai/v1/chat/completions',
  },
  {
    label: 'Embeddings',
    path: '/client/v4/accounts/{account_id}/ai/v1/embeddings',
  },
  {
    label: 'Responses',
    path: '/client/v4/accounts/{account_id}/ai/v1/responses',
  },
]

const DEEPSEEK_SUFFIXES: EndpointSuffixEntry[] = [
  { label: 'Chat Completions', path: '/v1/chat/completions' },
  { label: 'Messages', path: '/anthropic/v1/messages' },
]

const MOKAAI_SUFFIXES: EndpointSuffixEntry[] = [
  { label: 'Chat', path: '/chat/' },
  { label: 'Embeddings', path: '/embeddings' },
]

const VOLCENGINE_SUFFIXES: EndpointSuffixEntry[] = [
  { label: 'Chat Completions', path: '/api/v3/chat/completions' },
  { label: 'Images', path: '/api/v3/images/generations' },
  { label: 'Embeddings', path: '/api/v3/embeddings' },
  { label: 'Responses', path: '/api/v3/responses' },
  { label: 'Rerank', path: '/api/v3/rerank' },
]

const BAIDU_V2_SUFFIXES: EndpointSuffixEntry[] = [
  { label: 'Chat Completions', path: '/v2/chat/completions' },
  { label: 'Embeddings', path: '/v2/embeddings' },
  { label: 'Images', path: '/v2/images/generations' },
  { label: 'Image Edits', path: '/v2/images/edits' },
  { label: 'Rerank', path: '/v2/rerank' },
]

const COZE_SUFFIXES: EndpointSuffixEntry[] = [
  { label: 'Chat', path: '/v3/chat' },
]

const CODEX_SUFFIXES: EndpointSuffixEntry[] = [
  { label: 'Responses', path: '/backend-api/codex/responses' },
]

export const CHANNEL_ENDPOINT_SUFFIXES: Record<number, EndpointSuffixEntry[]> =
  {
    4: OLLAMA_SUFFIXES,
    11: PALM_SUFFIXES,
    14: CLAUDE_SUFFIXES,
    25: MOONSHOT_SUFFIXES,
    26: ZHIPU_4V_SUFFIXES,
    27: PERPLEXITY_SUFFIXES,
    34: COHERE_SUFFIXES,
    35: MINIMAX_SUFFIXES,
    37: DIFY_SUFFIXES,
    38: JINA_SUFFIXES,
    39: CLOUDFLARE_SUFFIXES,
    43: DEEPSEEK_SUFFIXES,
    44: MOKAAI_SUFFIXES,
    45: VOLCENGINE_SUFFIXES,
    46: BAIDU_V2_SUFFIXES,
    49: COZE_SUFFIXES,
    57: CODEX_SUFFIXES,
  }

for (const typeId of OPENAI_COMPATIBLE_TYPE_IDS) {
  CHANNEL_ENDPOINT_SUFFIXES[typeId] = OPENAI_COMPATIBLE_SUFFIXES
}

export function isPassthroughChannelType(channelType: number): boolean {
  return CHANNEL_ENDPOINT_SUFFIXES[channelType] === OPENAI_COMPATIBLE_SUFFIXES
}

export function getEndpointPreview(
  channelType: number,
  baseUrl: string | undefined
): Array<{ label: string; url: string }> | null {
  const suffixes = CHANNEL_ENDPOINT_SUFFIXES[channelType]
  const trimmed = baseUrl?.trim().replace(/\/+$/, '')
  if (!suffixes || !trimmed) return null

  return suffixes.map(({ label, path }) => ({
    label,
    url: `${trimmed}${path}`,
  }))
}
