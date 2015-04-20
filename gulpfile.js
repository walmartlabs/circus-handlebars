/*
  gulpfile.js
  ===========
  Each task has been broken out into its own file in build/tasks. Any file in that folder gets
  automatically required by the loop in ./gulp/index.js (required below).

  To add a new task, simply add a new task file to ./build/tasks.
*/

var gulp = require('gulp'),
    eslint = require('gulp-eslint'),
    istanbul = require('gulp-istanbul'),
    mocha = require('gulp-mocha');

var source = ['lib/**/*.js'];
var mochaTests = [
  'test/**/*.js',
  '!test/client/**/*.js',
  '!test/fixtures/**/*.js'
];

gulp.task('eslint', function() {
  return gulp.src(source)
    .pipe(eslint())
    .pipe(eslint.format('stylish'))
    .pipe(eslint.failAfterError());
});

gulp.task('mocha', function() {
  return gulp.src(mochaTests, {read: false})
      .pipe(mocha());
});

gulp.task('coverage', function(done) {
  gulp.src(source)
    .pipe(istanbul())
    .pipe(istanbul.hookRequire())
    .on('finish', function() {
      gulp.src(mochaTests, {read: false})
        .pipe(mocha())
        .pipe(istanbul.writeReports())
        .on('end', done);
    });
});

gulp.task('lint', ['eslint']);
gulp.task('test', ['coverage']);
gulp.task('default', ['lint', 'test']);
