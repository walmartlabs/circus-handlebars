var _ = require('lodash'),
    Fs = require('fs'),
    Circus = require('circus'),
    Path = require('path'),
    HandlebarsExportsPlugin = require('./plugins/handlebars-exports'),
    ServerRenderFlagPlugin = require('./plugins/server-render-flag'),
    RouterConverterPlugin = require('hula-hoop/webpack/router-converter'),
    Webpack = require('webpack');

module.exports.config = function(additions) {
  var configs = [{
    pathPrefix: additions && additions.pathPrefix,
    defines: {
      $serverSide: false,
      $isBrowser: false,
      $isAndroid: false,
      $isiOS: false
    }
  }];

  // Generate our set of config variables that will be built into each output permutation
  if (additions.serverSide) {
    configs = [false, true].map(function(value) {
      return configs.map(function(config) {
        return _.defaults({
          configId: '$serverSide:' + value + ';' + (config.configId || ''),
          pathPrefix: (value ? 'server' : 'client') + (config.pathPrefix ? '-' + config.pathPrefix : ''),
          defines: _.defaults({'$serverSide': value}, config.defines)
        }, config);
      });
    });
    configs = _.flatten(configs);
  }
  if (additions.hybrid) {
    configs = _.map({
      '$isAndroid': 'android',
      '$isiOS': 'ios',
      '$isBrowser': 'browser'
    }, function(path, value) {
      return configs.map(function(config) {
        var define = {};
        define[value] = true;

        return _.defaults({
          configId: value + ';' + (config.configId || ''),
          pathPrefix: path + (config.pathPrefix ? '-' + config.pathPrefix : ''),
          defines: _.defaults(define, config.defines)
        }, config);
      });
    });
    configs = _.flatten(configs);
  }

  var filename = additions.output && additions.output.filename;
  if (!filename) {
    var package = JSON.parse(Fs.readFileSync('package.json').toString());
    filename = package.name + '.js';
  }

  // Default to Thorax known helpers
  var knownHelpers = additions.knownHelpers
        || ['template', 'super', 'view', 'element', 'button', 'url', 'link', 'collection', 'empty', 'collection-element', 'layout-element', 'loading'];

  return Circus.config(configs.map(function(config) {
    var pathPrefix = config.pathPrefix;

    var output = _.extend({
      filename: filename,
      path: Path.resolve('./build/')
    }, additions.output);

    if (pathPrefix) {
      output.pathPrefix = pathPrefix;
    }

    return _.defaults({
      circusNamespace: 'Zeus',

      entry: (additions && additions.entry) || './src/client/index.js',

      module: _.defaults({
        loaders: loaders(config.defines, additions.module && additions.module.loaders, knownHelpers)
      }, additions.module),

      resolveLoader: _.defaults({
        alias: _.extend({
          'helper': __dirname + '/loaders/helper',
          'partial': __dirname + '/loaders/partial'
        }, additions.resolveLoader && additions.resolveLoader.alias)
      }, additions.resolveLoader),

      configId: config.configId,
      output: output,

      plugins: plugins(config.defines, additions.plugins)
    }, additions);
  }));
};

function loaders(stylusDefines, additions, knownHelpers) {
  knownHelpers = knownHelpers.map(function(helper) {
    return 'knownHelpers[]=' + helper;
  }).join('&');

  var base = [
    {
      test: /\.(handlebars|hbs)$/,
      loader: require.resolve('./loaders/handlebars') + '?' + knownHelpers
    },

    {
      test: /\.styl$/,
      loader: require.resolve('stylus-loader')
          + '?' + JSON.stringify({define: stylusDefines})
    }
  ];

  return additions ? base.concat(additions) : base;
}

function plugins(jsDefines, additions) {
  var base = [
    new Webpack.DefinePlugin(jsDefines),
    new HandlebarsExportsPlugin(),
    new RouterConverterPlugin()
  ];

  if (jsDefines.$serverSide) {
    base.push(new ServerRenderFlagPlugin());
  }

  return additions ? base.concat(additions) : base;
}
