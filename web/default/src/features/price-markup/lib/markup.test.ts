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
  // tiered/expr-billed -> coefficients scaled by pct, structure preserved
  'tiered-model': {
    billing_mode: { current: null, upstreams: { [CH]: 'tiered_expr' }, confidence: {} },
    billing_expr: {
      current: null,
      upstreams: { [CH]: 'tier("base", p*3+c*15)' },
      confidence: {},
    },
  },
  // tiered/expr-billed but no recognizable price coefficient -> genuinely skipped
  'weird-tiered-model': {
    billing_mode: { current: null, upstreams: { [CH]: 'tiered_expr' }, confidence: {} },
    billing_expr: {
      current: null,
      upstreams: { [CH]: 'tier("base", 5)' },
      confidence: {},
    },
  },
}

describe('buildMarkupPlan', () => {
  test('marks up model_ratio/model_price by pct; copies relative ratios; scales tiered expr', () => {
    const plan = buildMarkupPlan(diffs, [CH], vendorIndex, 10, {})

    assert.deepEqual(plan.skippedTiered, ['weird-tiered-model'])

    const tiered = plan.rows.find((r) => r.model === 'tiered-model')!
    assert.equal(tiered.billing, 'expr')
    assert.equal(tiered.exprBefore, 'tier("base", p*3+c*15)')
    assert.equal(tiered.exprAfter, 'tier("base", p * 3.3+c * 16.5)')

    const gpt = plan.rows.find((r) => r.model === 'gpt-4o')!
    assert.equal(gpt.billing, 'ratio')
    assert.equal(gpt.base, 2.5)
    assert.equal(gpt.result, 2.75) // 2.5 * 1.10
    assert.equal(gpt.completionRatio, 4) // copied, NOT marked up
    assert.equal(gpt.vendor, 'OpenAI')
    assert.equal(gpt.channelFactor, 1) // no channel factor configured -> default 1

    const claude = plan.rows.find((r) => r.model === 'claude-sonnet-4-6')!
    assert.equal(claude.base, 3) // 'same' -> current
    assert.equal(claude.result, 3.3)

    const img = plan.rows.find((r) => r.model === 'some-image-model')!
    assert.equal(img.billing, 'price')
    assert.equal(img.result, 0.055) // 0.05 * 1.10
  })

  test('resolves base even when upstream keys are "name(id)" not matching passed channel names', () => {
    // Mirrors real backend: upstreams keyed by "name(id)"; one channel 'same'
    // with null current, another with a real number.
    const realDiffs: DifferencesMap = {
      'claude-fable-5': {
        model_ratio: {
          current: null,
          upstreams: { 'memtensor.cn渠道(8)': 5, '得物国内模型渠道(1)': 'same' },
          confidence: {},
        },
        completion_ratio: {
          current: null,
          upstreams: { 'memtensor.cn渠道(8)': 5, '得物国内模型渠道(1)': 'same' },
          confidence: {},
        },
      },
    }
    // pass a mismatching bare name; fallback scan must still find 5
    const plan = buildMarkupPlan(realDiffs, ['memtensor.cn渠道'], vendorIndex, 20, {})
    assert.equal(plan.rows.length, 1)
    assert.equal(plan.rows[0].base, 5)
    assert.equal(plan.rows[0].result, 6) // 5 * 1.20
    assert.equal(plan.rows[0].completionRatio, 5)
  })

  test('per-vendor pct overrides global pct', () => {
    const plan = buildMarkupPlan(diffs, [CH], vendorIndex, 10, { OpenAI: 30 })
    const gpt = plan.rows.find((r) => r.model === 'gpt-4o')!
    assert.equal(gpt.pct, 30)
    assert.equal(gpt.result, 3.25) // 2.5 * 1.30
    const claude = plan.rows.find((r) => r.model === 'claude-sonnet-4-6')!
    assert.equal(claude.pct, 10) // Anthropic falls back to global
  })

  test('channel factor corrects upstream group/discount ratio before markup (e.g. 得物 default-group 0.7x)', () => {
    // real scenario: upstream reports raw model_ratio 0.5, but our account is
    // actually billed under their "default" group at 0.7x -> true cost 0.35
    const realCost: DifferencesMap = {
      'deepseek-v4-flash': {
        model_ratio: { current: null, upstreams: { '得物(1)': 0.5 }, confidence: {} },
        completion_ratio: { current: null, upstreams: { '得物(1)': 2 }, confidence: {} },
      },
    }
    const plan = buildMarkupPlan(
      realCost,
      ['得物(1)'],
      vendorIndex,
      20,
      {},
      { '得物(1)': 0.7 }
    )
    const row = plan.rows[0]
    assert.equal(row.base, 0.35) // 0.5 * 0.7 (channel factor), true cost
    assert.equal(row.result, 0.42) // 0.35 * 1.20 (markup)
    assert.equal(row.channelFactor, 0.7) // recorded for later per-model re-edit
    // relative ratio unaffected by channel factor (invariant to it)
    assert.equal(row.completionRatio, 2)
  })

  test('channel factor scales tiered expr coefficients too', () => {
    const d: DifferencesMap = {
      'tiered-x': {
        billing_mode: { current: null, upstreams: { 'ch(9)': 'tiered_expr' }, confidence: {} },
        billing_expr: {
          current: null,
          upstreams: { 'ch(9)': 'tier("base", p*10+c*20)' },
          confidence: {},
        },
      },
    }
    const plan = buildMarkupPlan(d, ['ch(9)'], vendorIndex, 20, {}, { 'ch(9)': 0.5 })
    const row = plan.rows[0]
    // coef * channelFactor(0.5) * (1+20%) = coef * 0.6
    assert.equal(row.exprAfter, 'tier("base", p * 6+c * 12)')
    assert.equal(row.channelFactor, 0.5)
  })

  test('missing channel factor defaults to 1 (no change in behavior)', () => {
    const plan = buildMarkupPlan(diffs, [CH], vendorIndex, 10, {}, { 'other-channel': 0.5 })
    const gpt = plan.rows.find((r) => r.model === 'gpt-4o')!
    assert.equal(gpt.base, 2.5)
    assert.equal(gpt.result, 2.75)
  })

  test('excludes untrustworthy placeholder ratios (real backend signature: 37.5 + completion_ratio 1)', () => {
    // Mirrors controller/ratio_sync.go's own "不可信" heuristic: a channel that
    // never configured a custom price for this model reports the system
    // fallback (37.5 / completion 1) and is flagged confidence=false. Must be
    // excluded entirely, not treated as a competing real price.
    const d: DifferencesMap = {
      'glm-5': {
        model_ratio: {
          current: null,
          upstreams: { 'apextoken(13)': 0.3, '得物(1)': 37.5 },
          confidence: { 'apextoken(13)': true, '得物(1)': false },
        },
      },
    }
    const plan = buildMarkupPlan(d, ['apextoken(13)', '得物(1)'], vendorIndex, 0, {})
    assert.equal(plan.rows.length, 1)
    assert.equal(plan.rows[0].base, 0.3) // 得物's untrustworthy 37.5 never considered
    assert.equal(plan.rows[0].sourceChannel, 'apextoken(13)')
    assert.equal(plan.rows[0].conflict, undefined) // only one trustworthy candidate -> no conflict
  })

  test('flags a conflict when >=2 trustworthy channels disagree, and reports sourceChannel', () => {
    const d: DifferencesMap = {
      'deepseek-v4-flash': {
        model_ratio: {
          current: null,
          upstreams: { 'apextoken(13)': 0.1, 'memtensor(8)': 0.0715, '得物(1)': 0.5 },
          confidence: {},
        },
      },
    }
    const names = ['apextoken(13)', 'memtensor(8)', '得物(1)']
    const plan = buildMarkupPlan(d, names, vendorIndex, 0, {})
    const row = plan.rows[0]
    // default priority = first in channelNames order
    assert.equal(row.sourceChannel, 'apextoken(13)')
    assert.equal(row.base, 0.1)
    assert.equal(row.conflict?.length, 3)
    assert.deepEqual(
      new Set(row.conflict?.map((c) => c.value)),
      new Set([0.1, 0.0715, 0.5])
    )
  })

  test('channelOverride forces a specific channel to win for a given model', () => {
    const d: DifferencesMap = {
      'deepseek-v4-flash': {
        model_ratio: {
          current: null,
          upstreams: { 'apextoken(13)': 0.1, '得物(1)': 0.5 },
          confidence: {},
        },
      },
    }
    const names = ['apextoken(13)', '得物(1)']
    const plan = buildMarkupPlan(d, names, vendorIndex, 0, {}, {}, {
      'deepseek-v4-flash': '得物(1)',
    })
    const row = plan.rows[0]
    assert.equal(row.sourceChannel, '得物(1)')
    assert.equal(row.base, 0.5)
  })

  test('channelOverride pointing at a channel with no trustworthy data for that model drops the row (no silent fallback)', () => {
    const d: DifferencesMap = {
      'model-x': {
        model_ratio: { current: null, upstreams: { 'a(1)': 1 }, confidence: {} },
      },
    }
    const plan = buildMarkupPlan(d, ['a(1)'], vendorIndex, 0, {}, {}, {
      'model-x': 'b(2)', // b(2) has no data for model-x at all
    })
    assert.equal(plan.rows.length, 0)
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

    // tiered model: scaled expression written, ratio/price maps untouched for it
    assert.equal(map.get('billing_setting.billing_mode')['tiered-model'], 'tiered_expr')
    assert.equal(
      map.get('billing_setting.billing_expr')['tiered-model'],
      'tier("base", p * 3.3+c * 16.5)'
    )
    assert.equal('tiered-model' in map.get('ModelRatio'), false)
    assert.equal('tiered-model' in map.get('ModelPrice'), false)
  })
})
