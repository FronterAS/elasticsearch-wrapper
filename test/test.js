'use strict';

var assert = require('assert'),
    http = require('http'),
    ew = require('../elasticsearch-wrapper'),
    config = require('../config.js').Config,
    testData = [
        { index: { _type: 'example', _id: 1 } },
        { title: 'This is an example', body: 'It has a title and body' },
        { index: { _type: 'example', _id: 2 } },
        { title: 'Another example', user: 1234 },
        { index: { _type: 'example', _id: 3 } },
        { title: 'Final example', body: 'Broad shoulders and narrow waist', user: 1337 }
    ];

describe('elasticsearch-wrapper', function (){

    // Create test index and setup wrapper
    before(function (done) {
        var host = config.db.url.match(/^.*\/([^:]+?):(\d+).*?$/),
            options = {
                hostname: host[1],
                port: host[2],
                path: '/' + config.testIndex + '/_bulk',
                method: 'PUT'
            },
            request = http.request(options, function (response) {
                response.on('data', function () {
                    ew.config(config);
                    done();
                });
            }),
            i;

        request.on('error', function (e) {
            throw new Error('HTTP error: ' + e.message);
        });

        for (i = 0; i < testData.length; i += 1) {
            request.write(JSON.stringify(testData[i]) + '\n');
        }

        request.end();
    });

    // Remove test index
    after(function (done) {
        var host = config.db.url.match(/^.*\/([^:]+?):(\d+).*?$/),
            options = {
                hostname: host[1],
                port: host[2],
                path: '/' + config.testIndex,
                method: 'DELETE'
            },
            request = http.request(options, function () {
                done();
            });
            request.end();
    });

    describe('#createAlias', function () {
        it('should create an alias to an index', function (done) {
            ew.createAlias('test_create_alias').to(config.testIndex)
                .then(function (response) {
                    assert.equal(response.acknowledged, true);
                    return ew.getAlias('test_create_alias');
                })
                .then(function (indexName) {
                    assert.equal(indexName, config.testIndex);
                    done();
                });
        });
    });

    describe('#deleteAlias', function () {
        it('should delete an alias on an index', function (done) {
            ew.createAlias('test_create_alias').to(config.testIndex)
                .then(function () {
                    return ew.deleteAlias('test_create_alias').from(config.testIndex);
                })
                .then(function (response) {
                    assert.equal(response.acknowledged, true);
                    done();
                });
        });

        it('should throw an error if the alias doesn\'t exist', function (done) {
            ew.deleteAlias('does_not_exist').from(config.testIndex)
                .fail(function (response) {
                    assert.equal(response.error.message,
                        'AliasesMissingException[aliases [[does_not_exist]] missing]');
                    done();
                });
        });
    });

    describe('#getMapping()', function () {
        it('should return the mappings for all types', function (done) {
            ew.getMapping().from(config.testIndex)
                .then(function (mapping) {
                    var keys = Object.keys(mapping);
                    assert.equal(keys.length, 1);
                    assert.equal(keys[0], 'example');
                    done();
                });
        });

        it('should return the mappings for a specific type', function (done) {
            ew.getMapping().ofType('example').from(config.testIndex)
                .then(function (mapping) {
                    var keys = Object.keys(mapping),
                        expected = ['body', 'title', 'user'],
                        i;

                    assert.equal(keys.length, expected.length);
                    for (i = 0; i < expected.length; i += 1) {
                        // is there a better way to do this?
                        assert.notStrictEqual(keys.indexOf(expected[i]), -1);
                    }

                    done();
                });
        });
    });

    describe('#getAlias()', function() {
        it('should return false if the alias doesn\'t exist', function (done) {
            ew.getAlias('does_not_exist')
                .then(function (indexName) {
                    assert.strictEqual(indexName, false);
                    done();
                });
        });

        it('should return the index name the alias points to', function (done) {
            ew.createAlias('test_get_alias').to(config.testIndex)
                .then(function () {
                    return ew.getAlias('test_get_alias');
                })
                .then(function (indexName) {
                    assert.equal(indexName, config.testIndex);
                    done();
                });
        });
    });

});
