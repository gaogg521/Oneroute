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

// 计价变量（见 pkg/billingexpr/expr.md）。故意不含 len —— len 只用于阶梯条件判断，
// 从不参与定价，绝不能被当作系数缩放。顺序按长度降序排列（cc1h 在 cc 之前等），
// 但由于全程使用 \b 词边界匹配，顺序其实不影响正确性，仅为可读性。
const PRICED_VARS = ['cc1h', 'cc', 'img_o', 'img', 'ai', 'ao', 'cr', 'p', 'c']
const VAR_ALT = PRICED_VARS.join('|')

// 只匹配「计价变量 * 数字」或「数字 * 计价变量」这种系数写法，
// 阶梯条件（如 p <= 32000）没有 * 号，标签字符串（引号内文本）不含这种数字×变量模式，
// 均不会被匹配，因此结构性安全。
const VAR_FIRST_RE = new RegExp(`\\b(${VAR_ALT})\\s*\\*\\s*(\\d+(?:\\.\\d+)?)`, 'g')
const NUM_FIRST_RE = new RegExp(`\\b(\\d+(?:\\.\\d+)?)\\s*\\*\\s*(${VAR_ALT})\\b`, 'g')

function round6(n: number): number {
  return Math.round(n * 1e6) / 1e6
}

export type ExprScaleResult = {
  scaled: string
  /** 实际被缩放的价格系数个数；0 表示未识别出任何可缩放系数（视为无法加价） */
  count: number
}

/**
 * 按比例缩放计费表达式里的价格系数，阶梯阈值/标签/请求规则（|||后半段）保持不变。
 * 例：pct=20 时 "p*4+c*18+cr*0.8" -> "p*4.8+c*21.6+cr*0.96"；
 * "p<=32000 ? tier(...) : ..." 里的 32000 不受影响。
 * channelFactor（默认 1）用于先修正上游自己的分组/折扣倍率，再叠加加价：
 * 最终系数 = 原系数 × channelFactor × (1+pct/100)。
 */
export function scaleBillingExpr(
  expr: string,
  pct: number,
  channelFactor = 1
): ExprScaleResult {
  const factor = (1 + pct / 100) * channelFactor
  // 请求规则后缀（|||之后，如 when(...) * 6）不是价格系数，原样保留不缩放
  const sepIdx = expr.indexOf('|||')
  const billingPart = sepIdx >= 0 ? expr.slice(0, sepIdx) : expr
  const suffix = sepIdx >= 0 ? expr.slice(sepIdx) : ''

  let count = 0
  let out = billingPart.replace(VAR_FIRST_RE, (_m, v: string, num: string) => {
    count++
    return `${v} * ${round6(Number(num) * factor)}`
  })
  out = out.replace(NUM_FIRST_RE, (_m, num: string, v: string) => {
    count++
    return `${round6(Number(num) * factor)} * ${v}`
  })

  return { scaled: out + suffix, count }
}
