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
import assert from 'node:assert/strict'
import { describe, test } from 'node:test'

import {
  buildPriceSourcePatch,
  mergePriceSource,
  parsePriceSource,
  PRICE_SOURCE_OPTION_KEY,
  removePriceSourceEntries,
  type PriceSourceMap,
} from './price-source'

describe('parsePriceSource', () => {
  test('returns empty map when key absent', () => {
    assert.deepEqual(parsePriceSource([]), {})
    assert.deepEqual(parsePriceSource([{ key: 'Other', value: '{}' }]), {})
  })

  test('parses valid entries and drops malformed ones', () => {
    const value = JSON.stringify({
      'gpt-5.2': { source: 'manual', updatedAt: 100 },
      'deepseek-v3.2': {
        source: 'upstream_sync',
        channel: '得物(1)',
        updatedAt: 200,
      },
      'glm-4.7': { source: 'batch_markup', channel: 'x', updatedAt: 300 },
      bad1: { source: 'nonsense', updatedAt: 1 },
      bad2: { channel: 'x' },
      bad3: 42,
    })
    const parsed = parsePriceSource([{ key: PRICE_SOURCE_OPTION_KEY, value }])
    assert.deepEqual(Object.keys(parsed).sort(), [
      'deepseek-v3.2',
      'glm-4.7',
      'gpt-5.2',
    ])
    assert.deepEqual(parsed['gpt-5.2'], { source: 'manual', updatedAt: 100 })
    assert.equal(parsed['deepseek-v3.2'].channel, '得物(1)')
  })

  test('tolerates broken JSON and non-object roots', () => {
    assert.deepEqual(
      parsePriceSource([{ key: PRICE_SOURCE_OPTION_KEY, value: '{' }]),
      {}
    )
    assert.deepEqual(
      parsePriceSource([{ key: PRICE_SOURCE_OPTION_KEY, value: '[]' }]),
      {}
    )
  })

  test('defaults missing updatedAt to 0', () => {
    const value = JSON.stringify({ m: { source: 'manual' } })
    const parsed = parsePriceSource([{ key: PRICE_SOURCE_OPTION_KEY, value }])
    assert.deepEqual(parsed['m'], { source: 'manual', updatedAt: 0 })
  })
})

describe('mergePriceSource', () => {
  test('overwrites same model, keeps others', () => {
    const current: PriceSourceMap = {
      a: { source: 'batch_markup', channel: 'c1', updatedAt: 1 },
      b: { source: 'manual', updatedAt: 2 },
    }
    const patch: PriceSourceMap = { a: { source: 'manual', updatedAt: 3 } }
    const merged = JSON.parse(mergePriceSource(current, patch))
    assert.deepEqual(merged.a, { source: 'manual', updatedAt: 3 })
    assert.deepEqual(merged.b, { source: 'manual', updatedAt: 2 })
  })
})

describe('removePriceSourceEntries', () => {
  test('deletes listed models only', () => {
    const current: PriceSourceMap = {
      a: { source: 'manual', updatedAt: 1 },
      b: { source: 'manual', updatedAt: 2 },
      c: { source: 'manual', updatedAt: 3 },
    }
    const next = JSON.parse(removePriceSourceEntries(current, ['a', 'c']))
    assert.deepEqual(Object.keys(next), ['b'])
  })
})

describe('buildPriceSourcePatch', () => {
  test('stamps manual without channel', () => {
    const patch = buildPriceSourcePatch(['a', 'b'], 'manual', 500)
    assert.deepEqual(patch, {
      a: { source: 'manual', updatedAt: 500 },
      b: { source: 'manual', updatedAt: 500 },
    })
  })

  test('stamps channel-bearing sources when channelOf resolves', () => {
    const patch = buildPriceSourcePatch(
      ['a', 'b'],
      'upstream_sync',
      500,
      (m) => (m === 'a' ? '得物(1)' : undefined)
    )
    assert.deepEqual(patch.a, {
      source: 'upstream_sync',
      channel: '得物(1)',
      updatedAt: 500,
    })
    assert.deepEqual(patch.b, { source: 'upstream_sync', updatedAt: 500 })
  })
})
