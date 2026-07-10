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
import type { MarkupPlan, MarkupRow } from '../types'

/** 持久化在 option key "PriceMarkupHistory" 里的单条记录（按模型名建索引） */
export type MarkupHistoryEntry = {
  vendor: string
  billing: MarkupRow['billing']
  /** 近一次拉取时使用的渠道基准价（已按换算系数修正，加价前） */
  upstreamPrice: number
  /** 应用时使用的加价百分比 */
  pct: number
  /** 应用时算出的结果（写入 ModelRatio/ModelPrice 的值），用于核对是否被后续改动覆盖 */
  appliedResult: number
  /** 基准价来自哪个渠道，供核对 */
  sourceChannel: string
  /** 应用时间（毫秒时间戳） */
  appliedAt: number
  /** 阶梯计费时的表达式改动前后，供表格展开查看 */
  exprBefore?: string
  exprAfter?: string
}

export type MarkupHistory = Record<string, MarkupHistoryEntry>

const OPTION_KEY = 'PriceMarkupHistory'

export { OPTION_KEY as MARKUP_HISTORY_OPTION_KEY }

/** 从 getSystemOptions 的扁平列表里解析出历史记录，容错处理缺失/损坏的值 */
export function parseMarkupHistory(
  options: Array<{ key: string; value: string }>
): MarkupHistory {
  const raw = options.find((o) => o.key === OPTION_KEY)?.value
  if (!raw) return {}
  try {
    const parsed = JSON.parse(raw)
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return {}
    return parsed as MarkupHistory
  } catch {
    return {}
  }
}

/** 把一次加价方案（已应用）转换成待合并的历史记录条目 */
export function buildHistoryEntries(
  plan: MarkupPlan,
  appliedAt: number
): MarkupHistory {
  const out: MarkupHistory = {}
  for (const r of plan.rows) {
    out[r.model] = {
      vendor: r.vendor,
      billing: r.billing,
      upstreamPrice: r.base,
      pct: r.pct,
      appliedResult: r.result,
      sourceChannel: r.sourceChannel,
      appliedAt,
      exprBefore: r.exprBefore,
      exprAfter: r.exprAfter,
    }
  }
  return out
}

/** 合并新记录到现有历史（同模型名以新记录覆盖），返回待写回的 JSON 字符串 */
export function mergeMarkupHistory(
  current: MarkupHistory,
  updates: MarkupHistory
): string {
  const merged: MarkupHistory = { ...current, ...updates }
  return JSON.stringify(merged, null, 2)
}
