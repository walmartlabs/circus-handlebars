var Circus = require('circus'),
    CircusHandlebars = require('../lib'),
    Path = require('path'),
    webpack = require('webpack');

var childProcess = require('child_process'),
    expect = require('chai').expect,
    fs = require('fs'),
    temp = require('temp'),
    path = require('path'),
    phantom = require('phantomjs');

describe('loader integration', function() {
  var outputDir;

  beforeEach(function(done) {
    temp.mkdir('loader-plugin', function(err, dirPath) {
      if (err) {
        throw err;
      }

      outputDir = dirPath;

      var runner = fs.readFileSync(__dirname + '/client/runner.js');
      fs.writeFileSync(outputDir + '/runner.js', runner);

      var html = fs.readFileSync(__dirname + '/client/initial-route.html');
      fs.writeFileSync(outputDir + '/index.html', html);

      done();
    });
  });
  afterEach(function() {
    temp.cleanupSync();
  });

  describe('#config', function() {
    it('should extend config', function() {
      var config = CircusHandlebars.config({
        module: {
          loaders: [2]
        },
        resolveLoader: {
          alias: {
            'bar': 'bat'
          }
        },
        plugins: [1]
      });

      expect(config.module.loaders.length).to.equal(2);
      expect(config.module.loaders[1]).to.equal(2);
      expect(config.resolveLoader).to.eql({
        alias: {
          partial: Path.resolve(__dirname + '/../lib/loaders/partial'),
          helper: Path.resolve(__dirname + '/../lib/loaders/helper'),
          bar: 'bat'
        }
      });
      expect(config.plugins.length).to.equal(2);
      expect(config.plugins[1]).to.equal(1);
    });
  });

  it('should precompile', function(done) {
    var entry = path.resolve(__dirname + '/fixtures/handlebars.hbs');

    webpack({
      context: __dirname,
      entry: entry,
      output: {path: outputDir},

      module: {
        loaders: [
          { test: /\.hbs$/, loader: __dirname + '/../lib/loaders/handlebars' }
        ]
      }
    }, function(err, status) {
      expect(err).to.not.exist;
      expect(status.compilation.errors).to.be.empty;
      expect(status.compilation.warnings).to.be.empty;

      // Verify the loader boilerplate
      var output = fs.readFileSync(outputDir + '/bundle.js').toString();
      expect(output).to.match(/module\.exports = Handlebars\.template\(.*"main"/);
      expect(output).to.match(/<log info=/);

      done();
    });
  });
  it('should load dependencies', function(done) {
    var entry = path.resolve(__dirname + '/fixtures/dependencies.hbs');

    webpack(CircusHandlebars.config({
      context: __dirname,
      entry: entry,
      output: {path: outputDir},

      handlebars: {
        knownHelpers: ['baat', 'bat']
      }
    }), function(err, status) {
      expect(err).to.not.exist;
      expect(status.compilation.errors).to.be.empty;
      expect(status.compilation.warnings.length).to.equal(1);
      expect(status.compilation.warnings[0].toString()).to.match(/Unable to resolve partial "not-found": .*test\/fixtures/);

      // Verify the loader boilerplate
      var output = fs.readFileSync(outputDir + '/bundle.js').toString();
      expect(output).to.match(/\.registerPartial\("fixtures\/handlebars", __webpack_require__/);
      expect(output).to.match(/invokePartial\(.*'fixtures\/handlebars'/);
      expect(output).to.match(/invokePartial\(.*'not-found'/);
      expect(output).to.match(/helpers.foo.call\(/);
      expect(output).to.match(/helpers.bat.call\(/);
      expect(output).to.match(/module\.exports = Handlebars\.template\(.*"main"/);
      expect(output).to.match(/"foo!"/);
      expect(output).to.match(/<log info=/);

      done();
    });
  });
  it('should honor dependency configs', function(done) {
    var entry = path.resolve(__dirname + '/fixtures/dependencies.hbs');

    webpack(CircusHandlebars.config({
      context: __dirname,
      entry: entry,
      output: {path: outputDir},

      handlebars: {
        knownHelpers: ['baat', 'bat', 'foo'],
        helpersDir: '.',
        extension: '.foo'
      }
    }), function(err, status) {
      expect(err).to.not.exist;
      expect(status.compilation.errors).to.be.empty;
      expect(status.compilation.warnings.length).to.equal(2);
      expect(status.compilation.warnings[0].toString()).to.match(/Unable to resolve partial ".\/handlebars": .*test\/fixtures/);
      expect(status.compilation.warnings[1].toString()).to.match(/Unable to resolve partial "not-found": .*test\/fixtures/);

      // Verify the loader boilerplate
      var output = fs.readFileSync(outputDir + '/bundle.js').toString();
      expect(output).to.match(/invokePartial\(.*'\.\/handlebars'/);
      expect(output).to.match(/invokePartial\(.*'not-found'/);
      expect(output).to.match(/helpers.bat.call\(/);
      expect(output).to.match(/module\.exports = Handlebars\.template\(.*"main"/);

      done();
    });
  });
  it('should handle missing helpers', function(done) {
    var entry = path.resolve(__dirname + '/fixtures/missing-helper.hbs');

    webpack(CircusHandlebars.config({
      context: __dirname,
      entry: entry,
      output: {path: outputDir},

      handlebars: {
        knownHelpers: ['baat', 'bat']
      }
    }), function(err, status) {
      expect(err).to.not.exist;
      expect(status.compilation.errors.length).to.equal(1);
      expect(status.compilation.errors[0].toString()).to.match(/Failed to lookup helper: not-found\nresolve file/);

      done();
    });
  });

  describe('integration', function() {
    it('should precompile handlebars templates', function(done) {
      var entry = path.resolve(__dirname + '/fixtures/handlebars-render.js');

      var config = {
        context: __dirname,
        entry: entry,
        output: {
          path: outputDir
        }
      };
      config = CircusHandlebars.config(config);
      config = Circus.config(config);

      webpack(config, function(err, status) {
        expect(err).to.not.exist;

        var compilation = status.compilation;
        expect(compilation.errors).to.be.empty;
        expect(compilation.warnings).to.be.empty;

        var output = JSON.parse(fs.readFileSync(outputDir + '/circus.json').toString());
        expect(output.handlebars).to.eql({
          partial: {
            'fixtures/partial': 'partial:fixtures/partial'
          },
          helper: { logger: 'helper:logger' }
        });

        runPhantom(function(err, loaded) {
          expect(loaded.log).to.eql([
            'it worked',
            'this too',
            'also here'
          ]);

          done();
        });
      });
    });
    it('should load external handlebars resources from child chunks', function(done) {
      var vendorEntry = path.resolve(__dirname + '/fixtures/require-helpers.js'),
          entry = path.resolve(__dirname + '/fixtures/handlebars-components.js');

      var config = {
        context: __dirname,
        entry: vendorEntry,
        output: {
          component: 'vendor',

          path: outputDir + '/vendor',
          filename: 'vendor.js'
        }
      };
      config = CircusHandlebars.config(config);
      config = Circus.config(config);

      webpack(config, function(err, status) {
        expect(err).to.not.exist;

        var compilation = status.compilation;
        expect(compilation.errors).to.be.empty;
        expect(compilation.warnings).to.be.empty;

        var config = {
          entry: entry,

          output: {
            path: outputDir
          },

          resolve: {
            modulesDirectories: [
              outputDir
            ]
          }
        };
        config = CircusHandlebars.config(config);
        config = Circus.config(config);

        webpack(config, function(err, status) {
          expect(err).to.not.exist;

          var compilation = status.compilation;
          expect(compilation.errors).to.be.empty;
          expect(compilation.warnings).to.be.empty;

          runPhantom(function(err, loaded) {
            expect(loaded.scripts.length).to.equal(3);
            expect(loaded.scripts[0]).to.match(/vendor.js$/);
            expect(loaded.scripts[1]).to.match(/1\.vendor.js$/);
            expect(loaded.scripts[2]).to.match(/bundle.js$/);

            expect(loaded.log).to.eql([
              'it worked',
              'this too',
              'also here'
            ]);

            done();
          });
        });
      });
    });
  });


  function runPhantom(callback) {
    childProcess.execFile(phantom.path, [outputDir + '/runner.js', outputDir], function(err, stdout, stderr) {
      if (err) {
        throw new Error('Phantom failed code: ' + err.code + '\n\n' + stdout + '\n\n' + stderr);
      }
      expect(stderr).to.equal('');

      var loaded = JSON.parse(stdout);

      callback(undefined, loaded);
    });
  }
});
