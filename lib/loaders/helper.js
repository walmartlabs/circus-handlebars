var LoaderUtils = require('loader-utils'),
    Path = require('path');

/*istanbul ignore next */
module.exports = function() {
};

module.exports.pitch = function(remainingRequests) {
  this.cacheable(true);

  var query = LoaderUtils.parseQuery(this.query);

  if (!query.name) {
    query.name = Path.basename(remainingRequests).replace(/\.[^.]+$/, '');
  }

  return 'require("' + __dirname + '/client/handlebars-shim")'
      + '.registerHelper($registerHelper$(' + JSON.stringify(query.name) + '), require(' + JSON.stringify('!' + remainingRequests) + '))';
};
