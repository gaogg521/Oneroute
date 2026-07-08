import assert from 'node:assert/strict'
import { describe, test } from 'node:test'

import { buildVendorIndex, groupOptionsByVendor } from './vendor-grouping'

const pricing = {
  data: [
    { id: 1, model_name: 'gpt-4o', vendor_id: 10 },
    { id: 2, model_name: 'claude-sonnet-4-6', vendor_id: 20 },
    { id: 3, model_name: 'deepseek-v4-flash', vendor_id: 30 },
  ],
  vendors: [
    { id: 10, name: 'OpenAI' },
    { id: 20, name: 'Anthropic' },
    { id: 30, name: 'DeepSeek' },
  ],
} as unknown as import('@/features/pricing/types').PricingData

describe('buildVendorIndex', () => {
  test('maps model_name -> vendor via vendor_id and keeps vendor order', () => {
    const idx = buildVendorIndex(pricing)
    assert.equal(idx.modelToVendor.get('gpt-4o'), 'OpenAI')
    assert.equal(idx.modelToVendor.get('claude-sonnet-4-6'), 'Anthropic')
    assert.deepEqual(idx.vendorOrder, ['OpenAI', 'Anthropic', 'DeepSeek'])
  })
  test('empty/undefined pricing yields empty index', () => {
    const idx = buildVendorIndex(undefined)
    assert.equal(idx.modelToVendor.size, 0)
    assert.equal(idx.vendorOrder.length, 0)
  })
})

describe('groupOptionsByVendor', () => {
  test('buckets by vendor in marketplace order, unknown last', () => {
    const idx = buildVendorIndex(pricing)
    const groups = groupOptionsByVendor(
      ['deepseek-v4-flash', 'gpt-4o', 'my-custom-model', 'gpt-4o-2024'],
      idx
    )
    // OpenAI before DeepSeek (marketplace order), unknown ('') last
    assert.deepEqual(
      groups.map((g) => g.vendor),
      ['OpenAI', 'DeepSeek', '']
    )
    // gpt-4o exact + gpt-4o-2024 via normalized fallback both -> OpenAI
    assert.deepEqual(groups[0].models, ['gpt-4o', 'gpt-4o-2024'])
    assert.deepEqual(groups[2].models, ['my-custom-model'])
  })

  test('normalized fallback maps version/date variants to same vendor', () => {
    const idx = buildVendorIndex(pricing)
    // catalog has "deepseek-v4-flash"; a dated variant should still resolve
    const groups = groupOptionsByVendor(['deepseek-v4-flash-202605'], idx)
    assert.equal(groups[0].vendor, 'DeepSeek')
  })
  test('all-unknown yields a single empty-vendor group', () => {
    const groups = groupOptionsByVendor(['a', 'b'], buildVendorIndex(undefined))
    assert.equal(groups.length, 1)
    assert.equal(groups[0].vendor, '')
  })
})
