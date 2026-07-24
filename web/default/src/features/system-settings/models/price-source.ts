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
 * 价格来源追踪（PriceSourceHistory）
 *
 * 「模型定价」页的价格可能来自三种操作：管理员手动输入、上游价格同步、批量加价。
 * 三者最终都写进同一张扁平数字表（ModelRatio/ModelPrice/…），写完无法区分来源。
 * 这里用一个旁挂的 option 键 PriceSourceHistory（JSON map，按模型名索引）记录
 * 每个模型价格「最后一次是被哪种操作、来自哪个渠道」写入的，供列表展示来源徽章。
 *
 * 存储模式完全仿照现有的 PriceMarkupHistory（price-markup/lib/history.ts）——
 * 任意 option 键做侧表，后端 updateOptionMap 对未知键安全放行，零 schema 改动。
 * 三条写价路径都写同一个键，last-write-wins，天然解决「先加价后手动改」的先后关系。
 */

export type PriceSourceKind = 'manual' | 'upstream_sync' | 'batch_markup'

/** 单条来源记录（按模型名建索引） */
export type PriceSourceEntry = {
  /** 最后一次写入该模型价格的操作类型 */
  source: PriceSourceKind
  /** 来源渠道名（仅 upstream_sync / batch_markup 有；manual 无） */
  channel?: string
  /** 写入时间（毫秒时间戳） */
  updatedAt: number
}

export type PriceSourceMap = Record<string, PriceSourceEntry>

const OPTION_KEY = 'PriceSourceHistory'

export { OPTION_KEY as PRICE_SOURCE_OPTION_KEY }

const VALID_SOURCES: ReadonlySet<PriceSourceKind> = new Set([
  'manual',
  'upstream_sync',
  'batch_markup',
])

/** 从 getSystemOptions 的扁平列表里解析出来源记录，容错处理缺失/损坏的值 */
export function parsePriceSource(
  options: Array<{ key: string; value: string }>
): PriceSourceMap {
  const raw = options.find((o) => o.key === OPTION_KEY)?.value
  if (!raw) return {}
  try {
    const parsed = JSON.parse(raw)
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return {}
    const result: PriceSourceMap = {}
    for (const [model, entry] of Object.entries(
      parsed as Record<string, unknown>
    )) {
      if (!entry || typeof entry !== 'object') continue
      const e = entry as Record<string, unknown>
      if (typeof e.source !== 'string') continue
      if (!VALID_SOURCES.has(e.source as PriceSourceKind)) continue
      const entryOut: PriceSourceEntry = {
        source: e.source as PriceSourceKind,
        updatedAt: typeof e.updatedAt === 'number' ? e.updatedAt : 0,
      }
      if (typeof e.channel === 'string') entryOut.channel = e.channel
      result[model] = entryOut
    }
    return result
  } catch {
    return {}
  }
}

/** 合并来源补丁（同模型名以补丁为准），返回待写回的 JSON 字符串 */
export function mergePriceSource(
  current: PriceSourceMap,
  patch: PriceSourceMap
): string {
  const merged: PriceSourceMap = { ...current, ...patch }
  return JSON.stringify(merged, null, 2)
}

/** 价格被还原/删除时，把这些模型的来源戳移除，返回待写回的 JSON 字符串 */
export function removePriceSourceEntries(
  current: PriceSourceMap,
  models: string[]
): string {
  const next = { ...current }
  for (const model of models) delete next[model]
  return JSON.stringify(next, null, 2)
}

/** 便捷构造：给一批模型盖同一个来源戳 */
export function buildPriceSourcePatch(
  models: string[],
  source: PriceSourceKind,
  updatedAt: number,
  channelOf?: (model: string) => string | undefined
): PriceSourceMap {
  const patch: PriceSourceMap = {}
  for (const model of models) {
    const channel = channelOf?.(model)
    patch[model] = channel ? { source, channel, updatedAt } : { source, updatedAt }
  }
  return patch
}
