var app = require('cantina');

require('cantina-models');
require('cantina-mongo');

app.hook('start').add(function (done) {
  var store = require('./store');
  app.createCollectionFactory('mongo', store, { db: app.mongo });
  done();
});
