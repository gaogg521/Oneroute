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
import {
  resolveVendor,
  type VendorIndex,
} from '@/features/model-aliases/lib/vendor-grouping'
import type {
  DifferencesMap,
  RatioDifference,
  RatioType,
} from '@/features/system-settings/types'

import type {
  MarkupPlan,
  MarkupRow,
  OptionMaps,
  OptionUpdate,
} from '../types'
import { scaleBillingExpr } from './expr-scale'

/** 保留 6 位小数，消除浮点噪声 */
function round6(n: number): number {
  return Math.round(n * 1e6) / 1e6
}

/**
 * 取某模型某 ratioType 在所选渠道中的「有效上游值」：
 * 按 channelNames 顺序，取第一个是数字的上游值；若上游标记 'same'（与本地相同），
 * 则回退到 diff.current（本地当前值）。都没有则返回 undefined。
 */
export function effectiveUpstreamNumber(
  diff: RatioDifference | undefined,
  channelNames: string[]
): number | undefined {
  if (!diff) return undefined
  // 优先按传入的渠道键顺序取值。注意后端 upstreams 的键是「渠道名(id)」，
  // 与前端可能持有的裸渠道名不一定一致，故下面再兜底扫描所有键。
  for (const ch of channelNames) {
    const v = diff.upstreams?.[ch]
    if (typeof v === 'number') return v
    if (v === 'same' && typeof diff.current === 'number') return diff.current
  }
  // 兜底：扫描全部上游值，取第一个数字（处理键名格式不匹配 / 'same' 但 current 为 null）
  for (const v of Object.values(diff.upstreams ?? {})) {
    if (typeof v === 'number') return v
  }
  if (typeof diff.current === 'number') return diff.current
  return undefined
}

function effectiveUpstreamString(
  diff: RatioDifference | undefined,
  channelNames: string[]
): string | undefined {
  if (!diff) return undefined
  for (const ch of channelNames) {
    const v = diff.upstreams?.[ch]
    if (typeof v === 'string' && v !== 'same') return v
    if (v === 'same' && typeof diff.current === 'string') return diff.current
  }
  for (const v of Object.values(diff.upstreams ?? {})) {
    if (typeof v === 'string' && v !== 'same') return v
  }
  return undefined
}

const REL_RATIO_FIELDS: Array<[RatioType, keyof MarkupRow]> = [
  ['completion_ratio', 'completionRatio'],
  ['cache_ratio', 'cacheRatio'],
  ['create_cache_ratio', 'createCacheRatio'],
  ['image_ratio', 'imageRatio'],
  ['audio_ratio', 'audioRatio'],
  ['audio_completion_ratio', 'audioCompletionRatio'],
]

/**
 * 计算加价方案。基准 = 所选渠道的上游价。
 * ratio/price 计费：只对 model_ratio/model_price 本体加价，相对倍率
 * （completion/cache/…）从上游原样复制。
 * 阶梯/表达式计费：按同一百分比缩放表达式里的每个价格系数（阶梯阈值/标签不变），
 * 结构与上游一致地整体加价；极少数无法识别系数的写法才跳过。
 */
export function buildMarkupPlan(
  differences: DifferencesMap,
  channelNames: string[],
  vendorIndex: VendorIndex,
  globalPct: number,
  perVendorPct: Record<string, number>
): MarkupPlan {
  const rows: MarkupRow[] = []
  const skippedTiered: string[] = []

  for (const model of Object.keys(differences)) {
    const diff = differences[model]
    const vendor = resolveVendor(model, vendorIndex)
    const pct = perVendorPct[vendor] ?? globalPct

    const billingMode = effectiveUpstreamString(diff.billing_mode, channelNames)
    const billingExpr = effectiveUpstreamString(diff.billing_expr, channelNames)
    const isTiered = billingMode === 'tiered_expr' || Boolean(billingExpr?.trim())

    if (isTiered) {
      if (billingExpr && billingExpr.trim()) {
        const { scaled, count } = scaleBillingExpr(billingExpr, pct)
        if (count > 0) {
          rows.push({
            model,
            vendor,
            billing: 'expr',
            base: 0,
            pct,
            result: 0,
            exprBefore: billingExpr,
            exprAfter: scaled,
          })
          continue
        }
      }
      // 表达式缺失，或未识别出任何可缩放的价格系数 → 无法安全加价
      skippedTiered.push(model)
      continue
    }

    const priceBase = effectiveUpstreamNumber(diff.model_price, channelNames)
    const ratioBase = effectiveUpstreamNumber(diff.model_ratio, channelNames)

    let billing: 'ratio' | 'price'
    let base: number
    if (priceBase !== undefined) {
      billing = 'price'
      base = priceBase
    } else if (ratioBase !== undefined) {
      billing = 'ratio'
      base = ratioBase
    } else {
      continue // 该渠道没有此模型的可用基准价
    }

    const result = round6(base * (1 + pct / 100))
    const row: MarkupRow = { model, vendor, billing, base, pct, result }

    if (billing === 'ratio') {
      for (const [rt, field] of REL_RATIO_FIELDS) {
        const v = effectiveUpstreamNumber(diff[rt], channelNames)
        if (v !== undefined) {
          ;(row as Record<string, unknown>)[field as string] = v
        }
      }
    }

    rows.push(row)
  }

  rows.sort((a, b) => a.vendor.localeCompare(b.vendor) || a.model.localeCompare(b.model))
  return { rows, skippedTiered }
}

/**
 * 把加价方案合并进当前 option maps，产出待写回的 option 更新项。
 * price 与 ratio 互斥：写 price 清 ratio 系列，写 ratio 清 price；两者都清该模型的
 * 阶梯计费配置，避免旧 tiered 覆盖新价。
 */
export function buildOptionUpdates(
  plan: MarkupPlan,
  current: OptionMaps
): OptionUpdate[] {
  const next: OptionMaps = {
    ModelRatio: { ...current.ModelRatio },
    ModelPrice: { ...current.ModelPrice },
    CompletionRatio: { ...current.CompletionRatio },
    CacheRatio: { ...current.CacheRatio },
    CreateCacheRatio: { ...current.CreateCacheRatio },
    ImageRatio: { ...current.ImageRatio },
    AudioRatio: { ...current.AudioRatio },
    AudioCompletionRatio: { ...current.AudioCompletionRatio },
    BillingMode: { ...current.BillingMode },
    BillingExpr: { ...current.BillingExpr },
  }

  for (const r of plan.rows) {
    if (r.billing === 'expr') {
      // 阶梯/表达式计费：写入缩放后的表达式，清掉该模型的 ratio/price 系列
      // （二者互斥，避免旧的固定倍率覆盖新的阶梯定价）
      next.BillingMode[r.model] = 'tiered_expr'
      next.BillingExpr[r.model] = r.exprAfter ?? ''
      delete next.ModelPrice[r.model]
      delete next.ModelRatio[r.model]
      delete next.CompletionRatio[r.model]
      delete next.CacheRatio[r.model]
      delete next.CreateCacheRatio[r.model]
      delete next.ImageRatio[r.model]
      delete next.AudioRatio[r.model]
      delete next.AudioCompletionRatio[r.model]
      continue
    }

    // 清除该模型的阶梯计费，避免覆盖新价
    delete next.BillingMode[r.model]
    delete next.BillingExpr[r.model]

    if (r.billing === 'price') {
      next.ModelPrice[r.model] = r.result
      delete next.ModelRatio[r.model]
      delete next.CompletionRatio[r.model]
      delete next.CacheRatio[r.model]
      delete next.CreateCacheRatio[r.model]
      delete next.ImageRatio[r.model]
      delete next.AudioRatio[r.model]
      delete next.AudioCompletionRatio[r.model]
    } else {
      next.ModelRatio[r.model] = r.result
      delete next.ModelPrice[r.model]
      const rel: Array<[keyof MarkupRow, keyof OptionMaps]> = [
        ['completionRatio', 'CompletionRatio'],
        ['cacheRatio', 'CacheRatio'],
        ['createCacheRatio', 'CreateCacheRatio'],
        ['imageRatio', 'ImageRatio'],
        ['audioRatio', 'AudioRatio'],
        ['audioCompletionRatio', 'AudioCompletionRatio'],
      ]
      for (const [field, key] of rel) {
        const v = r[field]
        if (typeof v === 'number') {
          ;(next[key] as Record<string, number>)[r.model] = v
        }
      }
    }
  }

  return [
    { key: 'ModelRatio', value: JSON.stringify(next.ModelRatio, null, 2) },
    { key: 'ModelPrice', value: JSON.stringify(next.ModelPrice, null, 2) },
    {
      key: 'CompletionRatio',
      value: JSON.stringify(next.CompletionRatio, null, 2),
    },
    { key: 'CacheRatio', value: JSON.stringify(next.CacheRatio, null, 2) },
    {
      key: 'CreateCacheRatio',
      value: JSON.stringify(next.CreateCacheRatio, null, 2),
    },
    { key: 'ImageRatio', value: JSON.stringify(next.ImageRatio, null, 2) },
    { key: 'AudioRatio', value: JSON.stringify(next.AudioRatio, null, 2) },
    {
      key: 'AudioCompletionRatio',
      value: JSON.stringify(next.AudioCompletionRatio, null, 2),
    },
    {
      key: 'billing_setting.billing_mode',
      value: JSON.stringify(next.BillingMode, null, 2),
    },
    {
      key: 'billing_setting.billing_expr',
      value: JSON.stringify(next.BillingExpr, null, 2),
    },
  ]
}

/** 从 getSystemOptions 的扁平列表解析出 OptionMaps */
export function parseOptionMaps(
  options: Array<{ key: string; value: string }>
): OptionMaps {
  const byKey = new Map(options.map((o) => [o.key, o.value]))
  const num = (k: string): Record<string, number> => {
    try {
      return JSON.parse(byKey.get(k) || '{}') as Record<string, number>
    } catch {
      return {}
    }
  }
  const str = (k: string): Record<string, string> => {
    try {
      return JSON.parse(byKey.get(k) || '{}') as Record<string, string>
    } catch {
      return {}
    }
  }
  return {
    ModelRatio: num('ModelRatio'),
    ModelPrice: num('ModelPrice'),
    CompletionRatio: num('CompletionRatio'),
    CacheRatio: num('CacheRatio'),
    CreateCacheRatio: num('CreateCacheRatio'),
    ImageRatio: num('ImageRatio'),
    AudioRatio: num('AudioRatio'),
    AudioCompletionRatio: num('AudioCompletionRatio'),
    BillingMode: str('billing_setting.billing_mode'),
    BillingExpr: str('billing_setting.billing_expr'),
  }
}
