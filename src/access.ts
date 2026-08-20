import type { FieldAccess } from 'payload'

const identifier = (value: unknown): null | string => {
  if (value === null || value === undefined) {
    return null
  }

  if (typeof value === 'object') {
    const id = (value as { id?: unknown }).id

    return id === null || id === undefined ? null : String(id)
  }

  return String(value)
}

const emailOf = (value: unknown): null | string =>
  typeof value === 'string' && value.length > 0 ? value.toLowerCase() : null

export const denyOrderCustomer: FieldAccess = ({ doc, req }) => {
  const user = req.user as null | { email?: unknown; id?: unknown }

  if (!user) {
    return false
  }

  const order = (doc ?? {}) as { customer?: unknown; customerEmail?: unknown }
  const owner = identifier(order.customer)

  if (owner !== null && owner === identifier(user.id)) {
    return false
  }

  const orderEmail = emailOf(order.customerEmail)

  return orderEmail === null || orderEmail !== emailOf(user.email)
}
