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
import type { MarkupPlan, MarkupRow, OptionMaps, OptionUpdate } from '../types'
import { scaleBillingExpr } from './expr-scale'

/** 保留 6 位小数，消除浮点噪声（与 markup.ts / expr-scale.ts 保持一致的写法） */
function round6(n: number): number {
  return Math.round(n * 1e6) / 1e6
}

/**
 * 这个工具第一次同步某个模型之前，系统里原本的计费状态全量快照
 * （倍率/价格/阶梯表达式 + 全部相关子倍率），供「重置」把系统实际价格改回去。
 * billingMode 非 'tiered_expr' 时按 modelPrice/modelRatio 等数值字段恢复；
 * 是 'tiered_expr' 时按 billingExpr 恢复，其余数值字段恢复时忽略。
 */
export type MarkupBeforeSnapshot = {
  billingMode: string
  billingExpr: string
  modelPrice?: number
  modelRatio?: number
  completionRatio?: number
  cacheRatio?: number
  createCacheRatio?: number
  imageRatio?: number
  audioRatio?: number
  audioCompletionRatio?: number
}

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
  /** 应用时实际生效的渠道换算系数（默认 1）；旧记录可能缺失，读取时用 ?? 1 兜底 */
  channelFactor: number
  /** 应用时间（毫秒时间戳） */
  appliedAt: number
  /** 阶梯计费时的表达式改动前后，供表格展开查看 */
  exprBefore?: string
  exprAfter?: string
  /**
   * 这个工具第一次同步该模型之前的原始计费状态，供「重置」用。只在该模型第一次
   * 写入历史记录时捕获一次，之后每次重新应用/编辑都原样带过，绝不重新捕获——否则
   * 会把本工具自己上一次改动的结果误当成"原始状态"。
   */
  before: MarkupBeforeSnapshot
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

/** 读取某个模型当前的计费状态，作为「这个工具第一次同步它之前」的快照 */
function captureBeforeSnapshot(
  model: string,
  current: OptionMaps
): MarkupBeforeSnapshot {
  return {
    billingMode: current.BillingMode[model] ?? '',
    billingExpr: current.BillingExpr[model] ?? '',
    modelPrice: current.ModelPrice[model],
    modelRatio: current.ModelRatio[model],
    completionRatio: current.CompletionRatio[model],
    cacheRatio: current.CacheRatio[model],
    createCacheRatio: current.CreateCacheRatio[model],
    imageRatio: current.ImageRatio[model],
    audioRatio: current.AudioRatio[model],
    audioCompletionRatio: current.AudioCompletionRatio[model],
  }
}

/**
 * 把一次加价方案（已应用）转换成待合并的历史记录条目。
 * current/existingHistory 用于确定 before 快照：该模型已在历史里出现过就原样带过
 * 已捕获的 before（不重新捕获，避免把本工具自己的改动误当成"原始状态"）；否则
 * 说明这是本工具第一次同步该模型，从 current 现场捕获一份。
 */
export function buildHistoryEntries(
  plan: MarkupPlan,
  appliedAt: number,
  current: OptionMaps,
  existingHistory: MarkupHistory
): MarkupHistory {
  const out: MarkupHistory = {}
  for (const r of plan.rows) {
    const before =
      existingHistory[r.model]?.before ?? captureBeforeSnapshot(r.model, current)
    out[r.model] = {
      vendor: r.vendor,
      billing: r.billing,
      upstreamPrice: r.base,
      pct: r.pct,
      appliedResult: r.result,
      sourceChannel: r.sourceChannel,
      channelFactor: r.channelFactor,
      appliedAt,
      exprBefore: r.exprBefore,
      exprAfter: r.exprAfter,
      before,
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

/** 「重置」成功后，把某个模型从历史记录里移除（它不再由本工具管理），返回待写回的 JSON 字符串 */
export function removeMarkupHistoryEntry(
  current: MarkupHistory,
  model: string
): string {
  const next = { ...current }
  delete next[model]
  return JSON.stringify(next, null, 2)
}

/** 批量版 removeMarkupHistoryEntry：一次性移除多个模型（供「按供应商一键重置」使用） */
export function removeMarkupHistoryEntries(
  current: MarkupHistory,
  models: string[]
): string {
  const next = { ...current }
  for (const model of models) delete next[model]
  return JSON.stringify(next, null, 2)
}

/**
 * 管理员在「已应用的加价记录」里单独把某个模型的加价%改成 newPct 时，
 * 基于记录里保存的基准价/原始表达式重新算出新结果，不需要重新走整个抓取流程。
 * ratio/price：entry.upstreamPrice 已经是换算系数修正后的基准价，直接乘 (1+newPct/100)。
 * expr：entry.exprBefore 是原始未缩放表达式，需要 channelFactor 配合重新缩放。
 */
export function recomputeEntryForPct(
  entry: MarkupHistoryEntry,
  newPct: number
): { result?: number; exprAfter?: string } {
  if (entry.billing === 'expr') {
    if (!entry.exprBefore) return {}
    const { scaled } = scaleBillingExpr(
      entry.exprBefore,
      newPct,
      entry.channelFactor ?? 1
    )
    return { exprAfter: scaled }
  }
  return { result: round6(entry.upstreamPrice * (1 + newPct / 100)) }
}

/**
 * 管理员直接把某个模型的最终价格改成 newPrice 时，反推一个等效加价%存入记录，
 * 仅用于展示/核对——实际写回系统的就是 newPrice 本身，不经过这个%再算一遍。
 * upstreamPrice 为 0（如免费模型）时无法反推比例，加价%原样保留不变。
 * 只适用于 ratio/price 计费；expr 计费没有单一价格，调用方应在此之前排除。
 */
export function recomputePctForPrice(
  entry: MarkupHistoryEntry,
  newPrice: number
): number {
  if (entry.upstreamPrice === 0) return entry.pct
  return round6((newPrice / entry.upstreamPrice - 1) * 100)
}

function cloneOptionMaps(current: OptionMaps): OptionMaps {
  return {
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
}

/** 就地把单个模型的计费状态改回 entry.before 记录的原始快照（供单个/批量重置共用） */
function applyResetForModel(
  next: OptionMaps,
  model: string,
  entry: MarkupHistoryEntry
): void {
  const before: MarkupBeforeSnapshot = entry.before ?? {
    billingMode: '',
    billingExpr: '',
  }

  delete next.ModelRatio[model]
  delete next.ModelPrice[model]
  delete next.CompletionRatio[model]
  delete next.CacheRatio[model]
  delete next.CreateCacheRatio[model]
  delete next.ImageRatio[model]
  delete next.AudioRatio[model]
  delete next.AudioCompletionRatio[model]
  delete next.BillingMode[model]
  delete next.BillingExpr[model]

  if (before.billingMode === 'tiered_expr') {
    next.BillingMode[model] = before.billingMode
    next.BillingExpr[model] = before.billingExpr
  } else {
    if (before.modelPrice !== undefined) next.ModelPrice[model] = before.modelPrice
    if (before.modelRatio !== undefined) next.ModelRatio[model] = before.modelRatio
    if (before.completionRatio !== undefined) {
      next.CompletionRatio[model] = before.completionRatio
    }
    if (before.cacheRatio !== undefined) next.CacheRatio[model] = before.cacheRatio
    if (before.createCacheRatio !== undefined) {
      next.CreateCacheRatio[model] = before.createCacheRatio
    }
    if (before.imageRatio !== undefined) next.ImageRatio[model] = before.imageRatio
    if (before.audioRatio !== undefined) next.AudioRatio[model] = before.audioRatio
    if (before.audioCompletionRatio !== undefined) {
      next.AudioCompletionRatio[model] = before.audioCompletionRatio
    }
  }
}

function optionMapsToUpdates(next: OptionMaps): OptionUpdate[] {
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

/**
 * 「重置」：把某个模型的系统实际计费状态改回 entry.before 记录的、本工具第一次
 * 同步它之前的原始快照（倍率/价格/阶梯表达式 + 全部相关子倍率），返回待写回的
 * 10 个 option 更新项。写回后应配合 removeMarkupHistoryEntry 把该模型移出历史记录。
 * entry.before 在这个字段上线之前应用的旧记录里不存在，兜底当作"从未自定义过"处理
 * （重置会把该模型的计费配置整体清空，而不是抛错）。
 */
export function buildResetOptionUpdates(
  model: string,
  entry: MarkupHistoryEntry,
  current: OptionMaps
): OptionUpdate[] {
  const next = cloneOptionMaps(current)
  applyResetForModel(next, model, entry)
  return optionMapsToUpdates(next)
}

/**
 * 批量重置：对多个模型依次应用「重置」逻辑，合并成同一批 10 个 option 更新项一次性写回
 * （供「按供应商一键重置」使用）。history 里找不到对应条目的模型名会被跳过。
 */
export function buildResetOptionUpdatesForModels(
  models: string[],
  history: MarkupHistory,
  current: OptionMaps
): OptionUpdate[] {
  const next = cloneOptionMaps(current)
  for (const model of models) {
    const entry = history[model]
    if (!entry) continue
    applyResetForModel(next, model, entry)
  }
  return optionMapsToUpdates(next)
}
