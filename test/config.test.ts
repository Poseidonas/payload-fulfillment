import { describe, expect, it } from 'vitest'

import { denyOrderCustomer } from '../src/access.js'
import { resolveConfig } from '../src/config.js'
import { defaultStates, defaultTransitions } from '../src/states.js'

describe('resolveConfig', () => {
  it('fills in the documented defaults', () => {
    expect(resolveConfig()).toEqual({
      carriers: [],
      disabled: false,
      guardTransitions: false,
      history: true,
      historyFieldName: 'statusHistory',
      internalAccess: denyOrderCustomer,
      notes: true,
      notesFieldName: 'internalNotes',
      ordersSlug: 'orders',
      states: defaultStates,
      statusFieldName: 'status',
      tracking: true,
      trackingCarrierFieldName: 'trackingCarrier',
      trackingNumberFieldName: 'trackingNumber',
      trackingStates: ['shipped', 'completed'],
      transitions: defaultTransitions,
      usersSlug: 'users',
    })
  })

  it('keeps the guard off unless it is switched on explicitly', () => {
    expect(resolveConfig({}).guardTransitions).toBe(false)
    expect(resolveConfig({ guardTransitions: true }).guardTransitions).toBe(true)
  })

  it('falls back when a name is given as an empty string', () => {
    expect(resolveConfig({ ordersSlug: '', statusFieldName: '' })).toMatchObject({
      ordersSlug: 'orders',
      statusFieldName: 'status',
    })
  })

  it('accepts an empty states list rather than reinstating the defaults', () => {
    expect(resolveConfig({ states: [] }).states).toEqual([])
  })

  it('turns a plain string state into a labelled one', () => {
    expect(resolveConfig({ states: ['awaiting-stock'] }).states).toEqual([
      { label: 'Awaiting stock', value: 'awaiting-stock' },
    ])
  })

  it('drops a state with no usable value and keeps the rest', () => {
    expect(resolveConfig({ states: ['', { value: '' }, 'shipped'] }).states).toEqual([
      { label: 'Shipped', value: 'shipped' },
    ])
  })

  it('drops a repeated state value', () => {
    const config = resolveConfig({ states: ['shipped', { label: 'Sent', value: 'shipped' }] })

    expect(config.states).toEqual([{ label: 'Shipped', value: 'shipped' }])
  })

  it('replaces the transition map when one is given', () => {
    expect(resolveConfig({ transitions: { processing: ['completed'] } }).transitions).toEqual({
      processing: ['completed'],
    })
  })

  it('ignores a transition map that is not an object', () => {
    expect(resolveConfig({ transitions: [] as never }).transitions).toEqual(defaultTransitions)
  })
})
