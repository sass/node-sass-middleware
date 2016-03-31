#node-sass-middleware

Connect/Express middleware for [node-sass](https://github.com/sass/node-sass).

[![Build Status](https://travis-ci.org/sass/node-sass-middleware.svg?branch=master&style=flat)](https://travis-ci.org/sass/node-sass-middleware)
[![npm version](https://badge.fury.io/js/node-sass-middleware.svg)](http://badge.fury.io/js/node-sass-middleware)
[![Dependency Status](https://david-dm.org/sass/node-sass-middleware.svg?theme=shields.io)](https://david-dm.org/sass/node-sass-middleware)
[![devDependency Status](https://david-dm.org/sass/node-sass-middleware/dev-status.svg?theme=shields.io)](https://david-dm.org/sass/node-sass-middleware#info=devDependencies)
[![Gitter chat](http://img.shields.io/badge/gitter-sass/node--sass-brightgreen.svg)](https://gitter.im/sass/node-sass)

## Install

    npm install node-sass-middleware

## Usage

Recompile `.scss` or `.sass` files automatically for connect and express based http servers.

### Connect example

```javascript
var connect = require('connect')
var sassMiddleware = require('node-sass-middleware')
var server = connect.createServer(
  sassMiddleware({
      /* Options */
      src: __dirname
    , dest: __dirname + '/public'
    , debug: true
    , outputStyle: 'compressed'
    , prefix:  '/prefix'  // Where prefix is at <link rel="stylesheets" href="prefix/style.css"/>
  }),
  connect.static('/prefix', __dirname + '/public')
);
```

There is an example connect app here: <https://github.com/andrew/node-sass-example>

Heavily inspired by <https://github.com/LearnBoost/stylus>

### Express example

```javascript
var express = require('express');
var sassMiddleware = require('node-sass-middleware');
var path = require('path');
var app = express();
app.use(sassMiddleware({
    /* Options */
    src: __dirname,
    dest: path.join(__dirname, 'public'),
    debug: true,
    outputStyle: 'compressed',
    prefix:  '/prefix'  // Where prefix is at <link rel="stylesheets" href="prefix/style.css"/>
}));
app.use(express.static(path.join(__dirname, 'public')));
```

### Connect with other middleware example

```javascript
var connect = require('connect');
var sassMiddleware = require('node-sass-middleware');
var postcssMiddleware = require('postcss-middleware');
var autoprefixer = require('autoprefixer');
var path = require('path');
var http = require('http');
var app = connect();
var destPath = __dirname + '/public';
app.use(sassMiddleware({
    /* Options */
    src: __dirname
  , response: false
  , dest: destPath
  , outputStyle: 'extended'
}));
app.use(postcssMiddleware({
  plugins: [
    /* Plugins */
    autoprefixer({
      /* Options */
    })
  ],
  src: function(req) {
    return path.join(destPath, req.url);
  }
}));

http.createServer(app).listen(3000);
```

### Options

 *    `src`            - (String) Source directory used to find `.scss` or `.sass` files.
 *    optional configurations:
  *    `dest`           - (String) Destination directory used to output `.css` files (when undefined defaults to `src`).
  *    `root`           - (String) A base path for both source and destination directories.
  *    `prefix`         - (String) It will tell the sass middleware that any request file will always be prefixed with `<prefix>` and this prefix should be ignored.
  *    `force`          - `[true | false]`, false by default. Always re-compile.
  *    `debug`          - `[true | false]`, false by default. Output debugging information.
  *    `indentedSyntax` - `[true | false]`, false by default. Compiles files with the `.sass` extension instead of `.scss` in the `src` directory.
  *    `response`       - `[true | false]`, true by default. To write output directly to response instead of to a file.
  *    `error`          - A function to be called when something goes wrong.
  *    `maxAge`         - MaxAge to be passed in Cache-Control header.


  For full list of options from original node-sass project go [here](https://github.com/sass/node-sass).

## Testing

    npm install mocha -g

    mocha test

## Contributors

We <3 our contributors! A special thanks to all those who have clocked in some dev time on this project, we really appreciate your hard work. You can find [a full list of those people here](https://github.com/sass/node-sass-middleware/graphs/contributors).

### Note on Patches/Pull Requests

 * Fork the project.
 * Make your feature addition or bug fix.
 * Add documentation if necessary.
 * Add tests for it. This is important so I don't break it in a future version unintentionally.
 * Send a pull request. Bonus points for topic branches.

## Copyright

Copyright (c) 2013+ Andrew Nesbitt. See [LICENSE](https://github.com/sass/node-sass-middleware/blob/master/LICENSE) for details.
