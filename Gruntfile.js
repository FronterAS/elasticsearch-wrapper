'use strict';

module.exports = function (grunt) {

    grunt.initConfig({
        pkg: grunt.file.readJSON('package.json'),

        clean: {
            coverage: {
                src: ['dist', 'coverage/report.html']
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
                    src: ['test/**/*.js']
                },
                options: {
                    jshintrc: 'test/.jshintrc'
                }
            }
        },

        jscs: {
            files: ['Gruntfile.js', 'test/**/*.js', 'src/**/*.js'],
            options: {
                config: '.jscsrc'
            }
        },

        coverage: {
            options: {
                reporter: 'html-cov',
                // use the quiet flag to suppress the mocha console output
                quiet: true,
                // specify a destination file to capture the mocha
                // output (the quiet option does not suppress this)
                captureFile: 'coverage/report.html'
            },
            src: ['test/test.js']
        },

        mochaTest: {
            test: {
                options: {
                    globals: ['expect', 'sinon'],
                    timeout: 3000,
                    ignoreLeaks: false,
                    ui: 'bdd',
                    reporter: 'nyan',
                    require: 'coverage/blanket'
                },

                src: ['test/spechelper.js', 'test/test.js']
            }
        }
    });

    grunt.loadNpmTasks('grunt-contrib-jshint');
    grunt.loadNpmTasks('grunt-contrib-clean');
    grunt.loadNpmTasks('grunt-contrib-copy');

    grunt.loadNpmTasks('grunt-jscs-checker');
    grunt.loadNpmTasks('grunt-mocha-test');
    grunt.loadNpmTasks('grunt-blanket-mocha');

    grunt.registerTask('test', ['jshint', 'jscs', 'mochaTest']);

    grunt.registerTask('build', ['test']);

    grunt.registerTask('default', ['build']);
};
