'use strict';

module.exports = function (grunt) {

    grunt.initConfig({
        pkg: grunt.file.readJSON('package.json'),

        clean: {
            all: {
                src: ['.tmp', 'coverage/**/*']
            },
            tmp: {
                src: ['.tmp']
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
                src: 'test/integration/**/*.js',
                options: {
                    slow: 50,
                    timeout: 20000,
                    root: './',
                    coverageFolder: './metrics/coverage-integration'
                }
            }
        }
    });

    grunt.loadNpmTasks('grunt-contrib-jshint');
    grunt.loadNpmTasks('grunt-contrib-clean');
    grunt.loadNpmTasks('grunt-contrib-copy');

    grunt.loadNpmTasks('grunt-jscs-checker');
    grunt.loadNpmTasks('grunt-mocha-istanbul');

    grunt.loadNpmTasks('grunt-plato');

    grunt.registerTask('code-quality', ['plato']);

    grunt.registerTask('coverage', ['mocha_istanbul']);

    grunt.registerTask('test', ['jshint', 'jscs', 'coverage']);

    grunt.registerTask('build', [
        'clean:all',
        'test',
        'coverage',
        'clean:tmp'
    ]);

    grunt.registerTask('travis', ['test']);

    grunt.registerTask('default', ['build']);
};
