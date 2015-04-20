var Handlebars = require('handlebars/runtime');
// TODO: Remove this shim layer after updating to handlebars 3.
module.exports = Handlebars['default'] || Handlebars;   // eslint-disable-line dot-notation
