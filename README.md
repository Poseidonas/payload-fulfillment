# payload-fulfillment

[![npm](https://img.shields.io/npm/v/payload-fulfillment?style=flat-square&color=0F766E)](https://www.npmjs.com/package/payload-fulfillment) ![node](https://img.shields.io/badge/node-%3E%3D20-339933?style=flat-square) ![license](https://img.shields.io/badge/license-MIT-6C757D?style=flat-square)

Gives a Payload order the states a real shop needs between payment and delivery, and a record of how it got there: extra statuses merged into the ones you already have, an append-only transition history, internal notes, and a tracking number with a carrier.

- Extends `@payloadcms/plugin-ecommerce` and works on any collection that holds orders
- Built against Payload 3.88 and `@payloadcms/plugin-ecommerce` 3.88.0
- No runtime dependencies, and no runtime import of `payload` either
- No admin components, so it survives minor releases

## Install

```bash
pnpm add payload-fulfillment
```

```ts
import { ecommercePlugin } from '@payloadcms/plugin-ecommerce'
import { fulfillmentPlugin } from 'payload-fulfillment'

export default buildConfig({
  plugins: [
    ecommercePlugin({ /* ... */ }),
    fulfillmentPlugin({
      guardTransitions: true,
      carriers: ['DHL', 'UPS', 'ELTA Courier'],
    }),
  ],
})
```

`fulfillmentPlugin` must come **after** the plugin that defines the orders collection. It extends what it finds; if the orders collection is not there yet, it returns the config untouched.

## What was measured

Read from the published sources of the exact versions, both of which are installed and can be checked line by line.

### What the official plugin gives an order

`@payloadcms/plugin-ecommerce@3.88.0`, `dist/collections/orders/createOrdersCollection.js`. The orders collection carries one `status` field:

| Property | Value |
| --- | --- |
| name | `status` |
| type | `select` |
| `defaultValue` | `processing` |
| `interfaceName` | `OrderStatus` |
| options | `processing`, `completed`, `cancelled`, `refunded` |

Those four are the whole vocabulary. An order is created by the Stripe adapter with `status: 'processing'` already set (`dist/payments/adapters/stripe/confirmOrder.js`), so there is no state before payment, no on hold, no failed, and nothing between processing and completed. There is no transition history, no notes and no tracking anywhere on the collection.

This package adds the missing states to that same field. The four above are never removed, never renamed and never reordered, because a shop may already have orders sitting in them.

### Why the history is a field on the order and not a collection

Payload 3.88.0, `dist/collections/operations/utilities/update.js` and `dist/collections/operations/create.js`, run their hooks in this order:

    beforeValidate - Fields  ->  beforeValidate - Collection  ->  beforeChange - Collection  ->  beforeChange - Fields

Three things follow from that, and together they decide the design.

**Field access is enforced before the collection hook runs.** `dist/fields/hooks/beforeValidate/promise.js` deletes a field from the incoming payload when its `create` or `update` access returns false. That happens in the first step, so a field closed to the API is still writable by a hook in the third step. The history field is therefore declared `create: false, update: false` and written only by the plugin. No request can forge, edit or delete an entry.

**The previous document is read with access overridden.** `originalDoc` is built with `overrideAccess: true` and `depth: 0`. The hook can read the existing history even though the requester cannot, and the relationships come back as plain ids.

**The write costs nothing extra.** The entry is appended to the same document, in the same write, inside the request's own transaction. A separate collection would mean a second `payload.create`: with `req` it is an extra write per status change, and without `req` it is a second database connection held while the order's own transaction is still open, which exhausts the default `pg` pool of 10 at eleven concurrent requests. A history that only ever grows by a handful of rows per order, and that is always read together with the order, does not justify either cost.

The trade is stated under Honest limits.

### The guard answers with 400, not 500

`dist/utilities/routeError.js` takes the HTTP status from `err.status`, and `dist/utilities/isErrorPublic.js` shows the message to the client when `isPublic` is true or the status is not 500. `InvalidTransitionError` carries both, so a refused transition comes back as a readable 400 without the package importing anything from `payload` at runtime.

### The tracking fields hide, they do not disappear

`admin.condition` is read in `dist/fields/hooks/beforeChange/promise.js`, where it only decides whether validation is skipped, and it appears nowhere in the read pipeline. Hiding the tracking fields outside the shipping states changes what the admin panel draws, never what the database holds or what the API returns.

### Tests

53 unit tests, `pnpm test`.

## Options

| Option | Default | Meaning |
| --- | --- | --- |
| `carriers` | `[]` | Options for the carrier field. Given any, it becomes a select instead of free text |
| `disabled` | `false` | Stops the hook but keeps every field, so the database keeps its shape |
| `guardTransitions` | `false` | Refuses a status change the transition map does not allow, with HTTP 400 |
| `history` | `true` | Records every status change on the order |
| `historyFieldName` | `'statusHistory'` | Name of the transition history field |
| `internalAccess` | see below | Decides who reads the history and reads or writes the notes |
| `notes` | `true` | Adds internal notes to the order |
| `notesFieldName` | `'internalNotes'` | Name of the internal notes field |
| `ordersSlug` | `'orders'` | Slug of the orders collection |
| `states` | `pending-payment`, `on-hold`, `shipped`, `failed` | Extra states merged into the status field |
| `statusFieldName` | `'status'` | Name of the status field |
| `tracking` | `true` | Adds the tracking number and carrier fields |
| `trackingCarrierFieldName` | `'trackingCarrier'` | Name of the carrier field |
| `trackingNumberFieldName` | `'trackingNumber'` | Name of the tracking number field |
| `trackingStates` | `['shipped', 'completed']` | States in which the tracking fields are shown |
| `transitions` | see below | Replaces the built-in transition map |
| `usersSlug` | `'users'` | Collection the `by` and `author` relationships point at |

A state may be written as a string or as `{ label, value }`. A bare string becomes its own label, so `'awaiting-stock'` is shown as `Awaiting stock`. A value that is empty, or that repeats one already listed, is dropped rather than applied. `trackingStates: []` places no restriction at all and shows the tracking fields in every state.

### The default states

| Value | Label | Fills the gap |
| --- | --- | --- |
| `pending-payment` | Pending payment | before the money arrives |
| `on-hold` | On hold | stopped, waiting on the shop or the customer |
| `shipped` | Shipped | between processing and completed |
| `failed` | Failed | payment or fulfillment gave up |

They are appended after the four official options, in that order. Passing `states` replaces the list; passing `states: []` adds none.

### The default transition map

Only read when `guardTransitions` is true.

| From | May become |
| --- | --- |
| `pending-payment` | `processing`, `on-hold`, `cancelled`, `failed` |
| `processing` | `on-hold`, `shipped`, `completed`, `cancelled`, `failed`, `refunded` |
| `on-hold` | `processing`, `shipped`, `completed`, `cancelled`, `failed` |
| `shipped` | `completed`, `cancelled`, `refunded` |
| `completed` | `refunded` |
| `cancelled` | `refunded` |
| `refunded` | nothing |
| `failed` | `processing`, `cancelled` |

A state that is not a key of the map is never refused, so adding your own states does not lock the shop out. Passing `transitions` replaces the whole map.

```ts
import { InvalidTransitionError } from 'payload-fulfillment'

try {
  await payload.update({ collection: 'orders', id, data: { status: 'processing' } })
} catch (error) {
  if (error instanceof InvalidTransitionError) {
    console.log(error.from, error.to, error.allowed)
  }
}
```

### The default internal access

`denyOrderCustomer`, exported so you can compose with it. It refuses an anonymous request, refuses the user named in the order's `customer`, and refuses a guest whose email matches the order's `customerEmail`. Everyone else who can already read the order sees the field, which under the official plugin's `isAdmin OR isDocumentOwner` read access means the shop and not the buyer.

If your orders collection names its customer differently, or lets strangers read orders, pass your own `internalAccess`.

## What it adds to your database

| Field | Type | Notes |
| --- | --- | --- |
| `status` | select | the existing field, with the extra options appended. Created in full if it is missing |
| `trackingNumber` | text | indexed, sidebar, shown in `trackingStates` |
| `trackingCarrier` | text or select | sidebar, shown in `trackingStates` |
| `statusHistory` | array | read only, closed to the API |
| `statusHistory.from` | text | the state left behind, empty on the first entry |
| `statusHistory.to` | text | the state entered |
| `statusHistory.at` | date | ISO timestamp written by the hook |
| `statusHistory.by` | relationship | the user, when they belong to `usersSlug` |
| `statusHistory.byEmail` | text | their email, kept as a copy that survives a deleted user |
| `internalNotes` | array | gated by `internalAccess` |
| `internalNotes.note` | textarea | required |
| `internalNotes.at` | date | stamped once, on the write that created the note |
| `internalNotes.author` | relationship | stamped once |
| `internalNotes.authorEmail` | text | stamped once |

No collections are added. The plugin appends one `beforeChange` hook to the orders collection and touches nothing else.

## Honest limits

**The plugin must run after the one that defines the orders collection.** It extends a collection that already exists in the incoming config. Listed before `ecommercePlugin`, it finds no orders collection, returns the config untouched, and says nothing. If the fields do not appear, check the order of the `plugins` array first.

**Two simultaneous writes to the same order can lose an entry.** The history is rebuilt from `originalDoc`, which each request read inside its own transaction. Two admins changing the status of the same order in the same instant produce two arrays built from the same starting point, and the second write wins whole. The status itself behaves the same way, with or without this package. If you need an audit trail that survives that, it has to be a separate collection committing on its own, and that carries the connection cost described above.

**Only writes that go through Payload are recorded.** A status changed directly in the database, or through a `payload.db` call, leaves no entry. The hook is the only writer.

**The guard is a rule, not a lock.** It refuses through Payload's Local, REST and GraphQL APIs. It is off by default so that adopting the package cannot break an existing admin workflow, and it never refuses a transition out of a state its map does not mention.

**Add states, do not remove them.** Removing a state after orders have been saved in it leaves those orders holding a value the field no longer offers. Changing the options of a select field also changes the shape of the collection: generate and apply a Payload migration before deploying to a database that runs them.

**Note text stays editable.** `author`, `authorEmail` and `at` are stamped once and restored from the stored order on every later write, so they cannot be rewritten. The text of an existing note can still be changed by anyone `internalAccess` lets write notes. The history is the append-only record; the notes are a workspace.

**No timeline widget.** The history is a read-only array field and the notes are a plain array field, drawn by Payload's own inputs. That is deliberate: admin components are where third party Payload packages break on minor releases.

## License

MIT. Copyright George Vasiliades, https://github.com/Poseidonas
