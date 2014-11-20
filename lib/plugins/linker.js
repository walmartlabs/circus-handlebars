var _ = require('lodash'),
    Fs = require('fs'),
    ModuleDependency = require('webpack/lib/dependencies/ModuleDependency'),
    NullFactory = require('webpack/lib/NullFactory'),
    Path = require('path'),
    RawSource = require('webpack-core/lib/RawSource'),

    Client = require('../client');

module.exports = exports = function LinkerPlugin() {
  this.usedModules = [];
  this.componentIdCounter = 0;
};

exports.prototype.apply = function(compiler) {
  var plugin = this;

  var linkedModules = {};

  // Convert the components list to the format that we will use for linking/serializing
  _.each(compiler.options.components, function(component, componentName) {
    _.each(component.modules, function(module, moduleId) {
      linkedModules[module.name] = {
        name: module.name,
        componentName: componentName,
        entry: component.entry
      };
      if (moduleId === '0' && !linkedModules[componentName]) {
        linkedModules[componentName] = linkedModules[module.name];
      }
    });
  });

  compiler.plugin('compilation', function(compilation) {
    compilation.dependencyFactories.set(LinkedRequireDependency, new NullFactory());
    compilation.dependencyTemplates.set(LinkedRequireDependency, new LinkedRequireDependencyTemplate());

    compilation.mainTemplate.plugin('local-vars', function(extensions/*, chunk, hash */) {
      var buf = [extensions];

      if (plugin.usedModules.length) {
        var linkedModules = [],
            chunkDeps = [],
            componentNames = [],
            componentPaths = [];
        plugin.usedModules.forEach(function(used, index) {
          linkedModules[index] = {c/*omponent*/: used.componentId, n/*ame*/: used.name};
          componentPaths[used.componentId] = used.entry;
          componentNames[used.componentId] = used.componentName;

          // Provide a heads up that things are going to fail
          if (!used.entry) {
            compilation.errors.push(new Error('Component "' + used.componentName + '" referenced and missing entry chunk path'));
          }
        });

        compilation.chunks.forEach(function(chunk, index) {
          chunkDeps[index] = chunk.linkedDeps;
        });

        buf.push(
          '// Linker variables',
          'var linkedModules = ' + JSON.stringify(linkedModules) + ',',
          '    chunkDeps = ' + JSON.stringify(chunkDeps) + ',',
          '    componentNames = ' + JSON.stringify(componentNames) + ';',
          '    componentPaths = ' + JSON.stringify(componentPaths) + ';');
      }

      return this.asString(buf);
    });
    compilation.mainTemplate.plugin('require-extensions', function(extensions/*, chunk, hash*/) {
      var buf = [extensions];

      buf.push(
        Client.jsLinker({
          requireFn: this.requireFn,
          exports: this.outputOptions.component && JSON.stringify(this.outputOptions.component),
          imports: plugin.usedModules.length
        }));

      return this.asString(buf);
    });

    // Wrap the init logic so we can preload any dependencies before we launch
    // our entry point.
    compilation.mainTemplate.plugin('startup', function(source, chunk, hash) {
      var loadEntry = '';
      if(chunk.modules.some(function(m) { return m.id === 0; })) {
        loadEntry = this.renderRequireFunctionForModule(hash, chunk, '0') + '(0);';
      }
      if (chunk.linkedDeps && chunk.linkedDeps.length) {
        return this.asString([
            this.requireFn + '.ec/*ensureComponent*/(' + JSON.stringify(chunk.linkedDeps) + ', function() {',
              this.indent([
                loadEntry,
                'loadComplete();',
                source
              ]),
            '})']);
      } else {
        return this.asString([
          loadEntry,
          'loadComplete();',
          source
        ]);
      }
    });

    // Annotates the chunks with their external dependencies. This allows us to ensure that
    // component dependencies are loaded prior to loading the chunk itself.
    compilation.plugin('before-chunk-assets', function() {
      compilation.chunks.forEach(function(chunk) {
        var chunkDeps = [];
        chunk.modules.forEach(function(module) {
          module.dependencies.forEach(function(dependency) {
            if (dependency instanceof LinkedRequireDependency) {
              chunkDeps.push(dependency.linked);
            }
          });
        });
        chunk.linkedDeps = _.uniq(chunkDeps);
      });
    });

    compilation.plugin('additional-assets', function(callback) {
      plugin.usedModules.forEach(function(module) {
        var component = compilation.options.components[module.componentName],
            componentFiles = component.files;
        componentFiles = _.map(componentFiles, function(file) {
          if (!/(^\/)|\/\//.test(file) && !compilation.assets[file]) {
            var path = Path.join(component.root, file);
            compilation.assets[file] = new RawSource(Fs.readFileSync(path));
          }
        });
      });

      callback();
    });
  });

  compiler.parser.plugin('call require:commonjs:item', function(expr, param) {
    // Define custom requires for known external modules
    var linked = param.isString() && linkedModules[param.string];
    if (linked) {
      var mappedId = plugin.moduleId(linked);

      var dep = new LinkedRequireDependency(mappedId, expr.range);
      dep.loc = expr.loc;
      this.state.current.addDependency(dep);
      return true;
    }
  });
};

exports.prototype.moduleId = function(linked) {
  /*jshint eqnull:true */
  var mappedId;
  _.find(this.usedModules, function(module, index) {
    if (module.name === linked.name) {
      mappedId = index;
      return module;
    }
  });
  if (mappedId == null) {
    mappedId = this.usedModules.length;
    linked.componentId = this.componentIdCounter++;
    this.usedModules.push(linked);
  }
  return mappedId;
};



function LinkedRequireDependency(linked, range) {
  ModuleDependency.call(this);
  this.Class = LinkedRequireDependency;
  this.linked = linked;
  this.range = range;
}
LinkedRequireDependency.prototype = Object.create(ModuleDependency.prototype);
LinkedRequireDependency.prototype.type = 'linked require';



function LinkedRequireDependencyTemplate() {}
LinkedRequireDependencyTemplate.prototype.apply = function(dep, source) {
  var content = '.l/*ink*/(' + JSON.stringify(dep.linked) + ')';
  source.replace(dep.range[0], dep.range[1]-1, content);
};
