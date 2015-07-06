'use strict';

var q = require('q'),
    unique = require('array-unique'),
    elasticsearch = require('elasticsearch'),

    config,
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
        var adaptedResult = result.fields || result._source;

        if (adaptedResult) {
            adaptedResult.id = result.id || result._id;

        } else {
            adaptedResult = result; // assumes the result wasn't a document object
        }

        return adaptedResult;
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
     * Takes an array of ids to return many results. Unlike get(), getMany() does not need a
     * type specified as it is not a simple url api. It behaves more like a post, with data
     * passed to the {host}/_mget url with the -d flag.
     *
     * @see http://www.elastic.co/guide/en/elasticsearch/reference/1.x/docs-multi-get.html
     * @param {array} ids An array of ids to look up
     * @return {promise}
     */
    getMany = function (ids) {
        var typeName;

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
                var params = {
                        'index' : indexName,
                        'type'  : typeName,
                        'body': {
                            'ids': ids
                        }
                    },

                    runMultipleGet = function (resolve, reject) {
                        if (!ids || ids.length === 0) {
                            resolve(emptyResult());

                        } else if (!Array.isArray(ids)) {
                            ids = [ids];
                        }

                        // Ensure that array has only unique ids.
                        // The second boolean parameter is 'isSorted', and runs much faster.
                        ids = unique(ids, true);

                        client.mget(params, function (error, response) {
                            var results;

                            if (error) {
                                reject(adaptError(error));
                                return;
                            }

                            results = adaptResults(response.docs);
                            results.total = results.results.length;
                            resolve(results);
                        });
                    };

                return q.Promise(runMultipleGet);
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
                var runGet = function (resolve, reject) {
                    var params = {
                        'id'    : id,
                        'index' : indexName,
                        'type'  : typeName
                    };

                    if (!typeName) {
                        reject(new TypeError('You must supply a type when calling get()'));
                        return;
                    }

                    client.get(params, function (error, response) {
                        var result;

                        if (error) {
                            reject(adaptError(error));
                            return;
                        }

                        result = adaptResult(response);
                        resolve(result);
                    });
                };

                return q.Promise(runGet);
            }
        };
    };

exports.post = function (postData) {
    var typeName;

    return {
        ofType: function (_typeName) {
            typeName = _typeName;
            return this;
        },

        withId: function (_id) {
            postData.id = _id;
            return this;
        },

        into: function (indexName) {
            var runPost = function (resolve, reject) {
                    var params = {
                        index: indexName,
                        type: typeName,
                        timestamp: (new Date()).toISOString(),
                        body: postData
                    };

                    if (Array.isArray(postData)) {
                        reject(new TypeError('Please use the bulk api to post multiple documents'));
                        return;
                    }

                    if (!postData.createdAt) {
                        postData.createdAt = (new Date()).toISOString();
                    }

                    if (postData.id) {
                        params.id = postData.id;
                    }

                    client.create(params, function (error, response) {
                        if (error) {
                            reject(adaptError(error));
                            return;
                        }

                        resolve(response);
                    });
                };

            return q.Promise(runPost)
                .then(function (response) {
                    return get(response._id).ofType(typeName).from(indexName);
                });
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
            var dslParams = {},

                params = {
                    'index': indexName,
                    'type': typeName,
                    'from': offset,
                    'size': size
                },

                runQuery = function (resolve, reject) {
                    client.search(params, function (error, results) {
                        var response;

                        if (error) {
                            reject(adaptError(error));
                            return;
                        }

                        response = adaptResults(results.hits.hits);
                        response.total = results.hits.total;

                        resolve(response);
                    });
                };

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

            return q.Promise(runQuery);
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
            var params = {
                    'index' : indexName,
                    'type'  : typeName,
                    'from'  : offset,
                    'size'  : size,
                    'sort'  : sort,
                    'q'     : queryString
                },

                runQuery = function (resolve, reject) {
                    client.search(params, function (error, results) {
                        var response;

                        if (error) {
                            reject(adaptError(error));
                            return;
                        }

                        response = adaptResults(results.hits.hits);
                        response.total = results.hits.total;

                        resolve(response);
                    });
                };

            return q.Promise(runQuery);
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
 * @param  {string} typeName
 * @return {promise}
 */
exports.getAll = function (typeName) {
    var filter,
        fields,
        sort = '',
        offset = 0,
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
            var extraParams = {},

                searchParams = {
                    'index' : indexName,
                    'type'  : typeName,
                    'from'  : offset,
                    'sort'  : sort,
                    'size'  : size
                },

                runGetAll = function (resolve, reject) {
                    client.search(searchParams, function (error, results) {
                        var response;

                        if (error) {
                            reject(adaptError(error));
                            return;
                        }

                        response = adaptResults(results.hits.hits);
                        response.total = results.hits.total;

                        resolve(response);
                    });
                };

            if (fields) {
                searchParams.fields = fields;
            }

            if (filter) {
                extraParams.filter = filter;
            }

            searchParams.body = extraParams;

            return q.Promise(runGetAll);
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
            var /**
                 * Loops through the existing data key values and adds any missing from
                 * the data we want to PUT. Then saves to the elasticsearch index.
                 *
                 * @param  {object} existingData The data that exists with the id provided.
                 * @return {promise}             Resolves to an adapted data set.
                 */
                updateExistingData = function (existingData) {
                    data.updatedAt = (new Date()).toISOString();

                    Object.keys(existingData).filter(function (key) {
                        return data[key] === undefined;

                    }).forEach(function (key) {
                        data[key] = existingData[key];
                    });

                    return client.update({
                        'id': data.id,
                        'index': indexName,
                        'type': typeName,
                        'body': {
                            'doc': data
                        }
                    });
                },

                runOperation = function (resolve, reject) {
                    if (!typeName) {
                        reject(new Error('You must specify a type'));
                        return;
                    }

                    // GET the data as it exists now...
                    get(data.id).ofType(typeName).from(indexName)
                        // ...update...
                        .then(updateExistingData)
                        // now GET the data again just to make certain it is written and to
                        // make sure that the actual data returned is the version stored.
                        .then(function (updateResponse) {
                            return get(updateResponse._id).ofType(typeName).from(indexName);
                        })
                        .then(resolve)
                        .catch(function (error) {
                            reject(adaptError(error));
                        });
                };

            return q.Promise(runOperation);
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
            var runDelete = function (resolve, reject) {
                client.delete({
                    index: indexName,
                    type: typeName,
                    id: id
                }, function (error, result) {

                    if (error) {
                        reject(adaptError(error));
                        return;
                    }

                    result = {
                        'results': result.found ? [result._id]: [],
                        'total': result.found ? 1 : 0
                    };

                    resolve(result);
                });
            };

            return q.Promise(runDelete);
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
            return q.Promise(function (resolve, reject) {
                client.deleteByQuery({
                    'index': indexName,
                    'type': typeName,
                    'body': {
                        'query': query
                    }
                }, function (error, result) {
                    var index;

                    if (error) {
                        reject(adaptError(error));
                        return;
                    }

                    if (result._indices.hasOwnProperty(indexName)) {
                        index = indexName;

                    } else {
                        // assumes we're using an alias
                        index = Object.keys(result._indices)[0];
                    }

                    resolve(result._indices[index]._shards);
                });
            });
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
    return q.Promise(function (resolve, reject) {
        client.bulk({
            body: actions
        }, function (error, response) {

            if (error) {
                reject(adaptError(error));
                return;
            }

            resolve(response);
        });
    });
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
            var params = {index: indexName};

            if (type) {
                params.type = type;
            }

            return q.Promise(function (resolve, reject) {
                client.indices.getMapping(params, function (error, response) {
                    if (error) {
                        reject(adaptError(error));
                        return;
                    }

                    response = response[indexName].mappings;

                    if (type) {
                        response = response[type].properties;
                    }

                    resolve(response);
                });
            });
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
            var params = {
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

            return q.Promise(function (resolve, reject) {
                client.indices.putMapping(params, function (error, response) {
                    if (error) {
                        reject(adaptError(error));
                        return;
                    }

                    // client returns {acknowledged: true} on success
                    resolve(response);
                });
            });
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
    var runGetAlias = function (resolve, reject) {
        client.indices.getAlias({
            name: aliasName
        }, function (error, response) {
            if (error) {
                reject(adaptError(error));
                return;
            }

            resolve(Object.keys(response)[0]);
        });
    };

    return q.Promise(runGetAlias);
};

/**
 * Checks an alias exists.
 *
 * @param {string} aliasName
 * @return {object} Promise resolving to true or false;
 */
exports.checkAliasExists = function (aliasName) {
    var runCheckAliasExists = function (resolve, reject) {
        client.indices.existsAlias({
            name: aliasName
        }, function (error, response) {
            if (error) {
                reject(adaptError(error));
                return;
            }

            resolve(response);
        });
    };

    return q.Promise(runCheckAliasExists);
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
            var runDelete = function (resolve, reject) {
                client.indices.deleteAlias({
                    'index': indexName,
                    'name': aliasName
                }, function (error, response) {
                    if (error) {
                        reject(adaptError(error));
                        return;
                    }

                    resolve(response);
                });
            };

            return q.Promise(runDelete);
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
        for: function (indexName) {
            var runCreateAlias = function (resolve, reject) {
                client.indices.putAlias({
                    index: indexName,
                    name: aliasName
                }, function (error, response) {
                    if (error) {
                        reject(adaptError(error));
                        return;
                    }

                    resolve(response);
                });
            };

            return q.Promise(runCreateAlias);
        }
    };
};

exports.checkIndexExists = function (indexName) {
    var runCheckIndexExists = function (resolve, reject) {
        client.indices.exists({
            index: indexName
        }, function (error, response) {
            if (error) {
                reject(adaptError(error));
                return;
            }

            resolve(response);
        });
    };

    return q.Promise(runCheckIndexExists);
};

exports.destroyIndex = function (indexName) {
    var runDestroyIndex = function (resolve, reject) {
        client.indices.delete({
            index: indexName
        }, function (error, response) {
            if (error) {
                reject(adaptError(error));
                return;
            }

            resolve(response);
        });
    };

    return q.Promise(runDestroyIndex);
};

exports.createIndex = function (indexName) {
    var runCreateIndex = function (resolve, reject) {
        client.indices.create({
            index: indexName
        }, function (error, response) {
            if (error) {
                reject(adaptError(error));
                return;
            }

            resolve(response);
        });
    };

    return q.Promise(runCreateIndex);
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
        host: config.url || 'http://localhost:9200'
    };

    if (config.keepAlive !== undefined) {
        clientOptions.keepAlive = config.keepAlive;
    }

    if (config.logging) {
        clientOptions.log = config.logging;
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
    var runCreateTemplate = function (resolve, reject) {
        client.indices.putTemplate({
            name: name,
            body: template
        }, function (error, response) {
            if (error) {
                reject(adaptError(error));
                return;
            }

            resolve(response);
        });
    };

    return q.Promise(runCreateTemplate);
};

/**
 * Delete a template.
 *
 * @param  {string} name Name of the template to delete
 * @return {object} Promise
 */
exports.deleteTemplate = function (name) {
    var runDeleteTemplate = function (resolve, reject) {
        client.indices.deleteTemplate({
            'name': name
        }, function (error, response) {
            if (error) {
                reject(adaptError(error));
                return;
            }

            resolve(response);
        });
    };

    return q.Promise(runDeleteTemplate);
};

/**
 * Get the template data.
 *
 * @param  {string} name Name of the template to get
 * @return {object} Promise
 */
exports.getTemplate = function (name) {
    var runGetTemplate = function (resolve, reject) {
        client.indices.getTemplate({
            'name': name
        }, function (error, response) {
            if (error) {
                reject(adaptError(error));
                return;
            }

            resolve(response);
        });
    };

    return q.Promise(runGetTemplate);
};

// API
exports.get = get;
exports.getMany = getMany;

/**
 * Count only works with a query. Use filtered query to use with filters.
 *
 * @example
 * DB.count(type).that.match(query).from(myIndex);
 */
exports.count = function (type) {
    var query;

    return {
        thatMatch: function (_query) {
            if (_query.filter) {
                throw new TypeError('Use a filtered query with count, not a top level filter');
            }

            query = _query;
            return this;
        },

        from: function (indexName) {
            var searchParams = {},
                extraParams  = {},

                runCount = function (resolve, reject) {
                    client.count(searchParams, function (error, response) {
                        if (error) {
                            reject(adaptError(error));
                            return;
                        }

                        resolve(response.count);
                    });
                };

            if (indexName) {
                searchParams.index = indexName;
            }

            if (type) {
                searchParams.q = '_type:' + type;
            }

            if (query) {
                extraParams.query = query;
            }

            searchParams.body = extraParams;

            return q.Promise(runCount);
        }
    };
};
