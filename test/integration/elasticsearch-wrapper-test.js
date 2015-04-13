'use strict';

/**
 * It has become clear that this must be an integration suite, and not a unit test suite.
 * Therefore, do not stub or mock the elasticsearch.js client, it will not show certain
 * breaking changes nor check the actual result is the expected one 100% of the time.
 */
require('../spec-helper.js');

var assert      = require('assert'),
    q           = require('q'),
    DB          = require('../../src/elasticsearch-wrapper'),
    config      = require('../../config.json'),

    testIndex   = config.tests.indexName,

    testType    = 'example',

    testData    = [
        {index: {_type: testType, _id: 1, _index: testIndex}},
        {title: 'This is an example', body: 'It has a title and body'},
        {index: {_type: testType, _id: 2, _index: testIndex}},
        {title: 'Another example', user: '1234', type: 'lala'},
        {index: {_type: testType, _id: 3, _index: testIndex}},
        {title: 'Final example', body: 'Broad shoulders and narrow waist', user: '1337'}
    ],

    testTemplate = {
        'template': testIndex,
        'settings': {
            'number_of_shards': 1
        },
        'mappings': {
            'example': {
                'properties': {
                    'title': {
                        'type': 'string'
                    },
                    'body': {
                        'type': 'string'
                    },
                    'user': {
                        'type': 'string',
                        'index': 'not_analyzed'
                    }
                }
            }
        }
    },

    wait = function () {
        return q.delay(1500);
    };

describe('elasticsearch-wrapper', function () {

    // The before actually tests the bulk api.
    before(function (done) {
        DB.config(config);

        DB.createIndex(testIndex)
            .then(function () {
                return DB.createTemplate(testIndex, testTemplate);
            })
            .then(function () {
                return DB.bulk(testData);
            })
            .then(function (response) {
                expect(response.errors).to.be.false;
                expect(response.items).to.have.length(3);
            })
            .catch(console.error)
            .tap(wait)
            .done(done);
    });

    // The before actually tests the destroyIndex api.
    after(function (done) {
        DB.destroyIndex(testIndex)
            .then(function (response) {
                expect(response).to.be.deep.equal({
                    'acknowledged': true
                });
            })
            .catch(console.error)
            .done(done);
    });

    describe('putMapping', function () {
        var mapping = {
            'testMappingType': {
                'properties': {
                    'testNestedField': {
                        'properties': {
                            'uuid': {
                                'type': 'string',
                                'index': 'not_analyzed'
                            },
                            'testIntegerField': {
                                'type': 'integer'
                            }
                        }
                    },
                    'testLongField': {
                        'type': 'long'
                    },
                    'testBooleanField': {
                        'type': 'boolean'
                    },
                    'testFloatField': {
                        'type': 'float'
                    },
                    'testDoubleField': {
                        'type': 'double'
                    }
                }
            }
        };

        it('should update the index mapping', function (done) {
            var putMapping,
                result;

            // @todo, these are unit tests and should be moved.
            expect(DB.putMapping).to.be.a('function');

            putMapping = DB.putMapping(mapping);

            expect(putMapping).to.be.an('object')
                .and.to.have.a.property('ofType')
                .that.is.a('function');

            expect(putMapping).to.have.a.property('into')
                .that.is.a('function');

            result = putMapping.ofType('testMappingType').into('test');

            expect(result).to.become({acknowledged: true}).notify(done);
        });
    });

    describe('createAlias()', function () {
        it('should create an alias to an index', function (done) {
            var getAlias = function (response) {
                    assert.equal(response.acknowledged, true);
                    return DB.getAlias('test_create_alias');
                },

                validateIndexName = function (indexName) {
                    assert.equal(indexName, testIndex);
                };

            DB.createAlias('test_create_alias').for(testIndex)
                .then(getAlias)
                .then(validateIndexName)
                .done(done);
        });
    });

    describe('deleteAlias', function () {
        it('should delete an alias on an index', function (done) {
            var deleteAlias = function (response) {
                    assert.equal(response.acknowledged, true);
                    return DB.deleteAlias('test_create_alias').from(testIndex);
                },

                validateResponse = function (response) {
                    assert.equal(response.acknowledged, true);
                };

            DB.createAlias('test_create_alias').for(testIndex)
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

            DB.deleteAlias('does_not_exist').from(testIndex)
                .fail(validateErrorMessage)
                .done(done);
        });
    });

    describe('getMapping()', function () {
        it('should return the mappings for all types', function (done) {
            var validateMappingKeys = function (mapping) {
                var keys = Object.keys(mapping);

                expect(keys).to.have.length(1);

                expect(keys[0]).to.equal(testType);
            };

            DB.getMapping().from(testIndex)
                .then(validateMappingKeys)
                .done(done);
        });

        it('should return the mappings for a specific type', function (done) {
            var validateMapping = function (mapping) {
                var keys = Object.keys(mapping),
                    expected = ['body', 'title', 'user', 'type'];

                expect(keys).to.have.length(expected.length)
                    .and.to.have.members(expected);
            };

            DB.getMapping().ofType(testType).from(testIndex)
                .then(validateMapping)
                .done(done);
        });
    });

    describe('checkAliasExists()', function () {
        it('should return false if the alias doesn\'t exist', function (done) {
            var validateResponse = function (exists) {
                assert.strictEqual(exists, false);
            };

            DB.checkAliasExists('should_not_exist')
                .then(validateResponse)
                .done(done);
        });

        it('should return true if alias exists', function (done) {
            var checkAlias = function () {
                    return DB.checkAliasExists('test_check_alias');
                },

                validateExists = function (exists) {
                    assert.equal(exists, true);
                };

            DB.createAlias('test_check_alias').for(testIndex)
                .then(checkAlias)
                .then(validateExists)
                .done(done);
        });
    });

    describe('getAlias()', function () {
        it('should return false if the alias doesn\'t exist', function (done) {
            var validateErrorMessage = function (error) {
                assert.strictEqual(error.error.message, 'alias [does_not_exist] missing');
            };

            DB.getAlias('does_not_exist')
                .catch(validateErrorMessage)
                .done(done);
        });

        it('should return the index name the alias points to', function (done) {
            var getAlias = function () {
                    return DB.getAlias('test_get_alias');
                },

                validateIndexName = function (indexName) {
                    assert.equal(indexName, testIndex);
                };

            DB.createAlias('test_get_alias').for(testIndex)
                .then(getAlias)
                .then(validateIndexName)
                .done(done);
        });
    });

    describe('get()', function () {
        it('should get a document by id', function (done) {
            var expected = testData[1],

                result = DB.get(1).ofType(testType).from(testIndex);

            expected.id = '1';

            expect(result).to.become(expected)
                .notify(done);
        });

        it('should throw a TypeError when type is not supplied', function (done) {
            var request = DB.get('whatever').from('whoCares?');

            expect(request).to.be.rejectedWith(TypeError)
                .notify(done);
        });
    });

    describe('post()', function () {
        it('should post a document and return the saved document', function (done) {
            var expected = {
                    'title': 'A post success',
                    'body': 'This is a load of hogwash'
                },

                result = DB.post(expected).ofType(testType).into(testIndex);

            // the id property we just added will not have it's value evaluated here.
            expect(result).to.eventually.have.all.keys('id', 'body', 'title');

            expect(result).to.eventually.have.property('title', 'A post success');
            expect(result).to.eventually.have.property('body', 'This is a load of hogwash');

            expect(result).to.eventually.have.property('id')
                .that.is.a('string')
                .notify(done);
        });
    });

    describe('getMany()', function () {
        it('should return an empty well formed result if no ids are supplied', function (done) {
            var expected = {
                    'results': [],
                    'total': 0
                },

                result = DB.getMany().from(testIndex);

            expect(result).to.become(expected)
                .notify(done);
        });

        it('should return all results for ids supplied', function (done) {
            DB.getMany([1, 2, 3]).ofType(testType).from(testIndex)
                .tap(function (response) {
                    expect(response).to.have.all.keys('results', 'total');
                })
                .tap(function (response) {
                    expect(response).to.have.property('total')
                        .that.is.a('number')
                        .that.equals(3);
                })
                .then(function (response) {
                    expect(response).to.have.property('results')
                        .that.is.an('array')
                        .with.length(3);
                })
                .done(done);
        });
    });

    describe('getAll()', function () {
        it('should retrieve all the filtered examples', function (done) {
            var filter = {
                    'bool': {
                        'must': [
                            {
                                'terms': {
                                    'user': ['1234', '1337']
                                }
                            },
                            {
                                'term': {
                                    'type': 'lala'
                                }
                            }
                        ]
                    }
                };

            DB.getAll(testType).filterBy(filter).from(testIndex)
                .then(function (response) {
                    expect(response).to.have.all.keys('results', 'total');

                    expect(response).to.have.property('results')
                        .that.is.an('array')
                        .with.length(1);
                })
                .done(done);
        });

        it('should retrieve all the examples and limit to specified fields with an offset',
            function (done) {
                DB.getAll(testType).fields('title').withOffset(1).size(1).from(testIndex)
                    .tap(function (response) {
                        expect(response).to.have.all.keys('results', 'total');
                    })
                    // Notice that the total is 3...
                    .tap(function (response) {
                        expect(response).to.have.property('total')
                            .that.is.equal(3);
                    })
                    // however the length of the results array is 1, same as the size.
                    .tap(function (response) {
                        expect(response).to.have.property('results')
                            .that.is.an('array')
                            .with.length(1)
                            .with.deep.property('[0]')
                            .that.has.all.keys('id', 'title');
                    })
                    .then(function (response) {
                        expect(response).to.have.deep.property('results[0].title[0]')
                            .that.is.equal('Another example');
                    })
                    .done(done);
            }
        );
    });

    describe('stringQuery()', function () {
        it('should accept a query string without type', function (done) {
            var query = 'title:final',
                result = DB.stringQuery(query).from(testIndex);

            expect(result).to.eventually.have.property('results')
                .that.is.an('array')
                .with.length(1);

            expect(result).to.eventually.have.all.keys('results', 'total')
                .notify(done);
        });

        it('should accept a query string with type', function (done) {
            var query = 'title:example',
                result = DB.stringQuery(query).ofType(testType).from(testIndex);

            expect(result).to.eventually.have.property('results')
                .that.is.an('array')
                .with.length(3)
                .notify(done);
        });

        it('should accept a query string with type and size', function (done) {
            var query = 'title:example',
                result = DB.stringQuery(query).ofType(testType).withSize(1).from(testIndex);

            expect(result).to.eventually.have.property('results')
                .that.is.an('array')
                .with.length(1)
                .notify(done);
        });
    });

    describe('dslQuery()', function () {
        it('should accept the json DSL to query db', function (done) {
            var query = {
                    'term': {
                        'title': 'final'
                    }
                },

                result = DB.dslQuery(query).from(testIndex);

            expect(result).to.eventually.have.property('results')
                .that.is.an('array')
                .with.length(1);

            expect(result).to.eventually.have.all.keys('results', 'total')
                .notify(done);
        });
    });
});
