'use strict';

var q = require('q'),
    _ = require('lodash'),

    config,

    elasticsearch = require('elasticsearch'),
    client,

    adaptResult = function (result) {
        var _result = result._source;
        _result.id = result._id;

        return _result;
    },

    adaptResults = function (results) {
        results = _.map(results, function (result) {
            return adaptResult(result);
        });

        return results;
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
                var defer = q.defer(),
                    options = null;

                promises.push(defer.promise);

                if (!item.createdAt) {
                    item.createdAt = JSON.parse(
                        JSON.stringify(new Date())
                    );
                }

                options = {
                    index: indexName,
                    type: typeName,
                    timestamp: (new Date()).toISOString(),
                    body: item
                };

                if (item.id) {
                    options.id = item.id
                }

                client.create(
                    options,
                    function (error, response) {
                        if (error) {
                            defer.reject(error);
                            return;
                        }
                        client.get({
                            index: indexName,
                            type: typeName,
                            id: response._id
                        }, function (error, result) {
                            if (error) {
                                defer.reject(error);
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


exports.query = function (queryString) {
    var typeName,
        offset = 0,
        sort = '',
        // results to return
        size = 1000000;

    return {
        of: function (_typeName) {
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
            var defer = q.defer();

            if (!typeName) {
                defer.reject(new Error('Type name must be supplied'));
            }

            client.search({
                index: indexName,
                q: queryString,
                from: offset,
                size: size,
                sort: sort
            }, function (error, results) {
                var response;
                if (error) {
                    defer.reject(error);
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
 * Use to retrieve all results of [type] from [index].
 *
 * @param  {string} type
 * @return {promise}
 */
exports.getAll = function (type) {
    var offset = 0,
        sort = '',
        size = 1000;

    return {
        withOffset: function (_offset) {
            offset = _offset;
            return this;
        },

        size: function (_size) {
            size = _size;
            return this;
        },

        /**
         * @param String _sort A comma-separated list of <field>:<direction>
         *                      pairs
         * @TODO: validate _sort
         */
        sortBy: function (_sort) {
            sort = _sort;
            return this;
        },
        from: function (indexName) {
            var defer = q.defer();

            if (!type) {
                // @TODO: if we ever actually need 'types' as a array, check
                // back in git history.
                defer.reject(new Error('Type must be supplied'));
            }

            client.search({
                index: indexName,
                q: '_type:' + type,
                from: offset,
                sort: sort,
                size: size
            }, function (error, results) {
                var response;
                if (error) {
                    defer.reject(error);
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
            var promises = [],
                defer = q.defer();

            promises.push(defer.promise);

            if (!typeName) {
                defer.reject(new Error('You must specify a type'));
                return;
            }

            client.get({
                index: indexName,
                type: typeName,
                id: data.id
            }, function (error, response) {
                if (error) {
                    // if it didn't find it, do a est.post?
                    defer.reject(error);
                    return;
                }

                data.updatedAt = JSON.parse(
                    JSON.stringify(new Date())
                );

                _.forEach(response._source, function (value, name) {
                    if (!data[name]) {
                        data[name] = value;
                    }
                });

                client.update({
                    index: indexName,
                    type: typeName,
                    id: data.id,
                    body: {
                        doc: data
                    }
                }, function (error, response) {
                    if (error) {
                        defer.reject(error);
                        return;
                    }
                    client.get({
                        index: indexName,
                        type: typeName,
                        id: response._id
                    }, function (error, response) {
                        var result;

                        if (error) {
                            defer.reject(error);
                            return;
                        }

                        result = adaptResult(response);
                        defer.resolve(result);
                    });
                });
            });

            if (data.length === 1) {
                return promises[0];
            }
            return q.all(promises);
        }
    };
};


/**
 * Delete type from index.
 * @example
 * db.delete('myType').withId(5).from('myIndex');
 * // 'withId' param is the id to delete.
 * // 'from' param is the string name of the index to delete from.
 *
 * @param  {string} typeName The name of the type to delete.
 * @return {object}
 */
exports.delete = function (typeName) {
    var id;
    return {
        withId: function (_id) {
            id = _id;
            return this;
        },
        from: function (indexName) {
            var defer = q.defer();
            client.delete({
                index: indexName,
                type: typeName,
                id: id
            }, function (error, response) {
                if (error) {
                    defer.reject(error);
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
            defer.reject(error);
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
            defer.reject(error);
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
            defer.reject(error);
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
    if (!_config) {
        return config;
    }

    config = _config;

    client = new elasticsearch.Client({
        host: config.db.url
    });

    return config;
};
