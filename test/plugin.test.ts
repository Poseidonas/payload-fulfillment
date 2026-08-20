import type { CollectionConfig, Config, Field, SelectField } from 'payload'

import { describe, expect, it } from 'vitest'

import { fulfillmentPlugin } from '../src/index.js'

const statusField: Field = {
  name: 'status',
  type: 'select',
  admin: { position: 'sidebar' },
  defaultValue: 'processing',
  interfaceName: 'OrderStatus',
  options: [
    { label: 'Processing', value: 'processing' },
    { label: 'Completed', value: 'completed' },
    { label: 'Cancelled', value: 'cancelled' },
    { label: 'Refunded', value: 'refunded' },
  ],
}

const ordersCollection: CollectionConfig = {
  slug: 'orders',
  fields: [{ name: 'customerEmail', type: 'email' }, statusField],
}

const baseConfig = (collections: CollectionConfig[]): Config => ({ collections }) as Config

const collectionOf = (config: Config, slug: string): CollectionConfig | undefined =>
  config.collections?.find((entry) => entry.slug === slug)

const fieldNames = (config: Config, slug: string): string[] =>
  (collectionOf(config, slug)?.fields ?? []).map((field) =>
    'name' in field && typeof field.name === 'string' ? field.name : '',
  )

const findField = (config: Config, slug: string, name: string): Field | undefined =>
  (collectionOf(config, slug)?.fields ?? []).find(
    (field) => 'name' in field && field.name === name,
  )

const statusValues = (config: Config, slug: string): string[] => {
  const field = findField(config, slug, 'status') as SelectField | undefined

  return (field?.options ?? []).map((option) =>
    typeof option === 'string' ? option : String(option.value),
  )
}

describe('fulfillmentPlugin', () => {
  it('keeps the four official states and appends the extra ones', () => {
    const result = fulfillmentPlugin()(baseConfig([ordersCollection]))

    expect(statusValues(result, 'orders')).toEqual([
      'processing',
      'completed',
      'cancelled',
      'refunded',
      'pending-payment',
      'on-hold',
      'shipped',
      'failed',
    ])
  })

  it('leaves the rest of the status field exactly as it found it', () => {
    const result = fulfillmentPlugin()(baseConfig([ordersCollection]))
    const field = findField(result, 'orders', 'status') as SelectField

    expect(field).toMatchObject({
      admin: { position: 'sidebar' },
      defaultValue: 'processing',
      interfaceName: 'OrderStatus',
    })
    expect(statusField).toMatchObject({ options: expect.any(Array) })
    expect((statusField as SelectField).options).toHaveLength(4)
  })

  it('adds the tracking, history and notes fields', () => {
    const names = fieldNames(fulfillmentPlugin()(baseConfig([ordersCollection])), 'orders')

    expect(names).toEqual([
      'customerEmail',
      'status',
      'trackingNumber',
      'trackingCarrier',
      'statusHistory',
      'internalNotes',
    ])
  })

  it('finds the status field inside tabs and rows', () => {
    const nested: CollectionConfig = {
      slug: 'orders',
      fields: [
        {
          type: 'tabs',
          tabs: [{ fields: [{ type: 'row', fields: [statusField] }], label: 'Details' }],
        },
      ],
    }
    const result = fulfillmentPlugin()(baseConfig([nested]))
    const tabs = (collectionOf(result, 'orders')?.fields ?? [])[0]
    const row = (tabs as { tabs: { fields: Field[] }[] }).tabs[0]?.fields[0]
    const field = (row as { fields: SelectField[] }).fields[0]

    expect(field?.options).toHaveLength(8)
  })

  it('creates a complete status field when the orders collection has none', () => {
    const bare: CollectionConfig = { slug: 'orders', fields: [{ name: 'total', type: 'number' }] }
    const result = fulfillmentPlugin()(baseConfig([bare]))

    expect(statusValues(result, 'orders')).toEqual([
      'processing',
      'completed',
      'cancelled',
      'refunded',
      'pending-payment',
      'on-hold',
      'shipped',
      'failed',
    ])
  })

  it('shows the tracking fields only in the states that carry a parcel', () => {
    const result = fulfillmentPlugin()(baseConfig([ordersCollection]))
    const field = findField(result, 'orders', 'trackingNumber')
    const admin = (field as { admin: { condition: (data: unknown) => boolean } }).admin
    const condition = admin.condition

    expect(condition({ status: 'shipped' })).toBe(true)
    expect(condition({ status: 'completed' })).toBe(true)
    expect(condition({ status: 'processing' })).toBe(false)
    expect(condition({})).toBe(false)
  })

  it('turns the carrier into a select when carriers are listed', () => {
    const result = fulfillmentPlugin({ carriers: ['dhl', { label: 'ELTA', value: 'elta' }] })(
      baseConfig([ordersCollection]),
    )
    const field = findField(result, 'orders', 'trackingCarrier') as SelectField

    expect(field.type).toBe('select')
    expect(field.options).toEqual([
      { label: 'Dhl', value: 'dhl' },
      { label: 'ELTA', value: 'elta' },
    ])
  })

  it('closes the history field to writes through the API', () => {
    const result = fulfillmentPlugin()(baseConfig([ordersCollection]))
    const field = findField(result, 'orders', 'statusHistory') as {
      access: { create: () => boolean; update: () => boolean }
    }

    expect(field.access.create()).toBe(false)
    expect(field.access.update()).toBe(false)
  })

  it('leaves out the parts that are switched off', () => {
    const result = fulfillmentPlugin({ history: false, notes: false, tracking: false })(
      baseConfig([ordersCollection]),
    )

    expect(fieldNames(result, 'orders')).toEqual(['customerEmail', 'status'])
  })

  it('keeps existing hooks on the orders collection', () => {
    const existing = (): null => null
    const withHook: CollectionConfig = {
      ...ordersCollection,
      hooks: { beforeChange: [existing as never] },
    }
    const result = fulfillmentPlugin()(baseConfig([withHook]))
    const hooks = collectionOf(result, 'orders')?.hooks?.beforeChange

    expect(hooks).toHaveLength(2)
    expect(hooks?.[0]).toBe(existing)
  })

  it('leaves other collections untouched', () => {
    const other: CollectionConfig = { slug: 'products', fields: [{ name: 'title', type: 'text' }] }
    const result = fulfillmentPlugin()(baseConfig([ordersCollection, other]))

    expect(fieldNames(result, 'products')).toEqual(['title'])
  })

  it('returns the config unchanged when the orders collection is absent', () => {
    const input = baseConfig([{ slug: 'products', fields: [] }])

    expect(fulfillmentPlugin()(input)).toBe(input)
  })

  it('still adds the fields when disabled, so the database keeps its shape', () => {
    const result = fulfillmentPlugin({ disabled: true })(baseConfig([ordersCollection]))

    expect(fieldNames(result, 'orders')).toContain('statusHistory')
    expect(statusValues(result, 'orders')).toContain('shipped')
  })
})

describe('the default internal access', () => {
  const readable = (doc: unknown, user: unknown): unknown => {
    const result = fulfillmentPlugin()(baseConfig([ordersCollection]))
    const field = findField(result, 'orders', 'internalNotes') as {
      access: { read: (args: unknown) => unknown }
    }

    return field.access.read({ doc, req: { user } })
  }

  it('refuses an anonymous request', () => {
    expect(readable({ customer: 7 }, null)).toBe(false)
  })

  it('refuses the customer the order belongs to', () => {
    expect(readable({ customer: 7 }, { id: 7 })).toBe(false)
  })

  it('refuses a guest whose email matches the order', () => {
    const doc = { customerEmail: 'Buyer@Shop.test' }

    expect(readable(doc, { email: 'buyer@shop.test', id: 9 })).toBe(false)
  })

  it('allows anyone else who can already read the order', () => {
    expect(readable({ customer: 7 }, { email: 'anna@shop.test', id: 1 })).toBe(true)
  })
})
