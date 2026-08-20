import type { FulfillmentState, TransitionMap } from './types.js'

export const coreStates = ['processing', 'completed', 'cancelled', 'refunded'] as const

export const defaultStates: FulfillmentState[] = [
  { label: 'Pending payment', value: 'pending-payment' },
  { label: 'On hold', value: 'on-hold' },
  { label: 'Shipped', value: 'shipped' },
  { label: 'Failed', value: 'failed' },
]

export const defaultTransitions: TransitionMap = {
  cancelled: ['refunded'],
  completed: ['refunded'],
  failed: ['processing', 'cancelled'],
  'on-hold': ['processing', 'shipped', 'completed', 'cancelled', 'failed'],
  'pending-payment': ['processing', 'on-hold', 'cancelled', 'failed'],
  processing: ['on-hold', 'shipped', 'completed', 'cancelled', 'failed', 'refunded'],
  refunded: [],
  shipped: ['completed', 'cancelled', 'refunded'],
}

export const labelFor = (value: string): string => {
  const words = value.replace(/[-_]+/g, ' ').trim()

  return words.length === 0 ? value : `${words.charAt(0).toUpperCase()}${words.slice(1)}`
}

export const toState = (entry: FulfillmentState | string): null | FulfillmentState => {
  if (typeof entry === 'string') {
    return entry.length > 0 ? { label: labelFor(entry), value: entry } : null
  }

  if (!entry || typeof entry.value !== 'string' || entry.value.length === 0) {
    return null
  }

  return {
    label:
      typeof entry.label === 'string' && entry.label.length > 0
        ? entry.label
        : labelFor(entry.value),
    value: entry.value,
  }
}

export const toStates = (entries: (FulfillmentState | string)[]): FulfillmentState[] => {
  const seen = new Set<string>()
  const states: FulfillmentState[] = []

  for (const entry of entries) {
    const state = toState(entry)

    if (state && !seen.has(state.value)) {
      seen.add(state.value)
      states.push(state)
    }
  }

  return states
}

export const isAllowedTransition = (
  from: string,
  to: string,
  transitions: TransitionMap,
): boolean => {
  const allowed = transitions[from]

  return allowed === undefined ? true : allowed.includes(to)
}

export const allowedFrom = (from: string, transitions: TransitionMap): string[] =>
  transitions[from] ?? []
