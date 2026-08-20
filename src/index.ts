import type { Config } from 'payload'

import { resolveConfig } from './config.js'
import { addedFields, statusField } from './fields.js'
import { trackFulfillment } from './hooks.js'
import { mergeIntoFields } from './status.js'
import type { FulfillmentConfig } from './types.js'

export { denyOrderCustomer } from './access.js'
export { InvalidTransitionError } from './errors.js'
export { coreStates, defaultStates, defaultTransitions } from './states.js'
export type { FulfillmentConfig, FulfillmentState, TransitionMap } from './types.js'

export const fulfillmentPlugin =
  (incoming: FulfillmentConfig = {}) =>
  (incomingConfig: Config): Config => {
    const config = resolveConfig(incoming)
    const collections = incomingConfig.collections ?? []

    if (!collections.some((collection) => collection.slug === config.ordersSlug)) {
      return incomingConfig
    }

    return {
      ...incomingConfig,
      collections: collections.map((collection) => {
        if (collection.slug !== config.ordersSlug) {
          return collection
        }

        const merged = mergeIntoFields(collection.fields, config.statusFieldName, config.states)
        const hooks = collection.hooks ?? {}

        return {
          ...collection,
          fields: [
            ...(merged.merged ? merged.fields : [...collection.fields, statusField(config)]),
            ...addedFields(config),
          ],
          hooks: {
            ...hooks,
            beforeChange: [...(hooks.beforeChange ?? []), trackFulfillment(config)],
          },
        }
      }),
    }
  }
