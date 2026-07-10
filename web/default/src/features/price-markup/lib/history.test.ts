import assert from 'node:assert/strict'
import { describe, test } from 'node:test'

import type { MarkupPlan } from '../types'
import {
  buildHistoryEntries,
  mergeMarkupHistory,
  parseMarkupHistory,
} from './history'

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
        },
      ],
      skippedTiered: [],
    }
    const entries = buildHistoryEntries(plan, 5000)
    assert.equal(entries['gpt-4o'].upstreamPrice, 2.5)
    assert.equal(entries['gpt-4o'].appliedResult, 3)
    assert.equal(entries['gpt-4o'].appliedAt, 5000)

    // merging preserves untouched models and overwrites the updated one
    const current = {
      'claude-3': {
        vendor: 'Anthropic',
        billing: 'ratio' as const,
        upstreamPrice: 1,
        pct: 10,
        appliedResult: 1.1,
        sourceChannel: 'b(2)',
        appliedAt: 1,
      },
      'gpt-4o': {
        vendor: 'OpenAI',
        billing: 'ratio' as const,
        upstreamPrice: 2, // stale, should be overwritten
        pct: 10,
        appliedResult: 2.2,
        sourceChannel: 'a(1)',
        appliedAt: 1,
      },
    }
    const mergedJson = mergeMarkupHistory(current, entries)
    const merged = JSON.parse(mergedJson)
    assert.equal(merged['claude-3'].upstreamPrice, 1) // untouched
    assert.equal(merged['gpt-4o'].upstreamPrice, 2.5) // overwritten
    assert.equal(merged['gpt-4o'].appliedAt, 5000)
  })
})
