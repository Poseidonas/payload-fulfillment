import type { Field, SelectField, TabsField } from 'payload'

import type { FulfillmentState } from './types.js'

type Option = SelectField['options'][number]

type Tab = TabsField['tabs'][number]

type MergeResult = {
  fields: Field[]
  merged: boolean
}

const valueOf = (option: Option): string =>
  typeof option === 'string' ? option : String(option.value)

export const mergeStatusOptions = (
  existing: SelectField['options'],
  states: FulfillmentState[],
): SelectField['options'] => {
  const present = new Set(existing.map(valueOf))
  const added: Option[] = []

  for (const state of states) {
    if (!present.has(state.value)) {
      present.add(state.value)
      added.push({ label: state.label ?? state.value, value: state.value })
    }
  }

  return added.length === 0 ? existing : [...existing, ...added]
}

const mergeIntoTabs = (tabs: Tab[], name: string, states: FulfillmentState[]): null | Tab[] => {
  const next: Tab[] = []
  let merged = false

  for (const tab of tabs) {
    if (merged || 'name' in tab) {
      next.push(tab)
      continue
    }

    const result = mergeIntoFields(tab.fields, name, states)

    if (result.merged) {
      merged = true
      next.push({ ...tab, fields: result.fields })
      continue
    }

    next.push(tab)
  }

  return merged ? next : null
}

export const mergeIntoFields = (
  fields: Field[],
  name: string,
  states: FulfillmentState[],
): MergeResult => {
  const next: Field[] = []
  let merged = false

  for (const field of fields) {
    if (merged) {
      next.push(field)
      continue
    }

    if (field.type === 'select' && field.name === name) {
      merged = true
      next.push({ ...field, options: mergeStatusOptions(field.options, states) })
      continue
    }

    if (field.type === 'row' || field.type === 'collapsible') {
      const result = mergeIntoFields(field.fields, name, states)

      merged = result.merged
      next.push(result.merged ? { ...field, fields: result.fields } : field)
      continue
    }

    if (field.type === 'tabs') {
      const tabs = mergeIntoTabs(field.tabs, name, states)

      merged = tabs !== null
      next.push(tabs === null ? field : { ...field, tabs })
      continue
    }

    next.push(field)
  }

  return { fields: next, merged }
}
