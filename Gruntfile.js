'use strict';

module.exports = function (grunt) {

    require('load-grunt-tasks')(grunt);
    require('time-grunt')(grunt);

    grunt.initConfig({
        pkg: grunt.file.readJSON('package.json'),

        clean: {
            all: {
                src: ['.tmp', 'metrics/**/*']
            }
        },

        plato: {
            options: {
                jshint : grunt.file.readJSON('.jshintrc')
            },
            local: {
                files: {
                    'metrics/quality/': ['src/**/*.js', 'test/**/*.js']
                }
            }
        },

        bump: {
            options: {
                files: ['package.json'],
                commit: true,
                commitMessage: 'Release v%VERSION%',
                // commitFiles: [''],
                createTag: true,
                tagName: 'v%VERSION%',
                tagMessage: 'Version %VERSION%',
                push: false,
                pushTo: 'origin',
                gitDescribeOptions: '--tags --always --abbrev=1 --dirty=-d',
                globalReplace: false,
                prereleaseName: false,
                regExp: false
            }
        },

        jshint: {
            app: {
                files: {
                    src: ['Gruntfile.js', 'src/**/*.js', 'test/integration/**/*.js']
                },
                options: {
                    jshintrc: '.jshintrc'
                }
            }
        },

        jscs: {
            files: ['Gruntfile.js', 'test/integration/**/*.js', 'src/**/*.js'],
            options: {
                config: '.jscsrc'
            }
        },

        'mocha_istanbul': {
            integration: {
                src: ['test/integration/**/*.js', '!config.js'],
                options: {
                    slow: 50,
                    timeout: 20000,
                    root: './',
                    coverageFolder: './metrics/coverage-integration'
                }
            }
        }
    });

    grunt.registerTask('metrics', ['plato']);
    grunt.registerTask('lint', ['jshint', 'jscs']);
    grunt.registerTask('test', ['mocha_istanbul']);

    grunt.registerTask('build', [
        'clean:all',
        'lint',
        'test'
    ]);

    grunt.registerTask('travis', ['lint', 'test']);
    grunt.registerTask('default', ['build']);
};
