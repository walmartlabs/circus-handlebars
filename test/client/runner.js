/*global phantom */
var page = require('webpage').create(),
    system = require('system');

page.onConsoleMessage = function(message) {
  if (message === 'DONE') {
    setTimeout(function() {
      var scripts = page.evaluate(function() {
        return [].map.call(document.querySelectorAll('script'), function(script) {
          return script.src;
        });
      });
      var styles = page.evaluate(function() {
        return [].map.call(document.querySelectorAll('link'), function(script) {
          return script.href;
        });
      });
      var log = page.evaluate(function() {
        return [].map.call(document.querySelectorAll('log'), function(script) {
          return script.info || script.getAttribute('info');
        });
      });
      var html = page.evaluate(function() {
        return document.body.innerHTML;
      });

      console.log(JSON.stringify({
        html: html,
        scripts: scripts,
        styles: styles,
        log: log
      }));
      phantom.exit(0);
    }, 0);
  } else {
    console.log(message);
  }
};

page.onError = function(msg, trace) {
  console.error(msg);
  trace.forEach(function(trace) {
    console.error(' -> ' + trace.file + ': ' + trace.line + (trace.function ? ' (in function "' + trace.function +'")' : ''));

  });
  phantom.exit(1);
};

page.open(system.args[1] + '/index.html', function(status) {
  if (status !== 'success') {
    phantom.exit(-127);
  }
});
