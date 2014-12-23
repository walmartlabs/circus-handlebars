var Handlebars = require('handlebars/runtime');

module.exports = function(log) {
  return new (Handlebars.default || Handlebars).SafeString('<log info=' + JSON.stringify(log) +'></log>');
};
