var _ = require('lodash'),
    Async = require('async'),
    Handlebars = require('handlebars'),
    Visitor = require('../handlebars-visitor'),
    LoaderUtils = require('loader-utils'),
    Path = require('path'),
    SourceMap = require('source-map');

module.exports = function(content) {
  var callback = this.async();
  this.cacheable(true);

  var query = LoaderUtils.parseQuery(this.query),
      helpersDir = query.helpersDir || './src/lib/helpers/',
      templateExtension = query.extension || '.hbs',
      externalKnown = {};

  (query.knownHelpers || []).forEach(function(helper) {
    externalKnown[helper] = true;
  });

  var componentHelpers = {},
      componentPartials = {};

  _.each(this.options.components, function(component) {
    if (component.handlebars) {
      _.extend(componentHelpers, component.handlebars.helper);
      _.extend(componentPartials, component.handlebars.partial);
    }
  });

  var self = this,
      ast = Handlebars.parse(content),
      scanner = new ImportScanner(),

      knownHelpers = {};

  // Do the first phase of the parse
  scanner.accept(ast);

  var prelude = [
    'var Handlebars = require("' + __dirname + '/client/handlebars-shim");\n'
  ];
  function lookupPartials(callback) {
    Async.forEach(scanner.partials, function(partial, callback) {
        var request = partial.request,
            partialName = partial.name.name;

        if (componentPartials[partialName]) {
          prelude.push('require(' + JSON.stringify(componentPartials[partialName]) + ');\n');
          return callback();
        }

        self.resolve(self.context, request + templateExtension, function(err, result) {
          if (err || !result) {
            self.emitWarning('Unable to resolve partial "' + request + '": ' + err);
          } else {
            // Attempt to generate a unique partial name
            var partialName = Path.relative(self._compiler.context, result);
            partialName = Path.dirname(partialName) + '/' + Path.basename(partialName, templateExtension);

            prelude.push('require("' + __dirname + '/partial?name=' + partialName + '!' + result + '");\n');

            // Update the AST for the unique name that we generated
            partial.name.name = partialName;
          }

          callback();
        });
      },
      callback);
  }
  function lookupHelpers(callback) {
    Async.forEach(_.uniq(scanner.potentialHelpers), function(helper, callback) {
        if (knownHelpers[helper] || externalKnown[helper]) {
          callback();
        } else if (componentHelpers[helper]) {
          knownHelpers[helper] = true;
          prelude.push('require(' + JSON.stringify(componentHelpers[helper]) + ');\n');
          callback();
        } else {
          self.resolve(self._compiler.context, helpersDir + helper, function(err, result) {
            if (!err) {
              knownHelpers[helper] = true;

              prelude.push('require("' + __dirname + '/helper?name=' + helper + '!' + result + '");\n');
            }

            callback();
          });
        }
      },
      callback);
  }

  Async.parallel([
      lookupPartials,
      lookupHelpers
    ],
    function() {
      var name = Path.relative(self.options.context, self.resource);
      // Render the AST to the final script
      var template = Handlebars.precompile(ast, {
        srcName: name,
        destName: name + '.js',
        knownHelpersOnly: true,
        knownHelpers: _.extend(knownHelpers, externalKnown)
      });

      var sourceNode = new SourceMap.SourceNode(1, 0, name, template);
      sourceNode.setSourceContent(name, content);

      var concatSrc = new SourceMap.SourceNode();
      concatSrc.add(prelude);
      concatSrc.add([
        '\nmodule.exports = Handlebars.template(',
        sourceNode,
        ')'
      ]);

      var result = concatSrc.toStringWithSourceMap();
      callback(undefined, result.code, result.map.toString());
    });
};



function ImportScanner() {
  this.partials = [];
  this.potentialHelpers = [];
}
ImportScanner.prototype = new Visitor();

ImportScanner.prototype.sexpr = function(sexpr) {
  var id = sexpr.id;
  if (id.isSimple) {
    this.potentialHelpers.push(id.original);
  }

  Visitor.prototype.sexpr.call(this, sexpr);
};
ImportScanner.prototype.partial = function(partial) {
  this.partials.push({request: partial.partialName.name, name: partial.partialName});

  Visitor.prototype.partial.call(this, partial);
};
