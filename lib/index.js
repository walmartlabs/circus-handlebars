var _ = require('lodash'),
    Circus = require('circus');

module.exports.config = function(additions) {
  return Circus.config(_.defaults({
    module: _.defaults({
      loaders: loaders(additions.module && additions.module.loaders)
    }, additions.module),
  }, additions));
};

function loaders(additions) {
  var base = [
    {
      test: /\.(handlebars|hbs)$/,
      loader: require.resolve('./loaders/handlebars')
          + '?knownHelpers=template,super,view,element,button,url,link,collection,empty,collection-element,layout-element,loading'
    },

    { test: /\.styl$/, loader: require.resolve('stylus-loader') }
  ];

  return additions ? base.concat(additions) : base;
}

