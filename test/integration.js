var _ = require('lodash'),
    Pack = require('../lib'),
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
      var config = Pack.config({
        serverSide: true,
        hybrid: true,
        module: {
          loaders: [2]
        },
        resolve: {
          bar: 'baz'
        },
        plugins: [1]
      });
      expect(config.length).to.equal(7);

      config = config[1];
      expect(config.module.loaders.length).to.equal(3);
      expect(config.module.loaders[2]).to.equal(2);
      expect(config.resolve).to.eql({
        modulesDirectories: ['web_modules', 'node_modules', 'bower_components'],
        bar: 'baz'
      });
      expect(config.plugins.length).to.equal(4);
      expect(config.plugins[3]).to.equal(1);
    });

    it('should include pathPref', function() {
      var config = Pack.config({
        serverSide: true,
        output: {
          chunkFilename: 'foo.js'
        },
        pathPrefix: 'foo'
      });
      expect(config.length).to.equal(3);

      config = config[2];
      expect(config.output.path).to.equal('build/server-foo');
    });
  });

  it('should load js+css on initial route', function(done) {
    var entry = path.resolve(__dirname + '/fixtures/multiple-chunks.js');

    webpack(Pack.config({
      entry: entry,
      output: {
        libraryTarget: 'umd',
        library: 'Zeus',

        path: outputDir,
        chunkFilename: '[hash:3].[id].bundle.js'
      }
    }), function(err, status) {
      expect(err).to.not.exist;
      var compilation = status.stats[0].compilation;
      expect(compilation.errors).to.be.empty;
      expect(compilation.warnings).to.be.empty;

      runPhantom(function(err, loaded) {
        // Opposite order as the loader injects into the top of head
        expect(loaded.scripts.length).to.eql(2);
        expect(loaded.scripts[0]).to.match(/\.1\.bundle\.js$/);
        expect(loaded.scripts[1]).to.match(/\/bundle\.js$/);

        expect(loaded.styles.length).to.eql(2);
        expect(loaded.styles[0]).to.match(/\.0\.bundle\.css$/);
        expect(loaded.styles[1]).to.match(/\.1\.bundle\.css$/);

        done();
      });
    });
  });
  it('should resolve bower and npm packages', function(done) {
    var entry = path.resolve(__dirname + '/fixtures/packages.js');

    webpack(Pack.config({
      entry: entry,
      output: {
        libraryTarget: 'umd',
        library: 'Zeus',

        path: outputDir,
        chunkFilename: '[hash:3].[id].bundle.js'
      }
    }), function(err, status) {
      expect(err).to.not.exist;

      var compilation = status.stats[0].compilation;
      expect(compilation.errors).to.be.empty;
      expect(compilation.warnings).to.be.empty;

      var pack = JSON.parse(fs.readFileSync(outputDir + '/circus.json').toString());
      expect(_.pluck(pack.modules, 'name').sort()).to.eql([
        'handlebars/runtime',
        'handlebars/runtime/dist/cjs/handlebars.runtime',
        'handlebars/runtime/dist/cjs/handlebars/base',
        'handlebars/runtime/dist/cjs/handlebars/exception',
        'handlebars/runtime/dist/cjs/handlebars/runtime',
        'handlebars/runtime/dist/cjs/handlebars/safe-string',
        'handlebars/runtime/dist/cjs/handlebars/utils',
        'pack/test/fixtures/packages',
        'underscore'
      ]);

      runPhantom(function(err, loaded) {
        expect(loaded.log).to.eql([
          '_: true Handlebars: true'
        ]);

        done();
      });
    });
  });


  it('should build server files', function(done) {
    var entry = path.resolve(__dirname + '/fixtures/stylus.js');

    outputDir = 'tmp/';

    webpack(Pack.config({
      entry: entry,
      serverSide: true,
      output: {
        path: outputDir
      }
    }), function(err, status) {
      expect(err).to.not.exist;

      var compilation = status.stats[1].compilation;
      expect(compilation.errors).to.be.empty;
      expect(compilation.warnings).to.be.empty;

      expect(Object.keys(compilation.assets)).to.eql(['bundle.js', '0.bundle.css', 'circus.json', 'bundle.js.map']);

      // Verify the actual css content
      var output = fs.readFileSync(outputDir + '/client/bundle.js').toString();
      expect(output).to.match(/if \(true\)/);
      expect(output).to.match(/Zeus\.router/);

      output = fs.readFileSync(outputDir + '/server/bundle.js').toString();
      expect(output).to.match(/if \(false\)/);
      expect(output).to.not.match(/Zeus\.router/);

      done();
    });
  });

  it('should compile stylus into external css files', function(done) {
    var entry = path.resolve(__dirname + '/fixtures/stylus.js');

    webpack(Pack.config({
      entry: entry,
      output: {
        libraryTarget: 'umd',
        library: 'Zeus',

        path: outputDir
      }
    }), function(err, status) {
      expect(err).to.not.exist;

      var compilation = status.stats[0].compilation;
      expect(compilation.errors).to.be.empty;
      expect(compilation.warnings).to.be.empty;

      expect(Object.keys(compilation.assets)).to.eql(['bundle.js', '0.bundle.css', 'circus.json', 'bundle.js.map']);

      // Verify the actual css content
      var output = fs.readFileSync(outputDir + '/0.bundle.css').toString();
      expect(output).to.match(/\.foo\s*\{/);
      expect(output).to.match(/\.baz\s*\{/);
      expect(output).to.not.match(/\.browser\s*\{/);
      expect(output).to.not.match(/\.android\s*\{/);
      expect(output).to.not.match(/\.ios\s*\{/);

      done();
    });
  });
  it('should build hybrid style files', function(done) {
    var entry = path.resolve(__dirname + '/fixtures/stylus.js');

    webpack(Pack.config({
      entry: entry,
      hybrid: true,
      output: {
        path: outputDir
      }
    }), function(err, status) {
      expect(err).to.not.exist;


      var compilation = status.stats[1].compilation;
      expect(compilation.errors).to.be.empty;
      expect(compilation.warnings).to.be.empty;

      expect(Object.keys(compilation.assets)).to.eql(['bundle.js', '0.bundle.css', 'circus.json', 'bundle.js.map']);

      // Check the meta config definition
      var output = JSON.parse(fs.readFileSync(outputDir + '/circus.json').toString());
      expect(output).to.eql({
        children: {
          "$isAndroid;": "android",
          "$isiOS;": "ios",
          "$isBrowser;": "browser"
        }
      });

      // Verify the actual css content
      output = fs.readFileSync(outputDir + '/browser/0.bundle.css').toString();
      expect(output).to.match(/\.foo\s*\{/);
      expect(output).to.match(/\.baz\s*\{/);
      expect(output).to.match(/\.browser\s*\{/);
      expect(output).to.not.match(/\.android\s*\{/);
      expect(output).to.not.match(/\.ios\s*\{/);

      output = fs.readFileSync(outputDir + '/ios/0.bundle.css').toString();
      expect(output).to.match(/\.foo\s*\{/);
      expect(output).to.match(/\.baz\s*\{/);
      expect(output).to.not.match(/\.browser\s*\{/);
      expect(output).to.not.match(/\.android\s*\{/);
      expect(output).to.match(/\.ios\s*\{/);

      output = fs.readFileSync(outputDir + '/android/0.bundle.css').toString();
      expect(output).to.match(/\.foo\s*\{/);
      expect(output).to.match(/\.baz\s*\{/);
      expect(output).to.not.match(/\.browser\s*\{/);
      expect(output).to.match(/\.android\s*\{/);
      expect(output).to.not.match(/\.ios\s*\{/);

      done();
    });
  });

  it('should precompile handlebars templates', function(done) {
    var entry = path.resolve(__dirname + '/fixtures/handlebars-render.js');

    webpack(Pack.config({
      entry: entry,
      output: {
        libraryTarget: 'umd',
        library: 'Zeus',

        path: outputDir
      }
    }), function(err, status) {
      expect(err).to.not.exist;

      var compilation = status.stats[0].compilation;
      expect(compilation.errors).to.be.empty;
      expect(compilation.warnings).to.be.empty;

      runPhantom(function(err, loaded) {
        expect(loaded.log).to.eql([
          'it worked'
        ]);

        done();
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
