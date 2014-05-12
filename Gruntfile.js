'use strict';

module.exports = function (grunt) {

    grunt.initConfig({
        pkg: grunt.file.readJSON('package.json'),

        clean: {
            coverage: {
                src: ['dist', 'coverage/test', 'coverage/report.html']
            }
        },

        copy: {
            coverage: {
                src: ['src/**/*.js'],
                dest: 'coverage/test/'
            },
            dist: {
                src: ['src/**'],
                dest: 'dist/'
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

        blanket: {
            coverage: {
                src: ['src/'],
                dest: 'coverage/src/'
            }
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
            },

            coverage: {
                options: {
                    reporter: 'html-cov',
                    // quiet: true,
                    captureFile: 'coverage/report.html'
                },
                src: ['coverage/test/**/*.js']
            }
        }
    });

    grunt.loadNpmTasks('grunt-contrib-jshint');
    grunt.loadNpmTasks('grunt-contrib-clean');
    grunt.loadNpmTasks('grunt-contrib-copy');

    grunt.loadNpmTasks('grunt-jscs-checker');
    grunt.loadNpmTasks('grunt-mocha-test');
    grunt.loadNpmTasks('grunt-blanket');

    grunt.registerTask('test', ['jshint', 'jscs', 'mochaTest']);

    grunt.registerTask('build', ['clean', 'copy:coverage', 'test', 'copy:dist']);

    grunt.registerTask('default', ['build']);
};
