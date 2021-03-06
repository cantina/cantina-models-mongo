describe('basic', function (){

  var app
    , model;

  before(function (done) {
    app = require('cantina').createApp();
    app.boot(function(err) {
      app.conf.set('mongo:db', 'cantina-models-mongo-test-' + idgen());
      app.require('../');
      done(err);
    });
  });

  after(function (done) {
    app.mongo.dropDatabase(function () {
      app.destroy(done);
    });
  });

  describe('core', function () {
    it('can create a mongo collection factory', function () {
      assert(app.createMongoCollection);
      assert('function' === typeof app.createMongoCollection);
    });

    it('can create a collection', function () {
      app.createMongoCollection('people');
      assert(app.collections.people);
    });

    it('can create a model', function () {
      model = app.collections.people.create({
        first: 'Brian',
        last: 'Link',
        email: 'cpsubrian@gmail.com'
      });
      assert(model);
      assert(model.id);
      assert.equal(model.rev, 0);
    });
    it('can save a new model', function (done) {
      app.collections.people.save(model, function (err, brian) {
        assert.ifError(err);
        assert.equal(brian.first, 'Brian');
        assert.equal(brian.last, 'Link');
        assert.equal(brian.email, 'cpsubrian@gmail.com');
        assert.equal(model.rev, 1);
        model = brian;
        done();
      });
    });
    it('can save changes to an existing model', function (done) {
      model.first = 'Midnight';
      model.last = 'Rider';
      email = model.email;
      app.collections.people.save(model, function (err, saveModel) {
        assert.ifError(err);
        assert.equal(saveModel.first, 'Midnight');
        assert.equal(saveModel.last, 'Rider');
        assert.equal(saveModel.email, email);
        assert.equal(saveModel.rev, 2);
        done();
      });
    });
    it('adds _changed hash when changing an existing model', function (done) {
      model.first = 'Ultimate';
      model.last = 'Warrior';
      app.collections.people.save(model, function (err, saveModel) {
        assert.ifError(err);
        assert.equal(saveModel.first, 'Ultimate');
        assert.equal(saveModel.last, 'Warrior');
        assert.equal(saveModel.rev, 3);
        assert(saveModel._changed.first);
        assert(saveModel._changed.last);
        assert(!saveModel._changed._id);
        assert(!saveModel._changed._changed);
        done();
      });
    });
    it('can load a model by id', function (done) {
      app.collections.people.load(model.id, function (err, loadModel) {
        assert.ifError(err);
        assert(loadModel);
        Object.keys(loadModel).forEach(function (prop) {
          if (prop === '_id') assert(loadModel[prop].equals(model[prop]));
          else if (prop === 'created' || prop === 'updated') assert.equal(loadModel[prop].toString(), model[prop].toString());
          else assert.equal(loadModel[prop], model[prop]);
        });
        done();
      });
    });
    it('can load a model by query', function (done) {
      app.collections.people.load({ first: 'Ultimate' }, function (err, loadModel) {
        assert.ifError(err);
        assert(loadModel);
        Object.keys(loadModel).forEach(function (prop) {
          if (prop === '_id') assert(loadModel[prop].equals(model[prop]));
          else if (prop === 'created' || prop === 'updated') assert.equal(loadModel[prop].toString(), model[prop].toString());
          else assert.equal(loadModel[prop], model[prop]);
        });
        done();
      });
    });
    it('can load models by array of ids', function (done) {
      app.collections.people.create({
        first: 'Carlos',
        last: 'Rodriquez',
        email: 'carlos8f@gmail.com'
      }, function (err, carlos) {
        assert.ifError(err);
        app.collections.people.load([carlos.id, model.id], function (err, models) {
          assert.ifError(err);
          assert(models);
          assert(Array.isArray(models));
          assert.equal(models.length, 2);
          app.collections.people.destroy(carlos, done);
        });
      });
    });
    it('can load a model with options hash', function (done) {
      app.collections.people.load(model.id, { returnKey: true }, function (err, result) {
        assert.ifError(err);
        assert(result);
        assert.deepEqual(result, { id: model.id, rev: model.rev });
        done();
      });
    });
    it('can list models', function (done) {
      app.collections.people.list(function (err, list) {
        assert.ifError(err);
        assert(Array.isArray(list));
        assert.equal(list.length, 1);
        assert.equal(list[0].id, model.id);
        done();
      });
    });
    it('can list models by query', function (done) {
      app.collections.people.list({ last: 'Warrior' }, null, function (err, list) {
        assert.ifError(err);
        assert.equal(list.length, 1);
        assert.equal(list[0].id, model.id);
        done();
      });
    });
    it('can list models with an options hash', function (done) {
      app.collections.people.list({ fields: { last: 1 } }, function (err, list) {
        assert.ifError(err);
        assert.equal(list.length, 1);
        assert.equal(list[0].last, model.last);
        assert.strictEqual(list[0].first, undefined);
        done();
      });
    });
    it('can list models with no results', function (done) {
      app.collections.people.list({notafield: 'notavalue'}, null, function (err, list) {
        assert.ifError(err);
        assert.equal(list.length, 0);
        done();
      });
    });
    it('can save partial changes to an existing model', function (done) {
      var attrs = {
        id: model.id,
        rev: model.rev,
        first: 'Ultimate',
        last: 'Warrior'
      };
      app.collections.people.save(attrs, function (err, saveModel) {
        assert.ifError(err);
        assert.equal(saveModel.first, 'Ultimate');
        assert.equal(saveModel.last, 'Warrior');
        assert.equal(saveModel.email, model.email);
        assert.equal(saveModel.rev, 4);
        done();
      });
    });
    it('can destroy a model', function (done) {
      app.collections.people.load(model.id, function (err, getModel) {
        assert.ifError(err);
        app.collections.people.destroy(getModel, function (err) {
          assert.ifError(err);
          // verify it's gone
          app.collections.people.load(model.id, function (err, loadModel) {
            assert.ifError(err);
            assert.equal(loadModel, null);
            done();
          });
        });
      });
    });
  });

  describe('hooks', function () {
    it('emits `model:create` event', function (done) {
      app.on('model:create', function onModelCreate (model) {
        app.removeListener('model:create', onModelCreate);
        assert.equal(model.first, 'John');
        done();
      });
      app.collections.people.create({
        first: 'John',
        last: 'Doe'
      });
    });

    it('emits `model:create:[name]` event', function (done) {
      app.on('model:create:people', function onModelCreate (model) {
        app.removeListener('model:create:people', onModelCreate);
        assert.equal(model.first, 'Jane');
        done();
      });
      app.collections.people.create({
        first: 'Jane',
        last: 'Doe'
      });
    });

    it('runs `model:save` hook', function (done) {
      app.hook('model:save').add(function onHook (model, next) {
        app.hook('model:save').remove(onHook);
        model.saveHookRan = true;
        next();
      });
      app.collections.people.create({first: 'Danny'}, function (err, model) {
        assert.ifError(err);
        assert.equal(model.first, 'Danny');
        assert(model.saveHookRan);
        done();
      });
    });

    it('runs `model:save:[name]` hook', function (done) {
      app.hook('model:save:people').add(function onHook (model, next) {
        app.hook('model:save:people').remove(onHook);
        model.saveHookRan = true;
        next();
      });
      app.collections.people.create({first: 'Danny'}, function (err, model) {
        assert.ifError(err);
        assert.equal(model.first, 'Danny');
        assert(model.saveHookRan);
        done();
      });
    });

    it('runs `model:load:[name]` hook', function (done) {
      app.hook('model:load:people').add(function onHook (model, next) {
        model.loadHookRan = true;
        next();
      });
      app.collections.people.list(function (err, models) {
        assert.ifError(err);
        assert.equal(models.length, 2);
        assert(models[0].loadHookRan);
        assert(models[1].loadHookRan);
        done();
      });
    });
  });

  describe('mongodb native collection methods', function () {
    // Just a couple to make sure
    it('#findOne', function (done) {
      app.collections.people._findOne({}, function (err, model) {
        assert.ifError(err);
        assert(model);
        assert(model._id);
        done();
      });
    });
    it('#count', function (done) {
      app.collections.people._count({}, function (err, count) {
        assert.ifError(err);
        assert.strictEqual(count, 2);
        done();
      });
    });
  });

  describe('field projections', function () {
    var spy = {
      codename: '007',
      covername: 'James Bond',
      realname: 'Dan MacTough'
    };
    it('can create a collection with private properties', function () {
      var opts = {
        privateProperties: [ 'realname' ]
      };
      app.createMongoCollection('spies', opts);
      assert(app.collections.spies);
    });
    it('hides private properties on save', function (done) {
      app.collections.spies.create(spy, function (err, savedModel) {
        assert.ifError(err);
        assert.strictEqual(savedModel.codename, spy.codename);
        assert.strictEqual(savedModel.covername, spy.covername);
        assert.strictEqual(savedModel.realname, undefined);
        assert(Object.keys(savedModel).every(function (prop) { return prop !== 'realname'; }));
        spy.id = savedModel.id;
        done();
      });
    });
    it('hides private properties on load', function (done) {
      app.collections.spies.load(spy.id, function (err, loadModel) {
        assert.ifError(err);
        assert.strictEqual(loadModel.codename, spy.codename);
        assert.strictEqual(loadModel.covername, spy.covername);
        assert.strictEqual(loadModel.realname, undefined);
        assert(Object.keys(loadModel).every(function (prop) { return prop !== 'realname'; }));
        done();
      });
    });
    it('hides private properties on list', function (done) {
      app.collections.spies.list(function (err, models) {
        assert.ifError(err);
        assert.equal(models.length, 1);
        assert(models.every(function (model) {
          return Object.keys(model).every(function (prop) { return prop !== 'realname'; });
        }));
        done();
      });
    });
    it('can still hide additional properties', function (done) {
      app.collections.spies.list({ fields: { codename: 0 } }, function (err, models) {
        assert.ifError(err);
        assert.equal(models.length, 1);
        assert(models.every(function (model) {
          return Object.keys(model).every(function (prop) { return prop !== 'realname' && prop !== 'codename'; });
        }));
        done();
      });
    });
    it('can still return only selected properties', function (done) {
      app.collections.spies.list({ fields: { codename: 1 } }, function (err, models) {
        assert.ifError(err);
        assert.equal(models.length, 1);
        assert(models.every(function (model) {
          return Object.keys(model).every(function (prop) { return prop !== 'realname' && prop !== 'covername'; });
        }));
        done();
      });
    });
    it('will not return private properties even if specifically asked to', function (done) {
      app.collections.spies.list({ fields: { realname: 1, codename: 1 } }, function (err, models) {
        assert.ifError(err);
        assert.equal(models.length, 1);
        assert(models.every(function (model) {
          return Object.keys(model).every(function (prop) { return prop !== 'realname' && prop !== 'covername'; });
        }));
        done();
      });
    });
    it('will not return hide required properties even if specifically asked to', function (done) {
      app.collections.spies.list({ fields: { rev: 0, codename: 0 } }, function (err, models) {
        assert.ifError(err);
        assert.equal(models.length, 1);
        assert(models.every(function (model) {
          return ('rev' in model) && Object.keys(model).every(function (prop) { return prop !== 'realname' && prop !== 'codename'; });
        }));
        done();
      });
    });
    it('permits including specified fields but excluding _id', function (done) {
      app.collections.spies.list({ fields: { codename: 1, _id: 0 } }, function (err, models) {
        assert.ifError(err);
        assert.equal(models.length, 1);
        assert(models.every(function (model) {
          return Object.keys(model).every(function (prop) { return prop !== 'realname' && prop !== 'covername' && prop !== '_id'; });
        }));
        done();
      });
    });
  });
});
