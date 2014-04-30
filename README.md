elasticsearch-wrapper
======================

A wrapper around the elasticsearch module to provide promise based workflow and a readable syntax.

## Getting started

Add the dependency to your package.json
```json
"dependencies": {
  "elasticsearch-wrapper": "git://github.com/FronterAS/elasticsearch-wrapper.git#master"
}
```

## Usage

To use the wrapper, you first need to setup the config parameters, which at its barest requires a URL to the ElasticSearch instance.

```js
var DB = require('elasticsearch-wrapper');

DB.config({
    db: {
        url: 'http://localhost:9200'
    }
});
```

The ElasticSearch wrapper depends heavily on chaining method calls to perform actions with the last method (which performs the actual action) returning a promise.

```js
var query = { match: { body: 'test' } },
    filter = { term: { user: 1337 } };

// Query for articles filtered by user
DB.query(query).ofType('article').filterBy(filter).from('my_index')
    .done(function (response) {
        console.log('Fetched ' + response.results.length + ' articles');
    }, function (response) {
        console.log('ElasticSearch Error: ' + response.error.message);
    });
```

## Testing

First, duplicate the **test/config.json.example** file and make relevant changes that apply to your system.

```bash
cp config.js.example config.js
```

Then the tests can be run using [Mocha](http://visionmedia.github.io/mocha/).

```bash
mocha
```

You can also use [JSHint](http://jshint.com/) to check if the code complies with the standard.

```bash
jshint elasticsearch-wrapper.js
```
