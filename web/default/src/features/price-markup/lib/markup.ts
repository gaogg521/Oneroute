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

/** 有效上游值 + 该值来自哪个渠道键（用于按渠道应用换算系数） */
type EffectiveValue<T> = { value: T; channelKey: string }

/** 该渠道在该字段上是否可信。后端明确标记 false 的（如 model_ratio≈37.5 且
 * completion_ratio≈1 的系统兜底占位值）一律排除，不当作候选价格；未标记的默认可信。 */
function isTrusted(diff: RatioDifference, channelKey: string): boolean {
  return diff.confidence?.[channelKey] !== false
}

/**
 * 取某模型某 ratioType 在所选渠道中的「有效上游值」：
 * 按 channelNames 顺序，取第一个可信的数字上游值；若上游标记 'same'（与本地相同），
 * 则回退到 diff.current（本地当前值）。不可信（confidence=false，如渠道未配置该模型、
 * 返回的是系统兜底占位值）的候选一律跳过，不参与选取。都没有则返回 undefined。
 * 同时返回该值来自哪个渠道键，供调用方查找该渠道的换算系数 / 强制指定来源。
 */
export function effectiveUpstreamNumber(
  diff: RatioDifference | undefined,
  channelNames: string[],
  forceChannelKey?: string
): EffectiveValue<number> | undefined {
  if (!diff) return undefined
  if (forceChannelKey !== undefined) {
    const v = diff.upstreams?.[forceChannelKey]
    if (typeof v === 'number' && isTrusted(diff, forceChannelKey)) {
      return { value: v, channelKey: forceChannelKey }
    }
    if (
      v === 'same' &&
      typeof diff.current === 'number' &&
      isTrusted(diff, forceChannelKey)
    ) {
      return { value: diff.current, channelKey: forceChannelKey }
    }
    // 指定的渠道对该模型没有可信数据，不回退——避免静默换用别的渠道
    return undefined
  }
  // 优先按传入的渠道键顺序取值。注意后端 upstreams 的键是「渠道名(id)」，
  // 与前端可能持有的裸渠道名不一定一致，故下面再兜底扫描所有键。
  for (const ch of channelNames) {
    if (!isTrusted(diff, ch)) continue
    const v = diff.upstreams?.[ch]
    if (typeof v === 'number') return { value: v, channelKey: ch }
    if (v === 'same' && typeof diff.current === 'number') {
      return { value: diff.current, channelKey: ch }
    }
  }
  // 兜底：扫描全部可信上游值，取第一个数字（处理键名格式不匹配 / 'same' 但 current 为 null）
  for (const [ch, v] of Object.entries(diff.upstreams ?? {})) {
    if (!isTrusted(diff, ch)) continue
    if (typeof v === 'number') return { value: v, channelKey: ch }
  }
  if (typeof diff.current === 'number') {
    return { value: diff.current, channelKey: channelNames[0] ?? '' }
  }
  return undefined
}

function effectiveUpstreamString(
  diff: RatioDifference | undefined,
  channelNames: string[],
  forceChannelKey?: string
): EffectiveValue<string> | undefined {
  if (!diff) return undefined
  if (forceChannelKey !== undefined) {
    const v = diff.upstreams?.[forceChannelKey]
    if (
      typeof v === 'string' &&
      v !== 'same' &&
      isTrusted(diff, forceChannelKey)
    ) {
      return { value: v, channelKey: forceChannelKey }
    }
    if (
      v === 'same' &&
      typeof diff.current === 'string' &&
      isTrusted(diff, forceChannelKey)
    ) {
      return { value: diff.current, channelKey: forceChannelKey }
    }
    return undefined
  }
  for (const ch of channelNames) {
    if (!isTrusted(diff, ch)) continue
    const v = diff.upstreams?.[ch]
    if (typeof v === 'string' && v !== 'same') return { value: v, channelKey: ch }
    if (v === 'same' && typeof diff.current === 'string') {
      return { value: diff.current, channelKey: ch }
    }
  }
  for (const [ch, v] of Object.entries(diff.upstreams ?? {})) {
    if (!isTrusted(diff, ch)) continue
    if (typeof v === 'string' && v !== 'same') return { value: v, channelKey: ch }
  }
  return undefined
}

/**
 * 收集某模型某字段在所有已选渠道中的「可信数值候选」（去重后 >1 个即为冲突）。
 * 用于向 UI 暴露"这几个渠道对这个模型报价不一致"，而不是静默择一。
 */
function collectTrustedNumericCandidates(
  diff: RatioDifference | undefined,
  channelNames: string[]
): Array<{ channelKey: string; value: number }> {
  if (!diff) return []
  const seen = new Map<string, number>()
  for (const ch of channelNames) {
    if (!isTrusted(diff, ch)) continue
    const v = diff.upstreams?.[ch]
    if (typeof v === 'number') seen.set(ch, v)
    else if (v === 'same' && typeof diff.current === 'number') {
      seen.set(ch, diff.current)
    }
  }
  return [...seen.entries()].map(([channelKey, value]) => ({ channelKey, value }))
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
 * 计算加价方案。基准 = 所选渠道的上游价 × 该渠道的「换算系数」。
 * 换算系数用于修正上游自己的分组/折扣倍率（ratio_sync 只抓上游裸 model_ratio，
 * 不知道我方账号在上游落在哪个分组、上游又打了多少折——由管理员手动填入换算系数
 * 修正，如上游默认分组倍率 0.7，就填 0.7，真实成本 = 裸倍率 × 0.7）。
 * ratio/price 计费：只对 model_ratio/model_price 本体加价，相对倍率
 * （completion/cache/…）是相对 model_ratio 的比值，换算系数对分子分母同时生效，
 * 比值不变，故原样复制、不需要再乘换算系数。
 * 阶梯/表达式计费：按「换算系数 ×(1+加价%)」整体缩放表达式里的每个价格系数
 * （阶梯阈值/标签不变），极少数无法识别系数的写法才跳过。
 *
 * 多渠道同时报价同一模型时：默认按 channelNames 顺序取第一个可信值（并在
 * row.sourceChannel 标明来源），若多个可信渠道报价不一致会在 row.conflict 里
 * 列出全部候选，供 UI 提示 + 让管理员用 channelOverride 强制指定某模型用哪个渠道。
 */
export function buildMarkupPlan(
  differences: DifferencesMap,
  channelNames: string[],
  vendorIndex: VendorIndex,
  globalPct: number,
  perVendorPct: Record<string, number>,
  channelFactors: Record<string, number> = {},
  channelOverride: Record<string, string> = {}
): MarkupPlan {
  const rows: MarkupRow[] = []
  const skippedTiered: string[] = []
  const factorOf = (channelKey: string) => channelFactors[channelKey] ?? 1

  for (const model of Object.keys(differences)) {
    const diff = differences[model]
    const vendor = resolveVendor(model, vendorIndex)
    const pct = perVendorPct[vendor] ?? globalPct
    const override = channelOverride[model]

    const billingModeEff = effectiveUpstreamString(diff.billing_mode, channelNames)
    const billingExprUnforced = effectiveUpstreamString(diff.billing_expr, channelNames)
    const isTiered =
      billingModeEff?.value === 'tiered_expr' ||
      Boolean(billingExprUnforced?.value.trim())

    if (isTiered) {
      const billingExprEff = override
        ? effectiveUpstreamString(diff.billing_expr, channelNames, override)
        : billingExprUnforced
      if (billingExprEff && billingExprEff.value.trim()) {
        const channelFactor = factorOf(billingExprEff.channelKey)
        const { scaled, count } = scaleBillingExpr(
          billingExprEff.value,
          pct,
          channelFactor
        )
        if (count > 0) {
          // 表达式无单一数值可比较冲突（多渠道阶梯结构本身就不同），故不做冲突检测，
          // 仅标明来源渠道供核对；如需换源可用换算系数/手动改表达式弥补。
          rows.push({
            model,
            vendor,
            billing: 'expr',
            base: 0,
            pct,
            result: 0,
            exprBefore: billingExprEff.value,
            exprAfter: scaled,
            sourceChannel: billingExprEff.channelKey,
          })
          continue
        }
      }
      // 表达式缺失，或未识别出任何可缩放的价格系数 → 无法安全加价
      skippedTiered.push(model)
      continue
    }

    const priceBaseEff = effectiveUpstreamNumber(diff.model_price, channelNames, override)
    const ratioBaseEff = effectiveUpstreamNumber(diff.model_ratio, channelNames, override)

    let billing: 'ratio' | 'price'
    let base: number
    let sourceChannel: string
    let conflict: Array<{ channelKey: string; value: number }> | undefined
    if (priceBaseEff !== undefined) {
      billing = 'price'
      base = priceBaseEff.value * factorOf(priceBaseEff.channelKey)
      sourceChannel = priceBaseEff.channelKey
      conflict = detectConflict(diff.model_price, channelNames)
    } else if (ratioBaseEff !== undefined) {
      billing = 'ratio'
      base = ratioBaseEff.value * factorOf(ratioBaseEff.channelKey)
      sourceChannel = ratioBaseEff.channelKey
      conflict = detectConflict(diff.model_ratio, channelNames)
    } else {
      continue // 该渠道没有此模型的可用基准价（或指定的来源渠道对该模型无可信数据）
    }

    const result = round6(base * (1 + pct / 100))
    const row: MarkupRow = {
      model,
      vendor,
      billing,
      base,
      pct,
      result,
      sourceChannel,
      conflict,
    }

    if (billing === 'ratio') {
      for (const [rt, field] of REL_RATIO_FIELDS) {
        const eff = effectiveUpstreamNumber(diff[rt], channelNames)
        if (eff !== undefined) {
          // 相对倍率不随换算系数变化（分子分母同时缩放，比值不变）
          ;(row as Record<string, unknown>)[field as string] = eff.value
        }
      }
    }

    rows.push(row)
  }

  rows.sort((a, b) => a.vendor.localeCompare(b.vendor) || a.model.localeCompare(b.model))
  return { rows, skippedTiered }
}

/** 若某字段在多个可信渠道间取值不一致，返回全部候选（供 UI 展示 + 手动切换来源） */
function detectConflict(
  diff: RatioDifference | undefined,
  channelNames: string[]
): Array<{ channelKey: string; value: number }> | undefined {
  const candidates = collectTrustedNumericCandidates(diff, channelNames)
  if (candidates.length < 2) return undefined
  const distinct = new Set(candidates.map((c) => c.value))
  return distinct.size > 1 ? candidates : undefined
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
