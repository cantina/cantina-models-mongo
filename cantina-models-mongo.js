module.exports = function (app) {
  var mongoStore = app.require('./lib/mongo-store');

  app.require('cantina-models');
  app.require('cantina-mongo');

  app.createCollectionFactory('mongo', mongoStore, { db: app.mongo });
};
