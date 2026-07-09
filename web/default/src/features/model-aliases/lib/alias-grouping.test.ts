import assert from 'node:assert/strict'
import { describe, test } from 'node:test'

import type { ChannelMappingRow } from '../types'
import {
  buildAliasGroups,
  buildUpdatesFromGroup,
  normalizeModelName,
  parseMapping,
} from './alias-grouping'

function ch(
  id: number,
  name: string,
  models: string,
  model_mapping = ''
): ChannelMappingRow {
  return { id, name, type: 1, status: 1, group: 'default', models, model_mapping }
}

describe('normalizeModelName', () => {
  test('strips provider prefix, date and numeric version suffixes', () => {
    assert.equal(normalizeModelName('openai/gpt-4o'), 'gpt4o')
    assert.equal(normalizeModelName('gpt-4o-2024-08-06'), 'gpt4o')
    assert.equal(normalizeModelName('gpt-4o-2024'), 'gpt4o')
    assert.equal(normalizeModelName('gpt-4o-latest'), 'gpt4o')
    assert.equal(normalizeModelName('GPT-4o'), 'gpt4o')
  })

  test('does NOT merge spec variants like -mini into the base model', () => {
    assert.notEqual(
      normalizeModelName('gpt-4o-mini'),
      normalizeModelName('gpt-4o')
    )
  })

  test('collapses separator differences', () => {
    assert.equal(
      normalizeModelName('gpt-3.5-turbo-0125'),
      normalizeModelName('gpt-3.5-turbo')
    )
    assert.equal(
      normalizeModelName('anthropic/claude-3-5-sonnet-latest'),
      normalizeModelName('claude-3.5-sonnet-20241022')
    )
  })

  test('keeps short numeric tokens (>=3 digits only are stripped)', () => {
    assert.equal(normalizeModelName('gpt-4'), 'gpt4')
    assert.equal(normalizeModelName('llama-3'), 'llama3')
  })
})

describe('buildAliasGroups', () => {
  test('clusters differently-named same model across channels into one group', () => {
    const channels = [
      ch(1, 'A', 'gpt-4o'),
      ch(2, 'B', 'gpt-4o-2024'),
      ch(3, 'C', 'openai/gpt-4o'),
    ]
    const groups = buildAliasGroups(channels)
    assert.equal(groups.length, 1)
    const g = groups[0]
    assert.equal(g.alias, 'gpt-4o') // shortest raw name wins
    assert.equal(g.bindings.length, 3)
    // each binding's target is that channel's real upstream name
    const byId = new Map(g.bindings.map((b) => [b.channelId, b.target]))
    assert.equal(byId.get(2), 'gpt-4o-2024')
    assert.equal(byId.get(3), 'openai/gpt-4o')
  })

  test('does not create a group for a single channel with one unique model', () => {
    const groups = buildAliasGroups([ch(1, 'A', 'solo-model,gpt-4o-mini')])
    assert.equal(groups.length, 0)
  })

  test('includeSingletons surfaces single-channel single-name models', () => {
    const channels = [ch(1, 'A', 'solo-model,gpt-4o-mini')]
    assert.equal(buildAliasGroups(channels, false).length, 0)
    const all = buildAliasGroups(channels, true)
    assert.equal(all.length, 2) // both models now appear
    assert.ok(all.some((g) => g.alias === 'solo-model'))
    assert.ok(all.some((g) => g.alias === 'gpt-4o-mini'))
  })

  test('recognizes an already-applied alias and reuses the existing target', () => {
    // channel B already had gpt-4o applied additively
    const channels = [
      ch(1, 'A', 'gpt-4o'),
      ch(2, 'B', 'gpt-4o-2024,gpt-4o', '{"gpt-4o":"gpt-4o-2024"}'),
    ]
    const groups = buildAliasGroups(channels)
    assert.equal(groups.length, 1)
    const bindingB = groups[0].bindings.find((b) => b.channelId === 2)!
    assert.equal(bindingB.target, 'gpt-4o-2024')
    assert.equal(bindingB.existingMapping, 'gpt-4o-2024')
  })
})

describe('buildUpdatesFromGroup', () => {
  test('additively appends alias to models and mapping for included channels only', () => {
    const channels = [
      ch(1, 'A', 'gpt-4o'),
      ch(2, 'B', 'gpt-4o-2024'),
      ch(3, 'C', 'openai/gpt-4o'),
    ]
    const groups = buildAliasGroups(channels)
    const g = groups[0]
    // exclude channel C
    g.bindings = g.bindings.map((b) =>
      b.channelId === 3 ? { ...b, included: false } : b
    )
    const updates = buildUpdatesFromGroup(g, channels)
    assert.equal(updates.length, 2) // only A and B

    const uB = updates.find((u) => u.id === 2)!
    // alias appended to models, original kept
    assert.ok(uB.models!.split(',').includes('gpt-4o'))
    assert.ok(uB.models!.split(',').includes('gpt-4o-2024'))
    // mapping written because target differs from alias
    assert.deepEqual(parseMapping(uB.model_mapping), { 'gpt-4o': 'gpt-4o-2024' })

    const uA = updates.find((u) => u.id === 1)!
    // channel A's real name equals the alias → no identity mapping written
    assert.deepEqual(parseMapping(uA.model_mapping), {})
    assert.ok(uA.models!.split(',').includes('gpt-4o'))
  })
})
