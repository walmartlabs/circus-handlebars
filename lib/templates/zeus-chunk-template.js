/*
  Derived from:
  https://github.com/webpack/webpack/blob/master/lib/JsonpChunkTemplatePlugin.js

  MIT License http://www.opensource.org/licenses/mit-license.php
  Author Tobias Koppers @sokra
*/
var ConcatSource = require('webpack-core/lib/ConcatSource');

function ZeusChunkTemplatePlugin() {
}
module.exports = ZeusChunkTemplatePlugin;

ZeusChunkTemplatePlugin.prototype.apply = function(chunkTemplate) {
  chunkTemplate.plugin('render', function(modules, chunk) {
    var jsonpFunction = this.outputOptions.jsonpFunction || 'zeusJsonp';
    var source = new ConcatSource();
    source.add(jsonpFunction + '(');
    source.add(JSON.stringify(this.outputOptions.component) + ', ');
    source.add(JSON.stringify(chunk.ids) + ',');
    source.add(modules);
    source.add(');');
    return source;
  });
  chunkTemplate.plugin('hash', function(hash) {
    hash.update('ZeusChunkTemplatePlugin');
    hash.update('3');
    hash.update(this.outputOptions.jsonpFunction + '');
    hash.update(this.outputOptions.library + '');
  });
};
