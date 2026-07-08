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
import type { PricingData } from '@/features/pricing/types'

import { normalizeModelName } from './alias-grouping'

/**
 * 模型 → 供应商 索引。供应商归属复用「模型广场」的后端数据（Model.vendor_id → Vendor），
 * 与 features/pricing/hooks/use-pricing-data 一致；额外提供一层规范化名匹配，
 * 让渠道里带日期/版本尾巴的变体（如 kimi-k2-6 → 目录里的 kimi-k2.6）也能归到正确供应商。
 */
export type VendorIndex = {
  /** model_name（精确） → 供应商名 */
  modelToVendor: Map<string, string>
  /** normalizeModelName(model_name) → 供应商名；仅收录无歧义（单一供应商）的规范化键 */
  normToVendor: Map<string, string>
  /** 供应商名，按模型广场（pricing.vendors）顺序，用于 optgroup 排序 */
  vendorOrder: string[]
}

export function buildVendorIndex(pricing?: PricingData | null): VendorIndex {
  const modelToVendor = new Map<string, string>()
  const normToVendor = new Map<string, string>()
  const vendorOrder: string[] = []
  if (!pricing?.vendors || !pricing?.data) {
    return { modelToVendor, normToVendor, vendorOrder }
  }
  const idToName = new Map<number, string>()
  for (const v of pricing.vendors) {
    idToName.set(v.id, v.name)
    vendorOrder.push(v.name)
  }
  // 累积规范化键 → 供应商集合，用于剔除歧义键（同一规范化名映射到多个供应商时不参与回退）
  const normAccum = new Map<string, Set<string>>()
  for (const m of pricing.data) {
    const name =
      m.vendor_id != null ? idToName.get(m.vendor_id) : m.vendor_name || undefined
    if (!name) continue
    modelToVendor.set(m.model_name, name)
    const nk = normalizeModelName(m.model_name)
    if (!nk) continue
    const set = normAccum.get(nk)
    if (set) set.add(name)
    else normAccum.set(nk, new Set([name]))
  }
  for (const [nk, set] of normAccum) {
    if (set.size === 1) normToVendor.set(nk, [...set][0])
  }
  return { modelToVendor, normToVendor, vendorOrder }
}

/** 解析单个模型名的供应商：先精确匹配，再规范化名回退，找不到返回 '' */
function resolveVendor(model: string, idx: VendorIndex): string {
  const exact = idx.modelToVendor.get(model)
  if (exact) return exact
  const nk = normalizeModelName(model)
  return (nk && idx.normToVendor.get(nk)) || ''
}

export type VendorGroup = {
  /** 供应商名；空字符串表示「未归类」（自定义/未登记模型），UI 归入「其他」 */
  vendor: string
  models: string[]
}

/**
 * 把一组模型名按供应商分桶，供应商顺序沿用模型广场，未归类的排最后。
 */
export function groupOptionsByVendor(
  options: string[],
  idx: VendorIndex
): VendorGroup[] {
  const buckets = new Map<string, string[]>()
  for (const o of options) {
    const v = resolveVendor(o, idx)
    const list = buckets.get(v)
    if (list) list.push(o)
    else buckets.set(v, [o])
  }
  const ordered: VendorGroup[] = []
  for (const v of idx.vendorOrder) {
    const models = buckets.get(v)
    if (models) {
      ordered.push({ vendor: v, models })
      buckets.delete(v)
    }
  }
  // 兜底：不在 vendorOrder 里的已知供应商（理论上不会有），再是未归类
  for (const [v, models] of buckets) {
    if (v !== '') ordered.push({ vendor: v, models })
  }
  const unknown = buckets.get('')
  if (unknown) ordered.push({ vendor: '', models: unknown })
  return ordered
}
