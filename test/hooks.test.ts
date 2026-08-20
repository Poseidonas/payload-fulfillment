import { describe, expect, it } from 'vitest'

import { resolveConfig } from '../src/config.js'
import { InvalidTransitionError } from '../src/errors.js'
import { trackFulfillment } from '../src/hooks.js'
import type { FulfillmentConfig } from '../src/types.js'

type Data = Record<string, unknown>

type Run = {
  data: Data
  operation?: 'create' | 'update'
  originalDoc?: Data
  user?: Data | null
}

const run = async (
  options: FulfillmentConfig,
  { data, operation = 'update', originalDoc, user = null }: Run,
): Promise<Data> =>
  (await trackFulfillment(resolveConfig(options))({
    collection: {} as never,
    context: {},
    data,
    operation,
    originalDoc,
    req: { user } as never,
  })) as Data

const history = (result: Data): Data[] => (result.statusHistory ?? []) as Data[]

const staff = { collection: 'users', email: 'anna@shop.test', id: 7 }

describe('trackFulfillment on create', () => {
  it('records the state the order starts in', async () => {
    const result = await run({}, { data: { status: 'processing' }, operation: 'create' })

    expect(history(result)).toHaveLength(1)
    expect(history(result)[0]).toMatchObject({ from: null, to: 'processing' })
    expect(Date.parse(String(history(result)[0]?.at))).not.toBeNaN()
  })

  it('names the user who created the order', async () => {
    const result = await run(
      {},
      { data: { status: 'processing' }, operation: 'create', user: staff },
    )

    expect(history(result)[0]).toMatchObject({ by: 7, byEmail: 'anna@shop.test' })
  })

  it('leaves the relationship empty for a user from another collection', async () => {
    const result = await run(
      {},
      {
        data: { status: 'processing' },
        operation: 'create',
        user: { collection: 'customers', email: 'buyer@shop.test', id: 42 },
      },
    )

    expect(history(result)[0]).toMatchObject({ by: null, byEmail: 'buyer@shop.test' })
  })

  it('writes no history when history is switched off', async () => {
    const result = await run(
      { history: false },
      { data: { status: 'processing' }, operation: 'create' },
    )

    expect(result.statusHistory).toBeUndefined()
  })
})

describe('trackFulfillment on update', () => {
  it('appends the new transition after the ones already recorded', async () => {
    const result = await run(
      {},
      {
        data: { status: 'shipped' },
        originalDoc: {
          status: 'processing',
          statusHistory: [
            { at: '2026-08-01T10:00:00.000Z', from: null, id: 'a', to: 'processing' },
          ],
        },
      },
    )

    expect(history(result)).toHaveLength(2)
    expect(history(result)[0]).toMatchObject({ id: 'a', to: 'processing' })
    expect(history(result)[1]).toMatchObject({ from: 'processing', to: 'shipped' })
  })

  it('records nothing when the status did not move', async () => {
    const result = await run(
      {},
      { data: { status: 'processing' }, originalDoc: { status: 'processing', statusHistory: [] } },
    )

    expect(result.statusHistory).toBeUndefined()
  })

  it('records nothing when the payload carries no status at all', async () => {
    const result = await run({}, { data: { amount: 500 }, originalDoc: { status: 'processing' } })

    expect(result).toEqual({ amount: 500 })
  })

  it('rebuilds the history from the stored order, not from the request', async () => {
    const result = await run(
      {},
      {
        data: {
          status: 'completed',
          statusHistory: [{ at: '2020-01-01T00:00:00.000Z', from: null, to: 'invented' }],
        },
        originalDoc: {
          status: 'shipped',
          statusHistory: [
            { at: '2026-08-01T10:00:00.000Z', from: null, id: 'a', to: 'processing' },
          ],
        },
      },
    )

    expect(history(result).map((entry) => entry.to)).toEqual(['processing', 'completed'])
  })

  it('carries a populated relationship forward as its id', async () => {
    const result = await run(
      {},
      {
        data: { status: 'completed' },
        originalDoc: {
          status: 'shipped',
          statusHistory: [
            {
              at: '2026-08-01T10:00:00.000Z',
              by: { email: 'anna@shop.test', id: 7 },
              id: 'a',
              to: 'processing',
            },
          ],
        },
      },
    )

    expect(history(result)[0]?.by).toBe(7)
  })
})

describe('the transition guard', () => {
  const backwards = {
    data: { status: 'processing' },
    originalDoc: { status: 'completed' },
  }

  it('allows an impossible transition while it is off', async () => {
    const result = await run({}, backwards)

    expect(history(result)[0]).toMatchObject({ from: 'completed', to: 'processing' })
  })

  it('refuses an impossible transition once it is on', async () => {
    await expect(run({ guardTransitions: true }, backwards)).rejects.toBeInstanceOf(
      InvalidTransitionError,
    )
  })

  it('answers with 400 rather than a server error', async () => {
    const failure = await run({ guardTransitions: true }, backwards).catch(
      (error: InvalidTransitionError) => error,
    )

    expect(failure).toMatchObject({
      allowed: ['refunded'],
      from: 'completed',
      status: 400,
      to: 'processing',
    })
  })

  it('still allows a completed order to be refunded', async () => {
    const result = await run(
      { guardTransitions: true },
      { data: { status: 'refunded' }, originalDoc: { status: 'completed' } },
    )

    expect(history(result)[0]).toMatchObject({ from: 'completed', to: 'refunded' })
  })

  it('does not refuse a state the map has never heard of', async () => {
    const result = await run(
      { guardTransitions: true },
      { data: { status: 'processing' }, originalDoc: { status: 'awaiting-stock' } },
    )

    expect(history(result)[0]).toMatchObject({ from: 'awaiting-stock', to: 'processing' })
  })
})

describe('internal notes', () => {
  it('stamps a new note with the author and the time', async () => {
    const result = await run(
      {},
      { data: { internalNotes: [{ note: 'Called the courier' }] }, user: staff },
    )

    expect((result.internalNotes as Data[])[0]).toMatchObject({
      author: 7,
      authorEmail: 'anna@shop.test',
      note: 'Called the courier',
    })
  })

  it('keeps the original author and time on a note that already exists', async () => {
    const result = await run(
      {},
      {
        data: {
          internalNotes: [
            {
              at: '2030-01-01T00:00:00.000Z',
              author: 99,
              authorEmail: 'fake@shop.test',
              id: 'n1',
              note: 'Edited',
            },
          ],
        },
        originalDoc: {
          internalNotes: [
            {
              at: '2026-08-01T10:00:00.000Z',
              author: 7,
              authorEmail: 'anna@shop.test',
              id: 'n1',
              note: 'Called the courier',
            },
          ],
        },
        user: { collection: 'users', email: 'bob@shop.test', id: 8 },
      },
    )

    expect((result.internalNotes as Data[])[0]).toMatchObject({
      at: '2026-08-01T10:00:00.000Z',
      author: 7,
      authorEmail: 'anna@shop.test',
      note: 'Edited',
    })
  })

  it('leaves the order alone when the payload carries no notes', async () => {
    const result = await run({}, { data: { amount: 500 }, originalDoc: { internalNotes: [] } })

    expect(result).toEqual({ amount: 500 })
  })
})

describe('the disabled switch', () => {
  it('returns the payload untouched', async () => {
    const data = { internalNotes: [{ note: 'Hello' }], status: 'shipped' }
    const result = await run({ disabled: true }, { data, originalDoc: { status: 'processing' } })

    expect(result).toBe(data)
  })
})
