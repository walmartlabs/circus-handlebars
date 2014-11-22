var _ = require('lodash'),
    Circus = require('circus'),
    Path = require('path'),
    Webpack = require('webpack');

module.exports.config = function(additions) {
  var configs = [{
    $serverSide: false,
    $isBrowser: false,
    $isAndroid: false,
    $isiOS: false
  }];

  // Generate our set of config variables that will be built into each output permutation
  if (additions.serverSide) {
    configs = [false, true].map(function(value) {
      return configs.map(function (config) {
        return _.defaults({'$serverSide': value}, config);
      });
    });
    configs = _.flatten(configs);
  }
  if (additions.hybrid) {
    configs = _.map({
      '$isAndroid': 'android/',
      '$isiOS': 'ios/',
      '$isBrowser': 'browser/'
    }, function(path, value) {
      return configs.map(function (config) {
        var define = {
          pathPrefix: path
        };
        define[value] = true;

        return _.defaults(define, config);
      });
    });
    configs = _.flatten(configs);
  }

  return configs.map(function(defines) {
    var pathPrefix = defines.pathPrefix;
    defines = _.omit(defines, 'pathPrefix');

    var output = additions.output;
    if (pathPrefix) {
      output = _.clone(additions.output || {});
      output.path = Path.join(output.path || '', pathPrefix);
    }
    if (defines.$serverSide) {
      output = _.clone(additions.output || {});

      output.filename = (output.filename || 'bundle.js').replace(/\.js$/, '-server.js');
      if (output.chunkFilename) {
        output.chunkFilename = output.chunkFilename.replace(/\.js$/, '-server.js');
      }
    }

    return Circus.config(_.defaults({
      module: _.defaults({
        loaders: loaders(defines, additions.module && additions.module.loaders)
      }, additions.module),

      output: output,

      plugins: plugins(defines, additions.plugins)
    }, additions));
  });
};

function loaders(stylusDefines, additions) {
  var base = [
    {
      test: /\.(handlebars|hbs)$/,
      loader: require.resolve('./loaders/handlebars')
          + '?knownHelpers=template,super,view,element,button,url,link,collection,empty,collection-element,layout-element,loading'
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
    new Webpack.DefinePlugin(jsDefines)
  ];

  return additions ? base.concat(additions) : base;
}
