import assert from 'node:assert/strict'
import { describe, test } from 'node:test'

import { scaleBillingExpr } from './expr-scale'

describe('scaleBillingExpr', () => {
  test('scales a simple flat expression', () => {
    const r = scaleBillingExpr('tier("base", p * 2.5 + c * 15 + cr * 0.25)', 20)
    assert.equal(r.count, 3)
    assert.equal(r.scaled, 'tier("base", p * 3 + c * 18 + cr * 0.3)')
  })

  test('applies an optional channel factor before the markup (upstream group correction)', () => {
    // channelFactor=0.7 corrects an upstream default-group discount before +20% markup
    const r = scaleBillingExpr('tier("base", p * 10 + c * 20)', 20, 0.7)
    // coef * 0.7 * 1.20 = coef * 0.84
    assert.equal(r.scaled, 'tier("base", p * 8.4 + c * 16.8)')
  })

  test('channel factor defaults to 1 (no behavior change when omitted)', () => {
    const withDefault = scaleBillingExpr('tier("base", p * 10)', 20)
    const withExplicit1 = scaleBillingExpr('tier("base", p * 10)', 20, 1)
    assert.equal(withDefault.scaled, withExplicit1.scaled)
  })

  test('leaves tier condition thresholds untouched (real prod expr: glm-5)', () => {
    const expr =
      'p <= 32000 ? tier("输入≤32k", p * 4 + c * 18 + cr * 0.8) : tier("32k<输入≤200k", p * 6 + c * 22 + cr * 1.2)'
    const r = scaleBillingExpr(expr, 20)
    assert.equal(r.count, 6)
    assert.ok(r.scaled.includes('p <= 32000'), 'threshold 32000 must be untouched')
    assert.ok(r.scaled.includes('输入≤32k'), 'tier label must be untouched')
    assert.ok(r.scaled.includes('p * 4.8'))
    assert.ok(r.scaled.includes('c * 21.6'))
    assert.ok(r.scaled.includes('cr * 0.96'))
    assert.ok(r.scaled.includes('p * 7.2'))
    assert.ok(r.scaled.includes('c * 26.4'))
    assert.ok(r.scaled.includes('cr * 1.44'))
  })

  test('multi-tier with three branches and && conditions (real prod expr: qwen-plus)', () => {
    const expr =
      'p <= 128000 ? tier("输入≤128k", p * 0.8 + c * 8 + cr * 0.16) : p > 128000 && p <= 256000 ? tier("128k<输入≤256k", p * 2.4 + c * 24 + cr * 0.48) : tier("256k<输入≤1m", p * 4.8 + c * 64 + cr * 0.96)'
    const r = scaleBillingExpr(expr, 10)
    assert.equal(r.count, 9)
    // thresholds untouched
    assert.ok(r.scaled.includes('p <= 128000'))
    assert.ok(r.scaled.includes('p > 128000 && p <= 256000'))
    // coefficients scaled by 1.10
    assert.ok(r.scaled.includes('p * 0.88'))
    assert.ok(r.scaled.includes('c * 8.8'))
    assert.ok(r.scaled.includes('cr * 0.176'))
    assert.ok(r.scaled.includes('p * 5.28'))
    assert.ok(r.scaled.includes('c * 70.4'))
  })

  test('request-rule suffix after ||| is preserved verbatim', () => {
    const expr = 'tier("base", p * 5 + c * 25)|||when(header("x") has "y") * 6'
    const r = scaleBillingExpr(expr, 50)
    assert.equal(r.count, 2) // only the two billing-part coefficients
    assert.ok(r.scaled.endsWith('|||when(header("x") has "y") * 6'))
    assert.ok(r.scaled.includes('p * 7.5'))
    assert.ok(r.scaled.includes('c * 37.5'))
  })

  test('returns count 0 for an expression with no recognizable price coefficients', () => {
    const r = scaleBillingExpr('tier("base", 5)', 20)
    assert.equal(r.count, 0)
  })
})
