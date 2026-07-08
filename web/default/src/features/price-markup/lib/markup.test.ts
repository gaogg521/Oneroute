import assert from 'node:assert/strict'
import { describe, test } from 'node:test'

import { buildVendorIndex } from '@/features/model-aliases/lib/vendor-grouping'
import type { DifferencesMap } from '@/features/system-settings/types'

import { buildMarkupPlan, buildOptionUpdates, parseOptionMaps } from './markup'

const vendorIndex = buildVendorIndex({
  data: [
    { id: 1, model_name: 'gpt-4o', vendor_id: 10 },
    { id: 2, model_name: 'claude-sonnet-4-6', vendor_id: 20 },
  ],
  vendors: [
    { id: 10, name: 'OpenAI' },
    { id: 20, name: 'Anthropic' },
  ],
} as unknown as import('@/features/pricing/types').PricingData)

const CH = 'chan-a'

const diffs: DifferencesMap = {
  // ratio-billed, differs from local
  'gpt-4o': {
    model_ratio: { current: 1, upstreams: { [CH]: 2.5 }, confidence: {} },
    completion_ratio: { current: 1, upstreams: { [CH]: 4 }, confidence: {} },
  },
  // ratio-billed, upstream same as local -> use current as base
  'claude-sonnet-4-6': {
    model_ratio: { current: 3, upstreams: { [CH]: 'same' }, confidence: {} },
  },
  // price-billed (per-call)
  'some-image-model': {
    model_price: { current: 0.02, upstreams: { [CH]: 0.05 }, confidence: {} },
  },
  // tiered -> skipped
  'tiered-model': {
    billing_expr: {
      current: null,
      upstreams: { [CH]: 'tier("base", p*3+c*15)' },
      confidence: {},
    },
  },
}

describe('buildMarkupPlan', () => {
  test('marks up model_ratio/model_price by pct; copies relative ratios; skips tiered', () => {
    const plan = buildMarkupPlan(diffs, [CH], vendorIndex, 10, {})

    assert.deepEqual(plan.skippedTiered, ['tiered-model'])

    const gpt = plan.rows.find((r) => r.model === 'gpt-4o')!
    assert.equal(gpt.billing, 'ratio')
    assert.equal(gpt.base, 2.5)
    assert.equal(gpt.result, 2.75) // 2.5 * 1.10
    assert.equal(gpt.completionRatio, 4) // copied, NOT marked up
    assert.equal(gpt.vendor, 'OpenAI')

    const claude = plan.rows.find((r) => r.model === 'claude-sonnet-4-6')!
    assert.equal(claude.base, 3) // 'same' -> current
    assert.equal(claude.result, 3.3)

    const img = plan.rows.find((r) => r.model === 'some-image-model')!
    assert.equal(img.billing, 'price')
    assert.equal(img.result, 0.055) // 0.05 * 1.10
  })

  test('per-vendor pct overrides global pct', () => {
    const plan = buildMarkupPlan(diffs, [CH], vendorIndex, 10, { OpenAI: 30 })
    const gpt = plan.rows.find((r) => r.model === 'gpt-4o')!
    assert.equal(gpt.pct, 30)
    assert.equal(gpt.result, 3.25) // 2.5 * 1.30
    const claude = plan.rows.find((r) => r.model === 'claude-sonnet-4-6')!
    assert.equal(claude.pct, 10) // Anthropic falls back to global
  })
})

describe('buildOptionUpdates', () => {
  test('merges into current maps; price/ratio exclusivity; clears tiered for written models', () => {
    const current = parseOptionMaps([
      { key: 'ModelRatio', value: '{"existing-model":9}' },
      { key: 'ModelPrice', value: '{"some-image-model":0.02}' },
      { key: 'CompletionRatio', value: '{}' },
      {
        key: 'billing_setting.billing_mode',
        value: '{"gpt-4o":"tiered_expr"}',
      },
    ])
    const plan = buildMarkupPlan(diffs, [CH], vendorIndex, 10, {})
    const updates = buildOptionUpdates(plan, current)
    const map = new Map(updates.map((u) => [u.key, JSON.parse(u.value)]))

    // gpt-4o ratio written; existing preserved
    assert.equal(map.get('ModelRatio')['gpt-4o'], 2.75)
    assert.equal(map.get('ModelRatio')['existing-model'], 9)
    assert.equal(map.get('CompletionRatio')['gpt-4o'], 4)
    // gpt-4o local tiered config cleared (would otherwise override)
    assert.equal('gpt-4o' in map.get('billing_setting.billing_mode'), false)
    // image model switched to price; its ratio entries absent
    assert.equal(map.get('ModelPrice')['some-image-model'], 0.055)
    assert.equal('some-image-model' in map.get('ModelRatio'), false)
  })
})
