'use strict';

var q = require('q'),
    unique = require('array-unique'),

    config,

    elasticsearch = require('elasticsearch'),
    client,

    /**
     * Looks for an error property and if it doesn't exist creates one.
     *
     * @param  {object} error An elasticsearch response containing an error message.
     * @return {object}       The adapted error.
     */
    adaptError = function (error) {
        if (error && !error.error) {
            error = {
                'error': error
            };
        }

        return error;
    },

    adaptResult = function (result) {
        var _result = result.fields || result._source;

        if (_result) {
            _result.id = result.id || result._id;

        } else {
            _result = result; // assumes the result wasn't a document object
        }

        return _result;
    },

    adaptResults = function (results) {
        return {
            'results': results.map(adaptResult)
        };
    },

    emptyResult = function () {
        return {
            'results': [],
            'total': 0
        };
    },

    /**
     * Takes an array of ids to return many results.
     *
     * @param {array} ids An array of ids to look up
     * @return {promise}
     */
    getMany = function (ids) {
        var typeName;

        if (!Array.isArray(ids)) {
            ids = [ids];
        }

        return {
            /**
             * @param  {string} _typeName
             * @return {string}
             */
            'ofType': function (_typeName) {
                typeName = _typeName;
                return this;
            },

            'from': function (indexName) {
                var defer = q.defer();

                if (!ids.length) {
                    return emptyResult();
                }

                // Ensure that array has only unique ids.
                // The second boolean parameter is 'isSorted', and runs much faster.
                ids = unique(ids, true);

                client.mget({
                    'index': indexName,
                    'type': typeName,
                    'body': {
                        'ids': ids
                    }
                }, function (error, response) {
                    var results;

                    if (error) {
                        defer.reject(adaptError(error));
                        return;
                    }

                    results = adaptResults(response.docs);
                    results.total = results.results.length;
                    defer.resolve(results);
                });

                return defer.promise;
            }
        };
    },

    /**
     * The most basic GET functionality.
     *
     * @param  {string} id The id of the record you wish to retrieve.
     * @return {object}    The chainable functionality used to build the sentence.
     */
    get = function (id) {
        var typeName;

        if (Array.isArray(id)) {
            return getMany(id);
        }

        return {
            /**
             * @param  {string} _typeName
             * @return {string}
             */
            'ofType': function (_typeName) {
                typeName = _typeName;
                return this;
            },

            'from': function (indexName) {
                var defer = q.defer();

                client.get({
                    'index': indexName,
                    'type': typeName,
                    'id': id
                }, function (error, response) {
                    var result;

                    if (error) {
                        defer.reject(adaptError(error));
                        return;
                    }

                    result = adaptResult(response);
                    defer.resolve(result);
                });

                return defer.promise;
            }
        };
    };

exports.post = function (data) {
    var typeName;

    if (!Array.isArray(data)) {
        data = [data];
    }

    return {
        ofType: function (_typeName) {
            typeName = _typeName;
            return this;
        },

        into: function (indexName) {
            var promises = [],
                errorDefer;

            if (!typeName) {
                errorDefer = q.defer();
                errorDefer.reject(new Error('You must specify a type'));
                return errorDefer.promise;
            }

            data.forEach(function (item) {
                var params,
                    defer = q.defer();

                promises.push(defer.promise);

                if (!item.createdAt) {
                    item.createdAt = (new Date()).toISOString();
                }

                params = {
                    index: indexName,
                    type: typeName,
                    timestamp: (new Date()).toISOString(),
                    body: item
                };

                if (item.id) {
                    params.id = item.id;
                }

                client.create(
                    params,
                    function (error, response) {
                        if (error) {
                            defer.reject(adaptError(error));
                            return;
                        }
                        client.get({
                            index: indexName,
                            type: typeName,
                            id: response._id
                        }, function (error, result) {
                            if (error) {
                                defer.reject(adaptError(error));
                                return;
                            }
                            result = adaptResult(result);
                            defer.resolve(result);
                        });
                    }
                );
            });

            if (data.length === 1) {
                return promises[0];
            }

            return q.all(promises);
        }
    };
};

/**
 * For use with the elasticsearch dsl query structure.
 *
 * @param  {object} dslQuery
 * @return {object}
 */
exports.dslQuery = function (dslQuery) {
    var typeName,
        offset = 0,
        sort,
        filter,
        // results to return
        size = 1000000;

    return {
        ofType: function (_typeName) {
            typeName = _typeName;
            return this;
        },

        withOffset: function (_offset) {
            offset = _offset;
            return this;
        },

        filterBy: function (_filter) {
            filter = _filter;
            return this;
        },

        sortBy: function (_sort, direction) {
            var sortOption = {};

            sort = sort || [];

            sortOption[_sort] = {
                'order': direction
            };

            sort.push(sortOption);
            return this;
        },

        withSize: function (_size) {
            size = _size;
            return this;
        },

        from: function (indexName) {
            var defer = q.defer(),
                params = {
                    index: indexName,
                    type: typeName,
                    from: offset,
                    size: size
                },
                dslParams = {};

            if (sort) {
                dslParams.sort = sort;
            }

            if (dslQuery) {
                dslParams.query = dslQuery;
            }

            if (filter) {
                dslParams.filter = filter;
            }

            params.body = dslParams;

            client.search(params, function (error, results) {
                var response;

                if (error) {
                    defer.reject(adaptError(error));
                    return;
                }

                response = adaptResults(results.hits.hits);
                response.total = results.hits.total;
                defer.resolve(response);
            });

            return defer.promise;
        }
    };
};

/**
 * For use with the elasticsearch url query string.
 *
 * @param  {string} queryString
 * @return {object}
 */
exports.stringQuery = function (queryString) {
    var typeName,
        offset = 0,
        sort = [],
        // results to return
        size = 1000000;

    return {
        ofType: function (_typeName) {
            typeName = _typeName;
            return this;
        },

        withOffset: function (_offset) {
            offset = _offset;
            return this;
        },

        sortBy: function (_sort) {
            sort = _sort;
            return this;
        },

        withSize: function (_size) {
            size = _size;
            return this;
        },

        from: function (indexName) {
            var defer = q.defer(),
                params = {
                    index: indexName,
                    type: typeName,
                    from: offset,
                    size: size,
                    sort: sort,
                    q: queryString
                };

            client.search(params, function (error, results) {
                var response;

                if (error) {
                    defer.reject(adaptError(error));
                    return;
                }

                response = adaptResults(results.hits.hits);
                response.total = results.hits.total;
                defer.resolve(response);
            });

            return defer.promise;
        }
    };
};

/**
 * Convenience function. Depending on whether the query passed as a parameter is an object or a
 * string depends on which query function is called.
 *
 * @param  {string|object} query Accepts both url string query and dsl object query.
 * @return {object}
 */
exports.query = function (query) {
    if (typeof query === 'string') {
        return exports.stringQuery(query);
    }

    return exports.dslQuery(query);
};

/**
 * Use to retrieve all results of [type] from [index].
 *
 * @param  {string} type
 * @return {promise}
 */
exports.getAll = function (type) {
    var offset = 0,
        sort = '',
        filter,
        fields,
        size = 1000;

    return {
        withOffset: function (_offset) {
            offset = _offset;
            return this;
        },

        fields: function (_fields) {
            fields = _fields;
            return this;
        },

        size: function (_size) {
            size = _size;
            return this;
        },

        filterBy: function (_filter) {
            filter = _filter;
            return this;
        },

        /**
         * @param {string} _sort A comma-separated list of <field>:<direction> pairs
         * @TODO: validate _sort
         */
        sortBy: function (_sort) {
            sort = _sort;
            return this;
        },

        from: function (indexName) {
            var defer = q.defer(),
                searchParams = {
                    index: indexName,
                    q: '_type:' + type,
                    from: offset,
                    sort: sort,
                    size: size
                },
                extraParams = {};

            if (!type) {
                // @TODO: if we ever actually need 'types' as a array, check
                // back in git history.
                defer.reject(new Error('Type must be supplied'));
            }

            if (fields) {
                searchParams.fields = fields;
            }

            if (filter) {
                extraParams.filter = filter;
            }

            searchParams.body = extraParams;

            client.search(searchParams, function (error, results) {
                var response;

                if (error) {
                    defer.reject(adaptError(error));
                    return;
                }

                response = adaptResults(results.hits.hits);
                response.total = results.hits.total;
                defer.resolve(response);
            });

            return defer.promise;
        }
    };
};

/**
 * PUT data to the supplied index. Used to update existing data.
 *
 * @param  {object} data The data to update.
 * @return {object}
 */
exports.put = function (data) {
    var typeName;

    return {

        ofType: function (_typeName) {
            typeName = _typeName;
            return this;
        },

        withId: function (_id) {
            data.id = _id;
            return this;
        },

        into: function (indexName) {
            var defer = q.defer(),

                /**
                 * Loops through the existing data key values and adds any missing from
                 * the data we want to PUT. Then saves to the elasticsearch index.
                 *
                 * @param  {object} existingData The data that exists with the id provided.
                 * @return {promise}             Resolves to an adapted data set.
                 */
                updateExistingData = function (existingData) {
                    data.updatedAt = (new Date()).toISOString();

                    Object.keys(existingData._source).forEach(function (key) {
                        if (data[key] === undefined) {
                            data[key] = existingData._source[key];
                        }
                    });

                    return client.update({
                        'id': data.id,
                        'index': indexName,
                        'type': typeName,
                        'body': {
                            'doc': data
                        }
                    });
                };

            if (!typeName) {
                defer.reject(new Error('You must specify a type'));
                return;
            }

            // GET the data as it exists now...
            exports.get(data.id).ofType(typeName).from(indexName)
                // ...update...
                .then(updateExistingData)
                // now GET the data again just to make certain it is written and to
                // make sure that the actual data now stored is returned.
                .then(function (updateResponse) {
                    return exports.get(updateResponse._id).ofType(typeName).from(indexName);
                })
                .then(function (updatedData) {
                    defer.resolve(updatedData);
                })
                .fail(function (error) {
                    defer.reject(adaptError(error));
                });

            return defer.promise;
        }
    };
};

/**
 * Delete document from index.
 * @example
 * db.delete(id).ofType(type).from('myIndex');
 * // 'ofType' param is the type to delete.
 * // 'from' param is the string name of the index to delete from.
 *
 * @param  {string} id ID of the document
 * @return {object}
 */
exports.deleteById = function (id) {
    var typeName;

    return {
        ofType: function (_typeName) {
            typeName = _typeName;
            return this;
        },

        from: function (indexName) {
            var defer = q.defer();

            client.delete({
                index: indexName,
                type: typeName,
                id: id
            }, function (error, result) {

                if (error) {
                    defer.reject(adaptError(error));
                    return;
                }

                result = {
                    'results': result.found ? [result._id]: [],
                    'total': result.found ? 1 : 0
                };

                defer.resolve(result);
            });

            return defer.promise;
        }
    };
};

exports.deleteByQuery = function (query) {
    var typeName;

    return {
        ofType: function (_typeName) {
            typeName = _typeName;
            return this;
        },

        from: function (indexName) {
            var defer = q.defer();

            client.deleteByQuery({
                'index': indexName,
                'type': typeName,
                'body': {
                    'query': query
                }
            }, function (error, result) {
                var index;

                if (error) {
                    defer.reject(adaptError(error));
                    return;
                }

                if (result._indices.hasOwnProperty(indexName)) {
                    index = indexName;
                } else {
                    // assumes we're using an alias
                    index = Object.keys(result._indices)[0];
                }

                defer.resolve(result._indices[index]._shards);
            });

            return defer.promise;
        }
    };
};

exports.delete = function (query) {
    if (typeof query === 'string') {
        return exports.deleteById(query);
    }

    return exports.deleteByQuery(query);
};

/**
 * Bulk perform actions.
 *
 * @param {array} actions
 * @return {object} Promise which resolves with the response from ElasticSearch
 */
exports.bulk = function (actions) {
    var defer = q.defer();

    client.bulk({
        body: actions
    }, function (error, response) {
        if (error) {
            defer.reject(adaptError(error));
        } else {
            defer.resolve(response);
        }
    });

    return defer.promise;
};

/**
 * Get the mapping of an index.
 *
 * @return {object} Object containing methods to filter or perform the request
 */
exports.getMapping = function () {
    var type;

    return {
        ofType: function (_type) {
            type = _type;
            return this;
        },

        from: function (indexName) {
            var defer = q.defer(),
                params = {index: indexName};

            if (type) {
                params.type = type;
            }

            client.indices.getMapping(params, function (error, response) {
                if (error) {
                    defer.reject(adaptError(error));
                    return;
                }

                response = response[indexName].mappings;

                if (type) {
                    response = response[type].properties;
                }

                defer.resolve(response);
            });

            return defer.promise;
        }
    };
};

/**
 * Add a type mapping to an index.
 *
 * @param {object} mapping
 * @return {object} Object containing methods to filter or perform the request
 */
exports.putMapping = function (mapping) {
    var type;

    return {
        ofType: function (_type) {
            type = _type;
            return this;
        },

        into: function (indexName) {
            var defer = q.defer(),

                params = {
                    index: indexName,
                    type: type
                };

            if (!indexName) {
                throw new Error('indexName must be supplied to put mapping');
            }

            if (!type) {
                throw new Error('type must be supplied to put mapping');
            }

            params.body = mapping;

            client.indices.putMapping(params, function (error, response) {
                if (error) {
                    defer.reject(adaptError(error));
                    return;
                }

                // client returns {acknowledged: true} on success
                defer.resolve(response);
            });

            return defer.promise;
        }
    };
};

/**
 * Get an alias, providing the index the alias points to (or false if the alias doesn't exist).
 *
 * @param {string} aliasName Name of the alias to get
 * @return {object} Promise which resolves with the index name (or false if it doesn't exist)
 */
exports.getAlias = function (aliasName) {
    var defer = q.defer();

    client.indices.getAlias({
        name: aliasName
    }, function (error, response) {
        if (error) {
            defer.resolve(false);
        } else {
            defer.resolve(Object.keys(response)[0]);
        }
    });

    return defer.promise;
};

/**
 * Delete an alias from an index.
 *
 * @param {string} aliasName Name of the alias to delete
 * @return {object} Object containing method to specify index
 */
exports.deleteAlias = function (aliasName) {
    return {
        from: function (indexName) {
            var defer = q.defer();

            client.indices.deleteAlias({
                index: indexName,
                name: aliasName
            }, function (error, response) {
                if (error) {
                    defer.reject(adaptError(error));
                    return;
                }

                defer.resolve(response);
            });

            return defer.promise;
        }
    };
};

/**
 * Create an alias to an index.
 *
 * @param {string} aliasName Name of the alias to create
 * @return {object} Object containing method to specify index
 */
exports.createAlias = function (aliasName) {
    return {
        to: function (indexName) {
            var defer = q.defer();

            client.indices.putAlias({
                index: indexName,
                name: aliasName
            }, function (error, response) {
                if (error) {
                    defer.reject(adaptError(error));
                    return;
                }

                defer.resolve(response);
            });

            return defer.promise;
        }
    };
};

exports.checkIndexExists = function (indexName) {
    var defer = q.defer();

    client.indices.exists({
        index: indexName
    }, function (error, response) {
        if (error) {
            defer.reject(adaptError(error));
            return;
        }

        defer.resolve(response);
    });

    return defer.promise;
};

exports.destroyIndex = function (indexName) {
    var defer = q.defer();

    client.indices.delete({
        index: indexName
    }, function (error, response) {
        if (error) {
            defer.reject(adaptError(error));
            return;
        }

        defer.resolve(response);
    });

    return defer.promise;
};

exports.createIndex = function (indexName) {
    var defer = q.defer();

    client.indices.create({
        index: indexName
    }, function (error, response) {
        if (error) {
            defer.reject(adaptError(error));
            return;
        }

        defer.resolve(response);
    });

    return defer.promise;
};

/**
 * Sets the configuration for the location of the database. Acts as a getter and a setter.
 *
 * @see config.js.example
 * @param  {object} _config The configuration object.
 * @return {object|undefined}         The configuration object.
 */
exports.config = function (_config) {
    var clientOptions;

    if (!_config) {
        return config;
    }

    config = _config;

    clientOptions = {
        host: config.db.url || 'http://localhost:9200'
    };

    if (config.db.keepAlive !== undefined) {
        clientOptions.keepAlive = config.db.keepAlive;
    }

    if (config.db.logging) {
        clientOptions.log = config.db.logging;
    }

    // @todo: dependency injection needed here
    client = new elasticsearch.Client(clientOptions);

    return config;
};

/**
 * Given a name and a template, it will save it to the es templates.
 * For more info on how and why to use templates refer to the docs.
 *
 * @param {string} name name of the template.
 * @param {string} template the json template as a string.
 * @return {object} promise
 */
exports.createTemplate = function (name, template) {
    var defer = q.defer();

    client.indices.putTemplate({
        name: name,
        body: template
    }, function (error, response) {
        if (error) {
            defer.reject(adaptError(error));
            return;
        }

        defer.resolve(response);
    });

    return defer.promise;
};

/**
 * Delete a template.
 *
 * @param  {string} name Name of the template to delete
 * @return {object} Promise
 */
exports.deleteTemplate = function (name) {
    var defer = q.defer();

    client.indices.deleteTemplate({
        name: name
    }, function (error, response) {
        if (error) {
            defer.reject(adaptError(error));
            return;
        }

        defer.resolve(response);
    });

    return defer.promise;
};

/**
 * Get the template data.
 *
 * @param  {string} name Name of the template to get
 * @return {object} Promise
 */
exports.getTemplate = function (name) {
    var defer = q.defer();

    client.indices.getTemplate({
        name: name
    }, function (error, response) {
        if (error) {
            defer.reject(adaptError(error));
            return;
        }

        defer.resolve(response);
    });

    return defer.promise;
};

// API
exports.get = get;
exports.getMany = getMany;

/**
 * Allows for easy stubbing in unit tests.
 * @return {object} The elasticsearch.js client
 */
exports.getClient = function () {
    return client;
};

/**
 * Count only works with a query. Use filtered query to use with filters.
 *
 * @example
 * DB.count(type).that.match(query).from(myIndex);
 */
exports.count = function (type) {
    var query;

    return {
        that: function () {
            return this;
        },

        match: function (_query) {
            query = _query;
            return this;
        },

        from: function (indexName) {
            var defer        = q.defer(),
                searchParams = {},
                extraParams  = {};

            if (indexName) {
                searchParams.index = indexName;
            }

            if (type) {
                searchParams.q = '_type:' + type
            }

            if (query) {
                extraParams.query = query;
            }

            searchParams.body = extraParams;

            client.count(searchParams, function (error, results) {
                var response;

                console.log(error || results);

                if (error) {
                    defer.reject(adaptError(error));
                    return;
                }

                response = adaptResults(results.hits.hits);
                response.total = results.hits.total;
                defer.resolve(response);
            });

            return defer.promise;
        }
    };
};
