'use strict';

require('../spechelper.js');

var assert = require('assert'),
    http = require('http'),
    ew = require('../../src/elasticsearch-wrapper'),
    config = require('../../config.js').Config,
    testData = [
        {index: {_type: 'example', _id: 1}},
        {title: 'This is an example', body: 'It has a title and body'},
        {index: {_type: 'example', _id: 2}},
        {title: 'Another example', user: 1234},
        {index: {_type: 'example', _id: 3}},
        {title: 'Final example', body: 'Broad shoulders and narrow waist', user: 1337}
    ],

    makeParams = function (overrides) {
        return {
            index: overrides.index || 'anIndex',
            q: '_type:' + (overrides.type || 'things'),
            from: overrides.from || 0,
            sort: overrides.sort || '',
            size: overrides.size || 1000,
            body: overrides.body || {}
        };
    };

describe('elasticsearch-wrapper', function () {

    // Create test index and setup wrapper
    before(function (done) {
        var i,
            host = config.db.url.match(/^.*\/([^:]+?):(\d+).*?$/),
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
            });

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

    describe.only('putMapping', function () {
        it('should update the index mapping', function (done) {

        });
    });

    describe('bulk', function () {
        it('should create documents using bulk actions', function (done) {
            var actions = [
                    {index: {_index: 'test', _type: 'example', _id: 1}},
                    {title: 'Test', body: 'Hello World'},
                    {index: {_index: 'test', _type: 'example', _id: 2}},
                    {title: 'Another Test', body: 'I know a bank where the wild thyme blows'}
                ],

                getExamples = function  (response) {
                    assert.equal(response.errors, false);
                    return ew.get([1, 2]).ofType('example').from('test');
                },

                validateResults = function (response) {
                    var expected = {
                        results: [
                            {
                                title: 'Test',
                                body: 'Hello World',
                                id: 1
                            },
                            {
                                title: 'Another Test',
                                body: 'I know a bank where the wild thyme blows',
                                id: 2
                            }
                        ],
                        total: 2
                    };

                    assert.deepEqual(response, expected);
                };

            ew.bulk(actions)
                .then(getExamples)
                .then(validateResults)
                .done(done);
        });
    });

    describe('createAlias', function () {
        it('should create an alias to an index', function (done) {
            var getAlias = function (response) {
                    assert.equal(response.acknowledged, true);
                    return ew.getAlias('test_create_alias');
                },

                validateIndexName = function (indexName) {
                    assert.equal(indexName, config.testIndex);
                };

            ew.createAlias('test_create_alias').to(config.testIndex)
                .then(getAlias)
                .then(validateIndexName)
                .done(done);
        });
    });

    describe('deleteAlias', function () {
        it('should delete an alias on an index', function (done) {
            var deleteAlias = function (response) {
                    assert.equal(response.acknowledged, true);
                    return ew.deleteAlias('test_create_alias').from(config.testIndex);
                },

                validateResponse = function (response) {
                    assert.equal(response.acknowledged, true);
                };

            ew.createAlias('test_create_alias').to(config.testIndex)
                .then(deleteAlias)
                .then(validateResponse)
                .done(done);
        });

        it('should throw an error if the alias doesn\'t exist', function (done) {
            var validateErrorMessage = function (response) {
                assert.equal(
                    response.error.message,
                    'AliasesMissingException[aliases [[does_not_exist]] missing]'
                );
            };

            ew.deleteAlias('does_not_exist').from(config.testIndex)
                .fail(validateErrorMessage)
                .done(done);
        });
    });

    describe('getMapping()', function () {
        it('should return the mappings for all types', function (done) {
            var validateMappingKeys = function (mapping) {
                var keys = Object.keys(mapping);
                assert.equal(keys.length, 1);
                assert.equal(keys[0], 'example');
            };

            ew.getMapping().from(config.testIndex)
                .then(validateMappingKeys)
                .done(done);
        });

        it('should return the mappings for a specific type', function (done) {
            var validateMapping = function (mapping) {
                var keys = Object.keys(mapping),
                    expected = ['body', 'title', 'user'],
                    i;

                assert.equal(keys.length, expected.length);

                for (i = 0; i < expected.length; i += 1) {
                    // is there a better way to do this?
                    assert.notStrictEqual(keys.indexOf(expected[i]), -1);
                }
            };

            ew.getMapping().ofType('example').from(config.testIndex)
                .then(validateMapping)
                .done(done);
        });
    });

    describe('getAlias()', function () {
        it('should return false if the alias doesn\'t exist', function (done) {
            var validateIndexName = function (indexName) {
                assert.strictEqual(indexName, false);
            };

            ew.getAlias('does_not_exist')
                .then(validateIndexName)
                .done(done);
        });

        it('should return the index name the alias points to', function (done) {
            var getAlias = function () {
                    return ew.getAlias('test_get_alias');
                },

                validateIndexName = function (indexName) {
                    assert.equal(indexName, config.testIndex);
                };

            ew.createAlias('test_get_alias').to(config.testIndex)
                .then(getAlias)
                .then(validateIndexName)
                .done(done);
        });
    });

    describe('getAll()', function () {
        it('should have access to the client search function for stubbing', function () {
            var client = ew.getClient();

            expect(client.search).to.be.a.function;
        });

        it('should proxy the client.search function', function () {
            var client = ew.getClient(),
                testParams = {
                    type: 'things',
                    index: 'anIndex'
                },
                resultParams = makeParams(testParams);

            expect(client.search).to.be.a.function;

            sinon.stub(client, 'search');

            ew.getAll(testParams.type).from(testParams.index);

            expect(client.search).to.have.been.calledOnce
                .and.to.have.been.calledWith(resultParams);

            client.search.restore();
        });
    });
});
