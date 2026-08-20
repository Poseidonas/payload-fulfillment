import type { FieldAccess } from 'payload'

/**
 * One entry of a select field: the value written to the database and the
 * label shown in the admin panel.
 */
export type FulfillmentState = {
  /**
   * Label shown in the admin panel. Defaults to the value with hyphens
   * replaced by spaces and the first letter capitalised.
   */
  label?: string
  /**
   * Value written to the database.
   */
  value: string
}

/**
 * Which state may become which. Keys and values are status values.
 * A state that is not a key of the map is never refused.
 */
export type TransitionMap = Record<string, string[]>

export type FulfillmentConfig = {
  /**
   * Options of the carrier field. Given any, the field becomes a select
   * instead of free text. Defaults to an empty list.
   */
  carriers?: (FulfillmentState | string)[]
  /**
   * Stops the hook while leaving every field in place, so that an existing
   * database keeps its shape. Defaults to false.
   */
  disabled?: boolean
  /**
   * Refuses a status change the transition map does not allow, with HTTP 400.
   * Defaults to false.
   */
  guardTransitions?: boolean
  /**
   * Records every status change on the order. Defaults to true.
   */
  history?: boolean
  /**
   * Name of the transition history field. Defaults to 'statusHistory'.
   */
  historyFieldName?: string
  /**
   * Decides who may read the history and read or write the internal notes.
   * The default refuses the customer named on the order and allows anyone
   * else who can already read the order.
   */
  internalAccess?: FieldAccess
  /**
   * Adds internal notes to the order. Defaults to true.
   */
  notes?: boolean
  /**
   * Name of the internal notes field. Defaults to 'internalNotes'.
   */
  notesFieldName?: string
  /**
   * Slug of the orders collection. Defaults to 'orders'.
   */
  ordersSlug?: string
  /**
   * Extra states merged into the status field, after the options already
   * there. A plain string is shorthand for `{ value }`. Defaults to
   * pending-payment, on-hold, shipped and failed.
   */
  states?: (FulfillmentState | string)[]
  /**
   * Name of the status field. Defaults to 'status'.
   */
  statusFieldName?: string
  /**
   * Adds the tracking number and carrier fields. Defaults to true.
   */
  tracking?: boolean
  /**
   * Name of the carrier field. Defaults to 'trackingCarrier'.
   */
  trackingCarrierFieldName?: string
  /**
   * Name of the tracking number field. Defaults to 'trackingNumber'.
   */
  trackingNumberFieldName?: string
  /**
   * States in which the tracking fields are shown in the admin panel.
   * Defaults to shipped and completed.
   */
  trackingStates?: string[]
  /**
   * Replaces the built-in transition map. Only read when `guardTransitions`
   * is true.
   */
  transitions?: TransitionMap
  /**
   * Slug of the collection the staff users live in, used by the `by` and
   * `author` relationships. Defaults to 'users'.
   */
  usersSlug?: string
}

export type ResolvedConfig = {
  carriers: FulfillmentState[]
  disabled: boolean
  guardTransitions: boolean
  history: boolean
  historyFieldName: string
  internalAccess: FieldAccess
  notes: boolean
  notesFieldName: string
  ordersSlug: string
  states: FulfillmentState[]
  statusFieldName: string
  tracking: boolean
  trackingCarrierFieldName: string
  trackingNumberFieldName: string
  trackingStates: string[]
  transitions: TransitionMap
  usersSlug: string
}
