# circus-handlebars

Implments Handlebars precompilation that is aware of Circus component dependencies when resolving helpers and partials.

## Usage

Used as a preprocessor for the `Circus.config` method:

```javascript
var Circus = require('circus'),
    CircusHandlebars = require('circus-handlebars');

var config = {};
config = CircusHandlebars.config(config);
config = Circus.config(config);
```

### Helpers

Helpers are implemented as simple CommonJS modules and circus-handlebars will handle registration of the helper, utilizing the filename.

```javascript
module.exports = function() {
  return 'Content';
};
```

Implements the most basic helper method.

### Programatically Loading Modules

Libraries that do not use a particular helper or partial directly may register the object via the `partial` and `helper` loaders.

```javascript
require('helper!./helpers/i18n');
require('partial!./footer');
```

Will register the `i18n` helper and `footer` partial for use in any dependent projects, without having to reference either directly in a template within the hosting component.


## Config Options

circus-handlebars defines optional config values on the `handlebars` config key. These are:

- `helpersDir`: Path to lookup helpers on. All javascript files within this directory are candidates for being automatically linked to helper candidate methods defined within templates. Defaults to `./src/lib/helpers`.
- `extension`: Extension used to resolve partial names. Defaults to `.hbs`.
- `knownHelpers`: an array of strings defining helpers that are registered via `registerHelper` manually by libraries that are loaded into the application.

