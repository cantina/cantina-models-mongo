cantina-models-mongo
====================

MongoDB models for Cantina applications implementing a
[modeler](https://github.com/carlos8f/modeler/)-compatible API extended with
additional functionality.

Provides
========

- **app.createMongoCollection (name, options)** - a MongoDB collection factory

See [cantina-models](https://github.com/cantina/cantina-models) for basic
documentation.

### Extended Functionality (differences from modeler)

#### Private Properties

A collection can be created with an optional array of `privateProperties`:

```js
app.createMongoCollection('foo', {
  privateProperties: ['secret_key']
});
```

Private properties will be excluded from all models returned by the core api
methods (e.g., load). Note that if the core method was invoked with a copy of a
model with private properties present, those properties will remain present on
the model when any events and hooks are triggered.

#### Unchangeable Properties

When updating an existing model, any values in the update document for the `id`,
`rev`, `created`, and `updated` properties will be discarded, these are intended
to be maintained only by the store.

#### Arbitrary Queries Parameters

`collection#load` and `collection#list` can optionally use the first parameter
as a [MongoDB query object](http://docs.mongodb.org/manual/reference/method/db.collection.find/#db.collection.find).
So, the call signatures become:

- **`load(id|model|query, [callback])`**
- **`list([query], [options], callback)`** - where `options` is **required** if
`query` is provided

#### Patch Updates

`collection#save` does not require the full model to perform an update. Only the
properties present in the model will be set (using MongoDB `$set`).

#### Changed Attributes Hash

When saving changes to an existing model, the model passed to the `save` and
`afterSave` hooks and passed to the callback will have an extra property,
`_changed`, containing a hash of the properties being saved (not necessarily
representing a change in value from the model's previous value).

Deep keys in the `_changed` hash are "flattened" (like you would access them in
in a query or update document), e.g.:

```js
{
  a: 1,
  b: false,
  c: { a: 'foo' },
  d: { b: { x: [ 'a', 'b' ] } }
  e: { y: undefined }
  _changed: {
    a: true,
    b: true,
    'c.a': true,
    'd.b.x': true,
    'e.y': true
  }
}
```

#### MongoDB Native Options

Any options provided when calling the core api methods will be passed to MongoDB.
So, e.g., [field projections](http://docs.mongodb.org/manual/reference/glossary/#term-projection)
are possible.

#### MongoDB Native Methods

All [MongoDB native methods](http://mongodb.github.io/node-mongodb-native/api-generated/collection.html)
are proxied on the collection, prefixed with an underscore (e.g.,
`MongoCollection#update()` is accessible as `collection._update()`).

**N.B.** `cantina-models` events and hooks will not be triggered for any of native
method calls.

- - -

### Developed by [Terra Eclipse](http://www.terraeclipse.com)
Terra Eclipse, Inc. is a nationally recognized political technology and
strategy firm located in Santa Cruz, CA and Washington, D.C.
