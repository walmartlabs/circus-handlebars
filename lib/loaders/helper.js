var LoaderUtils = require('loader-utils');

/*istanbul ignore next */
module.exports = function() {
};

module.exports.pitch = function(remainingRequests) {
  this.cacheable(true);

  var query = LoaderUtils.parseQuery(this.query);

  return 'require("' + __dirname + '/client/handlebars-shim")'
      + '.registerHelper(' + JSON.stringify(query.name) + ', require(' + JSON.stringify(remainingRequests) + '))';
};
