import type { Field, SelectField } from 'payload'

import { coreStates } from './states.js'
import type { ResolvedConfig } from './types.js'

const never = (): boolean => false

const optionsFor = (config: ResolvedConfig): SelectField['options'] => [
  ...coreStates.map((value) => ({ label: value.charAt(0).toUpperCase() + value.slice(1), value })),
  ...config.states.map(({ label, value }) => ({ label: label ?? value, value })),
]

export const statusField = (config: ResolvedConfig): Field => ({
  name: config.statusFieldName,
  type: 'select',
  admin: {
    position: 'sidebar',
  },
  defaultValue: 'processing',
  index: true,
  interfaceName: 'OrderStatus',
  label: 'Status',
  options: optionsFor(config),
})

export const historyField = (config: ResolvedConfig): Field => ({
  name: config.historyFieldName,
  type: 'array',
  access: {
    create: never,
    read: config.internalAccess,
    update: never,
  },
  admin: {
    readOnly: true,
  },
  fields: [
    {
      name: 'from',
      type: 'text',
      admin: { readOnly: true },
      label: 'From',
    },
    {
      name: 'to',
      type: 'text',
      admin: { readOnly: true },
      label: 'To',
      required: true,
    },
    {
      name: 'at',
      type: 'date',
      admin: { readOnly: true },
      label: 'At',
      required: true,
    },
    {
      name: 'by',
      type: 'relationship',
      admin: { readOnly: true },
      label: 'By',
      relationTo: config.usersSlug,
    },
    {
      name: 'byEmail',
      type: 'text',
      admin: { readOnly: true },
      label: 'By email',
    },
  ],
  label: 'Status history',
  labels: {
    plural: 'Transitions',
    singular: 'Transition',
  },
})

export const notesField = (config: ResolvedConfig): Field => ({
  name: config.notesFieldName,
  type: 'array',
  access: {
    create: config.internalAccess,
    read: config.internalAccess,
    update: config.internalAccess,
  },
  fields: [
    {
      name: 'note',
      type: 'textarea',
      label: 'Note',
      required: true,
    },
    {
      name: 'at',
      type: 'date',
      admin: { readOnly: true },
      label: 'At',
    },
    {
      name: 'author',
      type: 'relationship',
      admin: { readOnly: true },
      label: 'Author',
      relationTo: config.usersSlug,
    },
    {
      name: 'authorEmail',
      type: 'text',
      admin: { readOnly: true },
      label: 'Author email',
    },
  ],
  label: 'Internal notes',
  labels: {
    plural: 'Notes',
    singular: 'Note',
  },
})

export const trackingFields = (config: ResolvedConfig): Field[] => {
  const condition = (data: Record<string, unknown>): boolean =>
    config.trackingStates.length === 0 ||
    config.trackingStates.includes(String(data?.[config.statusFieldName] ?? ''))

  const carrier: Field =
    config.carriers.length > 0
      ? {
          name: config.trackingCarrierFieldName,
          type: 'select',
          admin: { condition, position: 'sidebar' },
          label: 'Carrier',
          options: config.carriers.map(({ label, value }) => ({ label: label ?? value, value })),
        }
      : {
          name: config.trackingCarrierFieldName,
          type: 'text',
          admin: { condition, position: 'sidebar' },
          label: 'Carrier',
        }

  return [
    {
      name: config.trackingNumberFieldName,
      type: 'text',
      admin: { condition, position: 'sidebar' },
      index: true,
      label: 'Tracking number',
    },
    carrier,
  ]
}

export const addedFields = (config: ResolvedConfig): Field[] => [
  ...(config.tracking ? trackingFields(config) : []),
  ...(config.history ? [historyField(config)] : []),
  ...(config.notes ? [notesField(config)] : []),
]
