var Dependency = require('webpack/lib/Dependency'),
    NullFactory = require('webpack/lib/NullFactory');

module.exports = exports = function HandlebarsExportsPlugin() {};

// Parses out the well-known identifier flags that are injected by the helper and partial
// loaders in order to save the list of helpers and partials that this component should
// expose.
exports.prototype.apply = function(compiler) {
  compiler.parser.plugin('call $registerHelper$', function(expr) {
    var request = this.evaluateExpression(expr.arguments[0]);
    this.state.current.addDependency(new NameDependency('helper', request.string, expr.range));

    return true;
  });
  compiler.parser.plugin('call $registerPartial$', function(expr) {
    var request = this.evaluateExpression(expr.arguments[0]);
    this.state.current.addDependency(new NameDependency('partial', request.string, expr.range));

    return true;
  });

  compiler.plugin('compilation', function(compilation) {
    compilation.dependencyFactories.set(NameDependency, new NullFactory());
    compilation.dependencyTemplates.set(NameDependency, new NameDependency.Template());

    // Save custom external module names for anything that we may be exporting.
    compilation.plugin('after-optimize-modules', function() {
      this.chunks.forEach(function(chunk) {
        chunk.modules.forEach(function(module) {
          module.dependencies.forEach(function(dependency) {
            if (dependency instanceof NameDependency) {
              module.externalName = dependency.type + ':' + dependency.name;
            }
          });
        });
      });
    });

    // Scan all modules and chunks looking for the helpers and partials that are used and
    // saves the resulting list.
    compilation.plugin('circus-json', function(json) {
      var definedNames = {
        partial: {},
        helper: {}
      };

      this.chunks.forEach(function(chunk) {
        chunk.modules.forEach(function(module) {
          module.dependencies.forEach(function(dependency) {
            if (dependency instanceof NameDependency) {
              definedNames[dependency.type][dependency.name] = module.externalName;
            }
          });
        });
      });

      json.handlebars = definedNames;
    });
  });
};


function NameDependency(type, name, range) {
  this.Class = NameDependency;

  this.type = type;
  this.name = name;
  this.range = range;
}
NameDependency.prototype = Object.create(Dependency.prototype);
NameDependency.prototype.updateHash = function(hash) {
  Dependency.prototype.updateHash.call(this, hash);

  hash.update(this.type);
  hash.update(this.name);
};

NameDependency.Template = function NameDependencyTemplate() {};
NameDependency.Template.prototype.apply = function(dep, source) {
  source.replace(dep.range[0], dep.range[1] - 1, JSON.stringify(dep.name));
};
