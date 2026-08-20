import type { CollectionBeforeChangeHook, PayloadRequest } from 'payload'

import { InvalidTransitionError } from './errors.js'
import { allowedFrom, isAllowedTransition } from './states.js'
import type { ResolvedConfig } from './types.js'

type Data = Record<string, unknown>

type Actor = {
  email: null | string
  id: unknown
}

const rows = (value: unknown): Data[] =>
  Array.isArray(value)
    ? value.filter((row): row is Data => Boolean(row) && typeof row === 'object')
    : []

const stateOf = (value: unknown): null | string =>
  typeof value === 'string' && value.length > 0 ? value : null

const relationId = (value: unknown): unknown => {
  if (value && typeof value === 'object') {
    return (value as { id?: unknown }).id ?? null
  }

  return value ?? null
}

const actorOf = (req: PayloadRequest, config: ResolvedConfig): Actor => {
  const user = req.user as null | { collection?: unknown; email?: unknown; id?: unknown }

  if (!user) {
    return { email: null, id: null }
  }

  return {
    email: typeof user.email === 'string' ? user.email : null,
    id: user.collection === config.usersSlug ? (user.id ?? null) : null,
  }
}

const transition = (from: null | string, to: string, actor: Actor): Data => ({
  at: new Date().toISOString(),
  by: actor.id,
  byEmail: actor.email,
  from,
  to,
})

const carried = (value: unknown): Data[] =>
  rows(value).map((row) => ({ ...row, by: relationId(row.by) }))

const stampNotes = (
  data: Data,
  original: Data | undefined,
  actor: Actor,
  config: ResolvedConfig,
): Data => {
  const incoming = data[config.notesFieldName]

  if (!Array.isArray(incoming)) {
    return data
  }

  const previous = new Map<string, Data>()

  for (const row of rows(original?.[config.notesFieldName])) {
    if (row.id !== null && row.id !== undefined) {
      previous.set(String(row.id), row)
    }
  }

  const at = new Date().toISOString()

  return {
    ...data,
    [config.notesFieldName]: incoming.map((value) => {
      const row = (value && typeof value === 'object' ? value : {}) as Data
      const existing =
        row.id === null || row.id === undefined ? undefined : previous.get(String(row.id))

      if (existing) {
        return {
          ...row,
          at: existing.at ?? null,
          author: relationId(existing.author),
          authorEmail: existing.authorEmail ?? null,
        }
      }

      return { ...row, at, author: actor.id, authorEmail: actor.email }
    }),
  }
}

export const trackFulfillment =
  (config: ResolvedConfig): CollectionBeforeChangeHook =>
  ({ data, operation, originalDoc, req }) => {
    if (config.disabled) {
      return data
    }

    const actor = actorOf(req, config)
    const original = originalDoc as Data | undefined
    const next = config.notes ? stampNotes(data as Data, original, actor, config) : (data as Data)
    const to = stateOf(next[config.statusFieldName])

    if (operation === 'create') {
      if (!config.history || to === null) {
        return next
      }

      return { ...next, [config.historyFieldName]: [transition(null, to, actor)] }
    }

    const from = stateOf(original?.[config.statusFieldName])

    if (to === null || to === from) {
      return next
    }

    if (
      config.guardTransitions &&
      from !== null &&
      !isAllowedTransition(from, to, config.transitions)
    ) {
      throw new InvalidTransitionError(from, to, allowedFrom(from, config.transitions))
    }

    if (!config.history) {
      return next
    }

    return {
      ...next,
      [config.historyFieldName]: [
        ...carried(original?.[config.historyFieldName]),
        transition(from, to, actor),
      ],
    }
  }
