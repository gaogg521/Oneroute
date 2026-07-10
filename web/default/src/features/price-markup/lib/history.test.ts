import assert from 'node:assert/strict'
import { describe, test } from 'node:test'

import type { MarkupPlan, OptionMaps } from '../types'
import {
  buildHistoryEntries,
  buildResetOptionUpdates,
  mergeMarkupHistory,
  type MarkupHistory,
  type MarkupHistoryEntry,
  parseMarkupHistory,
  recomputeEntryForPct,
  recomputePctForPrice,
  removeMarkupHistoryEntry,
} from './history'

const EMPTY_MAPS: OptionMaps = {
  ModelRatio: {},
  ModelPrice: {},
  CompletionRatio: {},
  CacheRatio: {},
  CreateCacheRatio: {},
  ImageRatio: {},
  AudioRatio: {},
  AudioCompletionRatio: {},
  BillingMode: {},
  BillingExpr: {},
}

// shape matching what captureBeforeSnapshot() produces when a model has no prior
// billing config at all (every optional field explicitly present but undefined)
const NO_BEFORE = {
  billingMode: '',
  billingExpr: '',
  modelPrice: undefined,
  modelRatio: undefined,
  completionRatio: undefined,
  cacheRatio: undefined,
  createCacheRatio: undefined,
  imageRatio: undefined,
  audioRatio: undefined,
  audioCompletionRatio: undefined,
}

describe('parseMarkupHistory', () => {
  test('parses a valid JSON option value', () => {
    const options = [
      {
        key: 'PriceMarkupHistory',
        value: JSON.stringify({
          'gpt-4o': {
            vendor: 'OpenAI',
            billing: 'ratio',
            upstreamPrice: 2.5,
            pct: 20,
            appliedResult: 3,
            sourceChannel: 'a(1)',
            channelFactor: 1,
            appliedAt: 1000,
          },
        }),
      },
    ]
    const h = parseMarkupHistory(options)
    assert.equal(h['gpt-4o'].appliedResult, 3)
  })

  test('returns {} when option is missing or malformed', () => {
    assert.deepEqual(parseMarkupHistory([]), {})
    assert.deepEqual(
      parseMarkupHistory([{ key: 'PriceMarkupHistory', value: 'not json' }]),
      {}
    )
    assert.deepEqual(
      parseMarkupHistory([{ key: 'PriceMarkupHistory', value: '[1,2]' }]),
      {}
    )
  })
})

describe('buildHistoryEntries + mergeMarkupHistory', () => {
  test('converts plan rows into history entries and merges by model name', () => {
    const plan: MarkupPlan = {
      rows: [
        {
          model: 'gpt-4o',
          vendor: 'OpenAI',
          billing: 'ratio',
          base: 2.5,
          pct: 20,
          result: 3,
          sourceChannel: 'a(1)',
          channelFactor: 1,
        },
      ],
      skippedTiered: [],
    }
    const entries = buildHistoryEntries(plan, 5000, EMPTY_MAPS, {})
    assert.equal(entries['gpt-4o'].upstreamPrice, 2.5)
    assert.equal(entries['gpt-4o'].appliedResult, 3)
    assert.equal(entries['gpt-4o'].appliedAt, 5000)
    assert.equal(entries['gpt-4o'].channelFactor, 1)
    // first time this model is touched -> before snapshot captured from current (empty here)
    assert.deepEqual(entries['gpt-4o'].before, NO_BEFORE)

    // merging preserves untouched models and overwrites the updated one
    const current: MarkupHistory = {
      'claude-3': {
        vendor: 'Anthropic',
        billing: 'ratio' as const,
        upstreamPrice: 1,
        pct: 10,
        appliedResult: 1.1,
        sourceChannel: 'b(2)',
        channelFactor: 1,
        appliedAt: 1,
        before: NO_BEFORE,
      },
      'gpt-4o': {
        vendor: 'OpenAI',
        billing: 'ratio' as const,
        upstreamPrice: 2, // stale, should be overwritten
        pct: 10,
        appliedResult: 2.2,
        sourceChannel: 'a(1)',
        channelFactor: 1,
        appliedAt: 1,
        before: { billingMode: '', billingExpr: '', modelRatio: 1 }, // pre-tool original
      },
    }
    const mergedJson = mergeMarkupHistory(current, entries)
    const merged = JSON.parse(mergedJson)
    assert.equal(merged['claude-3'].upstreamPrice, 1) // untouched
    assert.equal(merged['gpt-4o'].upstreamPrice, 2.5) // overwritten
    assert.equal(merged['gpt-4o'].appliedAt, 5000)
  })

  test('re-touching a model already in history carries its before-snapshot forward instead of recapturing', () => {
    const plan: MarkupPlan = {
      rows: [
        {
          model: 'gpt-4o',
          vendor: 'OpenAI',
          billing: 'ratio',
          base: 3,
          pct: 30,
          result: 3.9,
          sourceChannel: 'a(1)',
          channelFactor: 1,
        },
      ],
      skippedTiered: [],
    }
    const existingHistory: MarkupHistory = {
      'gpt-4o': {
        vendor: 'OpenAI',
        billing: 'ratio',
        upstreamPrice: 2.5,
        pct: 20,
        appliedResult: 3,
        sourceChannel: 'a(1)',
        channelFactor: 1,
        appliedAt: 1,
        before: { billingMode: '', billingExpr: '', modelRatio: 1 }, // original pre-tool value
      },
    }
    // even though `current` now reflects our own tool's prior write (modelRatio=3),
    // before must stay the true pre-tool value (1), not get re-captured as 3
    const currentAfterFirstApply: OptionMaps = {
      ...EMPTY_MAPS,
      ModelRatio: { 'gpt-4o': 3 },
    }
    const entries = buildHistoryEntries(
      plan,
      9999,
      currentAfterFirstApply,
      existingHistory
    )
    assert.deepEqual(entries['gpt-4o'].before, {
      billingMode: '',
      billingExpr: '',
      modelRatio: 1,
    })
  })
})

describe('removeMarkupHistoryEntry', () => {
  test('deletes only the named model, leaving others untouched', () => {
    const current: MarkupHistory = {
      'gpt-4o': {
        vendor: 'OpenAI',
        billing: 'ratio',
        upstreamPrice: 2.5,
        pct: 20,
        appliedResult: 3,
        sourceChannel: 'a(1)',
        channelFactor: 1,
        appliedAt: 1,
        before: NO_BEFORE,
      },
      'claude-3': {
        vendor: 'Anthropic',
        billing: 'ratio',
        upstreamPrice: 1,
        pct: 10,
        appliedResult: 1.1,
        sourceChannel: 'b(2)',
        channelFactor: 1,
        appliedAt: 1,
        before: NO_BEFORE,
      },
    }
    const result = JSON.parse(removeMarkupHistoryEntry(current, 'gpt-4o'))
    assert.equal('gpt-4o' in result, false)
    assert.equal('claude-3' in result, true)
  })
})

describe('recomputePctForPrice', () => {
  test('derives the equivalent markup% from a directly-typed final price', () => {
    const entry = {
      vendor: 'OpenAI',
      billing: 'ratio' as const,
      upstreamPrice: 2.5,
      pct: 20,
      appliedResult: 3,
      sourceChannel: 'a(1)',
      channelFactor: 1,
      appliedAt: 1,
      before: NO_BEFORE,
    }
    assert.equal(recomputePctForPrice(entry, 3.25), 30) // 3.25 / 2.5 - 1 = 30%
  })

  test('upstreamPrice of 0 (free model) keeps the existing pct rather than dividing by zero', () => {
    const entry = {
      vendor: 'OpenAI',
      billing: 'price' as const,
      upstreamPrice: 0,
      pct: 20,
      appliedResult: 0,
      sourceChannel: 'a(1)',
      channelFactor: 1,
      appliedAt: 1,
      before: NO_BEFORE,
    }
    assert.equal(recomputePctForPrice(entry, 1), 20)
  })
})

describe('buildResetOptionUpdates', () => {
  test('ratio model: restores the pre-tool model_ratio + relative ratios, clearing tiered config', () => {
    const entry = {
      vendor: 'OpenAI',
      billing: 'ratio' as const,
      upstreamPrice: 2.5,
      pct: 20,
      appliedResult: 3,
      sourceChannel: 'a(1)',
      channelFactor: 1,
      appliedAt: 1,
      before: { billingMode: '', billingExpr: '', modelRatio: 1, completionRatio: 2 },
    }
    const current: OptionMaps = {
      ...EMPTY_MAPS,
      ModelRatio: { 'gpt-4o': 3, 'other-model': 9 },
      CompletionRatio: { 'gpt-4o': 4 },
    }
    const updates = buildResetOptionUpdates('gpt-4o', entry, current)
    const map = new Map(updates.map((u) => [u.key, JSON.parse(u.value)]))
    assert.equal(map.get('ModelRatio')['gpt-4o'], 1) // restored to pre-tool value
    assert.equal(map.get('ModelRatio')['other-model'], 9) // untouched
    assert.equal(map.get('CompletionRatio')['gpt-4o'], 2) // restored
    assert.equal('gpt-4o' in map.get('billing_setting.billing_mode'), false)
  })

  test('model that had no prior billing at all: reset clears it back to unset', () => {
    const entry = {
      vendor: 'OpenAI',
      billing: 'ratio' as const,
      upstreamPrice: 2.5,
      pct: 20,
      appliedResult: 3,
      sourceChannel: 'a(1)',
      channelFactor: 1,
      appliedAt: 1,
      before: NO_BEFORE, // never had a custom price before this tool touched it
    }
    const current: OptionMaps = { ...EMPTY_MAPS, ModelRatio: { 'gpt-4o': 3 } }
    const updates = buildResetOptionUpdates('gpt-4o', entry, current)
    const map = new Map(updates.map((u) => [u.key, JSON.parse(u.value)]))
    assert.equal('gpt-4o' in map.get('ModelRatio'), false)
    assert.equal('gpt-4o' in map.get('ModelPrice'), false)
  })

  test('tiered/expr model: restores the original billing_mode + billing_expr, clearing ratio/price', () => {
    const entry = {
      vendor: 'OpenAI',
      billing: 'expr' as const,
      upstreamPrice: 0,
      pct: 20,
      appliedResult: 0,
      sourceChannel: 'a(1)',
      channelFactor: 1,
      appliedAt: 1,
      exprBefore: 'p*10',
      exprAfter: 'p * 12',
      before: {
        billingMode: 'tiered_expr',
        billingExpr: 'p*10',
      },
    }
    const current: OptionMaps = {
      ...EMPTY_MAPS,
      BillingMode: { 'tiered-model': 'tiered_expr' },
      BillingExpr: { 'tiered-model': 'p * 12' },
    }
    const updates = buildResetOptionUpdates('tiered-model', entry, current)
    const map = new Map(updates.map((u) => [u.key, JSON.parse(u.value)]))
    assert.equal(map.get('billing_setting.billing_mode')['tiered-model'], 'tiered_expr')
    assert.equal(map.get('billing_setting.billing_expr')['tiered-model'], 'p*10')
  })

  test('legacy record with no before field at all (applied before this feature shipped): falls back to clearing, does not throw', () => {
    // real-world case: entries persisted by an older build of this tool never had `before`
    const entry = {
      vendor: 'OpenAI',
      billing: 'ratio' as const,
      upstreamPrice: 0.105,
      pct: 20,
      appliedResult: 0.126,
      sourceChannel: 'a(1)',
      channelFactor: 1,
      appliedAt: 1,
    } as unknown as MarkupHistoryEntry // `before` intentionally omitted, as legacy JSON would be
    const current: OptionMaps = { ...EMPTY_MAPS, ModelRatio: { 'qwen-turbo': 0.126 } }
    assert.doesNotThrow(() => buildResetOptionUpdates('qwen-turbo', entry, current))
    const updates = buildResetOptionUpdates('qwen-turbo', entry, current)
    const map = new Map(updates.map((u) => [u.key, JSON.parse(u.value)]))
    assert.equal('qwen-turbo' in map.get('ModelRatio'), false)
  })
})

describe('recomputeEntryForPct', () => {
  test('ratio/price: multiplies the already-factor-corrected upstreamPrice by the new pct', () => {
    const entry = {
      vendor: 'OpenAI',
      billing: 'ratio' as const,
      upstreamPrice: 2.5,
      pct: 20,
      appliedResult: 3,
      sourceChannel: 'a(1)',
      channelFactor: 1,
      appliedAt: 1,
      before: NO_BEFORE,
    }
    assert.deepEqual(recomputeEntryForPct(entry, 30), { result: 3.25 }) // 2.5 * 1.30
  })

  test('expr: rescales exprBefore using pct + the persisted channelFactor, matching scaleBillingExpr', () => {
    const entry = {
      vendor: 'OpenAI',
      billing: 'expr' as const,
      upstreamPrice: 0,
      pct: 20,
      appliedResult: 0,
      sourceChannel: 'a(1)',
      channelFactor: 0.5,
      appliedAt: 1,
      exprBefore: 'p*10+c*20',
      exprAfter: 'p * 6+c * 12', // 0.5 * 1.20 = 0.6x, from the original apply
      before: NO_BEFORE,
    }
    // re-edit to 40% markup: coef * 0.5 * 1.40 = coef * 0.7
    assert.deepEqual(recomputeEntryForPct(entry, 40), {
      exprAfter: 'p * 7+c * 14',
    })
  })

  test('expr: missing channelFactor on a legacy record defaults to 1', () => {
    const entry = {
      vendor: 'OpenAI',
      billing: 'expr' as const,
      upstreamPrice: 0,
      pct: 20,
      appliedResult: 0,
      sourceChannel: 'a(1)',
      channelFactor: undefined as unknown as number,
      appliedAt: 1,
      exprBefore: 'p*10',
      exprAfter: 'p * 12',
      before: NO_BEFORE,
    }
    assert.deepEqual(recomputeEntryForPct(entry, 50), { exprAfter: 'p * 15' }) // 10 * 1 * 1.50
  })

  test('expr: missing exprBefore returns {} rather than throwing', () => {
    const entry = {
      vendor: 'OpenAI',
      billing: 'expr' as const,
      upstreamPrice: 0,
      pct: 20,
      appliedResult: 0,
      sourceChannel: 'a(1)',
      channelFactor: 1,
      appliedAt: 1,
      before: NO_BEFORE,
    }
    assert.deepEqual(recomputeEntryForPct(entry, 50), {})
  })
})
