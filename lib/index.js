var _ = require('lodash'),
    HandlebarsExportsPlugin = require('./plugins/handlebars-exports'),
    Webpack = require('webpack');

module.exports.config = function(additions) {
  var handlebarsOptions = additions.handlebars || {};

  return _.defaults({
    module: _.defaults({
      loaders: loaders(additions.module && additions.module.loaders, handlebarsOptions)
    }, additions.module),

    resolveLoader: _.defaults({
      alias: _.extend({
        helper: __dirname + '/loaders/helper',
        partial: __dirname + '/loaders/partial'
      }, additions.resolveLoader && additions.resolveLoader.alias)
    }, additions.resolveLoader),

    plugins: plugins(additions.plugins)
  }, additions);
};

function loaders(additions, handlebarsOptions) {
  var knownHelpers = handlebarsOptions.knownHelpers || [];

  var query = knownHelpers.map(function(helper) {
    return 'knownHelpers[]=' + helper;
  });
  if (handlebarsOptions.extension) {
    query.push('extension=' + handlebarsOptions.extension);
  }
  if (handlebarsOptions.helpersDir) {
    query.push('helpersDir=' + handlebarsOptions.helpersDir);
  }

  var base = [
    {
      test: /\.(handlebars|hbs)$/,
      loader: require.resolve('./loaders/handlebars') + '?' + query.join('&')
    }
  ];

  return additions ? base.concat(additions) : base;
}

function plugins(additions) {
  var base = [
    new HandlebarsExportsPlugin(),

    // Create aliases for our internal files. This gives us the opportunity to link to externals
    // rather than always loading from our local file system.
    // Replacing here prevents circus from trying to us this as the module name
    new Webpack.NormalModuleReplacementPlugin(
          /circus-handlebars\/lib\/loaders\/client\/handlebars-shim/,
          __dirname + '/loaders/client/handlebars-shim.js')
  ];

  return additions ? base.concat(additions) : base;
}
