import { denyOrderCustomer } from './access.js'
import { defaultStates, defaultTransitions, toStates } from './states.js'
import type { FulfillmentConfig, ResolvedConfig, TransitionMap } from './types.js'

const text = (value: unknown, fallback: string): string =>
  typeof value === 'string' && value.length > 0 ? value : fallback

const flag = (value: unknown, fallback: boolean): boolean =>
  typeof value === 'boolean' ? value : fallback

const values = (value: unknown, fallback: string[]): string[] => {
  if (!Array.isArray(value)) {
    return fallback
  }

  return value.filter((entry): entry is string => typeof entry === 'string' && entry.length > 0)
}

const transitionMap = (value: unknown, fallback: TransitionMap): TransitionMap => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return fallback
  }

  const map: TransitionMap = {}

  for (const [from, to] of Object.entries(value as Record<string, unknown>)) {
    map[from] = values(to, [])
  }

  return map
}

export const resolveConfig = (incoming: FulfillmentConfig = {}): ResolvedConfig => ({
  carriers: Array.isArray(incoming.carriers) ? toStates(incoming.carriers) : [],
  disabled: incoming.disabled === true,
  guardTransitions: incoming.guardTransitions === true,
  history: flag(incoming.history, true),
  historyFieldName: text(incoming.historyFieldName, 'statusHistory'),
  internalAccess:
    typeof incoming.internalAccess === 'function' ? incoming.internalAccess : denyOrderCustomer,
  notes: flag(incoming.notes, true),
  notesFieldName: text(incoming.notesFieldName, 'internalNotes'),
  ordersSlug: text(incoming.ordersSlug, 'orders'),
  states: Array.isArray(incoming.states) ? toStates(incoming.states) : defaultStates,
  statusFieldName: text(incoming.statusFieldName, 'status'),
  tracking: flag(incoming.tracking, true),
  trackingCarrierFieldName: text(incoming.trackingCarrierFieldName, 'trackingCarrier'),
  trackingNumberFieldName: text(incoming.trackingNumberFieldName, 'trackingNumber'),
  trackingStates: values(incoming.trackingStates, ['shipped', 'completed']),
  transitions: transitionMap(incoming.transitions, defaultTransitions),
  usersSlug: text(incoming.usersSlug, 'users'),
})
