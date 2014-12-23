var _ = require('lodash'),
    HandlebarsExportsPlugin = require('./plugins/handlebars-exports');

module.exports.config = function(additions) {
  var knownHelpers = additions.knownHelpers || [];

  return _.defaults({
    module: _.defaults({
      loaders: loaders(additions.module && additions.module.loaders, knownHelpers)
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

function loaders(additions, knownHelpers) {
  knownHelpers = knownHelpers.map(function(helper) {
    return 'knownHelpers[]=' + helper;
  }).join('&');

  var base = [
    {
      test: /\.(handlebars|hbs)$/,
      loader: require.resolve('./loaders/handlebars') + '?' + knownHelpers
    }
  ];

  return additions ? base.concat(additions) : base;
}

function plugins(additions) {
  var base = [
    new HandlebarsExportsPlugin()
  ];

  return additions ? base.concat(additions) : base;
}
