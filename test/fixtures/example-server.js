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

http.createServer(app).listen(port);
