elasticsearch-wrapper
======================

A wrapper around the elasticsearch module to provide promise based workflow and a readable syntax.

## Getting started

Add the dependency to your package.json
```
"dependencies": {
  "elasticsearch-wrapper": "git://github.com/FronterAS/elasticsearch-wrapper.git#master"
}
```

## Usage

The ElasticSearch wrapper depends heavily on chaining method calls to perform actions with the last method which performs the actual action returning a promise.

```js
var DB = require('elasticsearch-wrapper'),
    query = { term: { username: "bob" } };

DB.query(query).ofType('user').from('myindex')
    .then(function (users) {
        console.log('Fetched ' + users.results.length + ' users');
    });
```

## Testing

Testing is done using [Mocha](http://visionmedia.github.io/mocha/) and, once it is installed, is done by simply calling `mocha` in the root directory.

```bash
mocha
```

You can also use [JSHint](http://jshint.com/) to check if the code complies with the standard.

```bash
jshint elasticsearch-wrapper.js
```
