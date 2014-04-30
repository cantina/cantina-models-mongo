var app = require('cantina')
  , mongoStore = require('./lib/mongo-store');

require('cantina-models');
require('cantina-mongo');

app.createCollectionFactory('mongo', mongoStore, { db: app.mongo });
