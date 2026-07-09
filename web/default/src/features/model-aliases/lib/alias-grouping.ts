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
import type { AliasGroup, ChannelBinding, ChannelMappingRow } from '../types'

// 保守的尾巴剥离规则：只剥「日期 / 版本标签 / 纯数字版本号」，绝不剥规格词（mini/nano/大小等）
const DATE_SUFFIX = /-\d{4}-\d{2}-\d{2}$/ // -2024-08-06
const VERSION_TAG = /-(latest|preview|exp|beta|stable|snapshot)$/ // -latest
const NUMERIC_SUFFIX = /-\d{3,8}$/ // -0125 / -1106 / -20240620

/**
 * 把不同渠道对「同一真实模型」的各种命名规范化为同一个键。
 * 例：openai/gpt-4o、gpt-4o-2024-08-06、gpt-4o-latest → 均得 "gpt4o"。
 * 注意：不剥 -mini/-nano 等规格词，故 gpt-4o-mini 不会并入 gpt-4o。
 */
export function normalizeModelName(name: string): string {
  let s = name.trim().toLowerCase()
  if (!s) return ''
  // 剥厂商前缀：取最后一个 '/' 之后的部分（openai/、anthropic/ 等）
  const slash = s.lastIndexOf('/')
  if (slash >= 0) s = s.slice(slash + 1)
  // 反复剥除日期/版本/数字尾巴（可能叠加，如 -latest 之后又是日期）
  let changed = true
  while (changed) {
    changed = false
    for (const re of [DATE_SUFFIX, VERSION_TAG, NUMERIC_SUFFIX]) {
      if (re.test(s)) {
        s = s.replace(re, '')
        changed = true
      }
    }
  }
  // 去掉分隔符，抹平 gpt-3.5-turbo 与 gpt3.5turbo 之类的差异
  s = s.replace(/[-_.\s]/g, '')
  return s
}

/** 从别名候选里挑一个默认名：最短优先，长度相同取字典序最小 */
function pickAlias(names: string[]): string {
  const sorted = [...names].sort(
    (a, b) => a.length - b.length || a.localeCompare(b)
  )
  return sorted[0] ?? ''
}

/** 解析逗号分隔的模型列表 */
export function parseModels(models: string): string[] {
  return models
    .split(',')
    .map((m) => m.trim())
    .filter((m) => m.length > 0)
}

/** 安全解析 model_mapping JSON 字符串为 {string: string} */
export function parseMapping(raw: string): Record<string, string> {
  const trimmed = (raw ?? '').trim()
  if (!trimmed || trimmed === '{}') return {}
  try {
    const obj = JSON.parse(trimmed)
    if (!obj || typeof obj !== 'object' || Array.isArray(obj)) return {}
    const result: Record<string, string> = {}
    for (const [k, v] of Object.entries(obj)) {
      if (typeof v === 'string') result[k] = v
    }
    return result
  } catch {
    return {}
  }
}

/**
 * 扫描所有渠道，按名称相似度自动聚类出「统一别名」建议分组。
 * 只保留有意义的组：跨 ≥2 个渠道，或组内出现 ≥2 个不同原始名。
 * 已应用过别名的渠道（model_mapping 里含该别名 key）会被识别并复用现有真实名。
 */
export function buildAliasGroups(
  channels: ChannelMappingRow[],
  includeSingletons = false
): AliasGroup[] {
  // normalizedKey -> (channelId -> 该渠道属于此键的原始模型名集合)
  const clusters = new Map<string, Map<number, Set<string>>>()
  const mappingByChannel = new Map<number, Record<string, string>>()
  const channelById = new Map<number, ChannelMappingRow>()

  for (const ch of channels) {
    channelById.set(ch.id, ch)
    mappingByChannel.set(ch.id, parseMapping(ch.model_mapping))
    for (const m of parseModels(ch.models)) {
      const key = normalizeModelName(m)
      if (!key) continue
      let byCh = clusters.get(key)
      if (!byCh) {
        byCh = new Map()
        clusters.set(key, byCh)
      }
      let set = byCh.get(ch.id)
      if (!set) {
        set = new Set()
        byCh.set(ch.id, set)
      }
      set.add(m)
    }
  }

  const groups: AliasGroup[] = []

  for (const [key, byCh] of clusters) {
    const allRaw = new Set<string>()
    for (const set of byCh.values()) for (const r of set) allRaw.add(r)
    const channelIds = [...byCh.keys()]

    // 只有一个渠道且只有一个名字 → 默认无需别名而跳过；includeSingletons 时全部保留
    if (!includeSingletons && channelIds.length < 2 && allRaw.size < 2) continue

    // 若某原始名已被某渠道当作 mapping key 使用（说明是既有别名），优先作为别名名
    const establishedAlias = [...allRaw].filter((r) =>
      channelIds.some((cid) => r in (mappingByChannel.get(cid) ?? {}))
    )
    const alias = pickAlias(
      establishedAlias.length ? establishedAlias : [...allRaw]
    )

    const bindings: ChannelBinding[] = channelIds.map((cid) => {
      const ch = channelById.get(cid)!
      const mapping = mappingByChannel.get(cid) ?? {}
      const rawSet = byCh.get(cid)!
      let target: string
      if (alias in mapping && mapping[alias]) {
        // 别名已生效：复用现有真实上游名
        target = mapping[alias]
      } else if (rawSet.has(alias)) {
        // 该渠道本就原生提供与别名同名的模型 → 无需重定向，target 即别名自身
        target = alias
      } else {
        // 取该渠道该组里「非别名」的原始名作为真实上游名
        const nonAlias = [...rawSet].filter((r) => r !== alias)
        target = nonAlias.length ? pickAlias(nonAlias) : [...rawSet][0] ?? alias
      }
      return {
        channelId: cid,
        channelName: ch.name,
        channelStatus: ch.status,
        availableModels: parseModels(ch.models),
        target,
        included: true,
        existingMapping: mapping[alias] ?? '',
      }
    })

    bindings.sort((a, b) => a.channelId - b.channelId)
    groups.push({ id: key, alias, bindings })
  }

  // 覆盖渠道多的组排前面，其次按别名字典序
  groups.sort(
    (a, b) =>
      b.bindings.length - a.bindings.length || a.alias.localeCompare(b.alias)
  )
  return groups
}

export type ChannelMappingUpdatePayload = {
  id: number
  model_mapping: string
  models?: string
}

/**
 * 把多个（编辑后的）别名组合并成后端批量更新项，按渠道聚合。
 * 采用「追加」语义：别名加入 models（保留原名），mapping 追加 {alias: target}。
 * 仅纳入 included 的渠道；target 等于别名时不写 mapping（等价恒等映射）。
 * 同一渠道被多个别名命中时，累加到同一条更新里，避免相互覆盖。
 */
export function buildUpdatesFromGroups(
  groups: AliasGroup[],
  channels: ChannelMappingRow[]
): ChannelMappingUpdatePayload[] {
  const channelById = new Map(channels.map((c) => [c.id, c]))
  const state = new Map<
    number,
    { models: string[]; mapping: Record<string, string> }
  >()
  const touched: number[] = []

  for (const group of groups) {
    const alias = group.alias.trim()
    if (!alias) continue
    for (const b of group.bindings) {
      if (!b.included) continue
      const ch = channelById.get(b.channelId)
      if (!ch) continue
      const target = b.target.trim()
      if (!target) continue

      let st = state.get(b.channelId)
      if (!st) {
        st = {
          models: parseModels(ch.models),
          mapping: parseMapping(ch.model_mapping),
        }
        state.set(b.channelId, st)
        touched.push(b.channelId)
      }
      if (!st.models.includes(alias)) st.models.push(alias)
      if (target !== alias) st.mapping[alias] = target
    }
  }

  return touched.map((id) => {
    const st = state.get(id)!
    return {
      id,
      model_mapping:
        Object.keys(st.mapping).length > 0
          ? JSON.stringify(st.mapping, null, 2)
          : '',
      models: st.models.join(','),
    }
  })
}

/** 单个别名组转更新项（buildUpdatesFromGroups 的单组包装） */
export function buildUpdatesFromGroup(
  group: AliasGroup,
  channels: ChannelMappingRow[]
): ChannelMappingUpdatePayload[] {
  return buildUpdatesFromGroups([group], channels)
}
