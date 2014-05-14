'use strict';

module.exports = function (grunt) {

    grunt.initConfig({
        pkg: grunt.file.readJSON('package.json'),

        clean: {
            all: {
                src: ['dist', '.tmp', 'coverage/index.html']
            },
            tmp: {
                src: ['.tmp']
            }
        },

        copy: {
            // Copy source files to tmp directory.
            // These will be instrumented in the blanket task.
            coverage: {
                files: [{
                    src: ['spec/**'],
                    dest: '.tmp/coverage/'
                }, {
                    src: ['config.js'],
                    dest: '.tmp/coverage/'
                }]
            },
            dist: {
                cwd: 'src',
                src: '**',
                dest: 'dist/'
            }
        },

        plato: {
            options: {
                jshint : grunt.file.readJSON('.jshintrc')
            },
            local: {
                files: {
                    'quality/': ['src/**/*.js', 'spec/**/*.js']
                }
            }
        },

        jshint: {
            app: {
                files: {
                    src: ['Gruntfile.js', 'src/**/*.js']
                },
                options: {
                    jshintrc: '.jshintrc'
                }
            },
            test: {
                files: {
                    src: ['spec/test/**/*.js']
                },
                options: {
                    jshintrc: 'spec/.jshintrc'
                }
            }
        },

        jscs: {
            files: ['Gruntfile.js', 'spec/test/**/*.js', 'src/**/*.js'],
            options: {
                config: '.jscsrc'
            }
        },

        blanket: {
            coverage: {
                src: ['src/'],
                dest: '.tmp/coverage/src/'
            }
        },

        mochaTest: {
            test: {
                options: {
                    globals: ['expect', 'sinon'],
                    timeout: 3000,
                    ignoreLeaks: false,
                    ui: 'bdd',
                    reporter: 'nyan'
                },

                src: ['spec/test/**/*.js']
            },

            coverage: {
                options: {
                    reporter: 'html-cov',
                    quiet: true,
                    captureFile: 'coverage/index.html'
                },
                src: ['.tmp/coverage/spec/test/**/*.js']
            }
        }
    });

    grunt.loadNpmTasks('grunt-contrib-jshint');
    grunt.loadNpmTasks('grunt-contrib-clean');
    grunt.loadNpmTasks('grunt-contrib-copy');

    grunt.loadNpmTasks('grunt-jscs-checker');
    grunt.loadNpmTasks('grunt-mocha-test');
    grunt.loadNpmTasks('grunt-blanket');

    grunt.loadNpmTasks('grunt-plato');

    grunt.registerTask('code-quality', ['plato']);

    grunt.registerTask('coverage', ['copy:coverage', 'blanket', 'mochaTest:coverage']);

    grunt.registerTask('test', ['jshint', 'jscs', 'mochaTest:test']);

    grunt.registerTask('build', [
        'clean:all',
        'test',
        'coverage',
        'copy:dist',
        'clean:tmp'
    ]);

    grunt.registerTask('default', ['build']);
};