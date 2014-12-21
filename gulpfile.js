/*
  gulpfile.js
  ===========
  Each task has been broken out into its own file in build/tasks. Any file in that folder gets
  automatically required by the loop in ./gulp/index.js (required below).

  To add a new task, simply add a new task file to ./build/tasks.
*/

var gulp = require('gulp'),
    config = require('./gulp/config');

// Our project structure is slightly different as we are a Node module exclusively
config.serverSource = ['lib/**/*.js'];
config.clientSource = [];
config.mochaTests = [
  'test/**/*.js',
  '!test/client/**/*.js',
  '!test/fixtures/**/*.js'
];

var Pack = require('./gulp');

Pack.dev(['lint', 'test']);
gulp.task('default', ['dev']);
