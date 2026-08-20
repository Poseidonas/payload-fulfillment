/**
 * Thrown by the transition guard when a status change is not in the map.
 * Carries `status` 400 and `isPublic`, which Payload reads to answer the
 * request with the message rather than a generic server error.
 */
export class InvalidTransitionError extends Error {
  readonly allowed: string[]

  readonly from: string

  readonly isPublic = true

  readonly status = 400

  readonly to: string

  constructor(from: string, to: string, allowed: string[]) {
    super(
      allowed.length === 0
        ? `An order cannot leave ${from}.`
        : `An order cannot go from ${from} to ${to}. Allowed: ${allowed.join(', ')}.`,
    )

    this.allowed = allowed
    this.from = from
    this.name = 'InvalidTransitionError'
    this.to = to
  }
}
