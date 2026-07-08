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

/** 本工具管理的 10 个 option 价格 map（与 upstream-ratio-sync 一致） */
export type OptionMaps = {
  ModelRatio: Record<string, number>
  ModelPrice: Record<string, number>
  CompletionRatio: Record<string, number>
  CacheRatio: Record<string, number>
  CreateCacheRatio: Record<string, number>
  ImageRatio: Record<string, number>
  AudioRatio: Record<string, number>
  AudioCompletionRatio: Record<string, number>
  /** billing_setting.billing_mode */
  BillingMode: Record<string, string>
  /** billing_setting.billing_expr */
  BillingExpr: Record<string, string>
}

/** 单个模型的加价计算结果 */
export type MarkupRow = {
  model: string
  vendor: string // 供应商名，''=未归类（其他）
  billing: 'ratio' | 'price' // 基准来自 model_ratio 还是 model_price（每模型二选一）
  base: number // 上游基准价
  pct: number // 实际应用的加价百分比
  result: number // base × (1 + pct/100)
  // ratio 计费时从上游原样复制的相对倍率（不加价）
  completionRatio?: number
  cacheRatio?: number
  createCacheRatio?: number
  imageRatio?: number
  audioRatio?: number
  audioCompletionRatio?: number
}

export type MarkupPlan = {
  rows: MarkupRow[]
  /** 因阶梯/表达式计费而跳过的模型（无法简单按%加价） */
  skippedTiered: string[]
}

/** 待写回的 option 更新项 */
export type OptionUpdate = { key: string; value: string }
