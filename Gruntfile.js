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
                src: ['src/**/*.js'],
                dest: '.tmp/test/'
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
                dest: '.tmp/src/'
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

                src: ['test/spechelper.js', 'test/test.js']
            },

            coverage: {
                options: {
                    reporter: 'html-cov',
                    quiet: true,
                    captureFile: 'coverage/index.html'
                },
                src: ['.tmp/test/**/*.js']
            }
        }
    });

    grunt.loadNpmTasks('grunt-contrib-jshint');
    grunt.loadNpmTasks('grunt-contrib-clean');
    grunt.loadNpmTasks('grunt-contrib-copy');

    grunt.loadNpmTasks('grunt-jscs-checker');
    grunt.loadNpmTasks('grunt-mocha-test');
    grunt.loadNpmTasks('grunt-blanket');

    grunt.registerTask('coverage', ['copy:coverage', 'mochaTest:coverage']);

    grunt.registerTask('test', ['jshint', 'jscs', 'mochaTest:test']);

    grunt.registerTask('build', ['clean:all', 'test', 'coverage', 'copy:dist', 'clean:tmp']);

    grunt.registerTask('default', ['build']);
};
