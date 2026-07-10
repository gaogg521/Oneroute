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
  billing: 'ratio' | 'price' | 'expr' // ratio/price 二选一；expr=阶梯/表达式计费
  base: number // 上游基准价（expr 行不使用，为 0）
  pct: number // 实际应用的加价百分比
  result: number // base × (1 + pct/100)（expr 行不使用，为 0）
  // ratio 计费时从上游原样复制的相对倍率（不加价）
  completionRatio?: number
  cacheRatio?: number
  createCacheRatio?: number
  imageRatio?: number
  audioRatio?: number
  audioCompletionRatio?: number
  // expr 计费：原始表达式与按比例缩放系数后的表达式（仅数字系数变化，阶梯阈值/标签不变）
  exprBefore?: string
  exprAfter?: string
  /** 该行基准价实际取自哪个渠道键（如「得物国内模型渠道(1)」），供核对/多渠道场景排查 */
  sourceChannel: string
  /** 多个可信渠道对同一模型报价不一致时，列出全部候选（不可信的占位值已提前排除） */
  conflict?: Array<{ channelKey: string; value: number }>
}

export type MarkupPlan = {
  rows: MarkupRow[]
  /** 表达式无法安全识别系数、因而未能加价的模型（极少数非常规写法） */
  skippedTiered: string[]
}

/** 待写回的 option 更新项 */
export type OptionUpdate = { key: string; value: string }
