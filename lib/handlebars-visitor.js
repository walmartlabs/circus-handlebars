// jscs:disable
// jshint unused:false
// Pulled from Handlebars 3.x branch. We should remove this when that ships.
function Visitor() {}


/*istanbul ignore next*/
Visitor.prototype = {
  constructor: Visitor,

  accept: function(object) {
    return object && this[object.type] && this[object.type](object);
  },

  program: function(program) {
    var statements = program.statements,
        i = 0,
        l = statements.length;

    for (; i < l; i++) {
      this.accept(statements[i]);
    }
  },

  block: function(block) {
    this.accept(block.mustache);
    this.accept(block.program);
    this.accept(block.inverse);
  },

  mustache: function(mustache) {
    this.accept(mustache.sexpr);
  },

  sexpr: function(sexpr) {
    var params = sexpr.params;

    this.accept(sexpr.id);
    for (var i = 0, l = params.length; i < l; i++) {
      this.accept(params[i]);
    }
    this.accept(sexpr.hash);
  },

  hash: function(hash) {
    var pairs = hash.pairs;

    for (var i = 0, l = pairs.length; i < l; i++) {
      this.accept(pairs[i][1]);
    }
  },

  partial: function(partial) {
    this.accept(partial.partialName);
    this.accept(partial.context);
    this.accept(partial.hash);
  },
  PARTIAL_NAME: function() {},

  DATA: function(data) {
    this.accept(data.id);
  },

  STRING: function() {},
  NUMBER: function() {},
  BOOLEAN: function() {},
  ID: function() {},

  content: function() {},
  comment: function() {}
};

module.exports = Visitor;
