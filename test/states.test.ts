import { describe, expect, it } from 'vitest'

import { allowedFrom, defaultTransitions, isAllowedTransition } from '../src/states.js'
import { mergeStatusOptions } from '../src/status.js'

const officialOptions = [
  { label: () => 'Processing', value: 'processing' },
  { label: () => 'Completed', value: 'completed' },
  { label: () => 'Cancelled', value: 'cancelled' },
  { label: () => 'Refunded', value: 'refunded' },
]

describe('mergeStatusOptions', () => {
  it('keeps every option that was already there, in order', () => {
    const merged = mergeStatusOptions(officialOptions, [{ label: 'Shipped', value: 'shipped' }])

    expect(merged.slice(0, 4)).toEqual(officialOptions)
  })

  it('appends the extra states after the existing ones', () => {
    const merged = mergeStatusOptions(officialOptions, [
      { label: 'Shipped', value: 'shipped' },
      { label: 'Failed', value: 'failed' },
    ])

    expect(merged).toHaveLength(6)
    expect(merged[4]).toEqual({ label: 'Shipped', value: 'shipped' })
    expect(merged[5]).toEqual({ label: 'Failed', value: 'failed' })
  })

  it('never adds a value the field already carries', () => {
    const merged = mergeStatusOptions(officialOptions, [{ label: 'Done', value: 'completed' }])

    expect(merged).toBe(officialOptions)
  })

  it('recognises options written as plain strings', () => {
    const merged = mergeStatusOptions(['processing', 'completed'], [
      { label: 'Processing', value: 'processing' },
      { label: 'Shipped', value: 'shipped' },
    ])

    expect(merged).toEqual(['processing', 'completed', { label: 'Shipped', value: 'shipped' }])
  })
})

describe('isAllowedTransition', () => {
  it('refuses a completed order back to processing', () => {
    expect(isAllowedTransition('completed', 'processing', defaultTransitions)).toBe(false)
  })

  it('allows a completed order to be refunded', () => {
    expect(isAllowedTransition('completed', 'refunded', defaultTransitions)).toBe(true)
  })

  it('allows processing to shipped and shipped to completed', () => {
    expect(isAllowedTransition('processing', 'shipped', defaultTransitions)).toBe(true)
    expect(isAllowedTransition('shipped', 'completed', defaultTransitions)).toBe(true)
  })

  it('treats a refunded order as terminal', () => {
    expect(allowedFrom('refunded', defaultTransitions)).toEqual([])
    expect(isAllowedTransition('refunded', 'processing', defaultTransitions)).toBe(false)
  })

  it('never refuses a state the map does not mention', () => {
    expect(isAllowedTransition('awaiting-stock', 'processing', defaultTransitions)).toBe(true)
  })
})
