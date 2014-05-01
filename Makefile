test:
	@./node_modules/.bin/mocha \
		--reporter spec \
		--bail \
		--timeout 5s \
		--require test/_common.js

test-clean:
	@mongo test --eval \
		"var dbs = db.adminCommand('listDatabases'); dbs.databases.forEach(function (db){ print(db.name); })" | \
		env grep cantina-models-mongo-test- | xargs -t -I f mongo f --quiet --eval "void db.dropDatabase();"

.PHONY: test
.PHONY: test-clean
