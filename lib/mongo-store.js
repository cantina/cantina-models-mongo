var app = require('cantina')
  , idgen = require('idgen')
  , nested = require('nested-objects')
  , _ = require('underscore');

// Note that unlike modeler, we do not guarantee that you can list documents
// in insertion order

module.exports = function (_opts) {
  var opts = copy(_opts);
  if (!opts.db) throw new Error('must pass a node-mongodb-native db with options.db');
  if (!opts.name) throw new Error('must pass a collection name with options.name');

  var db = opts.db
    , collection = db.collection(opts.name)
    , nativeSave = collection.save;

  // Ensure indexes exist
  // No other operations can happen while indexes are being created, so we
  // run this on initialize and only really care if there's an error
  collection.ensureIndex([{ "id": 1, "rev": 1 }], { unique: true }, function (err) {
    if (err) app.emit('error', err);
  });


  collection.list = function (options, cb) {
    if (typeof options === 'function') {
      cb = options;
      options = {};
    }
    options = _.defaults(options || {}, {
      sort: '_id',
      offset: 0,
      reverse: true
    });

    // translate modeler keys to mongo keys
    var queryOptions = {}, sort = {};
    sort[options.sort] = options.reverse ? -1 : 1;
    queryOptions.sort = sort;
    if (options.offset) queryOptions.skip = options.offset;
    if (options.limit) queryOptions.limit = options.limit;

    collection.find({}, queryOptions).toArray(cb);
  };

  collection.create = function (attrs, cb) {
    if (typeof attrs === 'function') {
      cb = attrs;
      attrs = {};
    }
    attrs || (attrs = {});
    var entity = copy(attrs);
    if (typeof entity.id === 'undefined') entity.id = idgen(16);
    if (typeof entity.created === 'undefined') entity.created = new Date();
    if (typeof entity.rev === 'undefined') entity.rev = 0;
    if (opts.create) opts.create(entity);
    if (cb) process.nextTick(function () {
      collection.save(entity, cb);
    });
    return entity;
  };

  collection.save = function (entity, options, cb) {
    if (!cb) {
      if ('function' === typeof options) {
        cb = options;
        options = {};
      }
      else {
        cb = defaultCb;
      }
    }
    options = _.defaults(options || {}, {
      w: 1, // by default, at least wait for acknowledgement of write
      new: true // return the updated document instead of the old one
    });
    var rev = entity.rev || 0;
    entity.rev++;
    entity.updated = new Date();
    var changed = entity._changed = rev > 0 ? createChangedHash(entity) : {};

    if (opts.save) opts.save(entity, doSave);
    else doSave();

    function doSave (err, saveEntity) {
      if (!saveEntity) saveEntity = entity;
      else if (rev > 0) changed = createChangedHash(entity);
      if (err) return cb(err);

      options.upsert = rev > 0 ? false : true;
      var setEntity;
      if (rev > 0) {
        setEntity = copy(saveEntity);
        unchangeables.forEach(function (prop) {
          nested.delete(setEntity, prop);
        });
      }
      setEntity || (setEntity = saveEntity);
      delete setEntity._changed;
      collection.findAndModify({ id: saveEntity.id, rev: rev }, null, { $set: setEntity }, options, function (err, resultEntity) {
        if (err) return cb(err);
        if (!resultEntity) return cb(null, null);
        resultEntity._changed = changed;
        if (opts.afterSave) opts.afterSave(resultEntity, function (err) {
          if (err) return cb(err);
          cb(null, resultEntity);
        });
        else cb(null, resultEntity);
      });
    }
  };

  collection.load = function (id, cb) {
    if (!cb) cb = defaultCb;
    var entity, query;
    if (id.id) entity = id, id = id.id;
    if (entity) {
      query = { id: entity.id, rev: entity.rev };
    }
    else {
      query = { id: id };
    }
    collection.findOne(query, function (err, entity) {
      if (err) return cb(err);
      if (opts.load) opts.load(entity, doCallback);
      else doCallback();

      function doCallback (err, loadEntity) {
        if (err) return cb(err);
        if (!loadEntity) loadEntity = entity;
        cb(null, loadEntity);
      }

    });
  };

  collection.destroy = function (id, options, cb) {
    if (!cb) {
      if ('function' === typeof options) {
        cb = options;
        options = {};
      }
      else {
        cb = defaultCb;
      }
    }
    var entity, query;
    if (id.id) entity = id, id = id.id;
    if (entity) {
      query = { id: entity.id, rev: entity.rev };
    }
    else {
      query = { id: id };
    }
    options = _.defaults(options || {}, {
      w: 1 // by default, at least wait for acknowledgement of write
    });

    if (opts.destroy) {
      collection.load(query, function (err, loadEntity) {
        if (err) return cb(err);
        if (!loadEntity) return cb();
        query.rev || (query.rev = loadEntity.rev);
        opts.destroy(loadEntity, doDestroy);
      });
    }
    else doDestroy();

    function doDestroy (err) {
      if (err) return cb(err);
      collection.findAndRemove(query, null, null, options, function (err, destroyedEntity) {
        if (err) return cb(err);
        if (opts.afterDestroy) opts.afterDestroy(destroyedEntity, function (err) {
          if (err) return cb(err);
          cb(null);
        });
        else cb(null);
      });
    }
  };

  return collection;
};

var unchangeables = [ '_id', 'id', 'created' ];

function defaultCb (err) {
  if (err) app.emit('error', err);
}

function copy (obj) {
  var c = {};
  Object.keys(obj).forEach(function (prop) {
    c[prop] = obj[prop];
  });
  return c;
}

var flatArrayIdxRe = /\.\d+$/
  , changedRe = /^_changed/;

/**
 * Takes an object and returns a shallow object keyed with path names each having
 * the value Boolean(true)
 *
 * Ex:
 * ```js
 * var obj = {
 *   a : {
 *     b: {
 *       c: [1,2,3]
 *     },
 *     d: "abc"
 *   },
 *   e: new Date()
 * };
 * createChangedHash(obj);
 * // returns { 'a.b.c': true,
 * //           'a.d': true,
 * //           e: true }
 */
function createChangedHash (obj) {
  var flat = nested.flatten(obj)
    , changed = {};
  Object.keys(flat).forEach(function (key) {
    if (changedRe.test(key) || ~unchangeables.indexOf(key)) return;
    var trimmed = key.replace(flatArrayIdxRe, '');
    if (trimmed !== key) {
      if (!(trimmed in changed)) {
        changed[trimmed] = true;
      }
      delete changed[key];
    }
    else {
      changed[key] = true;
    }
  });
  return changed;
}
