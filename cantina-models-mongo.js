var app = require('cantina')
  , mongoStore = require('./mongo-store');

require('cantina-models');
require('cantina-mongo');

app.hook('start').add(function (done) {
  app.createCollectionFactory('mongo', mongoStore, { db: app.mongo });
  done();
});
