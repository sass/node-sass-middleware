var express = require('express');
var sassMiddleware = require('../../middleware');
var app = express();
var http = require('http');
var port = process.env.PORT || 8000;

app.use(sassMiddleware({
  src: __dirname,
  dest: __dirname,
  debug: true,
  outputStyle: 'compressed',
  beepOnError: true
}));

// Why a static middleware in test server?
// When testing locally, if the requested CSS resource
// was previously rendered by sassMiddleware, we recieve
// 404 when CWD is other than __dirname.
//
// Risk: if some test intermittently fails, or someone writes
// a new test skipping the cleanup code, the subsequent test
// will use the previously rendered content, which might result
// in false result.
//
// Based on the risk, making it optional:
// 'SASS_USE_STATIC_MIDDLEWARE=1 node path/to/test-server.js'
if (process.env.SASS_USE_STATIC_MIDDLEWARE) {
  app.use(express.static(__dirname));
}

http.createServer(app).listen(port);
